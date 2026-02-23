/**
 * 风险评估服务
 * 负责案件风险评估的核心逻辑
 */

import type {
  RiskAssessmentFormData,
  RiskAssessmentResult,
  RiskStatistics,
  RiskTimelineItem,
} from '@/types/risk-assessment';
import type {
  RiskIdentificationResult,
  RiskMitigationSuggestion,
} from '@/types/risk';
import {
  RiskType,
  RiskLevel,
  RiskCategory,
  MitigationSuggestionType,
  SuggestionPriority,
  calculateRiskLevel,
  generateRiskId,
  generateSuggestionId,
} from '@/types/risk';

/**
 * 风险评估服务类
 */
export class RiskAssessmentService {
  /**
   * 评估案件风险
   */
  static async assessRisk(
    formData: RiskAssessmentFormData
  ): Promise<RiskAssessmentResult> {
    const startTime = Date.now();

    // 识别各类风险
    const risks = await this.identifyRisks(formData);

    // 生成统计信息
    const statistics = this.calculateStatistics(risks);

    // 生成缓解建议
    const suggestions = this.generateSuggestions(risks);

    // 生成时间线
    const timeline = this.generateTimeline(formData, risks);

    // 计算总体风险
    const overallRiskScore = this.calculateOverallRiskScore(risks);
    const overallRiskLevel = calculateRiskLevel(overallRiskScore / 100);

    // 计算胜诉概率
    const winProbability = this.calculateWinProbability(overallRiskScore);

    const assessmentTime = Date.now() - startTime;

    return {
      id: `assessment_${Date.now()}`,
      caseId: formData.caseId,
      caseTitle: formData.caseTitle,
      assessedAt: new Date(),
      assessmentTime,
      overallRiskLevel,
      overallRiskScore,
      winProbability,
      risks,
      statistics,
      suggestions,
      timeline,
    };
  }

  /**
   * 识别风险
   */
  private static async identifyRisks(
    formData: RiskAssessmentFormData
  ): Promise<RiskIdentificationResult[]> {
    const risks: RiskIdentificationResult[] = [];

    // 检查证据强度风险
    const evidenceRisk = this.assessEvidenceStrength(formData);
    if (evidenceRisk) {
      risks.push(evidenceRisk);
    }

    // 检查法律依据风险
    const legalBasisRisk = this.assessLegalBasis(formData);
    if (legalBasisRisk) {
      risks.push(legalBasisRisk);
    }

    // 检查事实核实风险
    const factVerificationRisk = this.assessFactVerification(formData);
    if (factVerificationRisk) {
      risks.push(factVerificationRisk);
    }

    // 检查举证责任风险
    const proofBurdenRisk = this.assessProofBurden(formData);
    if (proofBurdenRisk) {
      risks.push(proofBurdenRisk);
    }

    return risks;
  }

