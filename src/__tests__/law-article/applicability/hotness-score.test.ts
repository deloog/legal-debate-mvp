import { describe, it, expect, beforeAll } from '@jest/globals';
import RuleValidator from '@/lib/law-article/applicability/rule-validator';
import { LawArticle, LawType, LawStatus, LawCategory } from '@prisma/client';

/**
 * RuleValidator — 边界值与并发处理测试
 *
 * 热度评分逻辑已随重构移除（判断交由 AI 处理）。
 * 本文件保留对硬性过滤边界值的覆盖测试。
 */
describe('RuleValidator - 边界值与批量处理', () => {
  let validator: RuleValidator;

  const createArticle = (overrides: Partial<LawArticle>): LawArticle =>
    ({
      id: 'test-id',
      lawName: '测试法',
      articleNumber: '第1条',
      fullText: '测试内容',
      lawType: LawType.LAW,
      category: LawCategory.CIVIL,
      subCategory: '合同',
      tags: [],
      keywords: [],
      version: '1.0',
      effectiveDate: new Date('2020-01-01'),
      expiryDate: null,
      status: LawStatus.VALID,
      amendmentHistory: null,
      parentId: null,
      chapterNumber: null,
      sectionNumber: null,
      level: 0,
      issuingAuthority: '测试机关',
      jurisdiction: '全国',
      relatedArticles: [],
      legalBasis: null,
      searchableText: '测试内容',
      viewCount: 100,
      referenceCount: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as LawArticle);

  beforeAll(() => {
    validator = new RuleValidator();
  });

  describe('日期边界值', () => {
    it('effectiveDate 恰好为今天应通过', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const article = createArticle({ effectiveDate: today });
      const result = validator.validateArticle(article);

      expect(result.passed).toBe(true);
    });

    it('effectiveDate 为明天应拒绝', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const article = createArticle({ effectiveDate: tomorrow });
      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('尚未生效');
    });

    it('expiryDate 为昨天应拒绝', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const article = createArticle({ status: LawStatus.VALID, expiryDate: yesterday });
      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('有效期');
    });

    it('expiryDate 为明天应通过', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const article = createArticle({ status: LawStatus.VALID, expiryDate: tomorrow });
      const result = validator.validateArticle(article);

      expect(result.passed).toBe(true);
    });
  });

  describe('状态优先级', () => {
    it('REPEALED 状态优先于日期检查', () => {
      // 即使日期有效，已废止法条也应被拒绝
      const article = createArticle({
        status: LawStatus.REPEALED,
        effectiveDate: new Date('2020-01-01'),
        expiryDate: null,
      });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
      expect(result.reason).toContain('废止');
    });

    it('DRAFT 状态优先于日期检查', () => {
      const article = createArticle({
        status: LawStatus.DRAFT,
        effectiveDate: new Date('2020-01-01'),
      });

      const result = validator.validateArticle(article);

      expect(result.passed).toBe(false);
    });
  });

  describe('大量法条批量验证', () => {
    it('应该能高效处理100条法条', () => {
      const articles = Array.from({ length: 100 }, (_, i) =>
        createArticle({ id: `article-${i}` })
      );

      const startTime = Date.now();
      const results = validator.validateArticles(articles);
      const elapsed = Date.now() - startTime;

      expect(results.size).toBe(100);
      expect(elapsed).toBeLessThan(100); // 纯同步操作应在 100ms 内完成
    });

    it('批量验证结果数量应与输入相同', () => {
      const mixed = [
        createArticle({ id: 'valid-1' }),
        createArticle({ id: 'valid-2' }),
        createArticle({ id: 'repealed', status: LawStatus.REPEALED }),
        createArticle({ id: 'draft', status: LawStatus.DRAFT }),
        createArticle({ id: 'amended', status: LawStatus.AMENDED }),
      ];

      const results = validator.validateArticles(mixed);

      expect(results.size).toBe(5);
      expect(results.get('valid-1')?.passed).toBe(true);
      expect(results.get('valid-2')?.passed).toBe(true);
      expect(results.get('repealed')?.passed).toBe(false);
      expect(results.get('draft')?.passed).toBe(false);
      expect(results.get('amended')?.passed).toBe(true); // AMENDED 通过，附警告
      expect(results.get('amended')?.warnings.length).toBeGreaterThan(0);
    });
  });
});
