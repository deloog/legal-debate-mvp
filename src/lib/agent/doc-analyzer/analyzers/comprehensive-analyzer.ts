/**
 * ComprehensiveAnalyzer - 综合分析器
 *
 * 功能：
 * 1. 分析提取数据的一致性
 * 2. 检查数据完整性
 * 3. 计算质量评分
 * 4. 提供改进建议
 */

import type {
  Claim,
  ConsistencyIssue,
  ConsistencyReport,
  CompletenessCheck,
  CompletenessReport,
  Party,
  QualityScoreReport,
  TimelineEvent,
  ComprehensiveAnalysisResult,
  EvidenceAnalysisResult,
} from "../core/types";

// =============================================================================
// ComprehensiveAnalyzer类
// =============================================================================

export class ComprehensiveAnalyzer {
  /**
   * 进行综合分析
   */
  analyze(
    parties: Party[],
    claims: Claim[],
    timeline: TimelineEvent[],
    evidenceAnalysis?: EvidenceAnalysisResult,
  ): ComprehensiveAnalysisResult {
    const startTime = Date.now();

    // 1. 一致性分析
    const consistencyReport = this.analyzeConsistency(
      parties,
      claims,
      timeline,
    );

    // 2. 完整性分析
    const completenessReport = this.analyzeCompleteness(
      parties,
      claims,
      timeline,
    );

    // 3. 质量评分
    const qualityScore = this.calculateQualityScore(
      consistencyReport,
      completenessReport,
    );

    // 4. 生成建议
    const suggestions = this.generateSuggestions(
      consistencyReport,
      completenessReport,
    );

    // 5. 计算整体置信度
    const overallConfidence = this.calculateOverallConfidence(
      consistencyReport,
      completenessReport,
      evidenceAnalysis,
    );

    return {
      consistencyReport,
      completenessReport,
      qualityScore,
      suggestions,
      overallConfidence,
      metadata: {
        analyzedAt: Date.now(),
        analysisDuration: Date.now() - startTime,
        dataSources: ["PARTIES", "CLAIMS", "TIMELINE"],
      },
    };
  }

  /**
   * 分析一致性
   */
  private analyzeConsistency(
    parties: Party[],
    claims: Claim[],
    timeline: TimelineEvent[],
  ): ConsistencyReport {
    const issues: ConsistencyIssue[] = [];

    // 1. 检查当事人-诉讼请求一致性
    const partyClaimIssues = this.checkPartyClaimConsistency(parties, claims);
    issues.push(...partyClaimIssues);

    // 2. 检查时间线一致性
    const timelineIssues = this.checkTimelineConsistency(timeline);
    issues.push(...timelineIssues);

    // 3. 检查证据一致性
    const evidenceIssues = this.checkEvidenceConsistency(claims);
    issues.push(...evidenceIssues);

    // 4. 计算各项一致性得分
    const partyClaimConsistency = this.calculatePartyClaimScore(
      parties,
      claims,
      partyClaimIssues,
    );
    const timelineConsistency = this.calculateTimelineScore(
      timeline,
      timelineIssues,
    );
    const evidenceConsistency = this.calculateEvidenceScore(
      claims,
      evidenceIssues,
    );

    // 5. 计算整体一致性得分
    const score =
      partyClaimConsistency * 0.4 +
      timelineConsistency * 0.3 +
      evidenceConsistency * 0.3;

    const isConsistent = score >= 0.8;

    return {
      isConsistent,
      issues,
      score,
      partyClaimConsistency,
      timelineConsistency,
      evidenceConsistency,
    };
  }

  /**
   * 检查当事人-诉讼请求一致性
   */
  private checkPartyClaimConsistency(
    parties: Party[],
    claims: Claim[],
  ): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // 检查是否有诉讼请求但没有相关当事人
    if (claims.length > 0 && parties.length === 0) {
      issues.push({
        type: "PARTY_CLAIM_MISMATCH",
        severity: "ERROR",
        description: "存在诉讼请求但缺少当事人信息",
        affectedItems: claims.map((c) => c.content),
        suggestion: "请补充原告和被告信息",
      });
    }

