/**
 * 撤回审批API
 * POST - 撤回审批流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractApprovalService } from '@/lib/contract/contract-approval-service';
import { getCurrentUserId } from '@/lib/auth/get-current-user';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const cancelApprovalSchema = z.object({
  approvalId: z.string(),
});

export async function POST(
  request: NextRequest,
  _context: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // 验证请求数据
    const validatedData = cancelApprovalSchema.parse(body);

    // 从session获取当前用户ID
    const currentUserId = await getCurrentUserId();

    // 撤回审批
    await contractApprovalService.cancelApproval(
      validatedData.approvalId,
      currentUserId
    );

    return NextResponse.json({
      success: true,
      message: '审批已撤回',
    });
  } catch (error) {
    logger.error('撤回审批失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据格式错误',
            details: error.issues,
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '撤回审批失败',
        },
      },
      { status: 500 }
    );
  }
}
