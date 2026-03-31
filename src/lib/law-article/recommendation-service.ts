/**
 * 法条推荐服务
 * 提供基于关系图谱、相似度和场景的法条推荐功能
 */

import { prisma } from '../db';
import { LawArticle, RelationType, VerificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import {
  GraphDistanceRecommender,
  type GraphDistanceRecommendation,
} from './graph-distance-recommender';

/**
 * 推荐选项
 */
export interface RecommendationOptions {
  maxDepth?: number;
  limit?: number;
  relationTypes?: RelationType[];
  minScore?: number;
  useFeedbackOptimization?: boolean; // 是否使用反馈优化
}

/**
 * 推荐结果
 */
export interface RecommendationResult {
  article: LawArticle;
  score: number;
  reason: string;
  relationType?: RelationType;
}

/**
 * 案件信息
 */
export interface CaseInfo {
  title: string;
  description: string;
  type: string;
  keywords?: string[];
}

/**
 * 合同信息
 */
export interface ContractInfo {
  type: string;
  content: string;
  existingArticles?: string[];
}

/**
 * 推荐统计
 */
export interface RecommendationStats {
  articleId: string;
  totalRelations: number;
  relationsByType: Record<string, number>;
  recommendationScore: number;
}

/**
 * 法条推荐服务类
 */
export class LawArticleRecommendationService {
  /**
   * 基于关系图谱推荐相关法条
   */
  static async recommendByRelations(
    articleId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const { maxDepth = 2, limit = 10, relationTypes, minScore = 0 } = options;

    // 参数验证
    if (limit <= 0 || maxDepth <= 0) {
      return [];
    }

    try {
      // 检查法条是否存在
      const article = await prisma.lawArticle.findUnique({
        where: { id: articleId },
      });

      if (!article) {
        return [];
      }

      // 获取相关法条
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          sourceId: articleId,
          verificationStatus: VerificationStatus.VERIFIED,
          ...(relationTypes && relationTypes.length > 0
            ? { relationType: { in: relationTypes } }
            : {}),
        },
        include: {
          target: true,
        },
        take: limit * 2, // 获取更多以便过滤
      });

      // 构建推荐结果
      const recommendations: RecommendationResult[] = relations.map(rel => ({
        article: rel.target,
        score: rel.strength * rel.confidence,
        reason: this.getRelationReason(rel.relationType),
        relationType: rel.relationType,
      }));

      // 过滤和排序
      let results = recommendations
        .filter(rec => rec.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // 应用反馈优化
      if (options.useFeedbackOptimization) {
        results = await this.applyFeedbackOptimization(results);
      }

      return results;
    } catch (error) {
      logger.error(
        '基于关系推荐失败',
        error instanceof Error ? error : undefined
      );
      return [];
    }
  }

  /**
   * 基于相似度推荐法条
   */
  static async recommendBySimilarity(
    articleId: string,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const { limit = 10, minScore = 0 } = options;

    try {
      // 获取源法条
      const sourceArticle = await prisma.lawArticle.findUnique({
        where: { id: articleId },
      });

      if (!sourceArticle) {
        return [];
      }

      // 获取候选法条（相同分类）
      const candidates = await prisma.lawArticle.findMany({
        where: {
          category: sourceArticle.category,
          id: { not: articleId },
        },
        take: limit * 3,
      });

      // 计算相似度
      const recommendations: RecommendationResult[] = candidates.map(
        candidate => {
          const score = this.calculateSimilarity(sourceArticle, candidate);
          const reason = this.getSimilarityReason(sourceArticle, candidate);

          return {
            article: candidate,
            score,
            reason,
          };
        }
      );

      // 过滤和排序
      let results = recommendations
        .filter(rec => rec.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // 应用反馈优化
      if (options.useFeedbackOptimization) {
        results = await this.applyFeedbackOptimization(results);
      }

      return results;
    } catch (error) {
      logger.error(
        '基于相似度推荐失败',
        error instanceof Error ? error : undefined
      );
      return [];
    }
  }

  /**
   * 为辩论推荐相关法条
   */
  static async recommendForDebate(
    caseInfo: CaseInfo,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const { limit = 10, minScore = 0 } = options;

    try {
      // 构建搜索条件（始终排除已废止法条）
      const whereConditions: Record<string, unknown> = {
        status: { not: 'REPEALED' },
      };

      // 按案件类型过滤
      if (caseInfo.type) {
        whereConditions.category = caseInfo.type;
      }

      // 如果有关键词，扩大搜索范围
      const searchLimit =
        caseInfo.keywords && caseInfo.keywords.length > 0
          ? limit * 5
          : limit * 3;

      // 获取候选法条
      const candidates = await prisma.lawArticle.findMany({
        where: whereConditions,
        take: searchLimit,
      });

      // 计算相关性分数
      const recommendations: RecommendationResult[] = candidates.map(
        article => {
          const score = this.calculateRelevanceForDebate(caseInfo, article);
          const reason = this.getDebateRecommendationReason(caseInfo, article);

          return {
            article,
            score,
            reason,
          };
        }
      );

      // 过滤和排序
      let results = recommendations
        .filter(rec => rec.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // 应用反馈优化
      if (options.useFeedbackOptimization) {
        results = await this.applyFeedbackOptimization(results);
      }

      return results;
    } catch (error) {
      logger.error(
        '为辩论推荐失败',
        error instanceof Error ? error : undefined
      );
      return [];
    }
  }

  /**
   * 为合同审查推荐补全法条
   */
  static async recommendForContract(
    contractInfo: ContractInfo,
    options: RecommendationOptions = {}
  ): Promise<RecommendationResult[]> {
    const { limit = 10, minScore = 0 } = options;
    const existingArticles = contractInfo.existingArticles || [];

    try {
      // 如果有已有法条，基于关系推荐
      if (existingArticles.length > 0) {
        const relatedRecommendations: RecommendationResult[] = [];

        for (const articleId of existingArticles) {
          const recommendations = await this.recommendByRelations(articleId, {
            limit: limit * 2,
            relationTypes: [RelationType.COMPLETES, RelationType.RELATED],
          });
          relatedRecommendations.push(...recommendations);
        }

        // 去重和排除已有法条
        const uniqueRecommendations = this.deduplicateRecommendations(
          relatedRecommendations,
          existingArticles
        );

        return uniqueRecommendations
          .filter(rec => rec.score >= minScore)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }

      // 否则基于合同类型推荐
      const candidates = await prisma.lawArticle.findMany({
        where: {
          category: 'CIVIL',
        },
        take: limit * 2,
      });

      const recommendations: RecommendationResult[] = candidates.map(
        article => {
          const score = this.calculateRelevanceForContract(
            contractInfo,
            article
          );
          const reason = '基于合同类型推荐的相关法条';

          return {
            article,
            score,
            reason,
          };
        }
      );

      return recommendations
        .filter(rec => rec.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    } catch (error) {
      logger.error(
        '为合同推荐失败',
        error instanceof Error ? error : undefined
      );
      return [];
    }
  }

  /**
   * 获取推荐统计信息
   */
  static async getRecommendationStats(
    articleId: string
  ): Promise<RecommendationStats> {
    try {
      // 获取所有关系
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          OR: [{ sourceId: articleId }, { targetId: articleId }],
          verificationStatus: VerificationStatus.VERIFIED,
        },
      });

      // 统计各类型关系数量
      const relationsByType: Record<string, number> = {};
      relations.forEach(rel => {
        const type = rel.relationType;
        relationsByType[type] = (relationsByType[type] || 0) + 1;
      });

      // 计算推荐分数（基于关系数量和质量）
      const recommendationScore =
        relations.reduce((sum, rel) => {
          return sum + rel.strength * rel.confidence;
        }, 0) / Math.max(relations.length, 1);

      return {
        articleId,
        totalRelations: relations.length,
        relationsByType,
        recommendationScore,
      };
    } catch (error) {
      logger.error(
        '获取推荐统计失败',
        error instanceof Error ? error : undefined
      );
      return {
        articleId,
        totalRelations: 0,
        relationsByType: {},
        recommendationScore: 0,
      };
    }
  }

  /**
   * 计算两个法条的相似度
   */
  private static calculateSimilarity(
    article1: LawArticle,
    article2: LawArticle
  ): number {
    let score = 0;

    // 相同分类加分
    if (article1.category === article2.category) {
      score += 0.3;
    }

    // 关键词重叠加分
    if (article1.keywords && article2.keywords) {
      const keywords1 = article1.keywords as string[];
      const keywords2 = article2.keywords as string[];
      const overlap = keywords1.filter(k => keywords2.includes(k)).length;
      score += Math.min(overlap * 0.1, 0.4);
    }

    // 标签重叠加分
    if (article1.tags && article2.tags) {
      const tags1 = article1.tags as string[];
      const tags2 = article2.tags as string[];
      const overlap = tags1.filter(t => tags2.includes(t)).length;
      score += Math.min(overlap * 0.1, 0.3);
    }

    return Math.min(score, 1);
  }

  /**
   * 计算法条与案件的相关性
   */
  private static calculateRelevanceForDebate(
    caseInfo: CaseInfo,
    article: LawArticle
  ): number {
    let score = 0;

    // 类型匹配加分
    if (article.category === caseInfo.type) {
      score += 0.5;
    }

    // 关键词匹配加分
    if (caseInfo.keywords && caseInfo.keywords.length > 0) {
      const articleKeywords = (article.keywords as string[]) || [];
      const matchCount = caseInfo.keywords.filter(
        k => articleKeywords.includes(k) || article.fullText.includes(k)
      ).length;
      score += Math.min(matchCount * 0.1, 0.5);
    }

    return Math.min(score, 1);
  }

  /**
   * 计算法条与合同的相关性
   */
  private static calculateRelevanceForContract(
    contractInfo: ContractInfo,
    article: LawArticle
  ): number {
    let score = 0;

    // 合同类型匹配
    if (
      article.fullText.includes(contractInfo.type) ||
      article.fullText.includes('合同')
    ) {
      score += 0.5;
    }

    // 内容相关性
    const keywords = ['合同', '当事人', '权利', '义务', '违约'];
    const matchCount = keywords.filter(k =>
      article.fullText.includes(k)
    ).length;
    score += Math.min(matchCount * 0.1, 0.5);

    return Math.min(score, 1);
  }

  /**
   * 获取关系类型的推荐原因
   */
  private static getRelationReason(relationType: RelationType): string {
    const reasons: Record<RelationType, string> = {
      [RelationType.CITES]: '该法条引用了此法条',
      [RelationType.CITED_BY]: '该法条被此法条引用',
      [RelationType.CONFLICTS]: '该法条与此法条存在冲突',
      [RelationType.COMPLETES]: '该法条补充完善了此法条',
      [RelationType.COMPLETED_BY]: '该法条被此法条补充完善',
      [RelationType.SUPERSEDES]: '该法条替代了此法条',
      [RelationType.SUPERSEDED_BY]: '该法条被此法条替代',
      [RelationType.IMPLEMENTS]: '该法条实施了此法条',
      [RelationType.IMPLEMENTED_BY]: '该法条被此法条实施',
      [RelationType.RELATED]: '该法条与此法条相关',
    };

    return reasons[relationType] || '相关法条';
  }

  /**
   * 获取相似度推荐原因
   */
  private static getSimilarityReason(
    article1: LawArticle,
    article2: LawArticle
  ): string {
    const reasons: string[] = [];

    // 优先检查关键词相似度
    if (article1.keywords && article2.keywords) {
      const keywords1 = article1.keywords as string[];
      const keywords2 = article2.keywords as string[];
      const overlap = keywords1.filter(k => keywords2.includes(k));
      if (overlap.length > 0) {
        reasons.push(`关键词相似: ${overlap.slice(0, 3).join('、')}`);
      }
    }

    if (article1.category === article2.category) {
      reasons.push('相同分类');
    }

    return reasons.length > 0 ? reasons.join('，') : '内容相似';
  }

  /**
   * 获取辩论推荐原因
   */
  private static getDebateRecommendationReason(
    caseInfo: CaseInfo,
    article: LawArticle
  ): string {
    const reasons: string[] = [];

    if (article.category === caseInfo.type) {
      reasons.push('案件类型匹配');
    }

    if (caseInfo.keywords && caseInfo.keywords.length > 0) {
      const articleKeywords = (article.keywords as string[]) || [];
      const matches = caseInfo.keywords.filter(
        k => articleKeywords.includes(k) || article.fullText.includes(k)
      );
      if (matches.length > 0) {
        reasons.push(`关键词匹配: ${matches.slice(0, 3).join('、')}`);
      }
    }

    return reasons.length > 0 ? reasons.join('，') : '相关法条';
  }

  /**
   * 去重推荐结果
   */
  private static deduplicateRecommendations(
    recommendations: RecommendationResult[],
    excludeIds: string[]
  ): RecommendationResult[] {
    const seen = new Set<string>(excludeIds);
    const unique: RecommendationResult[] = [];

    for (const rec of recommendations) {
      if (!seen.has(rec.article.id)) {
        seen.add(rec.article.id);
        unique.push(rec);
      }
    }

    return unique;
  }

  /**
   * 根据反馈数据调整推荐分数
   */
  static async adjustScoreByFeedback(
    articleId: string,
    baseScore: number
  ): Promise<number> {
    try {
      // 获取该法条的反馈统计
      const feedbacks = await prisma.recommendationFeedback.findMany({
        where: { lawArticleId: articleId },
        select: { feedbackType: true },
      });

      if (feedbacks.length === 0) {
        return baseScore;
      }

      // 计算反馈分数
      let feedbackScore = 0;
      const totalFeedbacks = feedbacks.length;

      for (const feedback of feedbacks) {
        switch (feedback.feedbackType) {
          case 'HELPFUL':
          case 'EXCELLENT':
            feedbackScore += 1;
            break;
          case 'NOT_HELPFUL':
            feedbackScore -= 0.5;
            break;
          case 'IRRELEVANT':
            feedbackScore -= 1;
            break;
        }
      }

      // 计算平均反馈分数（-1 到 1）
      const avgFeedbackScore = feedbackScore / totalFeedbacks;

      // 调整基础分数（最多调整 ±20%）
      const adjustment = avgFeedbackScore * 0.2;
      const adjustedScore = Math.max(0, Math.min(1, baseScore + adjustment));

      return adjustedScore;
    } catch (error) {
      logger.error('调整分数失败', error instanceof Error ? error : undefined);
      return baseScore;
    }
  }

  /**
   * 获取法条的反馈质量分数
   */
  static async getFeedbackQualityScore(articleId: string): Promise<number> {
    try {
      const feedbacks = await prisma.recommendationFeedback.findMany({
        where: { lawArticleId: articleId },
        select: { feedbackType: true },
      });

      if (feedbacks.length === 0) {
        return 0.5; // 默认中等质量
      }

      const helpfulCount = feedbacks.filter(
        f => f.feedbackType === 'HELPFUL' || f.feedbackType === 'EXCELLENT'
      ).length;

      return helpfulCount / feedbacks.length;
    } catch (error) {
      logger.error(
        '获取反馈质量分数失败',
        error instanceof Error ? error : undefined
      );
      return 0.5;
    }
  }

  /**
   * 过滤低质量推荐
   */
  static async filterLowQualityRecommendations(
    recommendations: RecommendationResult[]
  ): Promise<RecommendationResult[]> {
    const filtered: RecommendationResult[] = [];

    for (const rec of recommendations) {
      const feedbacks = await prisma.recommendationFeedback.findMany({
        where: { lawArticleId: rec.article.id },
      });

      // 如果反馈数>=5 且质量分数<30%，则过滤掉
      if (feedbacks.length >= 5) {
        const qualityScore = await this.getFeedbackQualityScore(rec.article.id);
        if (qualityScore < 0.3) {
          continue; // 跳过低质量推荐
        }
      }

      filtered.push(rec);
    }

    return filtered;
  }

  /**
   * 基于反馈优化推荐排序
   */
  static async optimizeRecommendationOrder(
    recommendations: RecommendationResult[]
  ): Promise<RecommendationResult[]> {
    const optimized: Array<RecommendationResult & { adjustedScore: number }> =
      [];

    for (const rec of recommendations) {
      const adjustedScore = await this.adjustScoreByFeedback(
        rec.article.id,
        rec.score
      );

      optimized.push({
        ...rec,
        adjustedScore,
      });
    }

    // 按调整后的分数排序
    optimized.sort((a, b) => b.adjustedScore - a.adjustedScore);

    return optimized;
  }

  /**
   * 应用反馈优化到推荐结果
   */
  static async applyFeedbackOptimization(
    recommendations: RecommendationResult[]
  ): Promise<RecommendationResult[]> {
    // 1. 过滤低质量推荐
    const filtered =
      await this.filterLowQualityRecommendations(recommendations);

    // 2. 优化排序
    const optimized = await this.optimizeRecommendationOrder(filtered);

    return optimized;
  }

  /**
   * 基于图谱多跳距离推荐相关法条
   *
   * 相比 recommendByRelations（仅查直接邻居），此方法沿关系链
   * 最多走 3 步，发现更丰富的间接相关法条，并附带路径说明。
   */
  static async recommendByGraphDistance(
    articleId: string,
    options: RecommendationOptions = {}
  ): Promise<GraphDistanceRecommendation[]> {
    const { limit = 10 } = options;
    return GraphDistanceRecommender.recommend(articleId, limit);
  }
}

// 导出 GraphDistanceRecommendation 类型，供 API 和前端使用
export type { GraphDistanceRecommendation };
