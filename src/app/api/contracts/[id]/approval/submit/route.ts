/**
 * 提交审批意见API
 * POST - 提交审批决定和意见
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractApprovalService } from '@/lib/contract/contract-approval-service';
import { z } from 'zod';

const submitApprovalSchema = z.object({
  stepId: z.string(),
  decision: z.enum(['APPROVE', 'REJECT', 'RETURN']),
  comment: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    // 验证请求数据
    const validatedData = submitApprovalSchema.parse(body);

    // TODO: 从session获取当前用户ID
    const currentUserId = 'current-user-id';

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
    console.error('提交审批失败:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: '请求数据格式错误',
            details: error.errors,
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
          message: error instanceof Error ? error.message : '提交审批失败',
        },
      },
      { status: 500 }
    );
  }
}
