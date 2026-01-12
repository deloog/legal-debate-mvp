import { describe, it, expect } from '@jest/globals';
import { LawType, LawStatus } from '@prisma/client';
import RuleValidator from '@/lib/law-article/applicability/rule-validator';
import {
  createMockCaseInfo,
  createMockArticle,
  createMockNonApplicableArticle,
  createMockExpiredArticle,
  createMockLocalArticle,
} from './test-data';

describe('RuleValidator', () => {
  let validator: RuleValidator;

  beforeEach(() => {
    validator = new RuleValidator();
  });

  describe('validateArticle', () => {
    it('应该通过有效法条的验证', () => {
      const article = createMockArticle();
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      expect(result.validity.passed).toBe(true);
      expect(result.scope.passed).toBe(true);
      // 层级评分 = 类型评分(1.0) * 80% + 热度评分 * 20%
      expect(result.levelScore).toBeCloseTo(0.8, 1);
      expect(result.overallScore).toBeGreaterThan(0.7);
    });

    it('应该拒绝过期法条', () => {
      const article = createMockExpiredArticle();
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      expect(result.validity.passed).toBe(false);
      expect(result.validity.reason).toContain('废止');
      expect(result.overallScore).toBeLessThan(0.3);
    });

    it('应该拒绝分类不匹配的法条', () => {
      const article = createMockNonApplicableArticle();
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      expect(result.scope.passed).toBe(false);
      expect(result.scope.reason).toContain('不匹配');
    });

    it('应该正确处理地方法规', () => {
      const article = createMockLocalArticle();
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      expect(result.validity.passed).toBe(true);
      // 层级评分 = 类型评分(0.7) * 80% + 热度评分 * 20%
      // 使用toBeCloseTo避免浮点数精度问题
      expect(result.levelScore).toBeCloseTo(0.56, 1);
    });
  });

  describe('validateArticles', () => {
    it('应该批量验证多条法条', () => {
      const articles = [
        createMockArticle({ id: '1' }),
        createMockArticle({ id: '2' }),
        createMockArticle({ id: '3' }),
      ];
      const caseInfo = createMockCaseInfo();

      const results = validator.validateArticles(articles, caseInfo);

      expect(results.size).toBe(3);
      expect(results.has('1')).toBe(true);
      expect(results.has('2')).toBe(true);
      expect(results.has('3')).toBe(true);
    });
  });

  describe('calculateLevelScore', () => {
    it('应该给法律层级法条最高分', () => {
      const article = createMockArticle({
        lawType: LawType.LAW,
      });
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      // 层级评分 = 类型评分(1.0) * 80% + 热度评分 * 20%
      // 使用toBeCloseTo避免浮点数精度问题
      expect(result.levelScore).toBeCloseTo(0.8, 1);
    });
  });

  describe('时效性检查', () => {
    it('应该检查法条状态', () => {
      const article = createMockArticle({
        status: LawStatus.AMENDED,
      });
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      expect(result.validity.passed).toBe(false);
      expect(result.validity.reason).toContain('已修订');
    });

    it('应该检查生效日期', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const article = createMockArticle({
        effectiveDate: futureDate,
      });
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      expect(result.validity.passed).toBe(false);
      expect(result.validity.reason).toContain('尚未生效');
    });
  });

  describe('适用范围检查', () => {
    it('应该匹配民事案件的民事法条', () => {
      const article = createMockArticle({
        category: 'CIVIL',
      });
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      expect(result.scope.passed).toBe(true);
    });

    it('应该拒绝民事案件的刑事法条', () => {
      const article = createMockArticle({
        category: 'CRIMINAL',
      });
      const caseInfo = createMockCaseInfo();

      const result = validator.validateArticle(article, caseInfo);

      expect(result.scope.passed).toBe(false);
    });
  });
});
