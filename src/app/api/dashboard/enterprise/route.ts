/**
 * 企业法务工作台API路由
 * GET /api/dashboard/enterprise - 获取企业法务工作台数据
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import type {
  EnterpriseDashboardResponse,
  DashboardStats,
  RiskAlert,
  RecentContract,
  ComplianceStatus,
  UpcomingTask,
} from '@/types/dashboard';
import { logger } from '@/lib/logger';

/**
 * 计算合规评分
 * 基于高风险合同比例计算
 */
function calculateComplianceScore(
  totalContracts: number,
  highRiskContracts: number
): number {
  if (totalContracts === 0) {
    return 100; // 没有合同时返回满分
  }

  const riskRatio = highRiskContracts / totalContracts;
  const score = Math.max(0, Math.min(100, 100 - riskRatio * 100));

  return Math.round(score);
}

/**
 * 生成风险告警
 * 使用稳定ID（非Date.now()），确保同一状态下前端无闪烁去重问题
 */
function generateRiskAlerts(
  highRiskContracts: number,
  pendingReviewContracts: number
): RiskAlert[] {
  const alerts: RiskAlert[] = [];

  if (highRiskContracts > 0) {
    alerts.push({
      id: 'alert-high-risk',
      type: 'HIGH_RISK',
      title: '高风险合同待审查',
      description: `当前有 ${highRiskContracts} 份高风险合同需要审查`,
      severity: highRiskContracts > 5 ? 'CRITICAL' : 'HIGH',
      createdAt: new Date(),
    });
  }

  if (pendingReviewContracts > 10) {
    alerts.push({
      id: 'alert-pending-review',
      type: 'COMPLIANCE',
      title: '待审查合同积压',
      description: `当前有 ${pendingReviewContracts} 份合同待审查，请及时处理`,
      severity: 'MEDIUM',
      createdAt: new Date(),
    });
  }

  return alerts;
}

/**
 * GET /api/dashboard/enterprise
 * 获取企业法务工作台数据
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<EnterpriseDashboardResponse>> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      {
        success: false,
        error: '未授权',
      } as unknown as EnterpriseDashboardResponse,
      { status: 401 }
    );
  }

  try {
    const enterpriseAccount = await prisma.enterpriseAccount.findUnique({
      where: { userId: authUser.userId },
      select: { status: true },
    });

    if (!enterpriseAccount) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ENTERPRISE_ACCOUNT_NOT_FOUND',
            message: '未找到企业账号',
          },
        } as EnterpriseDashboardResponse,
        { status: 404 }
      );
    }

    if (enterpriseAccount.status !== 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ENTERPRISE_NOT_APPROVED',
            message: '企业认证尚未通过，暂不可访问企业工作台',
          },
        } as EnterpriseDashboardResponse,
        { status: 403 }
      );
    }

    // 1. 获取统计数据（仅限当前用户关联的数据）
    const [
      pendingReviewContracts,
      highRiskContracts,
      pendingTasks,
      totalContracts,
    ] = await Promise.all([
      // 待审查合同数（状态为PENDING，仅当前用户关联的案件）
      prisma.contract.count({
        where: {
          status: 'PENDING',
          case: { is: { userId: authUser.userId, deletedAt: null } },
        },
      }),
      // 高风险合同数：含有 HIGH 或 CRITICAL 级别条款风险的合同
      prisma.contract.count({
        where: {
          case: { is: { userId: authUser.userId, deletedAt: null } },
          clauseRisks: {
            some: { riskLevel: { in: ['HIGH', 'CRITICAL'] } },
          },
        },
      }),
      // 待处理任务数（仅当前用户创建或被分配的）
      prisma.task.count({
        where: {
          status: 'TODO',
          OR: [{ createdBy: authUser.userId }, { assignedTo: authUser.userId }],
        },
      }),
      // 总合同数（仅当前用户关联的案件）
      prisma.contract.count({
        where: {
          case: { is: { userId: authUser.userId, deletedAt: null } },
        },
      }),
    ]);

    // 计算合规评分
    const complianceScore = calculateComplianceScore(
      totalContracts,
      highRiskContracts
    );

    const stats: DashboardStats = {
      pendingReviewContracts,
      highRiskContracts,
      complianceScore,
      pendingTasks,
    };

    // 2. 生成风险告警
    const riskAlerts = generateRiskAlerts(
      highRiskContracts,
      pendingReviewContracts
    );

    // 3. 获取最近审查的合同（最多5条，仅当前用户关联案件）
    const recentContractsData = await prisma.contract.findMany({
      where: {
        case: { is: { userId: authUser.userId, deletedAt: null } },
        status: {
          in: ['SIGNED', 'EXECUTING', 'COMPLETED'],
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
      select: {
        id: true,
        contractNumber: true,
        clientName: true,
        caseType: true,
        status: true,
        totalFee: true,
        updatedAt: true,
      },
    });

    const recentContracts: RecentContract[] = recentContractsData.map(
      contract => ({
        id: contract.id,
        contractNumber: contract.contractNumber,
        clientName: contract.clientName,
        caseType: contract.caseType,
        status: contract.status,
        totalFee: Number(contract.totalFee),
        reviewedAt: contract.updatedAt,
      })
    );

    // 4. 合规状态：仅当前用户企业的合规检查记录
    const [totalChecks, passedChecks, failedChecks] = await Promise.all([
      prisma.enterpriseComplianceCheck.count({
        where: { enterprise: { userId: authUser.userId } },
      }),
      prisma.enterpriseComplianceCheck.count({
        where: {
          checkResult: 'COMPLIANT',
          enterprise: { userId: authUser.userId },
        },
      }),
      prisma.enterpriseComplianceCheck.count({
        where: {
          checkResult: 'NON_COMPLIANT',
          enterprise: { userId: authUser.userId },
        },
      }),
    ]);

    const complianceStatus: ComplianceStatus = {
      totalChecks,
      passedChecks,
      failedChecks,
      score: complianceScore,
    };

    // 5. 获取即将到期的任务（最多5条，仅当前用户创建或被分配的）
    const upcomingTasksData = await prisma.task.findMany({
      where: {
        OR: [{ createdBy: authUser.userId }, { assignedTo: authUser.userId }],
        status: {
          in: ['TODO', 'IN_PROGRESS'],
        },
        dueDate: {
          gte: new Date(),
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7天内
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: 5,
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        status: true,
      },
    });

    const upcomingTasks: UpcomingTask[] = upcomingTasksData.map(task => ({
      id: task.id,
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate!,
      priority: task.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
      status: task.status as 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED',
    }));

    // 6. 返回数据
    return NextResponse.json({
      success: true,
      data: {
        stats,
        riskAlerts,
        recentContracts,
        complianceStatus,
        upcomingTasks,
      },
    });
  } catch (error) {
    logger.error('获取企业法务工作台数据失败:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取工作台数据失败',
        },
      },
      { status: 500 }
    );
  }
}
