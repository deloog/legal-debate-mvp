/**
 * 发起合同审批API
 * POST - 发起审批流程
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractApprovalService } from '@/lib/contract/contract-approval-service';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import {
  resolveContractUserId,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/app/api/lib/middleware/contract-auth';

// createdBy 不再从请求体读取，由 JWT token 提供
const startApprovalSchema = z.object({
  templateId: z.string().optional(),
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
  { params }: { params: Promise<{ id: string }> }
) {
  // ─── 认证 ─────────────────────────────────────────────────────────────────
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const contractId = (await params).id;
    const body = await request.json();

    // 验证请求数据
    const validatedData = startApprovalSchema.parse(body);

    // ─── 合同存在性 + 所有权 + 状态检查 ─────────────────────────────────────
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, lawyerId: true, status: true },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CONTRACT_NOT_FOUND', message: '合同不存在' },
        },
        { status: 404 }
      );
    }

    if (contract.lawyerId !== userId) {
      return forbiddenResponse();
    }

    if (contract.status !== 'DRAFT') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `只有草稿状态的合同可以发起审批，当前状态：${contract.status}`,
          },
        },
        { status: 400 }
      );
    }

    // 发起审批（createdBy 使用来自 JWT 的 userId）
    const approvalId = await contractApprovalService.startApproval({
      contractId,
      createdBy: userId,
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
    logger.error('发起审批失败:', error);

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
          message: '发起审批失败',
        },
      },
      { status: 500 }
    );
  }
}
