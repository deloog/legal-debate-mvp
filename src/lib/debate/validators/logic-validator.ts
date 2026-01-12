// 逻辑验证器：验证论点逻辑清晰度和完整性

import { Argument, ValidationResult } from '../types';

/**
 * 逻辑问题类型
 */
interface LogicIssue {
  type:
    | 'incomplete'
    | 'missing_reasoning'
    | 'weak_connection'
    | 'contradiction';
  severity: 'error' | 'warning';
  message: string;
  argumentId: string;
}

/**
 * 逻辑验证器类
 */
export class LogicValidator {
  /**
   * 验证单个论点的逻辑
   */
  static validateArgument(argument: Argument): ValidationResult {
    const issues: LogicIssue[] = [];

    // 1. 检查推理过程是否存在
    if (!argument.reasoning || argument.reasoning.trim().length < 20) {
      issues.push({
        type: 'missing_reasoning',
        severity: 'error',
        message: '论点缺少推理过程或推理过程过于简单',
        argumentId: argument.id,
      });
    }

    // 2. 检查论点内容
    if (!argument.content || argument.content.trim().length < 10) {
      issues.push({
        type: 'incomplete',
        severity: 'error',
        message: '论点内容不完整',
        argumentId: argument.id,
      });
    }

    // 3. 检查推理与论点的关联
    if (argument.content && argument.reasoning) {
      const connectionStrength = this.checkContentReasoningConnection(
        argument.content,
        argument.reasoning
      );
      if (connectionStrength < 0.5) {
        issues.push({
          type: 'weak_connection',
          severity: 'warning',
          message: '论点内容与推理过程的关联性较弱',
          argumentId: argument.id,
        });
      }
    }

    // 4. 检查是否有法律依据
    if (!argument.legalBasis || argument.legalBasis.length === 0) {
      issues.push({
        type: 'incomplete',
        severity: 'warning',
        message: '论点缺少法律依据',
        argumentId: argument.id,
      });
    }

    // 计算验证分数
    const score = this.calculateValidationScore(issues);

    // 转换为ValidationResult格式
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
   * 验证多个论点的逻辑
   */
  static validateArguments(arguments_: Argument[]): ValidationResult {
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

    // 检查论点之间的矛盾
    const contradictionIssues = this.checkContradictions(arguments_);
    if (contradictionIssues.length > 0) {
      allValid = false;
      allErrors.push(...contradictionIssues);
    }

    return {
      valid: allValid,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * 检查论点内容与推理过程的关联性
   */
  private static checkContentReasoningConnection(
    content: string,
    reasoning: string
  ): number {
    const contentWords = this.tokenize(content);
    const reasoningWords = this.tokenize(reasoning);

    // 计算词汇重叠
    const overlap = contentWords.filter(word => reasoningWords.includes(word));
    const overlapRatio = overlap.length / contentWords.length;

    return overlapRatio;
  }

  /**
   * 分词（简单实现）
   */
  private static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1);
  }

  /**
   * 检查论点之间的矛盾
   */
  private static checkContradictions(
    arguments_: Argument[]
  ): Array<{ field: string; message: string; severity: 'error' | 'warning' }> {
    const contradictions: Array<{
      field: string;
      message: string;
      severity: 'error' | 'warning';
    }> = [];

    // 检查所有论点对的矛盾
    for (let i = 0; i < arguments_.length; i++) {
      for (let j = i + 1; j < arguments_.length; j++) {
        const arg1 = arguments_[i];
        const arg2 = arguments_[j];

        // 只检查同一方的论点
        if (arg1.side !== arg2.side) {
          continue;
        }

        const hasContradiction = this.detectContradiction(
          arg1.content,
          arg2.content
        );
        if (hasContradiction) {
          contradictions.push({
            field: 'contradiction',
            message: `论点 ${arg1.id} 和 ${arg2.id} 之间存在矛盾`,
            severity: 'error',
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * 检测两个论点是否存在矛盾
   */
  private static detectContradiction(
    content1: string,
    content2: string
  ): boolean {
    // 简单矛盾检测逻辑
    const contradictionKeywords = [
      ['不', '是'],
      ['未', '已'],
      ['没有', '有'],
      ['不应', '应'],
      ['不能', '可以'],
      ['非', '是'],
    ];

    for (const [neg1, pos1] of contradictionKeywords) {
      if (content1.includes(neg1) && content2.includes(pos1)) {
        return true;
      }
      if (content1.includes(pos1) && content2.includes(neg1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 计算验证分数
   */
  private static calculateValidationScore(issues: LogicIssue[]): number {
    let score = 1.0;

    for (const issue of issues) {
      if (issue.severity === 'error') {
        score -= 0.3;
      } else if (issue.severity === 'warning') {
        score -= 0.15;
      }
    }

    return Math.max(0, score);
  }

  /**
   * 计算逻辑清晰度评分
   */
  static calculateLogicClarityScore(argument: Argument): number {
    let score = 5.0; // 基础分

    // 推理过程长度
    if (argument.reasoning.length >= 100 && argument.reasoning.length <= 500) {
      score += 2.0;
    } else if (argument.reasoning.length > 50) {
      score += 1.0;
    }

    // 论点内容长度
    if (argument.content.length >= 30 && argument.content.length <= 200) {
      score += 1.5;
    } else if (argument.content.length > 20) {
      score += 0.8;
    }

    // 法律依据数量
    if (argument.legalBasis.length >= 1 && argument.legalBasis.length <= 3) {
      score += 1.5;
    } else if (argument.legalBasis.length > 0) {
      score += 0.8;
    }

    return Math.min(10, Math.max(0, score));
  }

  /**
   * 批量计算逻辑清晰度评分
   */
  static calculateAverageLogicClarityScore(arguments_: Argument[]): number {
    if (arguments_.length === 0) {
      return 0;
    }

    const totalScore = arguments_.reduce(
      (sum, arg) => sum + this.calculateLogicClarityScore(arg),
      0
    );

    return totalScore / arguments_.length;
  }
}
