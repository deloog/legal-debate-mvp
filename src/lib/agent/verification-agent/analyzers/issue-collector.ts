/**
 * 问题收集器（Facade）
 * 集成3个收集器：事实、逻辑、完成度
 */
import {
  VerificationIssue,
  IssueSeverity,
  IssueCategory,
  FactualVerificationResult,
  LogicalVerificationResult,
  CompletenessVerificationResult,
} from "../types";
import { FactualIssueCollector } from "./factual-issue-collector";
import { LogicalIssueCollector } from "./logical-issue-collector";
import { CompletenessIssueCollector } from "./completeness-issue-collector";

/**
 * 问题收集器类（Facade）
 */
export class IssueCollector {
  private factualIssueCollector: FactualIssueCollector;
  private logicalIssueCollector: LogicalIssueCollector;
  private completenessIssueCollector: CompletenessIssueCollector;

  constructor() {
    this.factualIssueCollector = new FactualIssueCollector();
    this.logicalIssueCollector = new LogicalIssueCollector();
    this.completenessIssueCollector = new CompletenessIssueCollector();
  }

  /**
   * 收集所有验证层的问题
   */
  collectAllIssues(
    factualResult: FactualVerificationResult,
    logicalResult: LogicalVerificationResult,
    completenessResult: CompletenessVerificationResult,
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    // 收集事实准确性问题
    issues.push(...this.factualIssueCollector.collect(factualResult));

    // 收集逻辑一致性问题
    issues.push(...this.logicalIssueCollector.collect(logicalResult));

    // 收集完成度问题
    issues.push(...this.completenessIssueCollector.collect(completenessResult));

    return issues;
  }

  /**
   * 按严重程度排序问题
   */
  sortBySeverity(issues: VerificationIssue[]): VerificationIssue[] {
    const severityOrder: Record<IssueSeverity, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    return [...issues].sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
    );
  }

  /**
   * 按类别分组问题
   */
  groupByCategory(
    issues: VerificationIssue[],
  ): Map<IssueCategory, VerificationIssue[]> {
    const groups = new Map<IssueCategory, VerificationIssue[]>();

    for (const issue of issues) {
      if (!groups.has(issue.category)) {
        groups.set(issue.category, []);
      }
      groups.get(issue.category)!.push(issue);
    }

    return groups;
  }

  /**
   * 按严重程度分组问题
   */
  groupBySeverity(
    issues: VerificationIssue[],
  ): Map<IssueSeverity, VerificationIssue[]> {
    const groups = new Map<IssueSeverity, VerificationIssue[]>();

    for (const issue of issues) {
      if (!groups.has(issue.severity)) {
        groups.set(issue.severity, []);
      }
      groups.get(issue.severity)!.push(issue);
    }

    return groups;
  }

  /**
   * 过滤问题
   */
  filterIssues(
    issues: VerificationIssue[],
    filters: {
      severity?: IssueSeverity[];
      category?: IssueCategory[];
      detectedBy?: string[];
    },
  ): VerificationIssue[] {
    return issues.filter((issue) => {
      if (filters.severity && !filters.severity.includes(issue.severity)) {
        return false;
      }
      if (filters.category && !filters.category.includes(issue.category)) {
        return false;
      }
      if (
        filters.detectedBy &&
        !filters.detectedBy.includes(issue.detectedBy)
      ) {
        return false;
      }
      return true;
    });
  }

  /**
   * 获取问题统计
   */
  getIssueStatistics(issues: VerificationIssue[]): {
    total: number;
    bySeverity: Record<IssueSeverity, number>;
    byCategory: Record<IssueCategory, number>;
    bySource: Record<string, number>;
  } {
    const stats = {
      total: issues.length,
      bySeverity: {} as Record<IssueSeverity, number>,
      byCategory: {} as Record<IssueCategory, number>,
      bySource: {} as Record<string, number>,
    };

    for (const issue of issues) {
      // 按严重程度统计
      if (!stats.bySeverity[issue.severity]) {
        stats.bySeverity[issue.severity] = 0;
      }
      stats.bySeverity[issue.severity]++;

      // 按类别统计
      if (!stats.byCategory[issue.category]) {
        stats.byCategory[issue.category] = 0;
      }
      stats.byCategory[issue.category]++;

      // 按来源统计
      if (!stats.bySource[issue.detectedBy]) {
        stats.bySource[issue.detectedBy] = 0;
      }
      stats.bySource[issue.detectedBy]++;
    }

    return stats;
  }

  /**
   * 生成问题摘要
   */
  generateSummary(issues: VerificationIssue[]): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    summary: string;
  } {
    const stats = this.getIssueStatistics(issues);

    const summary: string[] = [];

    if (stats.bySeverity.critical > 0) {
      summary.push(`${stats.bySeverity.critical}个严重问题`);
    }
    if (stats.bySeverity.high > 0) {
      summary.push(`${stats.bySeverity.high}个高优先级问题`);
    }
    if (stats.bySeverity.medium > 0) {
      summary.push(`${stats.bySeverity.medium}个中等问题`);
    }
    if (stats.bySeverity.low > 0) {
      summary.push(`${stats.bySeverity.low}个轻微问题`);
    }

    return {
      total: stats.total,
      critical: stats.bySeverity.critical || 0,
      high: stats.bySeverity.high || 0,
      medium: stats.bySeverity.medium || 0,
      low: stats.bySeverity.low || 0,
      summary: summary.join("，"),
    };
  }
}
