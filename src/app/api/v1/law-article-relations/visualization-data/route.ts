/**
 * 知识图谱可视化数据API
 * GET /api/v1/law-article-relations/visualization-data
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
} from '@prisma/client';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

interface VisualizationDataResponse {
  success: boolean;
  data?: {
    chartType: 'pie' | 'bar' | 'line';
    data: unknown[];
  };
  error?: string;
}

// 关系类型中文映射
const RELATION_TYPE_NAMES: Record<RelationType, string> = {
  CITES: '引用关系',
  CITED_BY: '被引用关系',
  CONFLICTS: '冲突关系',
  COMPLETES: '补全关系',
  COMPLETED_BY: '被补全关系',
  SUPERSEDES: '替代关系',
  SUPERSEDED_BY: '被替代关系',
  IMPLEMENTS: '实施关系',
  IMPLEMENTED_BY: '被实施关系',
  RELATED: '一般关联',
};

// 发现方式中文映射
const DISCOVERY_METHOD_NAMES: Record<DiscoveryMethod, string> = {
  MANUAL: '人工添加',
  RULE_BASED: '规则匹配',
  AI_DETECTED: 'AI检测',
  CASE_DERIVED: '案例推导',
};

export async function GET(
  request: NextRequest
): Promise<NextResponse<VisualizationDataResponse>> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权，请先登录' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const days = searchParams.get('days')
      ? parseInt(searchParams.get('days')!)
      : 30;
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!)
      : 10;

    // 参数验证
    if (!type) {
      return NextResponse.json(
        {
          success: false,
          error: 'type参数是必需的',
        },
        { status: 400 }
      );
    }

    const validTypes = [
      'relationType',
      'discoveryMethod',
      'verificationTrend',
      'confidenceDistribution',
      'strengthDistribution',
      'topArticles',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `type参数必须是以下值之一: ${validTypes.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (days < 1 || days > 365) {
      return NextResponse.json(
        {
          success: false,
          error: '天数必须在1到365之间',
        },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          success: false,
          error: '数量必须在1到100之间',
        },
        { status: 400 }
      );
    }

    // 根据类型返回不同的数据
    let chartData;
    switch (type) {
      case 'relationType':
        chartData = await getRelationTypeDistribution();
        break;
      case 'discoveryMethod':
        chartData = await getDiscoveryMethodDistribution();
        break;
      case 'verificationTrend':
        chartData = await getVerificationTrend(days);
        break;
      case 'confidenceDistribution':
        chartData = await getConfidenceDistribution();
        break;
      case 'strengthDistribution':
        chartData = await getStrengthDistribution();
        break;
      case 'topArticles':
        chartData = await getTopArticles(limit);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: '不支持的数据类型',
          },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: chartData,
    });
  } catch (error) {
    logger.error('获取可视化数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取可视化数据失败',
      },
      { status: 500 }
    );
  }
}

/**
 * 获取关系类型分布数据
 */
async function getRelationTypeDistribution() {
  const relations = await prisma.lawArticleRelation.groupBy({
    by: ['relationType'],
    _count: {
      id: true,
    },
  });

  const total = relations.reduce((sum, item) => sum + item._count.id, 0);

  const data = relations.map(item => ({
    name: RELATION_TYPE_NAMES[item.relationType],
    value: item._count.id,
    percentage: total > 0 ? (item._count.id / total) * 100 : 0,
  }));

  return {
    chartType: 'pie' as const,
    data,
  };
}

/**
 * 获取发现方式分布数据
 */
async function getDiscoveryMethodDistribution() {
  const relations = await prisma.lawArticleRelation.groupBy({
    by: ['discoveryMethod'],
    _count: {
      id: true,
    },
  });

  const total = relations.reduce((sum, item) => sum + item._count.id, 0);

  const data = relations.map(item => ({
    name: DISCOVERY_METHOD_NAMES[item.discoveryMethod],
    value: item._count.id,
    percentage: total > 0 ? (item._count.id / total) * 100 : 0,
  }));

  return {
    chartType: 'pie' as const,
    data,
  };
}

/**
 * 获取验证率趋势数据
 */
