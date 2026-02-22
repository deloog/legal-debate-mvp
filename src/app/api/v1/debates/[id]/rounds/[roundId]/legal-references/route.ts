/**
 * 辩论回合法律参考API路由
 * GET /api/v1/debates/[id]/rounds/[roundId]/legal-references
 *
 * 功能：获取指定辩论回合关联的法律参考列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';

/**
 * 获取指定辩论回合的法律参考列表
 * 通过 debate -> case -> legalReferences 关联获取
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: '未认证' },
      { status: 401 }
    );
  }

  try {
    const { id: debateId, roundId } = await params;

    if (!debateId || !roundId) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数' },
        { status: 400 }
      );
    }

    // 验证辩论是否存在以及用户权限
    const debate = await prisma.debate.findUnique({
      where: { id: debateId },
      select: { id: true, userId: true, caseId: true },
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

    // 验证辩论回合是否存在
    const round = await prisma.debateRound.findUnique({
      where: { id: roundId, debateId },
      select: { id: true, debateId: true, roundNumber: true },
    });

    if (!round) {
      return NextResponse.json(
        { success: false, error: '辩论回合不存在' },
        { status: 404 }
      );
    }

    // 获取关联案件的法律参考
    const legalReferences = await prisma.legalReference.findMany({
      where: {
        caseId: debate.caseId,
        status: { not: 'REPEALED' }, // 排除已废除的
      },
      orderBy: [
        { applicabilityScore: 'desc' },
        { relevanceScore: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    // 格式化返回数据，适配前端组件需求
    const articles = legalReferences.map(ref => ({
      id: ref.id,
      lawName: ref.source,
      articleNumber: ref.articleNumber || '',
      content: ref.content,
      applicabilityScore: ref.applicabilityScore,
      applicabilityReason: ref.applicabilityReason,
      status: ref.status,
      metadata: ref.metadata,
    }));

    return NextResponse.json({
      success: true,
      articles,
    });
  } catch (error) {
    logger.error('获取法律参考列表失败:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
