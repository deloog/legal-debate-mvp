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
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const submitApprovalSchema = z.object({
  stepId: z.string(),
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN']),
  comment: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
    const validatedData = submitApprovalSchema.parse(body);

    // 验证 stepId 属于该合同，且当前用户是该步骤的指定审批人
    const { id: contractId } = await context.params;
    const step = await prisma.approvalStep.findFirst({
      where: {
        id: validatedData.stepId,
        approverId: user.userId, // 只有指定审批人才能提交
        approval: { contractId },
      },
      select: { id: true },
    });
    if (!step) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: '审批步骤不存在、不属于该合同，或您不是该步骤的指定审批人',
          },
        },
        { status: 403 }
      );
    }

    // 提交审批
    await contractApprovalService.submitApproval({
      stepId: validatedData.stepId,
      approverId: user.userId,
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
          message: '提交审批失败',
        },
      },
      { status: 500 }
    );
  }
}
