/**
 * 发起合同审批API
 * POST - 发起审批流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractApprovalService } from '@/lib/contract/contract-approval-service';
import { z } from 'zod';

const startApprovalSchema = z.object({
  templateId: z.string().optional(),
  createdBy: z.string(),
  approvers: z
    .array(
      z.object({
        stepNumber: z.number(),
        approverRole: z.string(),
        approverId: z.string().optional(),
        approverName: z.string().optional(),
      })
    )
    .optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id;
    const body = await request.json();

    // 验证请求数据
    const validatedData = startApprovalSchema.parse(body);

    // 发起审批
    const approvalId = await contractApprovalService.startApproval({
      contractId,
      ...validatedData,
    });

    return NextResponse.json({
      success: true,
      data: {
        approvalId,
      },
      message: '审批流程已发起',
    });
  } catch (error) {
    console.error('发起审批失败:', error);

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
          message: error instanceof Error ? error.message : '发起审批失败',
        },
      },
      { status: 500 }
    );
  }
}
