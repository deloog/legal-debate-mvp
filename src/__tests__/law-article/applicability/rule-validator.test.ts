import { describe, it, expect, beforeEach } from '@jest/globals';
import { LawType, LawStatus } from '@prisma/client';
import RuleValidator from '@/lib/law-article/applicability/rule-validator';
import {
  createMockArticle,
  createMockExpiredArticle,
} from './test-data';

/**
 * RuleValidator 单元测试
 *
 * 覆盖 Phase 0 硬性过滤的所有分支：
 * - REPEALED / EXPIRED / DRAFT → passed=false
 * - AMENDED → passed=true + warning
 * - effectiveDate 未到 → passed=false
 * - expiryDate 已过 → passed=false
 * - 正常有效法条 → passed=true, warnings=[]
 */
describe('RuleValidator', () => {
  let validator: RuleValidator;

  beforeEach(() => {
    validator = new RuleValidator();
  });

  describe('validateArticle', () => {
    it('应该通过有效法条的验证', () => {
      const article = createMockArticle();

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(true);
      expect(result.reason).toBeUndefined();
      expect(result.warnings).toEqual([]);
    });

    it('应该拒绝已废止法条', () => {
      const article = createMockExpiredArticle();

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
      expect(result.reason).toBeDefined();
    });

    it('应该拒绝 REPEALED 状态法条', () => {
      const article = createMockArticle({ status: LawStatus.REPEALED });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('废止');
    });

    it('应该拒绝 DRAFT 状态法条', () => {
      const article = createMockArticle({ status: LawStatus.DRAFT });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('草案');
    });

    it('应该拒绝 EXPIRED 状态法条', () => {
      const article = createMockArticle({ status: LawStatus.EXPIRED });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
    });

    it('AMENDED 状态法条应通过过滤但附加警告', () => {
      const article = createMockArticle({ status: LawStatus.AMENDED });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('修订');
    });

    it('应该拒绝尚未生效的法条', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const article = createMockArticle({ effectiveDate: futureDate });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('尚未生效');
    });

    it('应该拒绝已超过失效日期的法条', () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const article = createMockArticle({
        status: LawStatus.VALID,
        expiryDate: pastDate,
      });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('有效期');
    });

    it('expiryDate 为空时不应被拒绝', () => {
      const article = createMockArticle({ expiryDate: null });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(true);
    });

    it('不同法条类型均可通过有效性检查', () => {
      const types = [
        LawType.CONSTITUTION,
        LawType.LAW,
        LawType.ADMINISTRATIVE_REGULATION,
        LawType.JUDICIAL_INTERPRETATION,
        LawType.LOCAL_REGULATION,
        LawType.DEPARTMENTAL_RULE,
      ];

      for (const lawType of types) {
        const article = createMockArticle({ lawType });
        const result = validator.validateArticle(article);
        expect(result.passed).toBe(true);
      }
    });
  });

  describe('validateArticles', () => {
    it('应该批量验证多条法条并返回 Map', () => {
      const articles = [
        createMockArticle({ id: '1' }),
        createMockArticle({ id: '2' }),
        createMockArticle({ id: '3' }),
      ];

      const results = validator.validateArticles(articles);

      expect(results.size).toBe(3);
      expect(results.has('1')).toBe(true);
      expect(results.has('2')).toBe(true);
      expect(results.has('3')).toBe(true);
    });

    it('混合有效/无效法条批量验证结果应正确', () => {
      const valid = createMockArticle({ id: 'valid' });
      const repealed = createMockArticle({ id: 'repealed', status: LawStatus.REPEALED });

      const results = validator.validateArticles([valid, repealed]);

      expect(results.get('valid')?.passed).toBe(true);
      expect(results.get('repealed')?.passed).toBe(false);
    });
  });
});
