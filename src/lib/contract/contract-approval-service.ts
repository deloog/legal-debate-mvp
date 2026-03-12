/**
 * 合同审批服务
 * 实现合同审批工作流，支持多级审批、审批意见、审批历史
 * 包含状态机合法性验证和并发控制
 */

import { prisma } from '@/lib/db';
import { ApprovalStatus, StepStatus, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

export type ApproverStep = {
  stepNumber: number;
  approverRole: string;
  approverId?: string;
  approverName?: string;
};

export interface StartApprovalInput {
  contractId: string;
  templateId?: string;
  createdBy: string;
  approvers?: ApproverStep[];
}

/**
 * 类型守卫：检查 Json 值是否为有效的审批步骤数组
 */
function isApproverStepsArray(
  value: Prisma.JsonValue
): value is ApproverStep[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    item =>
      typeof item === 'object' &&
      item !== null &&
      'stepNumber' in item &&
      'approverRole' in item &&
      typeof item.stepNumber === 'number' &&
      typeof item.approverRole === 'string'
  );
}

export interface SubmitApprovalInput {
  stepId: string;
  approverId: string;
  decision: 'APPROVE' | 'REJECT' | 'RETURN';
  comment?: string;
}

export interface ApprovalInfo {
  id: string;
  contractId: string;
  status: ApprovalStatus;
  currentStep: number;
  createdBy: string;
  createdAt: Date;
  completedAt?: Date | null;
  steps: Array<{
    id: string;
    stepNumber: number;
    approverRole: string;
    approverId?: string | null;
    approverName?: string | null;
    status: StepStatus;
    decision?: string | null;
    comment?: string | null;
    completedAt?: Date | null;
  }>;
  contract: {
    contractNumber: string;
    clientName: string;
    totalFee: Prisma.Decimal;
  };
}

/**
 * 审批状态机验证错误
 */
export class ApprovalStateMachineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApprovalStateMachineError';
  }
}

/**
 * 并发冲突错误
 */
export class ConcurrentApprovalError extends Error {
  constructor(message: string = '审批已被其他用户处理') {
    super(message);
    this.name = 'ConcurrentApprovalError';
  }
}

export class ContractApprovalService {
  /**
   * 发起审批
   * 使用数据库唯一约束防止并发创建多个审批流程
   */
  async startApproval(input: StartApprovalInput): Promise<string> {
    const { contractId, templateId, createdBy, approvers } = input;

    // 检查合同是否存在
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new Error('合同不存在');
    }

    // 获取审批步骤配置
    let approvalSteps = approvers;

    if (!approvalSteps && templateId) {
      const template = await prisma.approvalTemplate.findUnique({
        where: { id: templateId },
      });

      if (template && template.steps) {
        if (isApproverStepsArray(template.steps)) {
          approvalSteps = template.steps;
        } else {
          throw new Error('审批模板步骤格式不正确');
        }
      }
    }

    if (!approvalSteps || approvalSteps.length === 0) {
      throw new Error('审批步骤配置不能为空');
    }

