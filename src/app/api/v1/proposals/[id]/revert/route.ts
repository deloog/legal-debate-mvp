import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { revertProposal } from '@/lib/agent/proposal/revert';
import type { RevertProposalBody } from '@/types/proposal';

type Params = { params: Promise<{ id: string }> };

const REVERTABLE_STATUSES = ['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED'];

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  let body: RevertProposalBody;
  try {
    body = (await request.json()) as RevertProposalBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: '请求体格式错误' },
      },
      { status: 400 }
    );
  }

  if (!body.reason?.trim()) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: '撤销原因不能为空' },
      },
      { status: 400 }
    );
  }

  const proposal = await prisma.agentProposal.findUnique({ where: { id } });
  if (!proposal || proposal.userId !== user.userId) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: '提案不存在' } },
      { status: 404 }
    );
  }

  if (!REVERTABLE_STATUSES.includes(proposal.status)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CONFLICT',
          message: `提案状态为 ${proposal.status}，不可撤销`,
        },
      },
      { status: 409 }
    );
  }

  const result = await revertProposal(id, body.reason.trim());

  return NextResponse.json({
    success: true,
    data: { proposalId: id, status: 'REVERTED', ...result },
  });
}
