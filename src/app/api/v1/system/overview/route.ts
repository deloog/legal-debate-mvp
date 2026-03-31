/**
 * 系统概览API
 *
 * GET /api/v1/system/overview
 *
 * 功能：获取系统概览统计数据
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 获取系统概览
 */
export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  try {
    // 获取法条总数
    const totalLawArticles = await prisma.lawArticle.count();

    // 获取关系总数（所有非拒绝的关系：PENDING + VERIFIED）
    const totalRelations = await prisma.lawArticleRelation.count({
      where: {
        verificationStatus: { not: VerificationStatus.REJECTED },
      },
    });

    // 计算关系覆盖率（有关系的法条数 / 总法条数）
    const articlesWithRelations = await prisma.lawArticle.count({
      where: {
        OR: [
          { sourceRelations: { some: {} } },
          { targetRelations: { some: {} } },
        ],
      },
    });
    const relationCoverage =
      totalLawArticles > 0 ? articlesWithRelations / totalLawArticles : 0;

    // 获取最后同步时间（最新法条的创建时间）
    const latestArticle = await prisma.lawArticle.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const lastSyncTime = latestArticle?.createdAt || new Date();

    return NextResponse.json({
      totalLawArticles,
      totalRelations,
      relationCoverage,
      lastSyncTime: lastSyncTime.toISOString(),
    });
  } catch (error) {
    logger.error('获取系统概览失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
