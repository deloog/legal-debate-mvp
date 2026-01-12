/**
 * 完成度问题收集器
 * 收集完成度验证中的必填字段、业务规则、格式、质量问题
 */
import {
  VerificationIssue,
  IssueSeverity,
  IssueCategory,
  IssueType,
  CompletenessVerificationResult,
} from '../types';

/**
 * 完成度问题收集器类
 */
export class CompletenessIssueCollector {
  /**
   * 收集完成度问题
   */
  collect(result: CompletenessVerificationResult): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // 必填字段问题
    for (const field of result.details.requiredFields.missingFields) {
      issues.push({
        id: `issue-field-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.MISSING_DATA,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.COMPLETENESS,
        field: field,
        message: `缺少必填字段: ${field}`,
        detectedBy: 'completeness',
      });
    }

    // 业务规则违反
    for (const rule of result.details.businessRules.violatedRules) {
      issues.push({
        id: `issue-rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.BUSINESS_RULE_VIOLATION,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.COMPLETENESS,
        message: rule,
        detectedBy: 'completeness',
      });
    }

    // 格式错误
    for (const error of result.details.formatCheck.formatErrors) {
      issues.push({
        id: `issue-format-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.FORMAT_ERROR,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.FORMAT,
        field: error.field,
        message: `${error.field}格式错误: ${error.error}`,
        suggestion: `期望格式: ${error.expected}`,
        detectedBy: 'completeness',
      });
    }

    // 质量阈值问题
    for (const [name, threshold] of Object.entries(
      result.details.qualityCheck.thresholds
    )) {
      if (!threshold.passed) {
        issues.push({
          id: `issue-quality-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: IssueType.QUALITY_BELOW_THRESHOLD,
          severity: IssueSeverity.MEDIUM,
          category: IssueCategory.QUALITY,
          message: `${name}质量低于阈值: 实际${threshold.actual}, 期望${threshold.threshold}`,
          detectedBy: 'completeness',
        });
      }
    }

    return issues;
  }
}
