/**
 * EvidenceStrengthAnalyzer - 证据强度分析器
 *
 * 功能：
 * 1. 计算证据强度（1-5分）
 * 2. 计算证据可靠性（0-1）
 * 3. 评估证据整体质量
 */

import type { EvidenceType, ClassifiedEvidence } from "../core/types";

// =============================================================================
// EvidenceStrengthAnalyzer类
// =============================================================================

export class EvidenceStrengthAnalyzer {
  /**
   * 计算证据强度
   */
  calculateStrength(content: string, type: EvidenceType): number {
    let score = 2; // 基础分

    // 类型强度权重
    const typeWeights: Record<EvidenceType, number> = {
      PHYSICAL_EVIDENCE: 4,
      DOCUMENTARY_EVIDENCE: 3,
      WITNESS_TESTIMONY: 2,
      EXPERT_OPINION: 3,
      AUDIO_VIDEO_EVIDENCE: 4,
      ELECTRONIC_EVIDENCE: 3,
      OTHER: 2,
    };

    score += typeWeights[type];

    // 内容强度指标
    const strengthKeywords = ["原件", "盖章", "签名", "公证", "认证"];
    if (strengthKeywords.some((kw) => content.includes(kw))) {
      score += 1;
    }

    const weakKeywords = ["复印件", "副本", "打印件"];
    if (weakKeywords.some((kw) => content.includes(kw))) {
      score -= 1;
    }

    // 内容长度
    if (content.length > 20) score += 0.5;
    if (content.length < 5) score -= 0.5;

    return Math.min(5, Math.max(1, score));
  }

  /**
   * 计算证据可靠性
   */
  calculateReliability(content: string): number {
    let reliability = 0.5; // 基础可靠性

    // 来源可靠性指标
    if (content.includes("官方") || content.includes("公证")) {
      reliability += 0.2;
    }

    if (content.includes("第三方") || content.includes("鉴定")) {
      reliability += 0.15;
    }

    return Math.min(1, Math.max(0, reliability));
  }

  /**
   * 评估证据整体质量
   */
  assessQuality(evidence: ClassifiedEvidence): {
    strength: number;
    reliability: number;
    qualityScore: number;
    grade: "STRONG" | "MODERATE" | "WEAK";
  } {
    const strength = evidence.strength;
    const reliability = evidence.reliability;

    // 综合质量评分（强度0.6 + 可靠性0.4）
    const qualityScore = (strength / 5) * 0.6 + reliability * 0.4;

    let grade: "STRONG" | "MODERATE" | "WEAK";
    if (qualityScore >= 0.7) {
      grade = "STRONG";
    } else if (qualityScore >= 0.5) {
      grade = "MODERATE";
    } else {
      grade = "WEAK";
    }

    return {
      strength,
      reliability,
      qualityScore: Math.round(qualityScore * 1000) / 1000,
      grade,
    };
  }

  /**
   * 生成证据质量建议
   */
  generateSuggestions(evidence: ClassifiedEvidence): string[] {
    const suggestions: string[] = [];

    // 强度不足
    if (evidence.strength <= 2) {
      suggestions.push("证据强度较弱，建议补充更强的证据形式");
    }

    // 可靠性低
    if (evidence.reliability < 0.5) {
      suggestions.push("证据可靠性较低，建议提供官方或第三方认证材料");
    }

    // 书证相关建议
    if (evidence.type === "DOCUMENTARY_EVIDENCE") {
      if (
        evidence.content.includes("复印件") ||
        evidence.content.includes("打印件")
      ) {
        suggestions.push("建议提供原件或公证后的复印件");
      }
    }

    // 证人证言相关建议
    if (evidence.type === "WITNESS_TESTIMONY") {
      suggestions.push("建议补充证人证言的书面记录");
    }

    return suggestions;
  }
}