async function getVerificationTrend(days: number) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // 按日期分组统计
  const relations = await prisma.lawArticleRelation.findMany({
    where: {
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      createdAt: true,
      verificationStatus: true,
    },
  });

  // 按日期分组
  const dateMap = new Map<
    string,
    { verified: number; pending: number; rejected: number }
  >();

  relations.forEach(relation => {
    const dateKey = relation.createdAt.toISOString().split('T')[0];
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, { verified: 0, pending: 0, rejected: 0 });
    }

    const stats = dateMap.get(dateKey)!;
    if (relation.verificationStatus === VerificationStatus.VERIFIED) {
      stats.verified++;
    } else if (relation.verificationStatus === VerificationStatus.PENDING) {
      stats.pending++;
    } else if (relation.verificationStatus === VerificationStatus.REJECTED) {
      stats.rejected++;
    }
  });

  // 转换为数组并排序
  const data = Array.from(dateMap.entries())
    .map(([date, stats]) => ({
      date,
      ...stats,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    chartType: 'line' as const,
    data,
  };
}

/**
 * 获取置信度分布数据
 */
async function getConfidenceDistribution() {
  const relations = await prisma.lawArticleRelation.findMany({
    select: {
      confidence: true,
    },
  });

  // 分组统计
  const ranges = [
    { range: '0.0-0.2', min: 0.0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 },
  ];

  relations.forEach(relation => {
    const confidence = relation.confidence;
    for (const range of ranges) {
      if (confidence >= range.min && confidence <= range.max) {
        range.count++;
        break;
      }
    }
  });

  const data = ranges.map(({ range, count }) => ({ range, count }));

  return {
    chartType: 'bar' as const,
    data,
  };
}

/**
 * 获取强度分布数据
 */
async function getStrengthDistribution() {
  const relations = await prisma.lawArticleRelation.findMany({
    select: {
      strength: true,
    },
  });

  // 分组统计
  const ranges = [
    { range: '0.0-0.2', min: 0.0, max: 0.2, count: 0 },
    { range: '0.2-0.4', min: 0.2, max: 0.4, count: 0 },
    { range: '0.4-0.6', min: 0.4, max: 0.6, count: 0 },
    { range: '0.6-0.8', min: 0.6, max: 0.8, count: 0 },
    { range: '0.8-1.0', min: 0.8, max: 1.0, count: 0 },
  ];

  relations.forEach(relation => {
    const strength = relation.strength;
    for (const range of ranges) {
      if (strength >= range.min && strength <= range.max) {
        range.count++;
        break;
      }
    }
  });

  const data = ranges.map(({ range, count }) => ({ range, count }));

  return {
    chartType: 'bar' as const,
    data,
  };
}

/**
 * 获取热门法条数据
 */
async function getTopArticles(limit: number) {
  // 统计每个法条的关系数量
  const sourceRelations = await prisma.lawArticleRelation.groupBy({
    by: ['sourceId'],
    _count: {
      id: true,
    },
  });

  const targetRelations = await prisma.lawArticleRelation.groupBy({
    by: ['targetId'],
    _count: {
      id: true,
    },
  });

  // 合并统计
  const articleCountMap = new Map<string, number>();

  sourceRelations.forEach(item => {
    articleCountMap.set(
      item.sourceId,
      (articleCountMap.get(item.sourceId) || 0) + item._count.id
    );
  });

  targetRelations.forEach(item => {
    articleCountMap.set(
      item.targetId,
      (articleCountMap.get(item.targetId) || 0) + item._count.id
    );
  });

  // 排序并取前N个
  const topArticleIds = Array.from(articleCountMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  // 获取法条详情
  const articles = await prisma.lawArticle.findMany({
    where: {
      id: { in: topArticleIds },
    },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
    },
  });

  // 构建返回数据
  const data = articles.map(article => ({
    lawName: article.lawName,
    articleNumber: article.articleNumber,
    relationCount: articleCountMap.get(article.id) || 0,
  }));

  // 按关系数量排序
  data.sort((a, b) => b.relationCount - a.relationCount);

  return {
    chartType: 'bar' as const,
    data,
  };
}