    // 检查是否有诉讼请求的当事人类型缺失
    const hasPlaintiff = parties.some((p) => p.type === "plaintiff");
    const hasDefendant = parties.some((p) => p.type === "defendant");
    const hasPaymentClaim = claims.some(
      (c) =>
        c.type === "PAY_PRINCIPAL" ||
        c.type === "PAY_INTEREST" ||
        c.type === "PAY_DAMAGES",
    );

    if (hasPaymentClaim && !hasDefendant) {
      issues.push({
        type: "PARTY_CLAIM_MISMATCH",
        severity: "WARNING",
        description: "存在金钱给付诉讼请求但缺少被告",
        affectedItems: ["PARTIES"],
        suggestion: "请确认是否遗漏被告信息",
      });
    }

    if (hasPaymentClaim && !hasPlaintiff) {
      issues.push({
        type: "PARTY_CLAIM_MISMATCH",
        severity: "WARNING",
        description: "存在金钱给付诉讼请求但缺少原告",
        affectedItems: ["PARTIES"],
        suggestion: "请确认是否遗漏原告信息",
      });
    }

    return issues;
  }

  /**
   * 检查时间线一致性
   */
  private checkTimelineConsistency(
    timeline: TimelineEvent[],
  ): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    if (timeline.length < 2) {
      return issues;
    }

    // 检查事件顺序是否合理
    const sortedTimeline = [...timeline].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    // 检查是否有不合理的事件顺序
    const filingEvent = sortedTimeline.find((e) => e.type === "FILING");
    const judgmentEvent = sortedTimeline.find((e) => e.type === "JUDGMENT");

    if (filingEvent && judgmentEvent) {
      const filingDate = new Date(filingEvent.date).getTime();
      const judgmentDate = new Date(judgmentEvent.date).getTime();

      if (judgmentDate < filingDate) {
        issues.push({
          type: "TIMELINE_DISCREPANCY",
          severity: "ERROR",
          description: "判决日期早于立案日期",
          affectedItems: [filingEvent.id || "", judgmentEvent.id || ""],
          suggestion: "请核实日期信息是否正确",
        });
      }
    }

    return issues;
  }

  /**
   * 检查证据一致性
   */
  private checkEvidenceConsistency(claims: Claim[]): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];

    // 检查诉讼请求是否有证据支持
    const claimsWithoutEvidence = claims.filter(
      (c) => !c.evidence || c.evidence.length === 0,
    );

    if (claimsWithoutEvidence.length > 0) {
      issues.push({
        type: "EVIDENCE_CONTRADICTION",
        severity: "WARNING",
        description: "部分诉讼请求缺少证据支持",
        affectedItems: claimsWithoutEvidence.map((c) => c.content),
        suggestion: "建议补充相关证据或说明证据来源",
      });
    }

    return issues;
  }

  /**
   * 分析完整性
   */
  private analyzeCompleteness(
    parties: Party[],
    claims: Claim[],
    timeline: TimelineEvent[],
  ): CompletenessReport {
    const checks: CompletenessCheck[] = [];

    // 1. 检查当事人完整性
    const partyCheck = this.checkPartyCompleteness(parties);
    checks.push(partyCheck);

    // 2. 检查诉讼请求完整性
    const claimCheck = this.checkClaimCompleteness(claims);
    checks.push(claimCheck);

    // 3. 检查时间线完整性
    const timelineCheck = this.checkTimelineCompleteness(timeline);
    checks.push(timelineCheck);

    // 4. 检查证据链完整性
    const evidenceChainCheck = this.checkEvidenceChainCompleteness(claims);
    checks.push(evidenceChainCheck);

    // 5. 计算各项完整性得分
    const partyCompleteness = partyCheck.isComplete ? 1 : 0.5;
    const timelineCompleteness = timelineCheck.isComplete ? 1 : 0.6;
    const evidenceChainCompleteness = evidenceChainCheck.isComplete ? 1 : 0.4;

    // 6. 计算整体完整性得分
    const score =
      partyCompleteness * 0.3 +
      timelineCompleteness * 0.3 +
      evidenceChainCompleteness * 0.4;

    const overallComplete = score >= 0.8;

    // 7. 生成建议
    const suggestions = this.generateCompletenessSuggestions(checks);

    return {
      overallComplete,
      score,
      checks,
      partyCompleteness,
      timelineCompleteness,
      evidenceChainCompleteness,
      suggestions,
    };
  }

  /**
   * 检查当事人完整性
   */
  private checkPartyCompleteness(parties: Party[]): CompletenessCheck {
    const missingItems: string[] = [];

    const hasPlaintiff = parties.some((p) => p.type === "plaintiff");
    const hasDefendant = parties.some((p) => p.type === "defendant");

    if (!hasPlaintiff) {
      missingItems.push("原告");
    }
    if (!hasDefendant) {
      missingItems.push("被告");
    }

    const incompleteParties = parties.filter(
      (p) => !p.name || p.name.trim() === "",
    );
    if (incompleteParties.length > 0) {
      missingItems.push("当事人姓名");
    }

    return {
      category: "PARTY_COMPLETENESS",
      isComplete: missingItems.length === 0,
      missingItems,
      importance: "HIGH",
    };
  }

  /**
   * 检查诉讼请求完整性
   */
  private checkClaimCompleteness(claims: Claim[]): CompletenessCheck {
    const missingItems: string[] = [];

    if (claims.length === 0) {
      missingItems.push("诉讼请求");
    }

    const incompleteClaims = claims.filter(
      (c) => !c.content || c.content.trim() === "",
    );
    if (incompleteClaims.length > 0) {
      missingItems.push("诉讼请求内容");
    }

    return {
      category: "CLAIM_COMPLETENESS",
      isComplete: missingItems.length === 0,
      missingItems,
      importance: "HIGH",
    };
  }

  /**
   * 检查时间线完整性
   */
  private checkTimelineCompleteness(
    timeline: TimelineEvent[],
  ): CompletenessCheck {
    const missingItems: string[] = [];

    if (timeline.length === 0) {
      missingItems.push("时间线事件");
    }

    return {
      category: "TIMELINE_COMPLETENESS",
      isComplete: missingItems.length === 0,
      missingItems,
      importance: "MEDIUM",
    };
  }

  /**
   * 检查证据链完整性
   */
  private checkEvidenceChainCompleteness(claims: Claim[]): CompletenessCheck {
    const missingItems: string[] = [];

    const claimsWithoutEvidence = claims.filter(
      (c) => !c.evidence || c.evidence.length === 0,
    );

    if (claimsWithoutEvidence.length > 0) {
      missingItems.push("部分诉讼请求缺少证据支持");
    }

    return {
      category: "EVIDENCE_CHAIN_COMPLETENESS",
      isComplete: missingItems.length === 0,
      missingItems,
      importance: "MEDIUM",
    };
  }

  /**
   * 计算质量评分
   */
  private calculateQualityScore(
    consistencyReport: ConsistencyReport,
    completenessReport: CompletenessReport,
  ): QualityScoreReport {
    const accuracyScore = Math.round(
      (consistencyReport.score * 0.6 + completenessReport.score * 0.4) * 100,
    );
    const completenessScore = Math.round(completenessReport.score * 100);
    const consistencyScore = Math.round(consistencyReport.score * 100);
    const relevanceScore = Math.round(
      (consistencyReport.score * 0.5 + completenessReport.score * 0.5) * 100,
    );
    const overallScore = Math.round(
      accuracyScore * 0.3 +
        completenessScore * 0.3 +
        consistencyScore * 0.2 +
        relevanceScore * 0.2,
    );

    const grade = this.determineGrade(overallScore);

    return {
      overallScore,
      accuracyScore,
      completenessScore,
      consistencyScore,
      relevanceScore,
      grade,
    };
  }

  /**
   * 确定评分等级
   */
  private determineGrade(
    score: number,
  ): "EXCELLENT" | "GOOD" | "SATISFACTORY" | "NEEDS_IMPROVEMENT" | "POOR" {
    if (score >= 90) return "EXCELLENT";
    if (score >= 80) return "GOOD";
    if (score >= 70) return "SATISFACTORY";
    if (score >= 60) return "NEEDS_IMPROVEMENT";
    return "POOR";
  }

  /**
   * 生成建议
   */
  private generateSuggestions(
    consistencyReport: ConsistencyReport,
    completenessReport: CompletenessReport,
  ): string[] {
    const suggestions: string[] = [];

    // 从一致性报告中提取建议
    for (const issue of consistencyReport.issues) {
      if (issue.suggestion) {
        suggestions.push(issue.suggestion);
      }
    }

    // 从完整性报告中提取建议
    suggestions.push(...completenessReport.suggestions);

    // 去重
    return Array.from(new Set(suggestions));
  }

  /**
   * 生成完整性建议
   */
  private generateCompletenessSuggestions(
    checks: CompletenessCheck[],
  ): string[] {
    const suggestions: string[] = [];

    for (const check of checks) {
      if (!check.isComplete) {
        switch (check.category) {
          case "PARTY_COMPLETENESS":
            suggestions.push("建议补充完整的当事人信息");
            break;
          case "CLAIM_COMPLETENESS":
            suggestions.push("建议补充明确的诉讼请求内容");
            break;
          case "TIMELINE_COMPLETENESS":
            suggestions.push("建议完善案件时间线");
            break;
          case "EVIDENCE_CHAIN_COMPLETENESS":
            suggestions.push("建议补充相关证据以支持诉讼请求");
            break;
        }
      }
    }

    return suggestions;
  }

  /**
   * 计算整体置信度
   */
  private calculateOverallConfidence(
    consistencyReport: ConsistencyReport,
    completenessReport: CompletenessReport,
    evidenceAnalysis?: EvidenceAnalysisResult,
  ): number {
    let confidence =
      consistencyReport.score * 0.5 + completenessReport.score * 0.3;

    if (evidenceAnalysis) {
      confidence += evidenceAnalysis.confidence * 0.2;
    }

    return Math.min(confidence, 1);
  }

  /**
   * 计算当事人-诉讼请求得分
   */
  private calculatePartyClaimScore(
    parties: Party[],
    claims: Claim[],
    issues: ConsistencyIssue[],
  ): number {
    let score = 1;

    // 根据问题严重程度扣分
    for (const issue of issues) {
      if (issue.severity === "ERROR") {
        score -= 0.3;
      } else if (issue.severity === "WARNING") {
        score -= 0.1;
      }
    }

    return Math.max(score, 0);
  }

  /**
   * 计算时间线得分
   */
  private calculateTimelineScore(
    timeline: TimelineEvent[],
    issues: ConsistencyIssue[],
  ): number {
    let score = 1;

    // 时间线过少扣分
    if (timeline.length === 0) {
      score -= 0.3;
    } else if (timeline.length < 3) {
      score -= 0.1;
    }

    // 根据问题严重程度扣分
    for (const issue of issues) {
      if (issue.severity === "ERROR") {
        score -= 0.3;
      } else if (issue.severity === "WARNING") {
        score -= 0.1;
      }
    }

    return Math.max(score, 0);
  }

  /**
   * 计算证据得分
   */
  private calculateEvidenceScore(
    claims: Claim[],
    issues: ConsistencyIssue[],
  ): number {
    let score = 1;

    // 根据问题严重程度扣分
    for (const issue of issues) {
      if (issue.severity === "ERROR") {
        score -= 0.3;
      } else if (issue.severity === "WARNING") {
        score -= 0.1;
      }
    }

    return Math.max(score, 0);
  }
}
