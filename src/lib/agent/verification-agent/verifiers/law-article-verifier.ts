/**
 * 法律条文验证器
 * 验证法条存在性、适用性、引用准确性、引用完整性
 */
import {
  VerificationResult,
  VerificationIssue,
  IssueType,
  IssueSeverity,
  IssueCategory,
  SuggestionType,
  SuggestionPriority,
} from '../types';
import { prisma } from '@/lib/db/prisma';

/**
 * 验证上下文接口
 */
interface VerificationContext {
  caseInfo: {
    caseType?: string;
    claims?: string[];
    facts?: string[];
    region?: string;
    currentDate?: Date;
  };
  legalBasis: Array<{
    lawName: string;
    articleNumber: string;
    citedContent?: string;
  }>;
}

/**
 * 法律条文验证器类
 */
export class LawArticleVerifier {
  /**
   * 验证法律条文引用
   */
  async verify(
    _content: string,
    context: VerificationContext
  ): Promise<VerificationResult> {
    const startTime = Date.now();
    const issues: VerificationIssue[] = [];

    try {
      // 1. 验证法条存在性和准确性
      const existenceIssues = await this.verifyExistence(context.legalBasis);
      issues.push(...existenceIssues);

      // 2. 验证法条适用性
      const applicabilityIssues = await this.verifyApplicability(
        context.legalBasis,
        context.caseInfo
      );
      issues.push(...applicabilityIssues);

      // 3. 验证引用准确性
      const accuracyIssues = this.verifyAccuracy(context.legalBasis);
      issues.push(...accuracyIssues);

      // 4. 验证引用完整性
      const completenessIssues = await this.verifyCompleteness(
        context.legalBasis
      );
      issues.push(...completenessIssues);

      // 计算综合评分
      const score = this.calculateOverallScore(issues);

      // 判断是否通过
      const criticalIssues = issues.filter(
        issue =>
          issue.severity === IssueSeverity.CRITICAL ||
          issue.severity === IssueSeverity.HIGH
      );
      const passed = criticalIssues.length === 0 && score > 0.7;

      const verificationTime = Date.now() - startTime;

      return {
        overallScore: score,
        factualAccuracy: this.calculateFactualAccuracy(issues),
        logicalConsistency: this.calculateLogicalConsistency(issues),
        taskCompleteness: this.calculateTaskCompleteness(issues),
        passed,
        issues,
        suggestions: this.generateSuggestions(issues),
        verificationTime,
      };
    } catch (error) {
      console.error('法律条文验证失败:', error);

      return {
        overallScore: 0,
        factualAccuracy: 0,
        logicalConsistency: 0,
        taskCompleteness: 0,
        passed: false,
        issues: [
          {
            id: `law-error-${Date.now()}`,
            type: IssueType.VALIDATION_ERROR,
            severity: IssueSeverity.CRITICAL,
            category: IssueCategory.FACTUAL,
            message: '法律条文验证过程中发生错误',
            detectedBy: 'law-article-verifier',
          },
        ],
        suggestions: [],
        verificationTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 验证法条存在性
   */
  private async verifyExistence(
    legalBasis: Array<{ lawName: string; articleNumber: string }>
  ): Promise<VerificationIssue[]> {
    const issues: VerificationIssue[] = [];

    for (const legal of legalBasis) {
      try {
        const article = await prisma.lawArticle.findFirst({
          where: {
            lawName: legal.lawName,
            articleNumber: legal.articleNumber,
          },
        });

        if (!article) {
          issues.push({
            id: `missing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: IssueType.INCORRECT_DATA,
            severity: IssueSeverity.HIGH,
            category: IssueCategory.FACTUAL,
            field: 'legalBasis',
            message: `引用的法条不存在：${legal.lawName} ${legal.articleNumber}`,
            suggestion:
              '请检查法条编号是否正确，或使用法条检索功能查找正确的法条',
            detectedBy: 'law-article-verifier',
          });
        }
      } catch (error) {
        console.error(
          `查询法条失败: ${legal.lawName} ${legal.articleNumber}`,
          error
        );
      }
    }

    return issues;
  }

  /**
   * 验证法条适用性
   */
  private async verifyApplicability(
    legalBasis: Array<{ lawName: string; articleNumber: string }>,
    caseInfo: VerificationContext['caseInfo']
  ): Promise<VerificationIssue[]> {
    const issues: VerificationIssue[] = [];

    for (const legal of legalBasis) {
      try {
        const article = await prisma.lawArticle.findFirst({
          where: {
            lawName: legal.lawName,
            articleNumber: legal.articleNumber,
          },
        });

        if (!article) {
          continue;
        }

        // 检查案件类型匹配（基于tags和keywords）
        if (caseInfo.caseType && article.tags && article.tags.length > 0) {
          const isApplicable = article.tags.some(
            tag =>
              caseInfo.caseType?.includes(tag) ||
              tag.includes(caseInfo.caseType || '')
          );

          if (!isApplicable) {
            issues.push({
              id: `applicability-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: IssueType.BUSINESS_RULE_VIOLATION,
              severity: IssueSeverity.MEDIUM,
              category: IssueCategory.FACTUAL,
              field: 'legalBasis',
              message: `法条不适用于当前案件类型：${legal.lawName} ${legal.articleNumber}`,
              suggestion: '请检查法条适用范围，选择适用于当前案件类型的法条',
              detectedBy: 'law-article-verifier',
            });
          }
        }

        // 检查地域限制（基于tags和keywords）
        if (caseInfo.region && article.tags && article.tags.length > 0) {
          const isInScope = article.tags.includes(caseInfo.region);
          if (!isInScope) {
            issues.push({
              id: `geographic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: IssueType.BUSINESS_RULE_VIOLATION,
              severity: IssueSeverity.MEDIUM,
              category: IssueCategory.FACTUAL,
              field: 'legalBasis',
              message: `法条不适用于当前地区：${legal.lawName} ${legal.articleNumber}`,
              suggestion: `该法条仅适用于${article.tags.join('、')}`,
              detectedBy: 'law-article-verifier',
            });
          }
        }

        // 检查法律时效性
        if (article.expiryDate) {
          const currentDate = caseInfo.currentDate || new Date();
          if (currentDate > article.expiryDate) {
            issues.push({
              id: `expired-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: IssueType.BUSINESS_RULE_VIOLATION,
              severity: IssueSeverity.HIGH,
              category: IssueCategory.FACTUAL,
              field: 'legalBasis',
              message: `法条已失效：${legal.lawName} ${legal.articleNumber}`,
              suggestion: '请使用有效的法律条文',
              detectedBy: 'law-article-verifier',
            });
          }
        }
      } catch (error) {
        console.error(
          `检查法条适用性失败: ${legal.lawName} ${legal.articleNumber}`,
          error
        );
      }
    }

    return issues;
  }

  /**
   * 验证引用准确性
   */
  private verifyAccuracy(
    legalBasis: Array<{
      lawName: string;
      articleNumber: string;
      citedContent?: string;
    }>
  ): VerificationIssue[] {
    const issues: VerificationIssue[] = [];

    for (const legal of legalBasis) {
      // 检查法条编号格式
      const formatPattern = /^第\d+条$/;
      if (!formatPattern.test(legal.articleNumber)) {
        issues.push({
          id: `format-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: IssueType.FORMAT_ERROR,
          severity: IssueSeverity.MEDIUM,
          category: IssueCategory.FORMAT,
          field: 'articleNumber',
          message: `法条编号格式不正确：${legal.articleNumber}`,
          suggestion: '法条编号应为"第XXX条"格式',
          detectedBy: 'law-article-verifier',
        });
      }
    }

    return issues;
  }

  /**
   * 验证引用完整性
   */
  private async verifyCompleteness(
    legalBasis: Array<{ lawName: string; articleNumber: string }>
  ): Promise<VerificationIssue[]> {
    const issues: VerificationIssue[] = [];

    try {
      // 检查重复引用
      const seenArticles = new Set<string>();
      for (const legal of legalBasis) {
        const key = `${legal.lawName}-${legal.articleNumber}`;
        if (seenArticles.has(key)) {
          issues.push({
            id: `duplicate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: IssueType.INCONSISTENT_DATA,
            severity: IssueSeverity.LOW,
            category: IssueCategory.FACTUAL,
            field: 'legalBasis',
            message: `重复引用法条：${legal.lawName} ${legal.articleNumber}`,
            suggestion: '请删除重复的法条引用',
            detectedBy: 'law-article-verifier',
          });
        }
        seenArticles.add(key);
      }

      // 检查法条冲突（不同法律体系）
      const lawNames = legalBasis.map(legal => legal.lawName);
      const uniqueLawNames = new Set(lawNames);
      if (uniqueLawNames.size > 1) {
        issues.push({
          id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: IssueType.INCONSISTENT_DATA,
          severity: IssueSeverity.MEDIUM,
          category: IssueCategory.FACTUAL,
          field: 'legalBasis',
          message: '引用了不同法律体系的法条，可能存在冲突',
          suggestion: '请确保引用的法条来自同一法律体系',
          detectedBy: 'law-article-verifier',
        });
      }
    } catch (error) {
      console.error('检查引用完整性失败:', error);
    }

    return issues;
  }

  /**
   * 计算综合评分
   */
  private calculateOverallScore(issues: VerificationIssue[]): number {
    if (issues.length === 0) {
      return 1.0;
    }

    // 根据问题严重程度计算评分
    let score = 1.0;
    for (const issue of issues) {
      switch (issue.severity) {
        case IssueSeverity.CRITICAL:
          score -= 0.3;
          break;
        case IssueSeverity.HIGH:
          score -= 0.15;
          break;
        case IssueSeverity.MEDIUM:
          score -= 0.1;
          break;
        case IssueSeverity.LOW:
          score -= 0.05;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * 计算事实准确性评分
   */
  private calculateFactualAccuracy(issues: VerificationIssue[]): number {
    const factualIssues = issues.filter(
      issue => issue.category === IssueCategory.FACTUAL
    );

    if (factualIssues.length === 0) {
      return 1.0;
    }

    // 根据事实性问题数量计算评分
    const score = 1 - factualIssues.length * 0.15;
    return Math.max(0, score);
  }

  /**
   * 计算逻辑一致性评分
   */
  private calculateLogicalConsistency(issues: VerificationIssue[]): number {
    const logicalIssues = issues.filter(
      issue => issue.category === IssueCategory.LOGICAL
    );

    if (logicalIssues.length === 0) {
      return 1.0;
    }

    // 根据逻辑性问题数量计算评分
    const score = 1 - logicalIssues.length * 0.1;
    return Math.max(0, score);
  }

  /**
   * 计算任务完成度评分
   */
  private calculateTaskCompleteness(issues: VerificationIssue[]): number {
    const completenessIssues = issues.filter(
      issue => issue.type === IssueType.MISSING_DATA
    );

    if (completenessIssues.length === 0) {
      return 1.0;
    }

    // 根据缺失数据问题数量计算评分
    const score = 1 - completenessIssues.length * 0.2;
    return Math.max(0, score);
  }

  /**
   * 生成改进建议
   */
  private generateSuggestions(issues: VerificationIssue[]): Array<{
    id: string;
    type: SuggestionType;
    priority: SuggestionPriority;
    target?: string;
    action: string;
    reason: string;
    estimatedImpact: string;
  }> {
    const suggestions: Array<{
      id: string;
      type: SuggestionType;
      priority: SuggestionPriority;
      target?: string;
      action: string;
      reason: string;
      estimatedImpact: string;
    }> = [];

    for (const issue of issues) {
      if (issue.suggestion) {
        const priority = this.mapSeverityToPriority(issue.severity);
        suggestions.push({
          id: `suggestion-${issue.id}`,
          type: SuggestionType.DATA_CORRECTION,
          priority,
          target: issue.field,
          action: issue.suggestion,
          reason: issue.message,
          estimatedImpact: `提升${this.getCategoryName(issue.category)}准确性`,
        });
      }
    }

    return suggestions;
  }

  /**
   * 映射严重程度到优先级
   */
  private mapSeverityToPriority(severity: IssueSeverity): SuggestionPriority {
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

  /**
   * 获取类别名称
   */
  private getCategoryName(category: IssueCategory): string {
    switch (category) {
      case IssueCategory.FACTUAL:
        return '事实';
      case IssueCategory.LOGICAL:
        return '逻辑';
      case IssueCategory.COMPLETENESS:
        return '完整性';
      case IssueCategory.FORMAT:
        return '格式';
      case IssueCategory.QUALITY:
        return '质量';
      default:
        return '整体';
    }
  }
}
