/**
 * 风险评估器
 * 
 * 计算风险等级和置信度
 */

import type {
  AIStrategyResponse,
  RiskAssessment,
  RiskAssessmentConfig
} from './types';
import { logger } from '../security/logger';

// =============================================================================
// 风险评估器类
// =============================================================================

export class RiskAssessor {
  private config: RiskAssessmentConfig;

  constructor(config?: Partial<RiskAssessmentConfig>) {
    this.config = {
      confidenceThreshold: 0.7,
      highRiskThreshold: 0.7,
      mediumRiskThreshold: 0.4,
      enableDetailedAnalysis: true,
      ...config
    };
  }

  /**
   * 评估风险
   */
  assessRisks(aiResponse: AIStrategyResponse): RiskAssessment {
    logger.info('开始风险评估', {
      risksCount: aiResponse.risks.length
    });

    // 计算整体风险等级
    const overallRisk = this.calculateOverallRisk(aiResponse.risks);

    // 计算置信度
    const confidence = this.calculateConfidence(aiResponse);

    // 生成详细的风险因素分析
    const riskFactors = this.analyzeRiskFactors(aiResponse.risks);

    logger.info('风险评估完成', {
      overallRisk,
      confidence,
      riskFactorsCount: riskFactors.length
    });

    return {
      overallRisk,
      confidence,
      riskFactors
    };
  }

  /**
   * 计算整体风险等级
   */
  private calculateOverallRisk(risks: any[]): 'low' | 'medium' | 'high' {
    if (risks.length === 0) {
      return 'low';
    }

    // 计算加权风险分数
    const highImpactRisks = risks.filter((r: any) => r.impact === 'high');
    const mediumImpactRisks = risks.filter((r: any) => r.impact === 'medium');
    const lowImpactRisks = risks.filter((r: any) => r.impact === 'low');

    // 计算平均影响权重
    const highWeight = highImpactRisks.length * 3;
    const mediumWeight = mediumImpactRisks.length * 2;
    const lowWeight = lowImpactRisks.length * 1;
    const totalWeight = highWeight + mediumWeight + lowWeight;
    const maxPossibleWeight = risks.length * 3;

    // 计算加权风险分数
    const riskScore = totalWeight / maxPossibleWeight;

    // 根据阈值确定风险等级
    if (riskScore >= this.config.highRiskThreshold) {
      return 'high';
    } else if (riskScore >= this.config.mediumRiskThreshold) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(aiResponse: AIStrategyResponse): number {
    const factors: number[] = [];

    // SWOT分析完整性因子
    const swotItems = [
      aiResponse.swotAnalysis.strengths.length,
      aiResponse.swotAnalysis.weaknesses.length,
      aiResponse.swotAnalysis.opportunities.length,
      aiResponse.swotAnalysis.threats.length
    ];
    const avgSWOTItems = swotItems.reduce((a, b) => a + b, 0) / swotItems.length;
    factors.push(Math.min(avgSWOTItems / 5, 1)); // 5个为满分

    // 策略建议完整性因子
    factors.push(Math.min(aiResponse.strategies.length / 5, 1)); // 5个为满分

    // 风险评估完整性因子
    factors.push(Math.min(aiResponse.risks.length / 5, 1)); // 5个为满分

    // 实施步骤质量因子
    const validSteps = aiResponse.strategies.filter(
      (s: any) => s.implementationSteps && s.implementationSteps.length >= 3
    );
    factors.push(Math.min(validSteps.length / aiResponse.strategies.length, 1));

    // 计算综合置信度
    const confidence = factors.reduce((a, b) => a + b, 0) / factors.length;

    logger.debug('置信度计算', {
      factors,
      averageConfidence: confidence
    });

    return confidence;
  }

  /**
   * 分析风险因素
   */
  private analyzeRiskFactors(risks: any[]): Array<{
    factor: string;
    impact: 'low' | 'medium' | 'high';
    probability: number;
    mitigation: string;
  }> {
    return risks.map((risk: any, index: number) => ({
      factor: risk.factor || '',
      impact: risk.impact || 'medium',
      probability: this.normalizeProbability(risk.probability),
      mitigation: risk.mitigation || ''
    }));
  }

  /**
   * 标准化概率值
   */
  private normalizeProbability(probability: number): number {
    if (typeof probability !== 'number') {
      return 0.5; // 默认中等概率
    }

    if (probability < 0) {
      return 0;
    }

    if (probability > 1) {
      return 1;
    }

    return probability;
  }

  /**
   * 生成风险摘要
   */
  generateRiskSummary(riskAssessment: RiskAssessment): string {
    const { overallRisk, confidence, riskFactors } = riskAssessment;

    let summary = `风险评估总结：\n`;
    summary += `- 整体风险等级：${this.getRiskLabel(overallRisk)}\n`;
    summary += `- 分析置信度：${(confidence * 100).toFixed(1)}%\n`;
    summary += `- 识别风险因素：${riskFactors.length}个\n\n`;

    // 按影响级别分类
    const highRisks = riskFactors.filter((r) => r.impact === 'high');
    const mediumRisks = riskFactors.filter((r) => r.impact === 'medium');
    const lowRisks = riskFactors.filter((r) => r.impact === 'low');

    if (highRisks.length > 0) {
      summary += `高影响风险（${highRisks.length}个）：\n`;
      highRisks.forEach((r, i) => {
        summary += `  ${i + 1}. ${r.factor}（概率：${(r.probability * 100).toFixed(0)}%）\n`;
      });
    }

    if (mediumRisks.length > 0) {
      summary += `\n中影响风险（${mediumRisks.length}个）：\n`;
      mediumRisks.forEach((r, i) => {
        summary += `  ${i + 1}. ${r.factor}（概率：${(r.probability * 100).toFixed(0)}%）\n`;
      });
    }

    if (lowRisks.length > 0) {
      summary += `\n低影响风险（${lowRisks.length}个）：\n`;
      lowRisks.forEach((r, i) => {
        summary += `  ${i + 1}. ${r.factor}（概率：${(r.probability * 100).toFixed(0)}%）\n`;
      });
    }

    return summary;
  }

  /**
   * 获取风险等级标签
   */
  private getRiskLabel(risk: string): string {
    const labels: Record<string, string> = {
      low: '低风险',
      medium: '中风险',
      high: '高风险'
    };
    return labels[risk] || risk;
  }

  /**
   * 更新配置
   */
  configure(config: Partial<RiskAssessmentConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('RiskAssessor配置已更新', { config: this.config });
  }

  /**
   * 获取配置
   */
  getConfig(): RiskAssessmentConfig {
    return { ...this.config };
  }
}
