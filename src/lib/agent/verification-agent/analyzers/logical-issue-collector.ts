/**
 * 逻辑一致性问题收集器
 * 收集逻辑验证中的推理链、矛盾、法条引用问题
 */
import {
  VerificationIssue,
  IssueSeverity,
  IssueCategory,
  IssueType,
  LogicalVerificationResult,
} from "../types";

/**
 * 逻辑一致性问题收集器类
 */
export class LogicalIssueCollector {
  /**
   * 收集逻辑一致性问题
   */
  collect(result: LogicalVerificationResult): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // 推理链缺口
    for (const gap of result.details.reasoningChain.gaps) {
      issues.push({
        id: `issue-reasoning-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.LOGICAL_ERROR,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.LOGICAL,
        message: gap,
        detectedBy: "logical",
      });
    }

    // 循环推理
    for (const loop of result.details.reasoningChain.loops) {
      issues.push({
        id: `issue-loop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.LOGICAL_ERROR,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.LOGICAL,
        message: loop,
        detectedBy: "logical",
      });
    }

    // 矛盾
    for (const contradiction of result.details.contradictions.contradictions) {
      issues.push({
        id: `issue-contradiction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.CONTRADICTION,
        severity: contradiction.severity,
        category: IssueCategory.LOGICAL,
        message: contradiction.description,
        suggestion: "请检查并修正矛盾的陈述",
        detectedBy: "logical",
      });
    }

    // 法条引用问题
    if (result.details.legalLogic.score < 0.8) {
      issues.push({
        id: `issue-legal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.LOGICAL_ERROR,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.LOGICAL,
        message: "法条引用逻辑性不足，请检查法条的有效性和相关性",
        detectedBy: "logical",
      });
    }

    return issues;
  }
}