  /**
   * 评估证据强度
   */
  private static assessEvidenceStrength(
    formData: RiskAssessmentFormData
  ): RiskIdentificationResult | null {
    const evidenceCount = formData.evidence.length;

    if (evidenceCount === 0) {
      return {
        id: generateRiskId(),
        riskType: RiskType.EVIDENCE_STRENGTH,
        riskCategory: RiskCategory.EVIDENTIARY,
        riskLevel: RiskLevel.CRITICAL,
        score: 0.9,
        confidence: 0.95,
        description: '缺少证据支持，案件胜诉概率极低',
        evidence: ['未提供任何证据材料'],
        suggestions: [],
        identifiedAt: new Date(),
      };
    }

    if (evidenceCount < 3) {
      return {
        id: generateRiskId(),
        riskType: RiskType.EVIDENCE_STRENGTH,
        riskCategory: RiskCategory.EVIDENTIARY,
        riskLevel: RiskLevel.HIGH,
        score: 0.7,
        confidence: 0.85,
        description: '证据数量较少，可能影响案件胜诉',
        evidence: [`仅提供${evidenceCount}份证据`],
        suggestions: [],
        identifiedAt: new Date(),
      };
    }

    if (evidenceCount < 5) {
      return {
        id: generateRiskId(),
        riskType: RiskType.EVIDENCE_STRENGTH,
        riskCategory: RiskCategory.EVIDENTIARY,
        riskLevel: RiskLevel.MEDIUM,
        score: 0.5,
        confidence: 0.75,
        description: '证据数量中等，建议补充更多证据',
        evidence: [`提供${evidenceCount}份证据`],
        suggestions: [],
        identifiedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * 评估法律依据
   */
  private static assessLegalBasis(
    formData: RiskAssessmentFormData
  ): RiskIdentificationResult | null {
    const legalBasisCount = formData.legalBasis.length;

    if (legalBasisCount === 0) {
      return {
        id: generateRiskId(),
        riskType: RiskType.LEGAL_BASIS,
        riskCategory: RiskCategory.SUBSTANTIVE,
        riskLevel: RiskLevel.CRITICAL,
        score: 0.85,
        confidence: 0.9,
        description: '缺少法律依据，诉讼请求可能被驳回',
        evidence: ['未引用任何法律条文'],
        suggestions: [],
        identifiedAt: new Date(),
      };
    }

    if (legalBasisCount < 2) {
      return {
        id: generateRiskId(),
        riskType: RiskType.LEGAL_BASIS,
        riskCategory: RiskCategory.SUBSTANTIVE,
        riskLevel: RiskLevel.MEDIUM,
        score: 0.55,
        confidence: 0.8,
        description: '法律依据较少，建议补充相关法律条文',
        evidence: [`仅引用${legalBasisCount}条法律依据`],
        suggestions: [],
        identifiedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * 评估事实核实
   */
  private static assessFactVerification(
    formData: RiskAssessmentFormData
  ): RiskIdentificationResult | null {
    const factsCount = formData.facts.length;

    if (factsCount < 3) {
      return {
        id: generateRiskId(),
        riskType: RiskType.FACT_VERIFICATION,
        riskCategory: RiskCategory.EVIDENTIARY,
        riskLevel: RiskLevel.HIGH,
        score: 0.65,
        confidence: 0.8,
        description: '案件事实陈述不够充分',
        evidence: [`仅陈述${factsCount}项事实`],
        suggestions: [],
        identifiedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * 评估举证责任
   */
  private static assessProofBurden(
    formData: RiskAssessmentFormData
  ): RiskIdentificationResult | null {
    const claimsCount = formData.claims.length;
    const evidenceCount = formData.evidence.length;

    // 如果诉讼请求多但证据少，存在举证责任风险
    if (claimsCount > evidenceCount) {
      return {
        id: generateRiskId(),
        riskType: RiskType.PROOF_BURDEN,
        riskCategory: RiskCategory.EVIDENTIARY,
        riskLevel: RiskLevel.MEDIUM,
        score: 0.6,
        confidence: 0.75,
        description: '诉讼请求与证据数量不匹配，可能难以完成举证责任',
        evidence: [`${claimsCount}项诉讼请求但仅有${evidenceCount}份证据`],
        suggestions: [],
        identifiedAt: new Date(),
      };
    }

    return null;
  }

  /**
   * 计算统计信息
   */
  private static calculateStatistics(
    risks: RiskIdentificationResult[]
  ): RiskStatistics {
    const statistics: RiskStatistics = {
      totalRisks: risks.length,
      criticalRisks: 0,
      highRisks: 0,
      mediumRisks: 0,
      lowRisks: 0,
      byCategory: {
        [RiskCategory.PROCEDURAL]: 0,
        [RiskCategory.EVIDENTIARY]: 0,
        [RiskCategory.SUBSTANTIVE]: 0,
        [RiskCategory.STRATEGIC]: 0,
      },
      byType: {
        [RiskType.LEGAL_PROCEDURE]: 0,
        [RiskType.EVIDENCE_STRENGTH]: 0,
        [RiskType.STATUTE_LIMITATION]: 0,
        [RiskType.JURISDICTION]: 0,
        [RiskType.COST_BENEFIT]: 0,
        [RiskType.FACT_VERIFICATION]: 0,
        [RiskType.LEGAL_BASIS]: 0,
        [RiskType.CONTRADICTION]: 0,
        [RiskType.PROOF_BURDEN]: 0,
      },
    };

    risks.forEach(risk => {
      // 按等级统计
      switch (risk.riskLevel) {
        case RiskLevel.CRITICAL:
          statistics.criticalRisks++;
          break;
        case RiskLevel.HIGH:
          statistics.highRisks++;
          break;
        case RiskLevel.MEDIUM:
          statistics.mediumRisks++;
          break;
        case RiskLevel.LOW:
          statistics.lowRisks++;
          break;
      }

      // 按类别统计
      statistics.byCategory[risk.riskCategory]++;

      // 按类型统计
      statistics.byType[risk.riskType]++;
    });

    return statistics;
  }

  /**
   * 生成缓解建议
   */
  private static generateSuggestions(
    risks: RiskIdentificationResult[]
  ): RiskMitigationSuggestion[] {
    const suggestions: RiskMitigationSuggestion[] = [];

    risks.forEach(risk => {
      switch (risk.riskType) {
        case RiskType.EVIDENCE_STRENGTH:
          suggestions.push({
            id: generateSuggestionId(),
            riskType: risk.riskType,
            suggestionType: MitigationSuggestionType.GATHER_EVIDENCE,
            priority: SuggestionPriority.URGENT,
            action: '收集更多证据材料',
            reason: '证据不足会严重影响案件胜诉概率',
            estimatedImpact: '提升胜诉概率20-30%',
            estimatedEffort: '1-2周',
          });
          break;

        case RiskType.LEGAL_BASIS:
          suggestions.push({
            id: generateSuggestionId(),
            riskType: risk.riskType,
            suggestionType: MitigationSuggestionType.ADD_LEGAL_BASIS,
            priority: SuggestionPriority.HIGH,
            action: '补充相关法律依据',
            reason: '法律依据不足可能导致诉讼请求被驳回',
            estimatedImpact: '提升胜诉概率15-25%',
            estimatedEffort: '3-5天',
          });
          break;

        case RiskType.FACT_VERIFICATION:
          suggestions.push({
            id: generateSuggestionId(),
            riskType: risk.riskType,
            suggestionType: MitigationSuggestionType.VERIFY_FACTS,
            priority: SuggestionPriority.HIGH,
            action: '补充案件事实陈述',
            reason: '事实陈述不充分会影响法官对案件的理解',
            estimatedImpact: '提升胜诉概率10-20%',
            estimatedEffort: '2-3天',
          });
          break;

        case RiskType.PROOF_BURDEN:
          suggestions.push({
            id: generateSuggestionId(),
            riskType: risk.riskType,
            suggestionType: MitigationSuggestionType.GATHER_EVIDENCE,
            priority: SuggestionPriority.MEDIUM,
            action: '为每项诉讼请求准备充分证据',
            reason: '确保能够完成举证责任',
            estimatedImpact: '提升胜诉概率10-15%',
            estimatedEffort: '1周',
          });
          break;
      }
    });

    return suggestions;
  }

  /**
   * 生成时间线
   */
  private static generateTimeline(
    _formData: RiskAssessmentFormData,
    risks: RiskIdentificationResult[]
  ): RiskTimelineItem[] {
    const timeline: RiskTimelineItem[] = [];

    // 添加评估时间点
    timeline.push({
      id: `timeline_${Date.now()}_1`,
      date: new Date(),
      title: '风险评估完成',
      description: `识别出${risks.length}项风险`,
      riskLevel: RiskLevel.MEDIUM,
      relatedRiskIds: risks.map(r => r.id),
    });

    return timeline;
  }

  /**
   * 计算总体风险评分
   */
  private static calculateOverallRiskScore(
    risks: RiskIdentificationResult[]
  ): number {
    if (risks.length === 0) {
      return 0;
    }

    const totalScore = risks.reduce((sum, risk) => sum + risk.score, 0);
    return Math.round((totalScore / risks.length) * 100);
  }

  /**
   * 计算胜诉概率
   */
  private static calculateWinProbability(riskScore: number): number {
    // 风险评分越高，胜诉概率越低
    return Math.max(0, Math.min(100, 100 - riskScore));
  }
}
