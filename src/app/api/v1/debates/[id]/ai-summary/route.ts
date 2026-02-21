/**
 * GET /api/v1/debates/[id]/ai-summary
 * 返回数据库中已保存的 AI 辩论总结（Debate.summary 字段）
 */

import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const debate = await prisma.debate.findUnique({
      where: { id },
      select: { summary: true, userId: true },
    });

    if (!debate) {
      return NextResponse.json(
        { success: false, error: '辩论不存在' },
        { status: 404 }
      );
    }

    const isAdmin = (session.user as { role?: string }).role === 'ADMIN';
    if (debate.userId !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { success: false, error: '无权访问' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: debate.summary ?? null });
  } catch (err) {
    logger.error('获取 AI 总结失败:', err);
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    );
  }
}
