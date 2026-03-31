/**
 * 撤回审批API
 * POST - 撤回审批流程
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  contractApprovalService,
  ApprovalStateMachineError,
} from '@/lib/contract/contract-approval-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const cancelApprovalSchema = z.object({
  approvalId: z.string(),
});

export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  try {
    // 通过 JWT Bearer 或 cookie 获取当前用户
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    // 验证请求数据
    const validatedData = cancelApprovalSchema.parse(body);

    // 撤回审批
    await contractApprovalService.cancelApproval(
      validatedData.approvalId,
      user.userId
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

    // 状态机错误
    if (error instanceof ApprovalStateMachineError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATE',
            message: error.message,
          },
        },
        { status: 409 }
      );
    }

    // 权限错误
    if (
      error instanceof Error &&
      error.message.includes('只有发起人可以撤回')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: error.message,
          },
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '撤回审批失败',
        },
      },
      { status: 500 }
    );
  }
}
