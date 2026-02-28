/**
 * AI检测器
 *
 * 功能：
 * 1. 使用AI分析法条之间的关系
 * 2. 批量分析优化
 * 3. 预筛选机制
 * 4. 降级策略
 */

import { LawArticle, RelationType } from '@prisma/client';
import { getOpenAICompletion } from '@/lib/ai/openai-client';
import { logger } from '@/lib/logger';
import { AI_DETECTOR_CONFIG } from './ai-detector-config';
import { AICostMonitor } from './ai-cost-monitor';
import {
  AIConfidenceConfig,
  ThresholdValidationResult,
} from '@/lib/law-article/ai-confidence-config';

/**
 * 关系分析结果
 */
export interface RelationAnalysis {
  relations: RelationInfo[];
  aiProvider: string;
  aiModel: string;
  aiConfidence: number;
}

/**
 * 关系信息
 */
export interface RelationInfo {
  type: RelationType | 'NONE';
  confidence: number;
  reason: string;
  evidence: string;
  validation?: ThresholdValidationResult;
}

/**
 * AI检测器
 */
export class AIDetector {
  /**
   * 分析两个法条之间的关系
   *
   * @param article1 法条1
   * @param article2 法条2
   * @param options 可选参数
   * @returns 关系分析结果
   */
  static async detectRelations(
    article1: LawArticle,
    article2: LawArticle,
    options?: {
      aiProvider?: string;
      aiModel?: string;
      skipValidation?: boolean;
    }
  ): Promise<RelationAnalysis> {
    const aiProvider = options?.aiProvider || 'openai';
    const aiModel = options?.aiModel || 'gpt-4';
    const prompt = `分析以下两个法条之间的关系：

【法条A】
法律名称：${article1.lawName}
条号：${article1.articleNumber}
内容：${article1.fullText.slice(0, AI_DETECTOR_CONFIG.maxTextLength)}

【法条B】
法律名称：${article2.lawName}
条号：${article2.articleNumber}
内容：${article2.fullText.slice(0, AI_DETECTOR_CONFIG.maxTextLength)}

请判断它们之间是否存在以下关系（可多选）：
1. CITES（引用）：A明确引用B
2. CITED_BY（被引用）：B被A引用
3. CONFLICTS（冲突）：A与B在适用条件重叠时结论不同
4. COMPLETES（补全）：A补充完善B的规定
5. IMPLEMENTS（实施）：A是B的实施细则
6. RELATED（相关）：存在一般关联
7. NONE（无关系）：不存在明确关系

返回JSON格式：
{
  "relations": [
    {
      "type": "CITES" | "CITED_BY" | "CONFLICTS" | "COMPLETES" | "IMPLEMENTS" | "RELATED" | "NONE",
      "confidence": 0.0-1.0,
      "reason": "关系存在的理由",
      "evidence": "支持该关系的具体文本"
    }
  ]
}`;

    try {
      const response = await getOpenAICompletion(prompt, {
        temperature: AI_DETECTOR_CONFIG.temperature,
        maxTokens: AI_DETECTOR_CONFIG.maxTokens,
      });

      const result = JSON.parse(response) as RelationAnalysis;

      // 过滤掉无关系的结果
      result.relations = result.relations.filter(
        (r: RelationInfo) => r.type !== 'NONE'
      );

      // 如果不跳过验证，进行置信度阈值验证
      if (!options?.skipValidation) {
        for (const relation of result.relations) {
          if (relation.type !== 'NONE') {
            const validation = AIConfidenceConfig.validateThreshold(
              relation.confidence,
              relation.type as RelationType,
              {
                aiProvider,
                aiModel,
              }
            );
            relation.validation = validation;

            // 标记低于最小阈值的关系
            if (validation.action === 'REJECT') {
              logger.warn(`AI检测关系置信度过低，将被过滤`, {
                article1Id: article1.id,
                article2Id: article2.id,
                relationType: relation.type,
                confidence: relation.confidence,
                threshold: validation.threshold,
              });
            }
          }
        }

        // 过滤掉被拒绝的关系
        result.relations = result.relations.filter(
          r => r.validation?.action !== 'REJECT'
        );
      } else {
        // 跳过验证时，仍然过滤低于最小阈值的
        result.relations = result.relations.filter(
          (r: RelationInfo) =>
            r.confidence >= AI_DETECTOR_CONFIG.minConfidenceThreshold
        );
      }

      // 添加AI元数据
      result.aiProvider = aiProvider;
      result.aiModel = aiModel;
      result.aiConfidence =
        result.relations.length > 0
          ? Math.max(...result.relations.map(r => r.confidence))
          : 0;

      logger.info('AI关系检测完成', {
        article1Id: article1.id,
        article2Id: article2.id,
        relationsCount: result.relations.length,
        aiProvider,
        aiModel,
      });

      return result;
    } catch (error) {
      logger.error('AI关系检测失败', {
        error,
        article1Id: article1.id,
        article2Id: article2.id,
      });

      // 降级处理
      if (AI_DETECTOR_CONFIG.fallbackToRuleBasedOnError) {
        logger.info('AI服务失败，使用规则匹配降级');
      }

      return {
        relations: [],
        aiProvider,
        aiModel,
        aiConfidence: 0,
      };
    }
  }

