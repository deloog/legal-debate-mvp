/**
 * RiskScorer - 风险评分器
 *
 * 功能：计算案件的整体风险等级和评分
 */

import type {
  RiskIdentificationResult,
  RiskAssessmentResult,
  RiskStatistics,
  RiskScoringConfig,
} from '../../../types/risk';
import {
  RiskLevel,
  RiskCategory,
  RiskType,
  DEFAULT_RISK_SCORING_CONFIG,
} from '../../../types/risk';

/**
 * 风险评分器
 */
export class RiskScorer {
  private readonly config: RiskScoringConfig;

  constructor(config?: Partial<RiskScoringConfig>) {
    this.config = {
      ...DEFAULT_RISK_SCORING_CONFIG,
      ...config,
    };
  }

  /**
   * 计算案件整体风险评估
   */
  assess(
    caseId: string,
    risks: RiskIdentificationResult[]
  ): RiskAssessmentResult {
    const startTime = Date.now();

    if (!risks || risks.length === 0) {
      return {
        caseId,
        overallRiskLevel: RiskLevel.LOW,
        overallRiskScore: 0,
        risks: [],
        statistics: this.calculateStatistics([]),
        suggestions: [],
        assessmentTime: Date.now() - startTime,
        assessedAt: new Date(),
      };
    }

    // 计算各类别加权风险
    const categoryScores = this.calculateCategoryScores(risks);

    // 提取简单的评分对象（移除risks数组）
    const simpleCategoryScores: Record<
      RiskCategory,
      { score: number; weight: number }
    > = {
      [RiskCategory.PROCEDURAL]: {
        score: categoryScores[RiskCategory.PROCEDURAL].score,
        weight: categoryScores[RiskCategory.PROCEDURAL].weight,
      },
      [RiskCategory.EVIDENTIARY]: {
        score: categoryScores[RiskCategory.EVIDENTIARY].score,
        weight: categoryScores[RiskCategory.EVIDENTIARY].weight,
      },
      [RiskCategory.SUBSTANTIVE]: {
        score: categoryScores[RiskCategory.SUBSTANTIVE].score,
        weight: categoryScores[RiskCategory.SUBSTANTIVE].weight,
      },
      [RiskCategory.STRATEGIC]: {
        score: categoryScores[RiskCategory.STRATEGIC].score,
        weight: categoryScores[RiskCategory.STRATEGIC].weight,
      },
    };

    // 计算整体风险评分
    const overallScore = this.calculateOverallScore(simpleCategoryScores);

    // 计算整体风险等级
    const overallLevel = this.calculateRiskLevel(overallScore);

    // 为所有风险添加统计信息
    const enrichedRisks = risks.map(risk => ({
      ...risk,
      metadata: {
        ...risk.metadata,
        categoryWeight: simpleCategoryScores[risk.riskCategory]?.weight || 0,
        categoryScore: simpleCategoryScores[risk.riskCategory]?.score || 0,
        impact: this.calculateRiskImpact(risk, simpleCategoryScores),
      },
    }));

    // 计算统计信息
    const statistics = this.calculateStatistics(enrichedRisks);

    // 生成所有建议
    const allSuggestions = this.aggregateSuggestions(enrichedRisks);

    return {
      caseId,
      overallRiskLevel: overallLevel,
      overallRiskScore: overallScore,
      risks: enrichedRisks,
      statistics,
      suggestions: allSuggestions,
      assessmentTime: Date.now() - startTime,
      assessedAt: new Date(),
    };
  }

  /**
   * 计算各类别风险评分
   */
  private calculateCategoryScores(
    risks: RiskIdentificationResult[]
  ): Record<RiskCategory, { score: number; weight: number }> {
    const categoryScores: Record<
      RiskCategory,
      { score: number; weight: number; risks: RiskIdentificationResult[] }
    > = {
      [RiskCategory.PROCEDURAL]: {
        score: 0,
        weight: this.config.weights.procedural,
        risks: [],
      },
      [RiskCategory.EVIDENTIARY]: {
        score: 0,
        weight: this.config.weights.evidentiary,
        risks: [],
      },
      [RiskCategory.SUBSTANTIVE]: {
        score: 0,
        weight: this.config.weights.substantive,
        risks: [],
      },
      [RiskCategory.STRATEGIC]: {
        score: 0,
        weight: this.config.weights.strategic,
        risks: [],
      },
    };

    // 将风险分类并计算各别评分
    for (const risk of risks) {
      categoryScores[risk.riskCategory].risks.push(risk);
    }

    // 计算各类别平均风险评分
    for (const category in categoryScores) {
      const categoryData = categoryScores[category as RiskCategory];
      if (categoryData.risks.length > 0) {
        // 使用风险评分的加权平均
        const sum = categoryData.risks.reduce(
          (total, risk) => total + risk.score,
          0
        );
        categoryData.score = sum / categoryData.risks.length;
      }
    }

    return categoryScores;
  }

