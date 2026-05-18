import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';

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

  const { count } = await prisma.agentProposal.updateMany({
    where: { id, userId: user.userId, status: 'PENDING' },
    data: { status: 'REJECTED' },
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
          message: `提案当前状态为 ${existing.status}，只有 PENDING 状态可拒绝`,
        },
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { proposalId: id, status: 'REJECTED' },
  });
}
