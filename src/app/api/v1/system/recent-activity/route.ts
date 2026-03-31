/**
 * 最近活动API
 *
 * GET /api/v1/system/recent-activity
 *
 * 功能：获取用户最近的活动记录
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 获取最近活动
 */
export async function GET(request: NextRequest) {
  // ─── 认证 ────────────────────────────────────────────────────────────────
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');

    // 解析并验证limit参数
    let limit = 5; // 默认值
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 20); // 最大20条
      }
    }

    // 并行获取最近的法条、辩论、合同、案件
    const [recentArticles, recentDebates, recentContracts, recentCases] =
      await Promise.all([
        // 获取最近更新的法条
        prisma.lawArticle.findMany({
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            fullText: true,
            updatedAt: true,
          },
        }),

        // 获取最近的辩论（仅当前用户）
        prisma.debate.findMany({
          where: { userId: authUser.userId },
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
        }),

        // 获取最近的合同（仅当前用户关联的案件）
        prisma.contract.findMany({
          where: { case: { userId: authUser.userId } },
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            contractNumber: true,
            clientName: true,
            status: true,
            createdAt: true,
          },
        }),

        // 获取最近的案件（仅当前用户）
        prisma.case.findMany({
          where: { userId: authUser.userId, deletedAt: null },
          take: limit,
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            status: true,
            updatedAt: true,
          },
        }),
      ]);

    return NextResponse.json({
      recentArticles: recentArticles.map(article => ({
        id: article.id,
        lawName: article.lawName,
        articleNumber: article.articleNumber,
        fullText: article.fullText.substring(0, 100) + '...', // 截取前100字符
        viewedAt: article.updatedAt.toISOString(),
      })),
      recentDebates: recentDebates.map(debate => ({
        id: debate.id,
        title: debate.title,
        status: debate.status,
        createdAt: debate.createdAt.toISOString(),
      })),
      recentContracts: recentContracts.map(contract => ({
        id: contract.id,
        title: contract.contractNumber,
        clientName: contract.clientName,
        status: contract.status,
        createdAt: contract.createdAt.toISOString(),
      })),
      recentCases: recentCases.map(c => ({
        id: c.id,
        title: c.title,
        status: c.status,
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('获取最近活动失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
