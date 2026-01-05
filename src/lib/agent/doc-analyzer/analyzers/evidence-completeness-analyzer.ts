/**
 * EvidenceCompletenessAnalyzer - 证据完整性分析器
 *
 * 功能：
 * 1. 计算证据完整性评分（0-1）
 * 2. 检测缺失的证据类型
 * 3. 生成证据补充建议
 */

import type {
  EvidenceType,
  ClassifiedEvidence,
  ExtractedData,
  EvidenceStrengthReport,
} from "../core/types";

// =============================================================================
// EvidenceCompletenessAnalyzer类
// =============================================================================

export class EvidenceCompletenessAnalyzer {
  /**
   * 计算完整性评分
   */
  calculateCompletenessScore(classifiedEvidence: ClassifiedEvidence[]): number {
    if (classifiedEvidence.length === 0) return 0;

    let score = 0;

    // 证据数量评分（0-0.3）
    const evidenceScore = Math.min(0.3, classifiedEvidence.length * 0.03);
    score += evidenceScore;

    // 证据类型多样性评分（0-0.3）
    const types = new Set(classifiedEvidence.map((e) => e.type));
    const diversityScore = Math.min(0.3, types.size * 0.05);
    score += diversityScore;

    // 证据关联度评分（0-0.2）
    const avgRelatedTo =
      classifiedEvidence.length > 0
        ? classifiedEvidence.reduce((sum, e) => sum + e.relatedTo.length, 0) /
          classifiedEvidence.length
        : 0;
    const relationScore = Math.min(0.2, avgRelatedTo * 0.05);
    score += relationScore;

    // 证据强度评分（0-0.2）
    const avgStrength =
      classifiedEvidence.length > 0
        ? classifiedEvidence.reduce((sum, e) => sum + e.strength, 0) /
          classifiedEvidence.length
        : 0;
    const strengthScore = Math.min(0.2, (avgStrength / 5) * 0.2);
    score += strengthScore;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * 检测缺失的证据类型
   */
  detectMissingEvidenceTypes(
    classifiedEvidence: ClassifiedEvidence[],
    extractedData: ExtractedData,
  ): EvidenceType[] {
    const presentTypes = new Set(classifiedEvidence.map((e) => e.type));

    // 根据案件类型确定应有的证据类型
    const requiredTypes: EvidenceType[] = [];

    // 所有的案件都应该有书证
    if (!presentTypes.has("DOCUMENTARY_EVIDENCE")) {
      requiredTypes.push("DOCUMENTARY_EVIDENCE");
    }

    // 根据当事人数量判断是否需要证人证言
    if (
      extractedData.parties &&
      extractedData.parties.length > 2 &&
      !presentTypes.has("WITNESS_TESTIMONY")
    ) {
      requiredTypes.push("WITNESS_TESTIMONY");
    }

    // 根据争议焦点判断是否需要物证
    if (
      extractedData.disputeFocuses &&
      extractedData.disputeFocuses.some(
        (f) =>
          f.category === "CONTRACT_BREACH" ||
          f.category === "DAMAGES_CALCULATION",
      ) &&
      !presentTypes.has("PHYSICAL_EVIDENCE")
    ) {
      requiredTypes.push("PHYSICAL_EVIDENCE");
    }

    return requiredTypes;
  }

  /**
   * 生成证据补充建议
   */
  generateSuggestions(
    classifiedEvidence: ClassifiedEvidence[],
    missingEvidenceTypes: EvidenceType[],
  ): string[] {
    const suggestions: string[] = [];

    // 基于缺失类型生成建议
    for (const type of missingEvidenceTypes) {
      switch (type) {
        case "DOCUMENTARY_EVIDENCE":
          suggestions.push("建议补充书面证据，如合同、协议、单据、证明等");
          break;
        case "WITNESS_TESTIMONY":
          suggestions.push("建议提供证人证言，以证明相关事实");
          break;
        case "PHYSICAL_EVIDENCE":
          suggestions.push("建议补充物证，如照片、录音、实物证据等");
          break;
        case "AUDIO_VIDEO_EVIDENCE":
          suggestions.push("建议补充视听资料，如录像、录音等");
          break;
        case "ELECTRONIC_EVIDENCE":
          suggestions.push("建议补充电子数据证据，如聊天记录、邮件、短信等");
          break;
        case "EXPERT_OPINION":
          suggestions.push("建议提供鉴定意见或专家意见，以证明专业问题");
          break;
        default:
          suggestions.push("建议补充其他相关证据");
      }
    }

    // 基于强度评估生成建议
    const weakEvidence = classifiedEvidence.filter((e) => e.strength <= 2);
    if (weakEvidence.length > classifiedEvidence.length / 2) {
      suggestions.push("大部分证据强度较弱，建议补充更强的证据形式");
    }

    return suggestions;
  }

  /**
   * 生成完整性评估报告
   */
  generateReport(
    classifiedEvidence: ClassifiedEvidence[],
    strengthReport: EvidenceStrengthReport,
    missingEvidenceTypes: EvidenceType[],
  ): {
    completenessScore: number;
    evidenceCount: number;
    typeDiversity: number;
    avgRelationCount: number;
    missingTypes: EvidenceType[];
    suggestions: string[];
    grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
  } {
    const completenessScore =
      this.calculateCompletenessScore(classifiedEvidence);
    const types = new Set(classifiedEvidence.map((e) => e.type));
    const avgRelationCount =
      classifiedEvidence.length > 0
        ? classifiedEvidence.reduce((sum, e) => sum + e.relatedTo.length, 0) /
          classifiedEvidence.length
        : 0;

    const suggestions = this.generateSuggestions(
      classifiedEvidence,
      missingEvidenceTypes,
    );

    let grade: "EXCELLENT" | "GOOD" | "FAIR" | "POOR";
    if (completenessScore >= 0.8) {
      grade = "EXCELLENT";
    } else if (completenessScore >= 0.6) {
      grade = "GOOD";
    } else if (completenessScore >= 0.4) {
      grade = "FAIR";
    } else {
      grade = "POOR";
    }

    return {
      completenessScore: Math.round(completenessScore * 1000) / 1000,
      evidenceCount: classifiedEvidence.length,
      typeDiversity: types.size,
      avgRelationCount: Math.round(avgRelationCount * 10) / 10,
      missingTypes: missingEvidenceTypes,
      suggestions,
      grade,
    };
  }
}
