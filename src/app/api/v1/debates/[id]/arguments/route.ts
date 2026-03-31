/**
 * GET /api/v1/debates/[id]/arguments
 * 获取指定辩论的所有论点（跨所有轮次）
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return Response.json({ success: false, error: '未认证' }, { status: 401 });
  }

  const { id: debateId } = await params;

  try {
    // 验证辩论存在且属于当前用户（或管理员）
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { id: true, userId: true },
    });

    if (!debate) {
      return Response.json(
        { success: false, error: '辩论不存在' },
        { status: 404 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: { role: true },
    });
    const isAdmin = dbUser?.role === 'ADMIN' || dbUser?.role === 'SUPER_ADMIN';
    if (debate.userId !== authUser.userId && !isAdmin) {
      return Response.json(
        { success: false, error: '无权访问' },
        { status: 403 }
      );
    }

    // 获取该辩论所有轮次的论点
    const rounds = await prisma.debateRound.findMany({
      where: { debateId },
      select: { id: true },
    });

    const roundIds = rounds.map(r => r.id);

    const args = await prisma.argument.findMany({
      where: { roundId: { in: roundIds } },
      orderBy: [{ roundId: 'asc' }, { createdAt: 'asc' }],
    });

    return Response.json({ success: true, data: args });
  } catch (error) {
    logger.error('获取辩论论点失败:', error);
    return Response.json(
      { success: false, error: '获取论点失败' },
      { status: 500 }
    );
  }
}
