/**
 * 管理员审核企业账号API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { requireRole } from '@/lib/middleware/permissions';
import { reviewEnterpriseAccount } from '@/lib/enterprise/service';
import { UserRole } from '@/types/auth';
import type { EnterpriseReviewRequest } from '@/types/enterprise';
import { EnterpriseReviewAction, EnterpriseStatus } from '@/types/enterprise';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

// 有效的审核操作
const VALID_REVIEW_ACTIONS = Object.values(EnterpriseReviewAction);

// 状态转换规则：定义哪些状态下可以进行哪些操作
const VALID_STATUS_TRANSITIONS: Record<
  EnterpriseStatus,
  EnterpriseReviewAction[]
> = {
  [EnterpriseStatus.PENDING]: [
    EnterpriseReviewAction.APPROVE,
    EnterpriseReviewAction.REJECT,
  ],
  [EnterpriseStatus.UNDER_REVIEW]: [
    EnterpriseReviewAction.APPROVE,
    EnterpriseReviewAction.REJECT,
  ],
  [EnterpriseStatus.APPROVED]: [EnterpriseReviewAction.SUSPEND],
  [EnterpriseStatus.REJECTED]: [EnterpriseReviewAction.REACTIVATE],
  [EnterpriseStatus.SUSPENDED]: [
    EnterpriseReviewAction.REACTIVATE,
    EnterpriseReviewAction.REJECT,
  ],
  [EnterpriseStatus.EXPIRED]: [EnterpriseReviewAction.REACTIVATE],
};

/**
 * 验证审核请求
 */
async function validateReviewRequest(
  enterpriseId: string,
  reviewAction: string,
  reviewNotes: string | undefined
): Promise<{ valid: boolean; error?: string; status?: number }> {
  // 验证审核操作是否有效
  if (!VALID_REVIEW_ACTIONS.includes(reviewAction as EnterpriseReviewAction)) {
    return {
      valid: false,
      error: `无效的审核操作: ${reviewAction}。有效操作: ${VALID_REVIEW_ACTIONS.join(', ')}`,
      status: 400,
    };
  }

  // 验证审核备注长度（如果提供）
  if (reviewNotes !== undefined && reviewNotes !== null) {
    if (typeof reviewNotes !== 'string') {
      return {
        valid: false,
        error: '审核备注必须是字符串',
        status: 400,
      };
    }
    if (reviewNotes.length > 2000) {
      return {
        valid: false,
        error: '审核备注不能超过2000个字符',
        status: 400,
      };
    }
  }

  // 检查企业是否存在
  const enterprise = await prisma.enterpriseAccount.findUnique({
    where: { id: enterpriseId },
    select: {
      id: true,
      status: true,
      enterpriseName: true,
    },
  });

  if (!enterprise) {
    return {
      valid: false,
      error: '企业账号不存在',
      status: 404,
    };
  }

  // 验证状态转换是否合法
  const currentStatus = enterprise.status as EnterpriseStatus;
  const allowedActions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedActions.includes(reviewAction as EnterpriseReviewAction)) {
    return {
      valid: false,
      error: `无法执行操作: ${reviewAction}。当前状态 ${currentStatus} 只允许: ${allowedActions.join(', ') || '无'}`,
      status: 409,
    };
  }

  return { valid: true };
}

/**
 * 记录企业审核审计日志
 */
async function logEnterpriseReview(
  enterpriseId: string,
  reviewerId: string,
  action: EnterpriseReviewAction,
  notes: string | undefined,
  previousStatus: EnterpriseStatus,
  newStatus: EnterpriseStatus
): Promise<void> {
  try {
    await prisma.enterpriseReview.create({
      data: {
        enterpriseId,
        reviewerId,
        reviewAction: action,
        reviewNotes: notes || `状态变更: ${previousStatus} -> ${newStatus}`,
      },
    });

    // 同时记录到系统审计日志
    logger.info('企业审核操作', {
      enterpriseId,
      reviewerId,
      action,
      previousStatus,
      newStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('记录企业审核日志失败', {
      error,
      enterpriseId,
      reviewerId,
      action,
    });
    // 审计日志失败不应该影响业务流程，但应该记录错误
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 获取认证用户信息
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          message: '未登录',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 检查权限
    const hasPermission = requireRole(user.role, [
      UserRole.ADMIN,
      UserRole.SUPER_ADMIN,
    ]);
    if (!hasPermission) {
      return NextResponse.json(
        {
          success: false,
          message: '权限不足',
          error: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // 解析请求体
    let body: EnterpriseReviewRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: '请求体格式错误',
          error: 'INVALID_BODY',
        },
        { status: 400 }
      );
    }

    const { reviewAction, reviewNotes } = body;

    // 基本参数验证
    if (!reviewAction) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必要参数: reviewAction',
          error: 'MISSING_PARAMETER',
        },
        { status: 400 }
      );
    }

    const enterpriseId = (await params).id;

    // 验证请求
    const validation = await validateReviewRequest(
      enterpriseId,
      reviewAction,
      reviewNotes
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: validation.error,
          error: 'VALIDATION_ERROR',
        },
        { status: validation.status }
      );
    }

    // 获取当前企业状态用于审计日志
    const enterprise = await prisma.enterpriseAccount.findUnique({
      where: { id: enterpriseId },
      select: { status: true },
    });
    const previousStatus = enterprise?.status as EnterpriseStatus;

    // 执行审核
    const enterpriseAccount = await reviewEnterpriseAccount(
      enterpriseId,
      user.userId,
      reviewAction as EnterpriseReviewAction,
      reviewNotes
    );

    // 记录审计日志
    await logEnterpriseReview(
      enterpriseId,
      user.userId,
      reviewAction as EnterpriseReviewAction,
      reviewNotes,
      previousStatus,
      enterpriseAccount.status
    );

    return NextResponse.json({
      success: true,
      message: '审核完成',
      data: enterpriseAccount,
    });
  } catch (error) {
    logger.error('企业审核失败', { error });

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
          error: error.name,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: '服务器内部错误',
        error: 'INTERNAL_SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
