/**
 * 争议焦点提取器 - 工具函数
 * 包含合并、去重、摘要生成等功能
 */

import type { DisputeFocus, DisputeFocusCategory } from '../../core/types';

/**
 * 合并AI和规则匹配结果，去重
 */
export function mergeAndDeduplicate(
  aiFocuses: DisputeFocus[],
  ruleFocuses: DisputeFocus[]
): DisputeFocus[] {
  const seen = new Set<string>();
  const unique: DisputeFocus[] = [];

  // 先添加AI识别的结果（置信度更高）
  for (const focus of aiFocuses) {
    const key = `${focus.category}_${focus.coreIssue}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(focus);
    }
  }

  // 再添加规则匹配的结果（去重）
  for (const focus of ruleFocuses) {
    const key = `${focus.category}_${focus.coreIssue}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(focus);
    }
  }

  return unique;
}

/**
 * 生成摘要
 */
export function generateSummary(
  finalFocuses: DisputeFocus[],
  aiExtracted: DisputeFocus[],
  ruleExtracted: DisputeFocus[],
  aiReviewed: DisputeFocus[]
): {
  total: number;
  byCategory: Record<DisputeFocusCategory, number>;
  avgImportance: number;
  avgConfidence: number;
  inferredCount: number;
  aiExtractedCount: number;
  ruleExtractedCount: number;
  aiReviewedCount: number;
} {
  const byCategory: Record<DisputeFocusCategory, number> = {} as Record<DisputeFocusCategory, number>;
  let totalImportance = 0;
  let totalConfidence = 0;
  let inferredCount = 0;

  const allCategories: DisputeFocusCategory[] = [
    'CONTRACT_BREACH',
    'PAYMENT_DISPUTE',
    'LIABILITY_ISSUE',
    'DAMAGES_CALCULATION',
    'PERFORMANCE_DISPUTE',
    'VALIDITY_ISSUE',
    'OTHER'
  ];

  for (const category of allCategories) {
    byCategory[category] = finalFocuses.filter(f => f.category === category).length;
  }

  for (const focus of finalFocuses) {
    totalImportance += focus.importance;
    totalConfidence += focus.confidence;
    if (focus._inferred) inferredCount++;
  }

  return {
    total: finalFocuses.length,
    byCategory,
    avgImportance: finalFocuses.length > 0 ? Math.round(totalImportance / finalFocuses.length) : 0,
    avgConfidence: finalFocuses.length > 0 ? Math.round(totalConfidence / finalFocuses.length * 100) / 100 : 0,
    inferredCount,
    aiExtractedCount: aiExtracted.length,
    ruleExtractedCount: ruleExtracted.length,
    aiReviewedCount: aiReviewed.length
  };
}
