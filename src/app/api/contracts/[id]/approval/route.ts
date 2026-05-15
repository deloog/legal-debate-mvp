/**
 * 合同审批API
 * GET - 获取合同审批信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractApprovalService } from '@/lib/contract/contract-approval-service';
import { logger } from '@/lib/logger';
import {
  getContractAccess,
  resolveContractUserId,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/app/api/lib/middleware/contract-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const contractId = (await params).id;
    const access = await getContractAccess(contractId, userId);

    if (!access.exists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '合同不存在',
          },
        },
        { status: 404 }
      );
    }

    if (!access.canManage) {
      return forbiddenResponse('无权访问此合同审批');
    }

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
          message: '获取审批信息失败',
        },
      },
      { status: 500 }
    );
  }
}
