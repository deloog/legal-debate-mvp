/**
 * 待审批列表API
 * GET - 获取当前用户的待审批列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractApprovalService } from '@/lib/contract/contract-approval-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const currentUserId = authUser.userId;

    // 获取待审批列表（ContractApproval 含嵌套 steps）
    const rawApprovals =
      await contractApprovalService.getPendingApprovals(currentUserId);

    // 格式化为页面所需结构：每条记录对应当前用户待处理的一个 ApprovalStep
    const approvals = rawApprovals.flatMap(approval => {
      const pendingSteps = approval.steps.filter(
        step => step.approverId === currentUserId && step.status === 'PENDING'
      );
      return pendingSteps.map(step => ({
        id: step.id, // stepId，供 submit API 使用
        approvalId: approval.id,
        contractId: approval.contractId,
        contractTitle: approval.contract?.clientName ?? '合同审批',
        contractNo: approval.contract?.contractNumber,
        submittedAt: approval.createdAt,
        submittedBy: approval.createdBy,
        status: step.status,
        comment: step.comment,
      }));
    });

    // 获取审批统计
    const stats = await contractApprovalService.getApprovalStats(currentUserId);

    return NextResponse.json({
      success: true,
      data: {
        approvals,
        stats,
      },
    });
  } catch (error) {
    logger.error('获取待审批列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取待审批列表失败',
        },
      },
      { status: 500 }
    );
  }
}
