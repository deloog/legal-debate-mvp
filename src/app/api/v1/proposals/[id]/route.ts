import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  const proposal = await prisma.agentProposal.findUnique({
    where: { id },
    include: { actions: { orderBy: { sequence: 'asc' } } },
  });

  if (!proposal || proposal.userId !== user.userId) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_FOUND', message: '提案不存在' } },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: proposal });
}
