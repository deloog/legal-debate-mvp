import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';

/** GET /api/v1/proposals/list?conversationId=xxx — 诊断用，列出当前用户的提案 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '未授权' } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversationId') ?? undefined;

  const proposals = await prisma.agentProposal.findMany({
    where: {
      userId: user.userId,
      ...(conversationId ? { conversationId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { actions: { orderBy: { sequence: 'asc' } } },
  });

  return NextResponse.json({
    success: true,
    data: proposals,
    count: proposals.length,
  });
}
