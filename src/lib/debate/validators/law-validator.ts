// 法律验证器：验证法条引用的准确性

import { Argument, ValidationResult, DebateInput } from '../types';

/**
 * 法律问题类型
 */
interface LawIssue {
  type: 'missing_law' | 'invalid_law' | 'weak_relevance' | 'format_error';
  severity: 'error' | 'warning';
  message: string;
  argumentId: string;
}

/**
 * 法律验证器类
 */
export class LawValidator {
  private availableLaws: Set<string>;

  constructor(private input: DebateInput) {
    // 从输入中提取可用的法条
    this.availableLaws = new Set(
      (input.lawArticles || []).map(
        article => `${article.lawName} ${article.articleNumber}`
      )
    );
  }

  /**
   * 验证单个论点的法律依据
   */
  validateArgument(argument: Argument): ValidationResult {
    const issues: LawIssue[] = [];

    // 1. 检查是否有法律依据
    if (!argument.legalBasis || argument.legalBasis.length === 0) {
      issues.push({
        type: 'missing_law',
        severity: 'error',
        message: '论点缺少法律依据',
        argumentId: argument.id,
      });
    } else {
      // 检查每个法条引用
      for (const basis of argument.legalBasis) {
        const lawIssues = this.validateLegalBasis(basis, argument.id);
        issues.push(...lawIssues);
      }
    }

    // 计算验证分数
    const score = this.calculateValidationScore(issues);

    return {
      valid: score >= 0.6,
      errors: issues
        .filter(issue => issue.severity === 'error')
        .map(issue => ({
          field: issue.type,
          message: issue.message,
          severity: issue.severity,
        })),
      warnings: issues
        .filter(issue => issue.severity === 'warning')
        .map(issue => issue.message),
    };
  }

  /**
   * 验证多个论点的法律依据
   */
  validateArguments(arguments_: Argument[]): ValidationResult {
    if (arguments_.length === 0) {
      return {
        valid: false,
        errors: [
          { field: 'arguments', message: '没有论点可验证', severity: 'error' },
        ],
        warnings: [],
      };
    }

    let allValid = true;
    const allErrors: Array<{
      field: string;
      message: string;
      severity: 'error' | 'warning';
    }> = [];
    const allWarnings: string[] = [];

    // 验证每个论点
    for (const argument of arguments_) {
      const result = this.validateArgument(argument);
      if (!result.valid) {
        allValid = false;
      }
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    }

    return {
      valid: allValid,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * 验证单个法条依据
   */
  private validateLegalBasis(
    basis: {
      lawName: string;
      articleNumber: string;
      relevance: number;
      explanation: string;
    },
    argumentId: string
  ): LawIssue[] {
    const issues: LawIssue[] = [];

    // 1. 检查法条是否在可用列表中
    const lawReference = `${basis.lawName} ${basis.articleNumber}`;
    if (!this.availableLaws.has(lawReference)) {
      issues.push({
        type: 'invalid_law',
        severity: 'error',
        message: `法条 "${lawReference}" 不在可用法条列表中`,
        argumentId,
      });
    }

    // 2. 检查法条格式
    if (!this.isValidLawFormat(basis.lawName, basis.articleNumber)) {
      issues.push({
        type: 'format_error',
        severity: 'warning',
        message: `法条格式可能不正确: "${lawReference}"`,
        argumentId,
      });
    }

    // 3. 检查相关性评分
    if (basis.relevance < 0.5) {
      issues.push({
        type: 'weak_relevance',
        severity: 'warning',
        message: `法条相关性较低（${basis.relevance.toFixed(2)}），建议增加相关性说明`,
        argumentId,
      });
    }

    // 4. 检查说明内容
    if (!basis.explanation || basis.explanation.trim().length < 10) {
      issues.push({
        type: 'format_error',
        severity: 'warning',
        message: '法条说明过于简单或缺失',
        argumentId,
      });
    }

    return issues;
  }

  /**
   * 验证法条格式
   */
  private isValidLawFormat(lawName: string, articleNumber: string): boolean {
    // 检查法律名称
    if (!lawName || lawName.trim().length < 2) {
      return false;
    }

    // 检查条款号格式
    const articlePattern = /第[0-9零一二三四五六七八九十百千万]+条/;
    return articlePattern.test(articleNumber) || /^\d+$/.test(articleNumber);
  }

  /**
   * 计算验证分数
   */
  private calculateValidationScore(issues: LawIssue[]): number {
    let score = 1.0;

    for (const issue of issues) {
      if (issue.severity === 'error') {
        score -= 0.35;
      } else if (issue.severity === 'warning') {
        score -= 0.15;
      }
    }

    return Math.max(0, score);
  }

  /**
   * 计算法律准确性评分
   */
  static calculateLegalAccuracyScore(argument: Argument): number {
    let score = 5.0; // 基础分

    if (!argument.legalBasis || argument.legalBasis.length === 0) {
      return score; // 没有法条返回基础分
    }

    // 法条数量（1-3个最佳）
    if (argument.legalBasis.length >= 1 && argument.legalBasis.length <= 3) {
      score += 2.0;
    } else if (argument.legalBasis.length > 0) {
      score += 1.0;
    }

    // 法条相关性平均分
    const avgRelevance =
      argument.legalBasis.reduce((sum, b) => sum + (b.relevance || 0), 0) /
      argument.legalBasis.length;
    score += avgRelevance * 2.5;

    // 法条说明长度
    const hasGoodExplanation = argument.legalBasis.some(
      b => b.explanation && b.explanation.length > 20
    );
    if (hasGoodExplanation) {
      score += 0.5;
    }

    return Math.min(10, Math.max(0, score));
  }

  /**
   * 批量计算法律准确性评分
   */
  static calculateAverageLegalAccuracyScore(arguments_: Argument[]): number {
    if (arguments_.length === 0) {
      return 0;
    }

    const totalScore = arguments_.reduce(
      (sum, arg) => sum + this.calculateLegalAccuracyScore(arg),
      0
    );

    return totalScore / arguments_.length;
  }
}
