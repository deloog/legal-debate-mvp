/**
 * 事实准确性建议生成器
 * 根据事实准确性问题生成补充、修正、一致性建议
 */
import {
  VerificationSuggestion,
  SuggestionType,
  SuggestionPriority,
  VerificationIssue,
  IssueType,
  IssueSeverity,
} from "../types";

/**
 * 事实准确性建议生成器类
 */
export class FactBasedSuggestionGenerator {
  /**
   * 为事实准确性问题生成建议
   */
  generate(issue: VerificationIssue): VerificationSuggestion | null {
    switch (issue.type) {
      case IssueType.MISSING_DATA:
        return this.generateDataCompletionSuggestion(issue);

      case IssueType.INCORRECT_DATA:
        return this.generateDataCorrectionSuggestion(issue);

      case IssueType.INCONSISTENT_DATA:
        return this.generateDataConsistencySuggestion(issue);

      default:
        return null;
    }
  }

  /**
   * 生成数据补充建议
   */
  private generateDataCompletionSuggestion(
    issue: VerificationIssue,
  ): VerificationSuggestion {
    const priority = this.getPriorityBySeverity(issue.severity);

    return {
      id: `suggestion-data-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SuggestionType.DATA_COMPLETION,
      priority,
      target: issue.field,
      action: `补充缺失的${issue.field}字段`,
      reason: issue.message,
      estimatedImpact: "提升数据完整性和验证通过率",
    };
  }

  /**
   * 生成数据修正建议
   */
  private generateDataCorrectionSuggestion(
    issue: VerificationIssue,
  ): VerificationSuggestion {
    const priority = this.getPriorityBySeverity(issue.severity);

    return {
      id: `suggestion-correction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SuggestionType.DATA_CORRECTION,
      priority,
      target: issue.field,
      action: `修正${issue.field}字段的数据`,
      reason: issue.message,
      estimatedImpact: "提升事实准确性评分",
    };
  }

  /**
   * 生成数据一致性建议
   */
  private generateDataConsistencySuggestion(
    issue: VerificationIssue,
  ): VerificationSuggestion {
    return {
      id: `suggestion-consistency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SuggestionType.DATA_CORRECTION,
      priority: SuggestionPriority.HIGH,
      action: "检查并统一数据源，确保数据一致性",
      reason: issue.message,
      estimatedImpact: "解决数据冲突，提升一致性评分",
    };
  }

  /**
   * 根据严重程度获取优先级
   */
  private getPriorityBySeverity(severity: IssueSeverity): SuggestionPriority {
    switch (severity) {
      case IssueSeverity.CRITICAL:
        return SuggestionPriority.URGENT;
      case IssueSeverity.HIGH:
        return SuggestionPriority.HIGH;
      case IssueSeverity.MEDIUM:
        return SuggestionPriority.MEDIUM;
      case IssueSeverity.LOW:
        return SuggestionPriority.LOW;
      default:
        return SuggestionPriority.MEDIUM;
    }
  }
}
