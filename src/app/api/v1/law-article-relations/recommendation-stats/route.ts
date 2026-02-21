/**
 * 推荐效果监控API
 * GET /api/v1/law-article-relations/recommendation-stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { VerificationStatus, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 时间范围参数
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '10');

    // 参数验证
    if (limit <= 0 || limit > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'limit必须在1-100之间',
        },
        { status: 400 }
      );
    }

    let dateFilter: { gte?: Date; lte?: Date } | undefined;

    if (startDate || endDate) {
      dateFilter = {};

      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: '无效的开始日期',
            },
            { status: 400 }
          );
        }
        dateFilter.gte = start;
      }

      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end.getTime())) {
          return NextResponse.json(
            {
              success: false,
              error: '无效的结束日期',
            },
            { status: 400 }
          );
        }
        dateFilter.lte = end;
      }

      // 验证日期范围
      if (dateFilter.gte && dateFilter.lte && dateFilter.gte > dateFilter.lte) {
        return NextResponse.json(
          {
            success: false,
            error: '开始日期不能晚于结束日期',
          },
          { status: 400 }
        );
      }
    }

    // 构建查询条件
    const where: Prisma.LawArticleRelationWhereInput = {
      verificationStatus: VerificationStatus.VERIFIED,
    };
    if (dateFilter) {
      where.createdAt = dateFilter;
    }

    // 并行查询统计数据
    const [totalArticles, relations, totalRelations, verifiedRelations] =
      await Promise.all([
        // 法条总数
        prisma.lawArticle.count(),
        // 所有关系（用于计算覆盖率和热门法条）
        prisma.lawArticleRelation.findMany({
          where,
          select: {
            sourceId: true,
          },
        }),
        // 关系总数
        prisma.lawArticleRelation.count({ where }),
        // 已验证关系数
        prisma.lawArticleRelation.count({
          where: {
            ...where,
            verificationStatus: VerificationStatus.VERIFIED,
          },
        }),
      ]);

    // 计算有关系的法条数量（去重）
    const uniqueArticleIds = new Set(relations.map(r => r.sourceId));
    const articlesWithRelations = uniqueArticleIds.size;

    // 计算覆盖率
    const coverageRate =
      totalArticles > 0 ? articlesWithRelations / totalArticles : 0;

    // 计算平均关系数
    const avgRelationsPerArticle =
      totalArticles > 0 ? totalRelations / totalArticles : 0;

    // 统计每个法条的关系数量
    const relationCounts = new Map<string, number>();
    relations.forEach(r => {
      relationCounts.set(r.sourceId, (relationCounts.get(r.sourceId) || 0) + 1);
    });

    // 获取热门法条（关系数最多的法条）
    const topArticleIds = Array.from(relationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);

    // 查询热门法条详情
    const topArticlesData = await prisma.lawArticle.findMany({
      where: {
        id: { in: topArticleIds },
      },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        fullText: true,
        category: true,
      },
    });

    // 构建热门法条列表
    const topArticles = topArticlesData
      .map(article => ({
        article,
        relationCount: relationCounts.get(article.id) || 0,
      }))
      .sort((a, b) => b.relationCount - a.relationCount);

    return NextResponse.json({
      success: true,
      data: {
        totalArticles,
        articlesWithRelations,
        coverageRate: Math.round(coverageRate * 1000) / 1000,
        totalRelations,
        verifiedRelations,
        avgRelationsPerArticle: Math.round(avgRelationsPerArticle * 100) / 100,
        topArticles,
      },
    });
  } catch (error) {
    logger.error('获取推荐统计失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取推荐统计失败',
      },
      { status: 500 }
    );
  }
}
