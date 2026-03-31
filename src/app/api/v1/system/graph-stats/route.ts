/**
 * 知识图谱统计API
 *
 * GET /api/v1/system/graph-stats
 *
 * 功能：获取知识图谱统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 获取知识图谱统计
 */
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  try {
    // 获取各类型关系统计
    const relationStats = await prisma.lawArticleRelation.groupBy({
      by: ['relationType'],
      where: {
        verificationStatus: VerificationStatus.VERIFIED,
      },
      _count: true,
    });

    const relationsByType: Record<string, number> = {};
    relationStats.forEach(stat => {
      relationsByType[stat.relationType] = stat._count;
    });

    // 获取关系最多的法条（Top 10）
    const topArticlesData = await prisma.lawArticle.findMany({
      take: 10,
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        _count: {
          select: {
            sourceRelations: true,
            targetRelations: true,
          },
        },
      },
      orderBy: [
        { sourceRelations: { _count: 'desc' } },
        { targetRelations: { _count: 'desc' } },
      ],
    });

    const topArticles = topArticlesData.map(article => ({
      id: article.id,
      title: `${article.lawName} 第${article.articleNumber}条`,
      relationCount:
        article._count.sourceRelations + article._count.targetRelations,
    }));

    // 计算推荐准确率（基于已验证关系的比例）
    const totalRelations = await prisma.lawArticleRelation.count();
    const verifiedRelations = await prisma.lawArticleRelation.count({
      where: {
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
    const recommendationAccuracy =
      totalRelations > 0 ? verifiedRelations / totalRelations : 0;

    return NextResponse.json({
      relationsByType,
      topArticles,
      recommendationAccuracy,
    });
  } catch (error) {
    logger.error('获取知识图谱统计失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
