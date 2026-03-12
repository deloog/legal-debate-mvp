import { LawArticle, LawStatus } from '@prisma/client';
import { RuleValidationResult } from './types';

/**
 * 规则验证器 — Phase 0 硬性过滤
 *
 * 只做客观、可确定的事实性检查：
 * - 法条状态（已废止/草案 → 直接排除）
 * - 生效日期（未来生效 → 排除）
 * - 失效日期（已过期 → 排除）
 *
 * 不做主观判断（法律领域匹配、案件类型适配等）——这些交由 AI 层处理。
 * AMENDED（已修订）法条通过过滤但附加警告，最终适用性由 AI 判断。
 */
export class RuleValidator {
  /**
   * 验证单条法条
   */
  public validateArticle(article: LawArticle): RuleValidationResult {
    const now = new Date();
    const warnings: string[] = [];

    // 1. 状态检查
    if (article.status === LawStatus.REPEALED) {
      return { passed: false, reason: '法条已废止，不得作为法律依据', warnings };
    }
    if (article.status === LawStatus.EXPIRED) {
      return { passed: false, reason: '法条已过期', warnings };
    }
    if (article.status === LawStatus.DRAFT) {
      return { passed: false, reason: '法条仍为草案状态，尚未正式生效', warnings };
    }
    if (article.status === LawStatus.AMENDED) {
      // 修订法条可能仍有效，但需要人工确认修订范围
      warnings.push('该法条已被修订，请确认当前适用版本及修订内容是否影响本案');
    }

    // 2. 生效日期检查
    if (article.effectiveDate && article.effectiveDate > now) {
      return {
        passed: false,
        reason: `法条尚未生效（生效日期：${article.effectiveDate.toISOString().split('T')[0]}）`,
        warnings,
      };
    }

    // 3. 失效日期检查
    if (article.expiryDate && article.expiryDate < now) {
      return {
        passed: false,
        reason: `法条已超过有效期（失效日期：${article.expiryDate.toISOString().split('T')[0]}）`,
        warnings,
      };
    }

    return { passed: true, warnings };
  }

  /**
   * 批量验证法条
   */
  public validateArticles(articles: LawArticle[]): Map<string, RuleValidationResult> {
    const results = new Map<string, RuleValidationResult>();
    for (const article of articles) {
      results.set(article.id, this.validateArticle(article));
    }
    return results;
  }
}

export default RuleValidator;