    // 使用事务确保原子性：检查现有审批 + 创建新审批
    try {
      const result = await prisma.$transaction(
        async tx => {
          // 在事务内检查是否已有进行中的审批（防止并发创建）
          const existingApproval = await tx.contractApproval.findFirst({
            where: {
              contractId,
              status: {
                in: [ApprovalStatus.PENDING, ApprovalStatus.IN_PROGRESS],
              },
            },
          });

          if (existingApproval) {
            throw new Error('该合同已有进行中的审批流程');
          }

          // 创建审批记录
          const approval = await tx.contractApproval.create({
            data: {
              contractId,
              templateId,
              status: ApprovalStatus.IN_PROGRESS,
              currentStep: 1,
              createdBy,
              steps: {
                create: approvalSteps!.map(step => ({
                  stepNumber: step.stepNumber,
                  approverRole: step.approverRole,
                  approverId: step.approverId,
                  approverName: step.approverName,
                  status: StepStatus.PENDING,
                })),
              },
            },
          });

          return approval.id;
        },
        {
          // 使用 Serializable 隔离级别防止幻读
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        }
      );

      return result;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('已有进行中的审批')
      ) {
        throw error;
      }
      logger.error('发起审批事务失败:', error);
      throw new Error('发起审批失败，请重试');
    }
  }

  /**
   * 提交审批意见
   * 包含状态机合法性验证和并发控制（乐观锁）
   */
  async submitApproval(input: SubmitApprovalInput): Promise<void> {
    const { stepId, approverId, decision, comment } = input;

    // 使用事务确保原子性
    await prisma.$transaction(
      async tx => {
        // 1. 获取审批步骤（加锁查询）
        const step = await tx.approvalStep.findUnique({
          where: { id: stepId },
          include: {
            approval: {
              include: {
                steps: {
                  orderBy: { stepNumber: 'asc' },
                },
              },
            },
          },
        });

        if (!step) {
          throw new ApprovalStateMachineError('审批步骤不存在');
        }

        // 2. 验证审批流程状态
        const approval = step.approval;
        if (
          approval.status !== ApprovalStatus.IN_PROGRESS &&
          approval.status !== ApprovalStatus.PENDING
        ) {
          throw new ApprovalStateMachineError(
            `审批流程已${this.getStatusText(approval.status)}，无法提交审批意见`
          );
        }

        // 3. 验证当前步骤是否为流程的当前步骤
        const currentStepNumber = approval.currentStep;
        if (step.stepNumber !== currentStepNumber) {
          throw new ApprovalStateMachineError(
            `当前审批步骤为第${currentStepNumber}步，此步骤暂时无法审批`
          );
        }

        // 4. 验证步骤状态（乐观锁检查）
        if (step.status !== StepStatus.PENDING) {
          throw new ConcurrentApprovalError('该步骤已被其他审批人处理');
        }

        // 5. 验证审批人权限
        if (step.approverId && step.approverId !== approverId) {
          throw new ApprovalStateMachineError('无权审批此步骤');
        }

        // 6. 验证决策合法性
        if (!['APPROVE', 'REJECT', 'RETURN'].includes(decision)) {
          throw new ApprovalStateMachineError('无效的审批决策');
        }

        // 7. 状态机转换
        const newStepStatus =
          decision === 'APPROVE'
            ? StepStatus.APPROVED
            : decision === 'REJECT'
              ? StepStatus.REJECTED
              : StepStatus.RETURNED;

        // 8. 更新步骤状态（原子操作）
        await tx.approvalStep.update({
          where: {
            id: stepId,
            // 乐观锁：确保状态仍然是 PENDING
            status: StepStatus.PENDING,
          },
          data: {
            status: newStepStatus,
            decision,
            comment,
            approverId,
            completedAt: new Date(),
          },
        });

        // 9. 更新审批记录状态和合同状态
        const allSteps = approval.steps;

        if (decision === 'REJECT') {
          // 拒绝：整个审批流程结束
          await tx.contractApproval.update({
            where: { id: approval.id },
            data: {
              status: ApprovalStatus.REJECTED,
              completedAt: new Date(),
            },
          });

          // 更新合同状态为已拒绝
          await tx.contract.update({
            where: { id: approval.contractId },
            data: { status: 'REJECTED' },
          });
        } else if (decision === 'RETURN') {
          // 退回：将审批状态改为已退回
          await tx.contractApproval.update({
            where: { id: approval.id },
            data: {
              status: ApprovalStatus.RETURNED,
              completedAt: new Date(),
            },
          });

          // 更新合同状态为草稿（可重新编辑）
          await tx.contract.update({
            where: { id: approval.contractId },
            data: { status: 'DRAFT' },
          });
        } else if (decision === 'APPROVE') {
          // 通过：检查是否还有下一步
          const nextStep = allSteps.find(
            s => s.stepNumber === step.stepNumber + 1
          );

          if (nextStep) {
            // 还有下一步，更新当前步骤
            await tx.contractApproval.update({
              where: { id: approval.id },
              data: {
                currentStep: nextStep.stepNumber,
              },
            });
          } else {
            // 所有步骤都通过，审批完成
            await tx.contractApproval.update({
              where: { id: approval.id },
              data: {
                status: ApprovalStatus.APPROVED,
                completedAt: new Date(),
              },
            });

            // 更新合同状态为待签署
            await tx.contract.update({
              where: { id: approval.contractId },
              data: {
                status: 'PENDING',
              },
            });
          }
        }
      },
      {
        // 使用 Repeatable Read 隔离级别
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      }
    );
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: ApprovalStatus): string {
    const statusMap: Record<ApprovalStatus, string> = {
      [ApprovalStatus.PENDING]: '待处理',
      [ApprovalStatus.IN_PROGRESS]: '进行中',
      [ApprovalStatus.APPROVED]: '已通过',
      [ApprovalStatus.REJECTED]: '已拒绝',
      [ApprovalStatus.RETURNED]: '已退回',
      [ApprovalStatus.CANCELLED]: '已取消',
    };
    return statusMap[status] || status;
  }

  /**
   * 获取待审批列表
   */
  async getPendingApprovals(userId: string): Promise<ApprovalInfo[]> {
    const approvals = await prisma.contractApproval.findMany({
      where: {
        status: ApprovalStatus.IN_PROGRESS,
        steps: {
          some: {
            approverId: userId,
            status: StepStatus.PENDING,
          },
        },
      },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        contract: {
          select: {
            contractNumber: true,
            clientName: true,
            totalFee: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return approvals as unknown as ApprovalInfo[];
  }

  /**
   * 获取审批详情
   */
  async getApprovalDetail(approvalId: string): Promise<ApprovalInfo | null> {
    const approval = await prisma.contractApproval.findUnique({
      where: { id: approvalId },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        contract: {
          select: {
            contractNumber: true,
            clientName: true,
            totalFee: true,
            caseType: true,
            caseSummary: true,
            scope: true,
            feeType: true,
          },
        },
      },
    });

    return approval as unknown as ApprovalInfo | null;
  }

  /**
   * 获取合同的审批历史
   */
  async getContractApprovals(contractId: string): Promise<ApprovalInfo[]> {
    const approvals = await prisma.contractApproval.findMany({
      where: { contractId },
      include: {
        steps: {
          orderBy: { stepNumber: 'asc' },
        },
        contract: {
          select: {
            contractNumber: true,
            clientName: true,
            totalFee: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return approvals as unknown as ApprovalInfo[];
  }

  /**
   * 撤回审批
   */
  async cancelApproval(approvalId: string, userId: string): Promise<void> {
    await prisma.$transaction(async tx => {
      const approval = await tx.contractApproval.findUnique({
        where: { id: approvalId },
      });

      if (!approval) {
        throw new Error('审批记录不存在');
      }

      // 只有发起人可以撤回
      if (approval.createdBy !== userId) {
        throw new Error('只有发起人可以撤回审批');
      }

      // 只能撤回进行中的审批
      if (
        approval.status !== ApprovalStatus.PENDING &&
        approval.status !== ApprovalStatus.IN_PROGRESS
      ) {
        throw new Error('只能撤回进行中的审批');
      }

      // 更新审批状态
      await tx.contractApproval.update({
        where: { id: approvalId },
        data: {
          status: ApprovalStatus.CANCELLED,
          completedAt: new Date(),
        },
      });

      // 更新所有待审批的步骤为已跳过
      await tx.approvalStep.updateMany({
        where: {
          approvalId,
          status: StepStatus.PENDING,
        },
        data: {
          status: StepStatus.SKIPPED,
        },
      });

      // 更新合同状态为草稿
      await tx.contract.update({
        where: { id: approval.contractId },
        data: { status: 'DRAFT' },
      });
    });
  }

  /**
   * 获取审批统计
   */
  async getApprovalStats(userId: string) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [pending, approvedToday, rejectedToday, totalHandled] =
      await Promise.all([
        // 待审批数量
        prisma.contractApproval.count({
          where: {
            status: ApprovalStatus.IN_PROGRESS,
            steps: {
              some: {
                approverId: userId,
                status: StepStatus.PENDING,
              },
            },
          },
        }),
        // 今日通过数量
        prisma.approvalStep.count({
          where: {
            approverId: userId,
            status: StepStatus.APPROVED,
            completedAt: { gte: todayStart },
          },
        }),
        // 今日拒绝数量
        prisma.approvalStep.count({
          where: {
            approverId: userId,
            status: StepStatus.REJECTED,
            completedAt: { gte: todayStart },
          },
        }),
        // 累计处理数量
        prisma.approvalStep.count({
          where: {
            approverId: userId,
            status: { in: [StepStatus.APPROVED, StepStatus.REJECTED] },
          },
        }),
      ]);

    return { pending, approvedToday, rejectedToday, totalHandled };
  }
}

// 导出单例
export const contractApprovalService = new ContractApprovalService();
