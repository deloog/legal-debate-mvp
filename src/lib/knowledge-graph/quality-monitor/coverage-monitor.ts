/**
 * 覆盖率监控模块
 * 用于统计和分析知识图谱关系的覆盖率指标
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

import { CoverageMetrics, CoverageStatsOptions, OrphanArticle } from './types';

// =============================================================================
// 覆盖率监控类
// =============================================================================

export class CoverageMonitor {
  /**
   * 计算覆盖率指标
   * @param options 统计选项
   * @returns 覆盖率指标
   */
  async calculateMetrics(
    options: CoverageStatsOptions = {}
  ): Promise<CoverageMetrics> {
    return calculateCoverageMetrics(options);
  }

  /**
   * 识别孤立法条
   * @param options 统计选项
   * @returns 孤立法条列表
   */
  async identifyOrphanArticles(
    options: CoverageStatsOptions = {}
  ): Promise<OrphanArticle[]> {
    return identifyOrphanArticles(options);
  }
}

// =============================================================================
// 覆盖率指标计算函数
// =============================================================================

/**
 * 计算覆盖率指标
 * @param options 统计选项
 * @returns 覆盖率指标
 */
export async function calculateCoverageMetrics(
  options: CoverageStatsOptions = {}
): Promise<CoverageMetrics> {
  try {
    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (options.lawType) {
      where.lawType = options.lawType;
    }

    if (options.category) {
      where.category = options.category;
    }

    if (options.status) {
      where.status = options.status;
    }

    // 统计总法条数
    const totalArticles = await prisma.lawArticle.count({ where });

    // 统计有关系（作为源或目标）的法条
    const articlesWithRelationsCount =
      totalArticles > 0
        ? await prisma.lawArticle.count({
            where: {
              ...where,
              OR: [
                {
                  sourceRelations: {
                    some: {},
                  },
                },
                {
                  targetRelations: {
                    some: {},
                  },
                },
              ],
            },
          })
        : 0;

    // 计算孤立法条数
    const orphanArticles = totalArticles - articlesWithRelationsCount;

    // 计算覆盖率
    const coverageRate =
      totalArticles > 0 ? articlesWithRelationsCount / totalArticles : 0;

    // 计算平均每个法条的关系数
    const totalRelations = await prisma.lawArticleRelation.count({
      where: {
        source: { ...where },
      },
    });

    const averageRelationsPerArticle =
      totalArticles > 0 ? totalRelations / totalArticles : 0;

    logger.info('覆盖率指标计算完成', {
      totalArticles,
      articlesWithRelations: articlesWithRelationsCount,
      coverageRate,
      orphanArticles,
      averageRelationsPerArticle,
    });

    return {
      totalArticles,
      articlesWithRelations: articlesWithRelationsCount,
      coverageRate,
      averageRelationsPerArticle,
      orphanArticles,
    };
  } catch (error) {
    logger.error('计算覆盖率指标失败', { error });
    throw new Error('计算覆盖率指标失败');
  }
}

// =============================================================================
// 孤立法条识别函数
// =============================================================================

/**
 * 识别孤立法条
 * @param options 统计选项
 * @returns 孤立法条列表
 */
export async function identifyOrphanArticles(
  options: CoverageStatsOptions = {}
): Promise<OrphanArticle[]> {
  try {
    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (options.lawType) {
      where.lawType = options.lawType;
    }

    if (options.category) {
      where.category = options.category;
    }

    if (options.status) {
      where.status = options.status;
    }

    // 查询既不是源也不是目标的法条（孤立法条）
    const orphanArticles = await prisma.lawArticle.findMany({
      where: {
        ...where,
        AND: [
          {
            sourceRelations: {
              none: {},
            },
          },
          {
            targetRelations: {
              none: {},
            },
          },
        ],
      },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        lawType: true,
        category: true,
        status: true,
        createdAt: true,
      },
    });

    logger.info(`识别到 ${orphanArticles.length} 个孤立法条`, {
      options,
    });

    return orphanArticles;
  } catch (error) {
    logger.error('识别孤立法条失败', { error });
    throw new Error('识别孤立法条失败');
  }
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取法条的关系统计
 * @param articleId 法条ID
 * @returns 关系统计
 */
export async function getArticleRelationStats(articleId: string): Promise<{
  sourceRelationsCount: number;
  targetRelationsCount: number;
  totalRelationsCount: number;
}> {
  try {
    const [sourceRelations, targetRelations] = await Promise.all([
      prisma.lawArticleRelation.count({
        where: { sourceId: articleId },
      }),
      prisma.lawArticleRelation.count({
        where: { targetId: articleId },
      }),
    ]);

    const totalRelationsCount = sourceRelations + targetRelations;

    return {
      sourceRelationsCount: sourceRelations,
      targetRelationsCount: targetRelations,
      totalRelationsCount,
    };
  } catch (error) {
    logger.error('获取法条关系统计失败', { error, articleId });
    return {
      sourceRelationsCount: 0,
      targetRelationsCount: 0,
      totalRelationsCount: 0,
    };
  }
}
