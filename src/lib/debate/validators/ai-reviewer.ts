/**
 * AI辩论审查器
 * 负责对生成的辩论论点进行质量审查
 */

import type { Argument, DebateInput } from '../types';

/**
 * 审查结果
 */
export interface ReviewResult {
  passed: boolean;
  overallScore: number;
  issues: ReviewIssue[];
  suggestions: string[];
}

/**
 * 审查问题
 */
export interface ReviewIssue {
  type: 'logic' | 'legal' | 'fact' | 'style' | 'balance';
  severity: 'error' | 'warning' | 'info';
  message: string;
  argumentId?: string;
}

/**
 * AI审查器配置
 */
export interface AIReviewerConfig {
  minLogicScore: number;
  minLegalScore: number;
  minFactScore: number;
  enableDeepCheck: boolean;
}

/**
 * AI辩论审查器类
 */
export class DebateAIReviewer {
  private config: AIReviewerConfig;

  constructor(config?: Partial<AIReviewerConfig>) {
    this.config = {
      minLogicScore: config?.minLogicScore ?? 7.0,
      minLegalScore: config?.minLegalScore ?? 7.0,
      minFactScore: config?.minFactScore ?? 7.0,
      enableDeepCheck: config?.enableDeepCheck ?? true,
    };
  }

  /**
   * 审查辩论论点
   */
  async review(
    plaintiffArguments: Argument[],
    defendantArguments: Argument[],
    input: DebateInput
  ): Promise<ReviewResult> {
    const issues: ReviewIssue[] = [];
    const suggestions: string[] = [];
    let totalScore = 0;
    let scoreCount = 0;

    // 审查原告论点
    for (const arg of plaintiffArguments) {
      const result = await this.reviewArgument(arg, input);
      issues.push(...result.issues);
      if (result.score > 0) {
        totalScore += result.score;
        scoreCount++;
      }
      suggestions.push(...result.suggestions);
    }

    // 审查被告论点
    for (const arg of defendantArguments) {
      const result = await this.reviewArgument(arg, input);
      issues.push(...result.issues);
      if (result.score > 0) {
        totalScore += result.score;
        scoreCount++;
      }
      suggestions.push(...result.suggestions);
    }

    // 检查平衡性
    const balanceResult = this.checkBalance(
      plaintiffArguments,
      defendantArguments
    );
    issues.push(...balanceResult.issues);
    suggestions.push(...balanceResult.suggestions);

    // 计算总体分数
    const overallScore =
      scoreCount > 0 ? totalScore / scoreCount : balanceResult.score;

    // 确定是否通过
    const passed = !issues.some(i => i.severity === 'error');

    return {
      passed,
      overallScore,
      issues,
      suggestions: [...new Set(suggestions)], // 去重
    };
  }

  /**
   * 审查单个论点
   */
  private async reviewArgument(
    arg: Argument,
    input: DebateInput
  ): Promise<{ score: number; issues: ReviewIssue[]; suggestions: string[] }> {
    const issues: ReviewIssue[] = [];
    const suggestions: string[] = [];
    let score = 10;

    // 1. 检查逻辑清晰度
    const logicResult = this.checkLogicClarity(arg);
    if (!logicResult.passed) {
      issues.push({
        type: 'logic',
        severity: logicResult.severity,
        message: logicResult.message,
        argumentId: arg.id,
      });
      score -= logicResult.penalty;
      suggestions.push(logicResult.suggestion);
    }

    // 2. 检查法律依据
    const legalResult = this.checkLegalBasis(arg);
    if (!legalResult.passed) {
      issues.push({
        type: 'legal',
        severity: legalResult.severity,
        message: legalResult.message,
        argumentId: arg.id,
      });
      score -= legalResult.penalty;
      suggestions.push(legalResult.suggestion);
    }

    // 3. 检查事实依据
    if (this.config.enableDeepCheck) {
      const factResult = this.checkFactBasis(arg, input);
      if (!factResult.passed) {
        issues.push({
          type: 'fact',
          severity: factResult.severity,
          message: factResult.message,
          argumentId: arg.id,
        });
        score -= factResult.penalty;
        suggestions.push(factResult.suggestion);
      }
    }

    // 4. 检查表达质量
    const styleResult = this.checkStyle(arg);
    if (!styleResult.passed) {
      issues.push({
        type: 'style',
        severity: styleResult.severity,
        message: styleResult.message,
        argumentId: arg.id,
      });
      score -= styleResult.penalty;
      suggestions.push(styleResult.suggestion);
    }

    // 确保分数在0-10范围内
    score = Math.max(0, Math.min(10, score));

    return { score, issues, suggestions };
  }

