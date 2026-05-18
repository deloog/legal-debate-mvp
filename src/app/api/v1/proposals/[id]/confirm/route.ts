import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { runDispatcher } from '@/lib/agent/proposal/dispatcher';
import { logger } from '@/lib/logger';
import type { ConfirmProposalBody } from '@/types/proposal';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  let body: ConfirmProposalBody;
  try {
    body = (await request.json()) as ConfirmProposalBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: '请求体格式错误' },
      },
      { status: 400 }
    );
  }

  // 乐观锁：同时校验归属和状态，防止并发双击
  const { count } = await prisma.agentProposal.updateMany({
    where: { id, userId: user.userId, status: 'PENDING' },
    data: {
      status: 'EXECUTING',
      confirmedAt: new Date(),
      confirmedById: user.userId,
      confirmedData: body.confirmedData ?? undefined,
    },
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
          message: `提案当前状态为 ${existing.status}，无法重复确认`,
        },
      },
      { status: 409 }
    );
  }

  // 按 selectedActionIds 更新勾选状态
  if (Array.isArray(body.selectedActionIds)) {
    const allActions = await prisma.proposalAction.findMany({
      where: { proposalId: id },
      select: { id: true },
    });

    const selectedSet = new Set(body.selectedActionIds);
    await Promise.all(
      allActions.map(a =>
        prisma.proposalAction.update({
          where: { id: a.id },
          data: {
            selected: selectedSet.has(a.id),
            status: selectedSet.has(a.id) ? 'PENDING' : 'SKIPPED',
          },
        })
      )
    );
  }

  // 事务外异步执行 dispatcher，不阻塞响应
  void runDispatcher(id).catch(err => {
    logger.error(`confirm: dispatcher 执行失败 proposalId=${id}`, err);
  });

  return NextResponse.json(
    { success: true, data: { proposalId: id, status: 'EXECUTING' } },
    { status: 200 }
  );
}