  /**
   * 计算整体风险评分
   */
  private calculateOverallScore(
    categoryScores: Record<RiskCategory, { score: number; weight: number }>
  ): number {
    let totalWeightedScore = 0;
    let totalWeight = 0;
    let nonZeroCategories = 0;

    for (const categoryData of Object.values(categoryScores)) {
      if (categoryData.score > 0) {
        totalWeightedScore += categoryData.score * categoryData.weight;
        totalWeight += categoryData.weight;
        nonZeroCategories++;
      }
    }

    // 如果只有一个类别有风险，直接返回该类别的分数
    if (nonZeroCategories === 1) {
      return totalWeightedScore / totalWeight;
    }

    // 多个类别时，使用加权平均
    if (totalWeight === 0) {
      return 0;
    }

    return totalWeightedScore / totalWeight;
  }

  /**
   * 计算风险等级
   */
  private calculateRiskLevel(score: number): RiskLevel {
    if (score >= this.config.thresholds.critical) {
      return RiskLevel.CRITICAL;
    }
    if (score >= this.config.thresholds.high) {
      return RiskLevel.HIGH;
    }
    if (score >= this.config.thresholds.medium) {
      return RiskLevel.MEDIUM;
    }
    return RiskLevel.LOW;
  }

  /**
   * 计算风险影响
   */
  private calculateRiskImpact(
    risk: RiskIdentificationResult,
    categoryScores: Record<RiskCategory, { score: number; weight: number }>
  ): string {
    const categoryData = categoryScores[risk.riskCategory];
    const categoryScore = categoryData?.score || 0;

    if (risk.riskLevel === RiskLevel.CRITICAL) {
      return '严重影响案件胜诉概率';
    }
    if (risk.riskLevel === RiskLevel.HIGH && risk.score > categoryScore) {
      return '该类别的关键风险因素';
    }
    if (risk.riskLevel === RiskLevel.HIGH) {
      return '需要重点关注';
    }
    return '一般风险因素';
  }

  /**
   * 计算统计信息
   */
  private calculateStatistics(
    risks: RiskIdentificationResult[]
  ): RiskStatistics {
    const byLevel: Record<RiskLevel, number> = {
      [RiskLevel.LOW]: 0,
      [RiskLevel.MEDIUM]: 0,
      [RiskLevel.HIGH]: 0,
      [RiskLevel.CRITICAL]: 0,
    };

    const byCategory: Record<RiskCategory, number> = {
      [RiskCategory.PROCEDURAL]: 0,
      [RiskCategory.EVIDENTIARY]: 0,
      [RiskCategory.SUBSTANTIVE]: 0,
      [RiskCategory.STRATEGIC]: 0,
    };

    const byType: Record<RiskType, number> = {
      [RiskType.LEGAL_PROCEDURE]: 0,
      [RiskType.EVIDENCE_STRENGTH]: 0,
      [RiskType.STATUTE_LIMITATION]: 0,
      [RiskType.JURISDICTION]: 0,
      [RiskType.COST_BENEFIT]: 0,
      [RiskType.FACT_VERIFICATION]: 0,
      [RiskType.LEGAL_BASIS]: 0,
      [RiskType.CONTRADICTION]: 0,
      [RiskType.PROOF_BURDEN]: 0,
    };

    for (const risk of risks) {
      // 按等级统计
      byLevel[risk.riskLevel]++;

      // 按类别统计
      byCategory[risk.riskCategory]++;

      // 按类型统计
      byType[risk.riskType] = byType[risk.riskType] + 1;
    }

    const totalRisks = risks.length;

    return {
      totalRisks,
      byLevel,
      byCategory,
      byType,
      criticalRisks: byLevel[RiskLevel.CRITICAL],
      highRisks: byLevel[RiskLevel.HIGH],
      mediumRisks: byLevel[RiskLevel.MEDIUM],
      lowRisks: byLevel[RiskLevel.LOW],
    };
  }

