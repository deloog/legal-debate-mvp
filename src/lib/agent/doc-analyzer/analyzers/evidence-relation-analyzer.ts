/**
 * EvidenceRelationAnalyzer - 证据关联分析器
 *
 * 功能：
 * 1. 分析证据与当事人的关联
 * 2. 分析证据与诉讼请求的关联
 * 3. 分析证据与争议焦点的关联
 * 4. 计算关联强度
 */

import type {
  ExtractedData,
  EvidenceRelation,
  ClassifiedEvidence,
} from "../core/types";

// =============================================================================
// EvidenceRelationAnalyzer类
// =============================================================================

export class EvidenceRelationAnalyzer {
  /**
   * 分析证据关联关系
   */
  analyzeRelations(
    classifiedEvidence: ClassifiedEvidence[],
    extractedData: ExtractedData,
  ): EvidenceRelation[] {
    const relations: EvidenceRelation[] = [];

    // 关联到当事人、诉讼请求、争议焦点
    for (const evidence of classifiedEvidence) {
      const relatedParties = this.findRelatedParties(
        evidence.content,
        extractedData,
      );
      for (const party of relatedParties) {
        relations.push({
          evidenceId: evidence.id,
          relatedTo: party,
          relationType: "RELATES_TO",
          strength: 0.6,
        });
        evidence.relatedTo.push(party);
      }

      // 关联到诉讼请求
      const relatedClaims = this.findRelatedClaims(
        evidence.content,
        extractedData,
      );
      for (const claim of relatedClaims) {
        relations.push({
          evidenceId: evidence.id,
          relatedTo: claim,
          relationType: "SUPPORTS",
          strength: 0.8,
        });
      }

      // 关联到争议焦点
      const relatedFocuses = this.findRelatedDisputeFocuses(
        evidence.content,
        extractedData,
      );
      for (const focus of relatedFocuses) {
        relations.push({
          evidenceId: evidence.id,
          relatedTo: focus,
          relationType: "SUPPORTS",
          strength: 0.7,
        });
      }
    }

    return relations;
  }

  /**
   * 查找相关当事人
   */
  findRelatedParties(
    evidenceContent: string,
    extractedData: ExtractedData,
  ): string[] {
    const related: string[] = [];

    if (!extractedData.parties) return related;

    for (const party of extractedData.parties) {
      if (evidenceContent.includes(party.name)) {
        related.push(party.name);
      }
    }

    return related;
  }

  /**
   * 查找相关诉讼请求
   */
  findRelatedClaims(
    evidenceContent: string,
    extractedData: ExtractedData,
  ): string[] {
    const related: string[] = [];

    if (!extractedData.claims) return related;

    for (const claim of extractedData.claims) {
      if (
        evidenceContent.includes(claim.content) ||
        (claim.legalBasis && evidenceContent.includes(claim.legalBasis))
      ) {
        related.push(claim.type);
      }
    }

    return related;
  }

  /**
   * 查找相关争议焦点
   */
  findRelatedDisputeFocuses(
    evidenceContent: string,
    extractedData: ExtractedData,
  ): string[] {
    const related: string[] = [];

    if (!extractedData.disputeFocuses) return related;

    for (const focus of extractedData.disputeFocuses) {
      if (
        evidenceContent.includes(focus.description) ||
        evidenceContent.includes(focus.coreIssue)
      ) {
        related.push(focus.id);
      }
    }

    return related;
  }

  /**
   * 计算关联强度
   */
  calculateRelationStrength(
    evidence: ClassifiedEvidence,
    relations: EvidenceRelation[],
  ): number {
    if (relations.length === 0) return 0;

    const totalStrength = relations.reduce((sum, r) => sum + r.strength, 0);
    return Math.round((totalStrength / relations.length) * 1000) / 1000;
  }

  /**
   * 生成关联分析报告
   */
  generateReport(
    evidence: ClassifiedEvidence,
    relations: EvidenceRelation[],
  ): {
    totalRelations: number;
    partyRelations: number;
    claimRelations: number;
    focusRelations: number;
    avgStrength: number;
  } {
    const partyRelations = relations.filter(
      (r) => r.relationType === "RELATES_TO",
    ).length;
    const claimRelations = relations.filter(
      (r) => r.relationType === "SUPPORTS",
    ).length;
    const focusRelations = relations.filter(
      (r) => r.relationType === "SUPPORTS",
    ).length;

    const avgStrength = this.calculateRelationStrength(evidence, relations);

    return {
      totalRelations: relations.length,
      partyRelations,
      claimRelations,
      focusRelations,
      avgStrength,
    };
  }
}
