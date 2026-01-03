/**
 * 事实准确性问题收集器
 * 收集事实验证中的当事人、金额、日期、一致性问题
 */
import {
  VerificationIssue,
  IssueSeverity,
  IssueCategory,
  IssueType,
  FactualVerificationResult,
} from "../types";

/**
 * 事实准确性问题收集器类
 */
export class FactualIssueCollector {
  /**
   * 收集事实准确性问题
   */
  collect(result: FactualVerificationResult): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // 当事人信息问题
    for (const issue of result.details.partyCheck.issues) {
      issues.push({
        id: `issue-party-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.INCORRECT_DATA,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.FACTUAL,
        field: "parties",
        message: issue,
        detectedBy: "factual",
      });
    }

    // 金额数据问题
    for (const issue of result.details.amountCheck.issues) {
      issues.push({
        id: `issue-amount-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.INCORRECT_DATA,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.FACTUAL,
        field: "amounts",
        message: issue,
        detectedBy: "factual",
      });
    }

    // 日期时间问题
    for (const issue of result.details.dateCheck.issues) {
      issues.push({
        id: `issue-date-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.INCORRECT_DATA,
        severity: IssueSeverity.MEDIUM,
        category: IssueCategory.FACTUAL,
        field: "dates",
        message: issue,
        detectedBy: "factual",
      });
    }

    // 数据一致性问题
    for (const issue of result.details.consistencyCheck.issues) {
      issues.push({
        id: `issue-consistency-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: IssueType.INCONSISTENT_DATA,
        severity: IssueSeverity.HIGH,
        category: IssueCategory.FACTUAL,
        message: issue,
        detectedBy: "factual",
      });
    }

    return issues;
  }
}
