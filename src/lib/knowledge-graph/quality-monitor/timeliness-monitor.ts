/**
 * 时效性监控模块
 * 用于统计和分析知识图谱关系的时效性指标
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { VerificationStatus, LawStatus } from '@prisma/client';
import {
  TimelinessMetrics,
  TimelinessStatsOptions,
  ExpiredRelation,
  StaleRelation,
} from './types';

// =============================================================================
// 时效性监控类
// =============================================================================

export class TimelinessMonitor {
  /**
   * 计算时效性指标
   * @param options 统计选项
   * @returns 时效性指标
   */
  async calculateMetrics(
    options: TimelinessStatsOptions = {}
  ): Promise<TimelinessMetrics> {
    return calculateTimelinessMetrics(options);
  }
}

// =============================================================================
// 时效性指标计算函数
// =============================================================================

/**
 * 计算时效性指标
 * @param options 统计选项
 * @returns 时效性指标
 */
export async function calculateTimelinessMetrics(
  options: TimelinessStatsOptions = {}
): Promise<TimelinessMetrics> {
  try {
    const { staleThresholdDays = 90, pendingThresholdDays = 30 } = options;

    // 统计总关系数
    const totalRelations = await prisma.lawArticleRelation.count();

    // 统计待审核关系数
    const pendingRelations = await prisma.lawArticleRelation.count({
      where: {
        verificationStatus: VerificationStatus.PENDING,
      },
    });

    // 计算待审核率
    const pendingRate =
      totalRelations > 0 ? pendingRelations / totalRelations : 0;

    // 统计过期关系数（创建时间超过阈值且仍为待审核状态）
    const staleThresholdDate = new Date();
    staleThresholdDate.setDate(
      staleThresholdDate.getDate() - staleThresholdDays
    );

    const staleRelations = await prisma.lawArticleRelation.count({
      where: {
        verificationStatus: VerificationStatus.PENDING,
        createdAt: {
          lt: staleThresholdDate,
        },
      },
    });

    // 统计失效关系数（涉及失效法条的关系）
    const expiredRelations = await countExpiredRelations();

    // 计算过期关系率
    const staleRate = totalRelations > 0 ? staleRelations / totalRelations : 0;

    // 计算失效关系率
    const expiredRate =
      totalRelations > 0 ? expiredRelations / totalRelations : 0;

    logger.info('时效性指标计算完成', {
      totalRelations,
      pendingRelations,
      pendingRate,
      staleRelations,
      staleRate,
      expiredRelations,
      expiredRate,
    });

    return {
      totalRelations,
      pendingRelations,
      pendingRate,
      staleRelations,
      staleRate,
      expiredRelations,
      expiredRate,
    };
  } catch (error) {
    logger.error('计算时效性指标失败', { error });
    throw new Error('计算时效性指标失败');
  }
}

// =============================================================================
// 失效关系识别函数
// =============================================================================

/**
 * 识别失效关系（涉及失效法条的关系）
 * @returns 失效关系列表
 */
export async function identifyExpiredRelations(): Promise<ExpiredRelation[]> {
  try {
    // 查询涉及失效法条的关系
    const expiredRelations = await prisma.lawArticleRelation.findMany({
      where: {
        OR: [
          {
            source: {
              status: LawStatus.EXPIRED,
            },
          },
          {
            target: {
              status: LawStatus.EXPIRED,
            },
          },
        ],
      },
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        createdAt: true,
        updatedAt: true,
        source: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            status: true,
            expiryDate: true,
          },
        },
        target: {
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            status: true,
            expiryDate: true,
          },
        },
      },
    });

    const result: ExpiredRelation[] = expiredRelations.map(relation => ({
      relationId: relation.id,
      sourceId: relation.sourceId,
      targetId: relation.targetId,
      relationType: relation.relationType,
      expiredSource: relation.source.status === LawStatus.EXPIRED,
      expiredTarget: relation.target.status === LawStatus.EXPIRED,
      expiryDate:
        relation.source.status === LawStatus.EXPIRED
          ? relation.source.expiryDate
          : relation.target.expiryDate,
      sourceStatus: relation.source.status,
      targetStatus: relation.target.status,
      createdAt: relation.createdAt,
      updatedAt: relation.updatedAt,
    }));

    logger.info(`识别到 ${result.length} 个失效关系`);

    return result;
  } catch (error) {
    logger.error('识别失效关系失败', { error });
    throw new Error('识别失效关系失败');
  }
}

/**
 * 统计失效关系数
 * @returns 失效关系数
 */
async function countExpiredRelations(): Promise<number> {
  try {
    const count = await prisma.lawArticleRelation.count({
      where: {
        OR: [
          {
            source: {
              status: LawStatus.EXPIRED,
            },
          },
          {
            target: {
              status: LawStatus.EXPIRED,
            },
          },
        ],
      },
    });
    return count;
  } catch (error) {
    logger.error('统计失效关系数失败', { error });
    return 0;
  }
}

// =============================================================================
// 过期关系识别函数
// =============================================================================

/**
 * 识别过期关系（创建时间超过阈值且仍为待审核状态的关系）
 * @param staleThresholdDays 过期阈值天数
 * @returns 过期关系列表
 */
export async function identifyStaleRelations(
  staleThresholdDays: number = 90
): Promise<StaleRelation[]> {
  try {
    // 计算阈值日期
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - staleThresholdDays);

    // 查询创建时间超过阈值且仍为待审核状态的关系
    const staleRelations = await prisma.lawArticleRelation.findMany({
      where: {
        verificationStatus: VerificationStatus.PENDING,
        createdAt: {
          lt: thresholdDate,
        },
      },
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        createdAt: true,
        updatedAt: true,
        verificationStatus: true,
      },
    });

    const now = new Date();

    const result: StaleRelation[] = staleRelations.map(relation => {
      const daysSinceCreation = Math.floor(
        (now.getTime() - relation.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      const daysSinceUpdate = Math.floor(
        (now.getTime() - relation.updatedAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      return {
        relationId: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: relation.relationType,
        createdAt: relation.createdAt,
        updatedAt: relation.updatedAt,
        daysSinceCreation,
        verificationStatus: relation.verificationStatus,
        daysSinceUpdate,
      };
    });

    logger.info(`识别到 ${result.length} 个过期关系`, {
      thresholdDays: staleThresholdDays,
    });

    return result;
  } catch (error) {
    logger.error('识别过期关系失败', { error });
    throw new Error('识别过期关系失败');
  }
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 计算两个日期之间的天数差
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 天数差
 */
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.round(Math.abs((start.getTime() - end.getTime()) / oneDay));
}

/**
 * 检查关系是否过期
 * @param relation 关系
 * @param staleThresholdDays 过期阈值天数
 * @returns 是否过期
 */
export function isRelationStale(
  relation: {
    createdAt: Date;
    verificationStatus: VerificationStatus;
  },
  staleThresholdDays: number = 90
): boolean {
  if (relation.verificationStatus !== VerificationStatus.PENDING) {
    return false;
  }

  const daysSinceCreation = calculateDaysBetween(
    relation.createdAt,
    new Date()
  );
  return daysSinceCreation > staleThresholdDays;
}
