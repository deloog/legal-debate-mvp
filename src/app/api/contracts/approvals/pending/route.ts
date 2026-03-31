/**
 * 待审批合同列表 API
 * GET /api/contracts/approvals/pending
 * 返回当前用户提交的（createdBy）处于进行中状态的审批列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  resolveContractUserId,
  unauthorizedResponse,
} from '@/app/api/lib/middleware/contract-auth';

export async function GET(request: NextRequest) {
  const userId = resolveContractUserId(request);
  if (!userId) return unauthorizedResponse();

  try {
    const approvals = await prisma.contractApproval.findMany({
      where: {
        // createdBy 匹配：当前用户发起的审批
        // contract.lawyerId 匹配：当前用户是合同律师（兜底）
        OR: [{ createdBy: userId }, { contract: { lawyerId: userId } }],
        status: { in: ['IN_PROGRESS', 'PENDING'] },
      },
      include: {
        contract: {
          select: {
            contractNumber: true,
            clientName: true,
            caseType: true,
            totalFee: true,
            lawyerName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = approvals.map(a => ({
      id: a.id,
      contractId: a.contractId,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
      contract: {
        contractNumber: a.contract.contractNumber,
        clientName: a.contract.clientName,
        caseType: a.contract.caseType,
        totalFee: Number(a.contract.totalFee),
        lawyerName: a.contract.lawyerName ?? '',
      },
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('获取待审批列表失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '获取待审批列表失败',
        },
      },
      { status: 500 }
    );
  }
}
