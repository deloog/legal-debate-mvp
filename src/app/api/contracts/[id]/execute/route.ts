/**
 * POST /api/contracts/[id]/execute
 * 启动合同履行（SIGNED → EXECUTING）
 * 仅合同归属律师可操作，且合同必须处于 SIGNED 状态
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit/logger';
import { contractVersionService } from '@/lib/contract/contract-version-service';
import {
  resolveContractUserId,
  unauthorizedResponse,
  forbiddenResponse,
} from '@/app/api/lib/middleware/contract-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const currentUserId = resolveContractUserId(request);
  if (!currentUserId) return unauthorizedResponse();

  try {
    const { id } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { id: true, lawyerId: true, status: true, contractNumber: true },
    });

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: '合同不存在' },
        },
        { status: 404 }
      );
    }

    // 仅合同归属律师可以启动履行
    if (contract.lawyerId !== currentUserId) {
      return forbiddenResponse('只有合同归属律师才能启动履行');
    }

    // 状态机：只有 SIGNED 可进入 EXECUTING
    if (contract.status !== 'SIGNED') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `合同当前状态（${contract.status}）不允许启动履行，需处于已签署（SIGNED）状态`,
          },
        },
        { status: 409 }
      );
    }

    await prisma.contract.update({
      where: { id },
      data: { status: 'EXECUTING' },
    });

    contractVersionService
      .createVersion(id, 'UPDATE', currentUserId)
      .catch(error => {
        logger.error('创建合同履行版本失败:', error);
      });

    createAuditLog({
      userId: currentUserId,
      actionType: 'UNKNOWN',
      actionCategory: 'DOCUMENT',
      description: `合同启动履行：${contract.contractNumber}`,
      resourceType: 'Contract',
      resourceId: id,
      metadata: { previousStatus: 'SIGNED', newStatus: 'EXECUTING' },
    }).catch(err => logger.error('合同履行审计日志记录失败:', err));

    return NextResponse.json({
      success: true,
      message: '合同已进入履行阶段',
      data: { id, status: 'EXECUTING' },
    });
  } catch (error) {
    logger.error('启动合同履行失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '操作失败，请稍后重试' },
      },
      { status: 500 }
    );
  }
}
