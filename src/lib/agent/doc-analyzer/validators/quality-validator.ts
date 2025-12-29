/**
 * 质量验证器 - 验证提取数据的质量
 *
 * 核心功能：
 * - 验证当事人信息完整性
 * - 验证诉讼请求完整性
 * - 验证置信度阈值
 * - 验证金额格式和合理性
 * - 生成质量评分和问题报告
 */

import type { ExtractedData, Party, Claim } from "../core/types";
import { QUALITY_VALIDATION_RULES } from "../core/constants";

export interface QualityIssue {
  severity: "ERROR" | "WARNING" | "INFO";
  category: string;
  message: string;
  suggestion?: string;
}

export interface QualityResult {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
  metrics: {
    partyCount: number;
    claimCount: number;
    confidence: number;
    hasPlaintiff: boolean;
    hasDefendant: boolean;
  };
}

/**
 * 验证当事人信息
 */
function validateParties(parties: Party[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (parties.length < QUALITY_VALIDATION_RULES.MIN_PARTIES) {
    issues.push({
      severity: "ERROR",
      category: "当事人",
      message: `当事人数量不足，至少需要${QUALITY_VALIDATION_RULES.MIN_PARTIES}个`,
      suggestion: "检查文档是否包含明确的当事人信息",
    });
  }

  const hasPlaintiff = parties.some((p) => p.type === "plaintiff");
  const hasDefendant = parties.some((p) => p.type === "defendant");

  if (!hasPlaintiff && parties.length > 0) {
    issues.push({
      severity: "WARNING",
      category: "当事人",
      message: "缺少原告信息",
      suggestion: "根据文档内容推断原告角色",
    });
  }

  if (!hasDefendant && parties.length > 0) {
    issues.push({
      severity: "WARNING",
      category: "当事人",
      message: "缺少被告信息",
      suggestion: "从诉讼请求中推断被告信息",
    });
  }

  parties.forEach((party, index) => {
    if (!party.name || party.name.trim().length === 0) {
      issues.push({
        severity: "ERROR",
        category: "当事人",
        message: `第${index + 1}个当事人姓名为空`,
      });
    }

    if (party.name && party.name.length > 100) {
      issues.push({
        severity: "WARNING",
        category: "当事人",
        message: `第${index + 1}个当事人姓名过长（${party.name.length}字符）`,
      });
    }
  });

  return issues;
}

/**
 * 验证诉讼请求
 */
function validateClaims(claims: Claim[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (claims.length < QUALITY_VALIDATION_RULES.MIN_CLAIMS) {
    issues.push({
      severity: "ERROR",
      category: "诉讼请求",
      message: `诉讼请求数量不足，至少需要${QUALITY_VALIDATION_RULES.MIN_CLAIMS}个`,
      suggestion: "检查文档是否包含明确的诉讼请求",
    });
  }

  const hasLitigationCost = claims.some((c) => c.type === "LITIGATION_COST");
  if (!hasLitigationCost) {
    issues.push({
      severity: "INFO",
      category: "诉讼请求",
      message: "缺少诉讼费用请求",
      suggestion: "通常诉讼费用应当包含在请求中",
    });
  }

  claims.forEach((claim, index) => {
    if (!claim.content || claim.content.trim().length === 0) {
      issues.push({
        severity: "ERROR",
        category: "诉讼请求",
        message: `第${index + 1}条诉讼请求内容为空`,
      });
    }

    if (!claim.type || claim.type.length === 0) {
      issues.push({
        severity: "WARNING",
        category: "诉讼请求",
        message: `第${index + 1}条诉讼请求类型为空`,
      });
    }
  });

  return issues;
}

/**
 * 验证置信度
 */
function validateConfidence(confidence: number): QualityIssue[] {
  const issues: QualityIssue[] = [];

  if (confidence < QUALITY_VALIDATION_RULES.MIN_CONFIDENCE) {
    issues.push({
      severity: "ERROR",
      category: "置信度",
      message: `置信度过低（${confidence.toFixed(2)}），低于最低要求${QUALITY_VALIDATION_RULES.MIN_CONFIDENCE}`,
      suggestion: "建议重新分析或人工校验",
    });
  }

  if (confidence < 0.8) {
    issues.push({
      severity: "WARNING",
      category: "置信度",
      message: `置信度较低（${confidence.toFixed(2)}）`,
      suggestion: "建议人工复核提取结果",
    });
  }

  return issues;
}

/**
 * 验证金额
 */
function validateAmounts(claims: Claim[]): QualityIssue[] {
  const issues: QualityIssue[] = [];

  claims.forEach((claim, index) => {
    if (claim.amount !== undefined && claim.amount !== null) {
      if (claim.amount < 0) {
        issues.push({
          severity: "ERROR",
          category: "金额",
          message: `第${index + 1}条请求金额为负数`,
        });
      }

      if (claim.amount > 1e9) {
        issues.push({
          severity: "WARNING",
          category: "金额",
          message: `第${index + 1}条请求金额过大（${claim.amount}）`,
        });
      }
    }
  });

  return issues;
}

/**
 * 计算质量评分
 */
function calculateQualityScore(
  issues: QualityIssue[],
  partyCount: number,
  claimCount: number,
): number {
  let score = 100;

  const errorCount = issues.filter((i) => i.severity === "ERROR").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;
  const infoCount = issues.filter((i) => i.severity === "INFO").length;

  score -= errorCount * 20;
  score -= warningCount * 5;
  score -= infoCount * 1;

  if (partyCount === 0) {
    score -= 20;
  }

  if (claimCount === 0) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 质量验证器类
 */
export class QualityValidator {
  /**
   * 验证提取数据质量
   */
  public validate(
    data: ExtractedData,
    confidence: number = 0.8,
  ): QualityResult {
    const issues: QualityIssue[] = [];

    issues.push(...validateParties(data.parties));
    issues.push(...validateClaims(data.claims));
    issues.push(...validateConfidence(confidence));
    issues.push(...validateAmounts(data.claims));

    const metrics = {
      partyCount: data.parties.length,
      claimCount: data.claims.length,
      confidence,
      hasPlaintiff: data.parties.some((p) => p.type === "plaintiff"),
      hasDefendant: data.parties.some((p) => p.type === "defendant"),
    };

    const score = calculateQualityScore(
      issues,
      metrics.partyCount,
      metrics.claimCount,
    );

    const passed = score >= 60 && !issues.some((i) => i.severity === "ERROR");

    return {
      passed,
      score,
      issues,
      metrics,
    };
  }

  /**
   * 快速验证 - 只检查关键错误
   */
  public quickValidate(
    data: ExtractedData,
    confidence: number = 0.8,
  ): {
    passed: boolean;
    errors: QualityIssue[];
  } {
    const result = this.validate(data, confidence);
    const errors = result.issues.filter((i) => i.severity === "ERROR");

    return {
      passed: errors.length === 0,
      errors,
    };
  }
}