  /**
   * 检查逻辑清晰度
   */
  private checkLogicClarity(arg: Argument): {
    passed: boolean;
    severity: 'error' | 'warning' | 'info';
    message: string;
    penalty: number;
    suggestion: string;
  } {
    // 检查推理是否为空
    if (!arg.reasoning || arg.reasoning.trim().length < 10) {
      return {
        passed: false,
        severity: 'error',
        message: '论点推理过程过于简单',
        penalty: 2,
        suggestion: '请提供更详细的推理过程',
      };
    }

    // 检查推理长度
    if (arg.reasoning.length > 1000) {
      return {
        passed: false,
        severity: 'warning',
        message: '论点推理过程过长',
        penalty: 0.5,
        suggestion: '精简推理过程，突出核心逻辑',
      };
    }

    // 检查逻辑词汇
    const logicWords = ['因此', '所以', '因为', '如果', '则', '故'];
    const hasLogicWord = logicWords.some(word => arg.reasoning.includes(word));
    if (!hasLogicWord) {
      return {
        passed: false,
        severity: 'warning',
        message: '论点缺少逻辑连接词',
        penalty: 1,
        suggestion: '添加逻辑连接词使推理更清晰',
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '',
      penalty: 0,
      suggestion: '',
    };
  }

  /**
   * 检查法律依据
   */
  private checkLegalBasis(arg: Argument): {
    passed: boolean;
    severity: 'error' | 'warning' | 'info';
    message: string;
    penalty: number;
    suggestion: string;
  } {
    // 检查是否有法律依据
    if (!arg.legalBasis || arg.legalBasis.length === 0) {
      return {
        passed: false,
        severity: 'error',
        message: '论点缺少法律依据',
        penalty: 3,
        suggestion: '引用相关法条作为论点的法律支撑',
      };
    }

    // 检查法律依据数量
    if (arg.legalBasis.length > 5) {
      return {
        passed: false,
        severity: 'warning',
        message: '论点的法律依据过多',
        penalty: 0.5,
        suggestion: '精选最相关的法条',
      };
    }

    // 检查相关性
    for (const basis of arg.legalBasis) {
      if (basis.relevance < 0.5) {
        return {
          passed: false,
          severity: 'warning',
          message: '部分法律依据相关性较低',
          penalty: 1,
          suggestion: '选择相关性更高的法条',
        };
      }

      // 检查法条说明
      if (!basis.explanation || basis.explanation.length < 10) {
        return {
          passed: false,
          severity: 'warning',
          message: '法律依据的说明不充分',
          penalty: 0.5,
          suggestion: '详细说明法条如何支持论点',
        };
      }
    }

    return {
      passed: true,
      severity: 'info',
      message: '',
      penalty: 0,
      suggestion: '',
    };
  }

  /**
   * 检查事实依据
   */
  private checkFactBasis(
    arg: Argument,
    input: DebateInput
  ): {
    passed: boolean;
    severity: 'error' | 'warning' | 'info';
    message: string;
    penalty: number;
    suggestion: string;
  } {
    const content = arg.content.toLowerCase();
    const facts = input.caseInfo.facts || [];

    // 检查论点是否基于案件事实
    if (facts.length > 0) {
      const hasFactReference = facts.some(fact => {
        const factKey = fact.toLowerCase().substring(0, 20);
        return content.includes(factKey);
      });

      if (!hasFactReference) {
        return {
          passed: false,
          severity: 'warning',
          message: '论点可能未基于案件事实',
          penalty: 1,
          suggestion: '将论点与案件事实相结合',
        };
      }
    }

    return {
      passed: true,
      severity: 'info',
      message: '',
      penalty: 0,
      suggestion: '',
    };
  }

  /**
   * 检查表达质量
   */
  private checkStyle(arg: Argument): {
    passed: boolean;
    severity: 'error' | 'warning' | 'info';
    message: string;
    penalty: number;
    suggestion: string;
  } {
    // 检查内容长度
    if (arg.content.length < 20) {
      return {
        passed: false,
        severity: 'error',
        message: '论点内容过短',
        penalty: 2,
        suggestion: '扩展论点内容',
      };
    }

    if (arg.content.length > 500) {
      return {
        passed: false,
        severity: 'warning',
        message: '论点内容过长',
        penalty: 0.5,
        suggestion: '精简论点，突出核心观点',
      };
    }

    // 检查是否包含敏感词
    const sensitiveWords = ['可能', '也许', '大概'];
    const hasSensitiveWord = sensitiveWords.some(word =>
      arg.content.includes(word)
    );
    if (hasSensitiveWord) {
      return {
        passed: false,
        severity: 'warning',
        message: '论点包含不确定性表述',
        penalty: 0.5,
        suggestion: '使用确定性表达',
      };
    }

    return {
      passed: true,
      severity: 'info',
      message: '',
      penalty: 0,
      suggestion: '',
    };
  }

  /**
   * 检查正反方平衡性
   */
  private checkBalance(
    plaintiffArgs: Argument[],
    defendantArgs: Argument[]
  ): {
    score: number;
    issues: ReviewIssue[];
    suggestions: string[];
  } {
    const issues: ReviewIssue[] = [];
    const suggestions: string[] = [];

    const plaintiffCount = plaintiffArgs.length;
    const defendantCount = defendantArgs.length;

    // 检查数量平衡
    const countDiff = Math.abs(plaintiffCount - defendantCount);
    if (countDiff > 2) {
      issues.push({
        type: 'balance',
        severity: 'warning',
        message: '双方论点数量不平衡',
      });
      suggestions.push('建议增加论点较少一方的论点数量');
    }

    // 检查质量平衡
    const plaintiffAvgScore =
      plaintiffArgs.reduce((sum, a) => sum + a.overallScore, 0) /
      (plaintiffArgs.length || 1);
    const defendantAvgScore =
      defendantArgs.reduce((sum, a) => sum + a.overallScore, 0) /
      (defendantArgs.length || 1);

    const scoreDiff = Math.abs(plaintiffAvgScore - defendantAvgScore);
    if (scoreDiff > 2) {
      issues.push({
        type: 'balance',
        severity: 'warning',
        message: '双方论点质量差异较大',
      });
      suggestions.push('建议提升论点质量较低一方的论证深度');
    }

    // 计算平衡分数
    const score = 10 - countDiff * 0.5 - scoreDiff * 0.5;

    return {
      score: Math.max(0, Math.min(10, score)),
      issues,
      suggestions,
    };
  }
}
