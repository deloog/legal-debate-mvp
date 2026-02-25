/**
 * 专家统计 API
 * GET /api/knowledge-graph/experts/[expertId]/stats - 获取专家统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import { expertService } from '@/lib/knowledge-graph/expert/expert-service';

/**
 * GET 获取专家统计信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { expertId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { prisma } = await import('@/lib/db/prisma');

    // 获取专家信息
    const expert = await prisma.knowledgeGraphExpert.findUnique({
      where: { id: params.expertId },
    });

    if (!expert) {
      return NextResponse.json(
        { success: false, error: '专家不存在' },
        { status: 404 }
      );
    }

    // 获取统计信息
    const [contributionStats, accuracyRate] = await Promise.all([
      expertService.getExpertContributionStats(expert.userId),
      expertService.calculateExpertAccuracyRate(expert.userId),
    ]);

    logger.info('Expert stats fetched successfully', {
      userId: session.user.id,
      expertId: params.expertId,
    });

    return NextResponse.json({
      success: true,
      stats: {
        contribution: contributionStats,
        accuracy: accuracyRate,
      },
    });
  } catch (error) {
    logger.error('获取专家统计失败', {
      error,
      expertId: params.expertId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取专家统计失败',
      },
      { status: 500 }
    );
  }
}
