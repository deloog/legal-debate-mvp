import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { runDispatcher } from '@/lib/agent/proposal/dispatcher';
import { logger } from '@/lib/logger';

type Params = { params: Promise<{ id: string }> };

const RETRYABLE_STATUSES = ['FAILED', 'PARTIALLY_COMPLETED'] as const;

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  // 乐观锁：同时校验归属和可重试状态
  const { count } = await prisma.agentProposal.updateMany({
    where: { id, userId: user.userId, status: { in: RETRYABLE_STATUSES } },
    data: { status: 'EXECUTING' },
  });

  if (count === 0) {
    const existing = await prisma.agentProposal.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.userId) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '提案不存在' } },
        { status: 404 }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: `提案状态为 ${existing.status}，只有 FAILED / PARTIALLY_COMPLETED 状态可重试`,
        },
      },
      { status: 409 }
    );
  }

  // 将失败的 actions 重置为 PENDING（COMPLETED 的保留，dispatcher 会跳过）
  await prisma.proposalAction.updateMany({
    where: { proposalId: id, status: 'FAILED' },
    data: { status: 'PENDING', error: null },
  });

  void runDispatcher(id).catch(err => {
    logger.error(`retry: dispatcher 执行失败 proposalId=${id}`, err);
  });

  return NextResponse.json(
    { success: true, data: { proposalId: id, status: 'EXECUTING' } },
    { status: 200 }
  );
}
