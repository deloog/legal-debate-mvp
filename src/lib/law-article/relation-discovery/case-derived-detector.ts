/**
 * 案例推导检测器
 * 从裁判文书和案例中发现法条之间的共现关系和使用模式
 */

import { prisma } from '@/lib/db';
import { RelationType, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import {
  CoOccurrenceRelation,
  UsagePattern,
  CoOccurrenceStats,
  FrequentPattern,
} from './types';

/**
 * 案例推导检测器类
 * 通过分析案例中法条的共同出现情况来发现潜在关系
 */
export class CaseDerivedDetector {
  /**
   * 从案例中发现法条共现关系
   *
   * @param minCoOccurrence - 最小共现次数阈值（默认5次）
   * @returns 共现关系列表
   */
  static async discoverFromCases(
    minCoOccurrence: number = 5
  ): Promise<CoOccurrenceRelation[]> {
    try {
      // SQL查询：查找在案例中共同出现的法条对
      // 使用 LegalReference 表（关联到 Case）
      const results = await prisma.$queryRaw<
        Array<{
          source_id: string;
          target_id: string;
          co_occurrence_count: number;
          order_score: number;
        }>
      >(Prisma.sql`
        SELECT
          a1.id as source_id,
          a2.id as target_id,
          COUNT(DISTINCT lr1."caseId") as co_occurrence_count,
          AVG(CASE WHEN a1.id < a2.id THEN 1.0 ELSE 0.0 END) as order_score
        FROM legal_references lr1
        JOIN legal_references lr2 ON lr1."caseId" = lr2."caseId"
        JOIN law_articles a1 ON lr1.source = a1."lawName" AND lr1."articleNumber" = a1."articleNumber"
        JOIN law_articles a2 ON lr2.source = a2."lawName" AND lr2."articleNumber" = a2."articleNumber"
        WHERE a1.id != a2.id
        GROUP BY a1.id, a2.id
        HAVING COUNT(DISTINCT lr1."caseId") >= ${minCoOccurrence}
        ORDER BY co_occurrence_count DESC
      `);

      // 转换为关系对象
      return results.map(row => {
        // 计算关系强度：共现次数 / 100，最大为1.0
        const strength = Math.min(row.co_occurrence_count / 100, 1.0);

        return {
          sourceId: row.source_id,
          targetId: row.target_id,
          relationType: RelationType.RELATED,
          strength,
          confidence: 0.7, // 案例推导的置信度设为0.7
          discoveryMethod: 'CASE_DERIVED',
          evidence: `在${row.co_occurrence_count}个案例中同时被引用`,
        };
      });
    } catch (error) {
      logger.error('案例推导失败', { error: String(error) });
      return [];
    }
  }

  /**
   * 分析法条在案例中的使用模式
   *
   * @param articleId - 法条ID
   * @param minFrequency - 最小频率阈值（默认3次）
   * @returns 使用模式分析结果
   */
  static async analyzeUsagePattern(
    articleId: string,
    minFrequency: number = 3
  ): Promise<UsagePattern> {
    try {
      // SQL查询：分析法条在案例中的使用顺序
      const results = await prisma.$queryRaw<
        Array<{
          related_article_id: string;
          frequency: number;
          avg_position: number;
        }>
      >(Prisma.sql`
        SELECT
          a2.id as related_article_id,
          COUNT(DISTINCT lr1."caseId") as frequency,
          AVG(
            CASE
              WHEN lr2."createdAt" > lr1."createdAt" THEN 1.0
              WHEN lr2."createdAt" < lr1."createdAt" THEN -1.0
              ELSE 0.0
            END
          ) as avg_position
        FROM legal_references lr1
        JOIN legal_references lr2 ON lr1."caseId" = lr2."caseId"
        JOIN law_articles a1 ON lr1.source = a1."lawName" AND lr1."articleNumber" = a1."articleNumber"
        JOIN law_articles a2 ON lr2.source = a2."lawName" AND lr2."articleNumber" = a2."articleNumber"
        WHERE a1.id = ${articleId}
          AND a2.id != ${articleId}
        GROUP BY a2.id
        HAVING COUNT(DISTINCT lr1."caseId") >= ${minFrequency}
        ORDER BY frequency DESC
      `);

      // 转换为使用模式对象
      const frequentlyUsedWith = results.map(row => ({
        articleId: row.related_article_id,
        frequency: row.frequency,
        typicalOrder: (row.avg_position >= 0 ? 'after' : 'before') as
          | 'before'
          | 'after',
      }));

      return {
        articleId,
        frequentlyUsedWith,
      };
    } catch (error) {
      logger.error('使用模式分析失败', { error: String(error) });
      return {
        articleId,
        frequentlyUsedWith: [],
      };
    }
  }

  /**
   * 获取共现统计信息
   *
   * @returns 共现统计数据
   */
  static async getCoOccurrenceStats(): Promise<CoOccurrenceStats> {
    try {
      const results = await prisma.$queryRaw<
        Array<{
          total_pairs: number;
          avg_co_occurrence: number | null;
          max_co_occurrence: number | null;
          min_co_occurrence: number | null;
        }>
      >(Prisma.sql`
        SELECT
          COUNT(*) as total_pairs,
          AVG(co_occurrence_count) as avg_co_occurrence,
          MAX(co_occurrence_count) as max_co_occurrence,
          MIN(co_occurrence_count) as min_co_occurrence
        FROM (
          SELECT
            a1.id as source_id,
            a2.id as target_id,
            COUNT(DISTINCT lr1."caseId") as co_occurrence_count
          FROM legal_references lr1
          JOIN legal_references lr2 ON lr1."caseId" = lr2."caseId"
          JOIN law_articles a1 ON lr1.source = a1."lawName" AND lr1."articleNumber" = a1."articleNumber"
          JOIN law_articles a2 ON lr2.source = a2."lawName" AND lr2."articleNumber" = a2."articleNumber"
          WHERE a1.id != a2.id
          GROUP BY a1.id, a2.id
          HAVING COUNT(DISTINCT lr1."caseId") >= 5
        ) subquery
      `);

      const row = results[0];

      return {
        totalPairs: row?.total_pairs || 0,
        avgCoOccurrence: row?.avg_co_occurrence || 0,
        maxCoOccurrence: row?.max_co_occurrence || 0,
        minCoOccurrence: row?.min_co_occurrence || 0,
      };
    } catch (error) {
      logger.error('获取共现统计失败', { error: String(error) });
      return {
        totalPairs: 0,
        avgCoOccurrence: 0,
        maxCoOccurrence: 0,
        minCoOccurrence: 0,
      };
    }
  }

  /**
   * 发现频繁使用的法条组合模式
   *
   * @param minSetSize - 最小集合大小（默认2）
   * @param minSupport - 最小支持度（默认5）
   * @returns 频繁模式列表
   */
  static async findFrequentPatterns(
    minSetSize: number = 2,
    minSupport: number = 5
  ): Promise<FrequentPattern[]> {
    try {
      // 这是一个简化的频繁项集挖掘
      // 实际应用中可能需要使用 Apriori 或 FP-Growth 算法
      const results = await prisma.$queryRaw<
        Array<{
          article_ids: string[];
          frequency: number;
        }>
      >(Prisma.sql`
        SELECT
          ARRAY_AGG(DISTINCT a.id ORDER BY a.id) as article_ids,
          COUNT(DISTINCT lr."caseId") as frequency
        FROM legal_references lr
        JOIN law_articles a ON lr.source = a."lawName" AND lr."articleNumber" = a."articleNumber"
        GROUP BY lr."caseId"
        HAVING COUNT(DISTINCT a.id) >= ${minSetSize}
          AND COUNT(DISTINCT lr."caseId") >= ${minSupport}
        ORDER BY frequency DESC
        LIMIT 100
      `);

      // 计算总案例数用于计算支持度
      const totalCasesResult = await prisma.$queryRaw<Array<{ total: number }>>(
        Prisma.sql`SELECT COUNT(DISTINCT "caseId") as total FROM legal_references`
      );
      const totalCases = totalCasesResult[0]?.total || 1;

      return results.map(row => ({
        articleIds: row.article_ids,
        frequency: row.frequency,
        support: row.frequency / totalCases,
      }));
    } catch (error) {
      logger.error('发现频繁模式失败', { error: String(error) });
      return [];
    }
  }
}
