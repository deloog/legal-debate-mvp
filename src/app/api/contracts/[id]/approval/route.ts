/**
 * 合同审批API
 * GET - 获取合同审批信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractApprovalService } from '@/lib/contract/contract-approval-service';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;

    // 获取合同的最新审批记录
    const approvals =
      await contractApprovalService.getContractApprovals(contractId);

    if (!approvals || approvals.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '未找到审批记录',
          },
        },
        { status: 404 }
      );
    }

    // 返回最新的审批记录
    const latestApproval = approvals[0];

    return NextResponse.json({
      success: true,
      data: latestApproval,
    });
  } catch (error) {
    logger.error('获取审批信息失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '获取审批信息失败',
        },
      },
      { status: 500 }
    );
  }
}
