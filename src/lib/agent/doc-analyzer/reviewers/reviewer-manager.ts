/**
 * 审查管理器 - 负责协调多个审查器的执行
 * 
 * 核心功能：
 * - 管理审查器的注册和执行
 * - 协调审查流程顺序
 * - 汇总审查结果
 * - 根据配置启用/禁用特定审查器
 */

import type {
  ExtractedData,
  ReviewResult,
  ReviewerConfig,
  Correction
} from '../core/types';
import { logger } from '../../../agent/security/logger';
import { DEFAULT_CONFIG } from '../core/constants';

/**
 * 审查器接口
 */
export interface IReviewer {
  readonly name: string;
  review(
    data: ExtractedData,
    fullText: string,
    config: ReviewerConfig
  ): Promise<ReviewResult>;
}

/**
 * 审查管理器
 */
export class ReviewerManager {
  private reviewers: Map<string, IReviewer> = new Map();

  constructor() {
    logger.info('ReviewerManager初始化');
  }

  /**
   * 注册审查器
   */
  public registerReviewer(reviewer: IReviewer): void {
    this.reviewers.set(reviewer.name, reviewer);
    logger.info('审查器已注册', { reviewer: reviewer.name });
  }

  /**
   * 注销审查器
   */
  public unregisterReviewer(name: string): void {
    this.reviewers.delete(name);
    logger.info('审查器已注销', { reviewer: name });
  }

  /**
   * 执行审查
   */
  public async review(
    data: ExtractedData,
    fullText: string,
    config?: Partial<ReviewerConfig>
  ): Promise<{
    passed: boolean;
    score: number;
    issues: Array<any>;
    corrections: Correction[];
    details: Array<{ reviewer: string; result: ReviewResult }>;
  }> {
    const mergedConfig = {
      ...DEFAULT_CONFIG.reviewers.ruleReviewer,
      ...config
    };

    logger.info('开始审查流程', {
      reviewerCount: this.reviewers.size,
      enabled: mergedConfig.enabled
    });

    if (!mergedConfig.enabled || this.reviewers.size === 0) {
      logger.info('审查流程跳过（未启用或无审查器）');
      return {
        passed: true,
        score: 1.0,
        issues: [],
        corrections: [],
        details: []
      };
    }

    const results: Array<{ reviewer: string; result: ReviewResult }> = [];
    const allIssues: Array<any> = [];
    const allCorrections: Correction[] = [];

    // 顺序执行所有注册的审查器
    for (const [name, reviewer] of this.reviewers) {
      try {
        logger.debug('执行审查器', { reviewer: name });
        const result = await reviewer.review(data, fullText, mergedConfig);
        results.push({ reviewer: name, result });

        allIssues.push(...result.issues);
        allCorrections.push(...result.corrections);

        logger.debug('审查器执行完成', {
          reviewer: name,
          passed: result.passed,
          score: result.score,
          issues: result.issues.length
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`审查器执行失败: ${name} - ${errorMessage}`);
        // 继续执行其他审查器
      }
    }

    // 计算综合评分
    const overallScore = this.calculateOverallScore(results);

    // 判断是否通过阈值
    const passed = overallScore >= mergedConfig.threshold;

    logger.info('审查流程完成', {
      passed,
      score: overallScore,
      threshold: mergedConfig.threshold,
      issues: allIssues.length,
      corrections: allCorrections.length
    });

    return {
      passed,
      score: overallScore,
      issues: allIssues,
      corrections: allCorrections,
      details: results
    };
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(
    results: Array<{ reviewer: string; result: ReviewResult }>
  ): number {
    if (results.length === 0) {
      return 1.0;
    }

    // 使用平均分作为综合评分
    const totalScore = results.reduce(
      (sum, { result }) => sum + result.score,
      0
    );

    return totalScore / results.length;
  }

  /**
   * 获取已注册的审查器列表
   */
  public getReviewers(): string[] {
    return Array.from(this.reviewers.keys());
  }

  /**
   * 检查审查器是否已注册
   */
  public hasReviewer(name: string): boolean {
    return this.reviewers.has(name);
  }
}
