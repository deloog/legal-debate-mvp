/**
 * 专家统计 API
 * GET /api/knowledge-graph/experts/[expertId]/stats - 获取专家统计信息
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { expertService } from '@/lib/knowledge-graph/expert/expert-service';

/**
 * GET 获取专家统计信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ expertId: string }> }
) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json(
        { success: false, error: '未登录' },
        { status: 401 }
      );
    }

    const { expertId } = await params;

    // 获取专家信息
    const expert = await prisma.knowledgeGraphExpert.findUnique({
      where: { id: expertId },
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
      userId: authUser.userId,
      expertId,
    });

    return NextResponse.json({
      success: true,
      stats: {
        contribution: contributionStats,
        accuracy: accuracyRate,
      },
    });
  } catch (error) {
    const { expertId } = await params;
    logger.error('获取专家统计失败', { error, expertId });

    return NextResponse.json(
      { success: false, error: '获取专家统计失败' },
      { status: 500 }
    );
  }
}
