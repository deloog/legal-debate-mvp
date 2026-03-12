/**
 * 提交审批意见API
 * POST - 提交审批决定和意见
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  contractApprovalService,
  ApprovalStateMachineError,
  ConcurrentApprovalError,
} from '@/lib/contract/contract-approval-service';
import { getCurrentUserId } from '@/lib/auth/get-current-user';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const submitApprovalSchema = z.object({
  stepId: z.string(),
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN']),
  comment: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();

    // 验证请求数据
    const validatedData = submitApprovalSchema.parse(body);

    // 从session获取当前用户ID
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '请先登录',
          },
        },
        { status: 401 }
      );
    }

    // 提交审批
    await contractApprovalService.submitApproval({
      stepId: validatedData.stepId,
      approverId: currentUserId,
      decision: validatedData.decision,
      comment: validatedData.comment,
    });

    return NextResponse.json({
      success: true,
      message: '审批意见已提交',
    });
  } catch (error) {
    logger.error('提交审批失败:', error);

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

    // 并发冲突错误
    if (error instanceof ConcurrentApprovalError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONCURRENT_MODIFICATION',
            message: error.message,
          },
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '提交审批失败',
        },
      },
      { status: 500 }
    );
  }
}
