/**
 * 合同审批服务
 * 实现合同审批工作流，支持多级审批、审批意见、审批历史
 */

import { prisma } from '@/lib/prisma';
import { ApprovalStatus, StepStatus } from '@prisma/client';

export interface StartApprovalInput {
  contractId: string;
  templateId?: string;
  createdBy: string;
  approvers?: Array<{
    stepNumber: number;
    approverRole: string;
    approverId?: string;
    approverName?: string;
  }>;
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
    totalFee: any;
  };
}

export class ContractApprovalService {
  /**
   * 发起审批
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

    // 检查是否已有进行中的审批
    const existingApproval = await prisma.contractApproval.findFirst({
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

    // 获取审批步骤配置
    let approvalSteps = approvers;

    if (!approvalSteps && templateId) {
      // 从模板加载审批步骤
      const template = await prisma.approvalTemplate.findUnique({
        where: { id: templateId },
      });

      if (template && template.steps) {
        approvalSteps = template.steps as any;
      }
    }

    if (!approvalSteps || approvalSteps.length === 0) {
      throw new Error('审批步骤配置不能为空');
    }

    // 创建审批记录
    const approval = await prisma.contractApproval.create({
      data: {
        contractId,
        templateId,
        status: ApprovalStatus.IN_PROGRESS,
        currentStep: 1,
        createdBy,
        steps: {
          create: approvalSteps.map(step => ({
            stepNumber: step.stepNumber,
            approverRole: step.approverRole,
            approverId: step.approverId,
            approverName: step.approverName,
            status:
              step.stepNumber === 1 ? StepStatus.PENDING : StepStatus.PENDING,
          })),
        },
      },
    });

    return approval.id;
  }

  /**
   * 提交审批意见
   */
  async submitApproval(input: SubmitApprovalInput): Promise<void> {
    const { stepId, approverId, decision, comment } = input;

    // 获取审批步骤
    const step = await prisma.approvalStep.findUnique({
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
      throw new Error('审批步骤不存在');
    }

    // 检查审批人权限
    if (step.approverId && step.approverId !== approverId) {
      throw new Error('无权审批此步骤');
    }

    // 检查步骤状态
    if (step.status !== StepStatus.PENDING) {
      throw new Error('该步骤已完成审批');
    }

    // 更新步骤状态
    const newStepStatus =
      decision === 'APPROVE'
        ? StepStatus.APPROVED
        : decision === 'REJECT'
          ? StepStatus.REJECTED
          : StepStatus.PENDING;

    await prisma.approvalStep.update({
      where: { id: stepId },
      data: {
        status: newStepStatus,
        decision,
        comment,
        approverId,
        completedAt: new Date(),
      },
    });

    // 更新审批记录状态
    const approval = step.approval;
    const allSteps = approval.steps;

    if (decision === 'REJECT') {
      // 拒绝：整个审批流程结束
      await prisma.contractApproval.update({
        where: { id: approval.id },
        data: {
          status: ApprovalStatus.REJECTED,
          completedAt: new Date(),
        },
      });
    } else if (decision === 'APPROVE') {
      // 通过：检查是否还有下一步
      const currentStepNumber = step.stepNumber;
      const nextStep = allSteps.find(
        s => s.stepNumber === currentStepNumber + 1
      );

      if (nextStep) {
        // 还有下一步，更新当前步骤
        await prisma.contractApproval.update({
          where: { id: approval.id },
          data: {
            currentStep: nextStep.stepNumber,
          },
        });
      } else {
        // 所有步骤都通过，审批完成
        await prisma.contractApproval.update({
          where: { id: approval.id },
          data: {
            status: ApprovalStatus.APPROVED,
            completedAt: new Date(),
          },
        });

        // 更新合同状态
        await prisma.contract.update({
          where: { id: approval.contractId },
          data: {
            status: 'PENDING', // 审批通过后，合同状态变为待签署
          },
        });
      }
    }
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

    return approvals as any;
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

    return approval as any;
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

    return approvals as any;
  }

  /**
   * 撤回审批
   */
  async cancelApproval(approvalId: string, userId: string): Promise<void> {
    const approval = await prisma.contractApproval.findUnique({
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
    await prisma.contractApproval.update({
      where: { id: approvalId },
      data: {
        status: ApprovalStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    // 更新所有待审批的步骤为已跳过
    await prisma.approvalStep.updateMany({
      where: {
        approvalId,
        status: StepStatus.PENDING,
      },
      data: {
        status: StepStatus.SKIPPED,
      },
    });
  }

  /**
   * 获取审批统计
   */
  async getApprovalStats(userId: string) {
    const [pending, approved, rejected] = await Promise.all([
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
      // 已通过数量
      prisma.approvalStep.count({
        where: {
          approverId: userId,
          status: StepStatus.APPROVED,
        },
      }),
      // 已拒绝数量
      prisma.approvalStep.count({
        where: {
          approverId: userId,
          status: StepStatus.REJECTED,
        },
      }),
    ]);

    return {
      pending,
      approved,
      rejected,
      total: approved + rejected,
    };
  }
}

// 导出单例
export const contractApprovalService = new ContractApprovalService();