  /**
   * 批量分析关系（优化成本）
   *
   * @param sourceArticle 源法条
   * @param candidateArticles 候选法条列表
   * @param options 可选参数
   * @returns 关系分析结果映射
   */
  static async batchDetectRelations(
    sourceArticle: LawArticle,
    candidateArticles: LawArticle[],
    options?: {
      aiProvider?: string;
      aiModel?: string;
      skipValidation?: boolean;
    }
  ): Promise<Map<string, RelationAnalysis>> {
    // 先用规则过滤，只对可能相关的法条调用AI
    const filtered = candidateArticles.filter(candidate =>
      this.isPotentiallyRelated(sourceArticle, candidate)
    );

    // 检查成本限制
    const estimatedCost = 0.05 * filtered.length;
    if (!(await AICostMonitor.trackCall(estimatedCost))) {
      logger.info('AI成本限制，跳过批量检测', {
        estimatedCost,
        filteredCount: filtered.length,
      });
      return new Map();
    }

    const results = new Map<string, RelationAnalysis>();

    // 批量调用AI
    const batchSize = AI_DETECTOR_CONFIG.maxBatchSize;
    let totalRelations = 0;
    let totalRejected = 0;

    for (let i = 0; i < filtered.length; i += batchSize) {
      const batch = filtered.slice(i, i + batchSize);
      const promises = batch.map(candidate =>
        this.detectRelations(sourceArticle, candidate, options)
          .then(result => {
            totalRelations += result.relations.length;
            totalRejected += result.relations.filter(
              r => r.validation?.action === 'REJECT'
            ).length;
            return { id: candidate.id, result };
          })
          .catch(error => {
            logger.error(`分析法条 ${candidate.id} 失败`, {
              error,
              candidateId: candidate.id,
            });
            return {
              id: candidate.id,
              result: {
                relations: [],
                aiProvider: options?.aiProvider || 'openai',
                aiModel: options?.aiModel || 'gpt-4',
                aiConfidence: 0,
              },
            };
          })
      );

      const batchResults = await Promise.all(promises);
      for (const { id, result } of batchResults) {
        results.set(id, result);
      }
    }

    logger.info('批量AI关系检测完成', {
      sourceArticleId: sourceArticle.id,
      candidateCount: candidateArticles.length,
      filteredCount: filtered.length,
      resultsCount: results.size,
      totalRelations,
      totalRejected,
      skipValidation: options?.skipValidation,
    });

    return results;
  }

  /**
   * 快速预筛选（避免无意义的AI调用）
   *
   * @param a 法条A
   * @param b 法条B
   * @returns 是否可能相关
   */
  private static isPotentiallyRelated(a: LawArticle, b: LawArticle): boolean {
    // 同一法律的法条
    if (a.lawName === b.lawName) {
      // 只检测相邻法条
      const numA = parseInt(a.articleNumber) || 0;
      const numB = parseInt(b.articleNumber) || 0;
      return Math.abs(numA - numB) <= 10;
    }

    // 分类相同或相近
    if (a.category === b.category) return true;

    // 标签有交集
    if (a.tags && b.tags) {
      const tagOverlap = a.tags.filter(tag => b.tags.includes(tag));
      if (tagOverlap.length > 0) return true;
    }

    // 关键词有交集（至少2个）
    if (a.keywords && b.keywords) {
      const keywordOverlap = a.keywords.filter(kw => b.keywords.includes(kw));
      if (keywordOverlap.length >= 2) return true;
    }

    return false;
  }
}
