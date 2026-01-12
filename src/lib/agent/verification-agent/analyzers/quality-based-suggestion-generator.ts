/**
 * 质量/完成度建议生成器
 * 根据质量/完成度问题生成格式、规则、质量改进建议
 */
import {
  VerificationSuggestion,
  SuggestionType,
  SuggestionPriority,
  VerificationIssue,
  IssueType,
} from '../types';

/**
 * 质量/完成度建议生成器类
 */
export class QualityBasedSuggestionGenerator {
  /**
   * 为质量/完成度问题生成建议
   */
  generate(issue: VerificationIssue): VerificationSuggestion | null {
    switch (issue.type) {
      case IssueType.FORMAT_ERROR:
        return this.generateFormatStandardizationSuggestion(issue);

      case IssueType.BUSINESS_RULE_VIOLATION:
        return this.generateRuleFixSuggestion(issue);

      case IssueType.QUALITY_BELOW_THRESHOLD:
        return this.generateQualityImprovementSuggestion(issue);

      default:
        return null;
    }
  }

  /**
   * 生成格式标准化建议
   */
  private generateFormatStandardizationSuggestion(
    issue: VerificationIssue
  ): VerificationSuggestion {
    return {
      id: `suggestion-format-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SuggestionType.FORMAT_STANDARDIZATION,
      priority: SuggestionPriority.MEDIUM,
      target: issue.field,
      action: `按照${issue.suggestion}修正${issue.field}的格式`,
      reason: issue.message,
      estimatedImpact: '提升格式正确性评分',
    };
  }

  /**
   * 生成规则修复建议
   */
  private generateRuleFixSuggestion(
    issue: VerificationIssue
  ): VerificationSuggestion {
    return {
      id: `suggestion-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SuggestionType.VALIDATION_ENHANCEMENT,
      priority: SuggestionPriority.HIGH,
      action: '检查并修正违反的业务规则',
      reason: issue.message,
      estimatedImpact: '确保符合业务规范',
    };
  }

  /**
   * 生成质量改进建议
   */
  private generateQualityImprovementSuggestion(
    issue: VerificationIssue
  ): VerificationSuggestion {
    return {
      id: `suggestion-quality-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: SuggestionType.VALIDATION_ENHANCEMENT,
      priority: SuggestionPriority.MEDIUM,
      action: '丰富内容描述，提升内容质量',
      reason: issue.message,
      estimatedImpact: '提升质量评分',
    };
  }
}
