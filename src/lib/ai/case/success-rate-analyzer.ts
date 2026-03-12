import { logger } from '@/lib/agent/security/logger';
import { CaseResult } from '@prisma/client';
import type {
  SimilarCaseMatch,
  SuccessRateAnalysis,
  SuccessRateAnalysisParams,
} from '../../../types/case-example';

/**
 * 胜败率分析器配置接口
 */
interface SuccessRateAnalyzerConfig {
  minSampleSize: number;
  confidenceThreshold: number;
  weightBySimilarity: boolean;
}

/**
 * 胜败率统计接口
 */
interface SuccessRateStatistics {
  totalCount: number;
  winCount: number;
  loseCount: number;
  partialCount: number;
  withdrawCount: number;
  weightedWinRate: number;
  simpleWinRate: number;
}

/**
 * 胜败率分析器类
 * 负责基于相似案例检索结果分析胜败率
 */
export class SuccessRateAnalyzer {
  private config: SuccessRateAnalyzerConfig;

  constructor(config?: Partial<SuccessRateAnalyzerConfig>) {
    this.config = {
      minSampleSize: 5,
      confidenceThreshold: 0.7,
      weightBySimilarity: true,
      ...config,
    };
  }

  /**
   * 分析胜败率
   */
  public analyze(
    params: SuccessRateAnalysisParams,
    matches: SimilarCaseMatch[]
  ): SuccessRateAnalysis {
    try {
      // 过滤相似度低于阈值的案例
      const filteredMatches = matches.filter(
        m => m.similarity >= (params.minSimilarity ?? 0.6)
      );

      // 限制案例数量
      const limitedMatches = filteredMatches.slice(0, params.maxCases ?? 20);

      // 统计胜败情况
      const stats = this.calculateStatistics(limitedMatches);

      // 计算胜诉概率
      const winProbability = params.includePartial
        ? this.calculateWinProbability(stats, params.includeWithdraw ?? false)
        : this.calculateWinProbability(stats, params.includeWithdraw ?? false);

      // 计算置信度
      const confidence = this.calculateConfidence(limitedMatches);

      // 分析趋势
      const trend = this.analyzeTrend(limitedMatches);

      // 生成建议和风险评估
      const analysis = this.generateAnalysis(
        stats,
        confidence,
        trend,
        winProbability
      );

      return {
        caseId: params.caseId,
        winRate: stats.simpleWinRate,
        winProbability,
        confidence,
        similarCasesCount: limitedMatches.length,
        winCasesCount: stats.winCount,
        loseCasesCount: stats.loseCount,
        partialCasesCount: stats.partialCount,
        withdrawCasesCount: stats.withdrawCount,
        analysis,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to analyze success rate', new Error(errorMessage), {
        caseId: params.caseId,
      });
      throw error;
    }
  }

  /**
   * 计算胜败统计
   */
  private calculateStatistics(
    matches: SimilarCaseMatch[]
  ): SuccessRateStatistics {
    const stats: SuccessRateStatistics = {
      totalCount: matches.length,
      winCount: 0,
      loseCount: 0,
      partialCount: 0,
      withdrawCount: 0,
      weightedWinRate: 0,
      simpleWinRate: 0,
    };

    if (matches.length === 0) {
      return stats;
    }

    let totalWeight = 0;
    let weightedWinSum = 0;

    for (const match of matches) {
      const result = match.caseExample.result;

      switch (result) {
        case CaseResult.WIN:
          stats.winCount++;
          weightedWinSum += match.similarity;
          break;
        case CaseResult.LOSE:
          stats.loseCount++;
          break;
        case CaseResult.PARTIAL:
          stats.partialCount++;
          weightedWinSum += match.similarity * 0.5;
          break;
        case CaseResult.WITHDRAW:
          stats.withdrawCount++;
          break;
      }

      if (this.config.weightBySimilarity) {
        totalWeight += match.similarity;
      }
    }

    // 计算加权胜率
    if (totalWeight > 0) {
      stats.weightedWinRate = weightedWinSum / totalWeight;
    }

    // 计算简单胜率
    if (matches.length > 0) {
      stats.simpleWinRate = stats.winCount / matches.length;
    }

    return stats;
  }

  /**
   * 计算胜诉概率
   */
  private calculateWinProbability(
    stats: SuccessRateStatistics,
    includeWithdraw: boolean
  ): number {
    let total = stats.totalCount;
    let wins = stats.winCount;

    // 如果包含撤诉，排除撤诉案例
    if (!includeWithdraw) {
      total -= stats.withdrawCount;
    }

    if (total <= 0) {
      return 0; // 没有案例时返回0
    }

    // 如果没有LOSE案例但有PARTIAL案例，PARTIAL不参与计算
    if (stats.loseCount === 0 && stats.partialCount > 0) {
      total -= stats.partialCount;
    } else {
      // 否则PARTIAL按50%计入胜诉
      wins += stats.partialCount * 0.5;
    }

    return Math.min(1, Math.max(0, wins / total));
  }

  /**
   * 计算置信度
   * @param matches - 相似案例列表
   * @returns 置信度（0-1）
   */
  private calculateConfidence(matches: SimilarCaseMatch[]): number {
    // 样本数量不足，置信度低
    if (matches.length < this.config.minSampleSize) {
      return (matches.length / this.config.minSampleSize) * 0.5;
    }

    // 相似度分布 - 基于平均相似度计算
    const similarities = matches.map(m => m.similarity);
    const avgSimilarity =
      similarities.reduce((sum, s) => sum + s, 0) / similarities.length;

    // 相似度评分：平均相似度越高，置信度越高
    const similarityScore = avgSimilarity;

    // 样本评分：达到minSampleSize就有较高置信度
    const sampleScore = 1.0;

    // 综合评分：平均相似度和样本评分各占50%
    const confidence = (similarityScore + sampleScore) / 2;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * 分析趋势
   */
  private analyzeTrend(
    matches: SimilarCaseMatch[]
  ): 'increasing' | 'decreasing' | 'stable' {
    if (matches.length < 3) {
      return 'stable';
    }

    // 按判决日期排序（最近的在前）
    const sortedMatches = [...matches].sort(
      (a, b) =>
        new Date(b.caseExample.judgmentDate).getTime() -
        new Date(a.caseExample.judgmentDate).getTime()
    );

    // 计算最近一半案例的胜率
    const halfIndex = Math.floor(sortedMatches.length / 2);
    const recentMatches = sortedMatches.slice(0, halfIndex);
    const olderMatches = sortedMatches.slice(halfIndex);

    const recentWinRate = this.calculateSimpleWinRate(recentMatches);
    const olderWinRate = this.calculateSimpleWinRate(olderMatches);

    // 比较趋势
    const diff = recentWinRate - olderWinRate;
    if (diff > 0.1) {
      return 'increasing';
    }
    if (diff < -0.1) {
      return 'decreasing';
    }
    return 'stable';
  }

  /**
   * 计算简单胜率
   */
  private calculateSimpleWinRate(matches: SimilarCaseMatch[]): number {
    if (matches.length === 0) {
      return 0.5;
    }

    const winCount = matches.filter(
      m => m.caseExample.result === CaseResult.WIN
    ).length;

    return winCount / matches.length;
  }

  /**
   * 生成分析建议
   */
  private generateAnalysis(
    stats: SuccessRateStatistics,
    confidence: number,
    trend: 'increasing' | 'decreasing' | 'stable',
    winProbability: number
  ): SuccessRateAnalysis['analysis'] {
    // 确定风险等级
    const riskLevel = this.determineRiskLevel(winProbability, confidence);

    // 生成建议
    const recommendation = this.generateRecommendation(
      stats,
      confidence,
      trend,
      riskLevel
    );

    return {
      trend,
      recommendation,
      riskLevel,
    };
  }

  /**
   * 确定风险等级
   */
  private determineRiskLevel(
    winProbability: number,
    confidence: number
  ): 'low' | 'medium' | 'high' {
    // 置信度低，风险高
    if (confidence < this.config.confidenceThreshold) {
      return 'high';
    }

    // 根据胜诉概率判断
    if (winProbability >= 0.7) {
      return 'low';
    }
    if (winProbability >= 0.4) {
      return 'medium';
    }
    return 'high';
  }

  /**
   * 生成建议
   */
  private generateRecommendation(
    stats: SuccessRateStatistics,
    confidence: number,
    trend: 'increasing' | 'decreasing' | 'stable',
    riskLevel: 'low' | 'medium' | 'high'
  ): string {
    const parts: string[] = [];

    // 基于风险等级的建议
    if (riskLevel === 'low') {
      parts.push('案件胜诉概率较高，建议积极准备案件。');
    } else if (riskLevel === 'medium') {
      parts.push('案件存在一定风险，建议谨慎评估并准备备选方案。');
    } else {
      parts.push('案件风险较高，建议深入分析案件细节，考虑调解或和解。');
    }

    // 基于样本数量的建议
    if (stats.totalCount < this.config.minSampleSize) {
      parts.push(
        `相似案例数量较少（${stats.totalCount}个），分析结果的参考价值有限，建议寻找更多相似案例。`
      );
    }

    // 基于置信度的建议
    if (confidence < this.config.confidenceThreshold) {
      parts.push('分析结果置信度较低，建议结合其他分析方法综合判断。');
    }

    // 基于趋势的建议
    if (trend === 'increasing') {
      parts.push('近期类似案件胜诉率呈上升趋势，对案件有利。');
    } else if (trend === 'decreasing') {
      parts.push('近期类似案件胜诉率呈下降趋势，需重点关注。');
    }

    return parts.join(' ');
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<SuccessRateAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Success rate analyzer config updated', { ...this.config });
  }

  /**
   * 获取配置
   */
  public getConfig(): SuccessRateAnalyzerConfig {
    return { ...this.config };
  }
}

/**
 * 胜败率分析器工厂
 */
export class SuccessRateAnalyzerFactory {
  private static instances: Map<string, SuccessRateAnalyzer> = new Map();

  public static getInstance(
    name: string = 'default',
    config?: Partial<SuccessRateAnalyzerConfig>
  ): SuccessRateAnalyzer {
    let instance = this.instances.get(name);

    if (!instance) {
      instance = new SuccessRateAnalyzer(config);
      this.instances.set(name, instance);
    }

    return instance;
  }

  public static removeInstance(name: string): boolean {
    return this.instances.delete(name);
  }

  public static getAllInstances(): Map<string, SuccessRateAnalyzer> {
    return new Map(this.instances);
  }

  public static clearAllInstances(): void {
    this.instances.clear();
  }
}

export default SuccessRateAnalyzerFactory;
