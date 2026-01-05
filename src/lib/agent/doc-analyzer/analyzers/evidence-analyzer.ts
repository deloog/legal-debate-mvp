/**
 * EvidenceAnalyzer - 证据分析器（主入口）
 *
 * 功能：
 * 1. 证据类型分类（物证、书证、证人证言等）
 * 2. 证据关联分析（与当事人、诉讼请求、争议焦点的关联）
 * 3. 证据强度评估（直接证据、间接证据）
 * 4. 证据完整性检查（证据链完整性）
 */

import type {
  ExtractedData,
  ClassifiedEvidence,
  EvidenceStrengthReport,
  EvidenceAnalysisResult,
} from "../core/types";

import { EvidenceClassifier } from "./evidence-classifier";
import { EvidenceStrengthAnalyzer } from "./evidence-strength-analyzer";
import { EvidenceRelationAnalyzer } from "./evidence-relation-analyzer";
import { EvidenceCompletenessAnalyzer } from "./evidence-completeness-analyzer";

// =============================================================================
// EvidenceAnalyzer类
// =============================================================================

export class EvidenceAnalyzer {
  private readonly classifier: EvidenceClassifier;
  private readonly strengthAnalyzer: EvidenceStrengthAnalyzer;
  private readonly relationAnalyzer: EvidenceRelationAnalyzer;
  private readonly completenessAnalyzer: EvidenceCompletenessAnalyzer;

  constructor() {
    this.classifier = new EvidenceClassifier();
    this.strengthAnalyzer = new EvidenceStrengthAnalyzer();
    this.relationAnalyzer = new EvidenceRelationAnalyzer();
    this.completenessAnalyzer = new EvidenceCompletenessAnalyzer();
  }

  /**
   * 分析和分类证据（主入口，兼容DocAnalyzerAgent调用）
   */
  analyze(text: string, extractedData: ExtractedData): EvidenceAnalysisResult {
    // 1. 从各个模块提取证据
    const rawEvidence = this.classifier.extractRawEvidence(extractedData, text);

    // 2. 分类证据
    const classifiedEvidence = this.classifyEvidence(rawEvidence);

    // 3. 证据关联分析
    const evidenceRelations = this.relationAnalyzer.analyzeRelations(
      classifiedEvidence,
      extractedData,
    );

    // 4. 证据强度评估
    const strengthReport = this.assessEvidenceStrength(classifiedEvidence);

    // 5. 完整性评分
    const completenessScore =
      this.completenessAnalyzer.calculateCompletenessScore(classifiedEvidence);

    // 6. 计算整体置信度
    const confidence = this.calculateConfidence(
      classifiedEvidence,
      completenessScore,
    );

    // 7. 检查缺失的证据类型
    const missingEvidenceTypes =
      this.completenessAnalyzer.detectMissingEvidenceTypes(
        classifiedEvidence,
        extractedData,
      );

    return {
      classifiedEvidence,
      evidenceRelations,
      strengthReport,
      completenessScore,
      confidence,
      missingEvidenceTypes,
    };
  }

  // =============================================================================
  // 私有辅助方法
  // =============================================================================

  /**
   * 证据分类
   */
  private classifyEvidence(
    rawEvidence: Map<string, string>,
  ): ClassifiedEvidence[] {
    const classified: ClassifiedEvidence[] = [];
    let idCounter = 1;

    for (const [content, source] of rawEvidence.entries()) {
      const type = this.classifier.determineEvidenceType(content);
      const strength = this.strengthAnalyzer.calculateStrength(content, type);
      const reliability = this.strengthAnalyzer.calculateReliability(content);

      classified.push({
        id: `evidence_${idCounter++}`,
        type,
        content,
        source,
        strength,
        reliability,
        relatedTo: [],
      });
    }

    return classified;
  }

  /**
   * 证据强度评估
   */
  private assessEvidenceStrength(
    classifiedEvidence: ClassifiedEvidence[],
  ): EvidenceStrengthReport {
    const totalEvidence = classifiedEvidence.length;
    const strongEvidence = classifiedEvidence.filter(
      (e) => e.strength >= 4,
    ).length;
    const weakEvidence = classifiedEvidence.filter(
      (e) => e.strength <= 2,
    ).length;

    const averageStrength =
      totalEvidence > 0
        ? classifiedEvidence.reduce((sum, e) => sum + e.strength, 0) /
          totalEvidence
        : 0;

    const averageReliability =
      totalEvidence > 0
        ? classifiedEvidence.reduce((sum, e) => sum + e.reliability, 0) /
          totalEvidence
        : 0;

    // 按类型统计
    const byType: Record<string, number> = {};
    const allTypes: string[] = [
      "PHYSICAL_EVIDENCE",
      "DOCUMENTARY_EVIDENCE",
      "WITNESS_TESTIMONY",
      "EXPERT_OPINION",
      "AUDIO_VIDEO_EVIDENCE",
      "ELECTRONIC_EVIDENCE",
      "OTHER",
    ];

    for (const type of allTypes) {
      byType[type] = classifiedEvidence.filter((e) => e.type === type).length;
    }

    return {
      totalEvidence,
      strongEvidence,
      weakEvidence,
      averageStrength: Math.round(averageStrength * 100) / 100,
      averageReliability: Math.round(averageReliability * 1000) / 1000,
      byType,
    };
  }

  /**
   * 计算整体置信度
   */
  private calculateConfidence(
    classifiedEvidence: ClassifiedEvidence[],
    completenessScore: number,
  ): number {
    if (classifiedEvidence.length === 0) return 0;

    return completenessScore;
  }
}
