/**
 * 待审批列表API
 * GET - 获取当前用户的待审批列表
 */

import { NextResponse } from 'next/server';
import { contractApprovalService } from '@/lib/contract/contract-approval-service';

export async function GET() {
  try {
    // TODO: 从session获取当前用户ID
    const currentUserId = 'current-user-id';

    // 获取待审批列表
    const approvals =
      await contractApprovalService.getPendingApprovals(currentUserId);

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
    console.error('获取待审批列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message:
            error instanceof Error ? error.message : '获取待审批列表失败',
        },
      },
      { status: 500 }
    );
  }
}