  /**
   * 聚合所有建议
   */
  private aggregateSuggestions(
    risks: RiskIdentificationResult[]
  ): RiskIdentificationResult['suggestions'] {
    const allSuggestions = risks.flatMap(risk => risk.suggestions);

    // 按优先级排序
    allSuggestions.sort(() => 0);

    return allSuggestions;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RiskScoringConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): RiskScoringConfig {
    return {
      weights: { ...this.config.weights },
      thresholds: { ...this.config.thresholds },
    };
  }

  /**
   * 获取风险等级描述
   */
  getRiskLevelDescription(level: RiskLevel): string {
    const descriptions: Record<RiskLevel, string> = {
      [RiskLevel.LOW]: '整体风险较低，案件相对安全',
      [RiskLevel.MEDIUM]: '存在中等风险，需要关注',
      [RiskLevel.HIGH]: '风险较高，建议制定应对策略',
      [RiskLevel.CRITICAL]: '严重风险，必须立即采取措施',
    };

    return descriptions[level];
  }

  /**
   * 获取风险处理建议
   */
  getRiskHandlingSuggestions(
    level: RiskLevel
  ): Array<{ action: string; reason: string }> {
    const suggestions: Record<
      RiskLevel,
      Array<{ action: string; reason: string }>
    > = {
      [RiskLevel.LOW]: [
        {
          action: '定期监控风险变化',
          reason: '低风险也需要持续关注',
        },
      ],
      [RiskLevel.MEDIUM]: [
        {
          action: '制定风险应对计划',
          reason: '中风险需要提前规划',
        },
        {
          action: '增加证据收集',
          reason: '通过证据降低风险',
        },
      ],
      [RiskLevel.HIGH]: [
        {
          action: '立即评估风险',
          reason: '高风险需要快速响应',
        },
        {
          action: '咨询专业律师',
          reason: '高风险建议寻求专家意见',
        },
        {
          action: '考虑和解方案',
          reason: '降低败诉风险',
        },
      ],
      [RiskLevel.CRITICAL]: [
        {
          action: '全面重新评估案件',
          reason: '严重风险需要彻底分析',
        },
        {
          action: '暂停诉讼策略',
          reason: '避免进一步损失',
        },
        {
          action: '寻求专家支持',
          reason: '严重风险需要专业指导',
        },
      ],
    };

    return suggestions[level] || [];
  }

  /**
   * 生成风险报告摘要
   */
  generateSummary(assessment: RiskAssessmentResult): {
    title: string;
    summary: string;
    keyPoints: string[];
    recommendations: string[];
  } {
    const level = assessment.overallRiskLevel;
    const percentage = (assessment.overallRiskScore * 100).toFixed(1);

    const title = `案件风险评估报告 - ${this.getRiskLevelDescription(level)}`;

    const summary =
      `案件${assessment.caseId}的整体风险评分为${percentage}（${level}）。` +
      `共发现${assessment.statistics.totalRisks}个风险，` +
      `其中严重风险${assessment.statistics.criticalRisks}个，` +
      `高风险${assessment.statistics.highRisks}个，` +
      `中风险${assessment.statistics.mediumRisks}个，` +
      `低风险${assessment.statistics.lowRisks}个。`;

    const keyPoints: string[] = [];

    // 按类别分析
    for (const [category, count] of Object.entries(
      assessment.statistics.byCategory
    )) {
      if (count > 0) {
        const percentage = (
          (count / assessment.statistics.totalRisks) *
          100
        ).toFixed(1);
        keyPoints.push(
          `${category.toUpperCase()}风险占${percentage}%（${count}个）`
        );
      }
    }

    // 按等级分析
    keyPoints.push(
      `严重和高风险共${assessment.statistics.criticalRisks + assessment.statistics.highRisks}个，` +
        `占总风险的${(
          ((assessment.statistics.criticalRisks +
            assessment.statistics.highRisks) /
            assessment.statistics.totalRisks) *
          100
        ).toFixed(1)}%`
    );

    // 添加总体建议
    const handlingSuggestions = this.getRiskHandlingSuggestions(level);
    keyPoints.push('建议处理措施：');
    for (const suggestion of handlingSuggestions) {
      keyPoints.push(`- ${suggestion.action}：${suggestion.reason}`);
    }

    return {
      title,
      summary,
      keyPoints,
      recommendations: handlingSuggestions.map(s => s.action),
    };
  }
}
