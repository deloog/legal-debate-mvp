/**
 * 逻辑一致性建议生成器
 * 根据逻辑一致性问题生成改进、矛盾修复建议
 */
import {
  VerificationSuggestion,
  SuggestionType,
  SuggestionPriority,
  VerificationIssue,
  IssueType,
} from '../types';

/**
 * 逻辑一致性建议生成器类
 */
export class LogicBasedSuggestionGenerator {
  /**
   * 为逻辑一致性问题生成建议
   */
  generate(issue: VerificationIssue): VerificationSuggestion | null {
    switch (issue.type) {
      case IssueType.LOGICAL_ERROR:
        return this.generateLogicImprovementSuggestion(issue);

      case IssueType.CONTRADICTION:
        return this.generateContradictionFixSuggestion(issue);

      default:
        return null;
    }
  }

  /**
   * 生成逻辑改进建议
   */
  private generateLogicImprovementSuggestion(
    issue: VerificationIssue
  ): VerificationSuggestion {
    const priority = this.getPriorityBySeverity(issue.severity);

    return {
      id: `suggestion-logic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SuggestionType.LOGIC_IMPROVEMENT,
      priority,
      action: '检查推理链，补充缺失的逻辑连接',
      reason: issue.message,
      estimatedImpact: '提升逻辑一致性评分',
    };
  }

  /**
   * 生成矛盾修复建议
   */
  private generateContradictionFixSuggestion(
    issue: VerificationIssue
  ): VerificationSuggestion {
    return {
      id: `suggestion-contradiction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SuggestionType.LOGIC_IMPROVEMENT,
      priority: SuggestionPriority.URGENT,
      action: '识别并解决矛盾的陈述',
      reason: issue.message,
      estimatedImpact: '消除逻辑矛盾，大幅提升评分',
    };
  }

  /**
   * 根据严重程度获取优先级
   */
  private getPriorityBySeverity(issueSeverity: string): SuggestionPriority {
    switch (issueSeverity) {
      case 'critical':
        return SuggestionPriority.URGENT;
      case 'high':
        return SuggestionPriority.HIGH;
      case 'medium':
        return SuggestionPriority.MEDIUM;
      case 'low':
        return SuggestionPriority.LOW;
      default:
        return SuggestionPriority.MEDIUM;
    }
  }
}
