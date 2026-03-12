import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import ApplicabilityAnalyzer from '@/lib/law-article/applicability/applicability-analyzer';
import { LawArticle, LawStatus, LawType, LawCategory } from '@prisma/client';
import type {
  DocumentAnalysisOutput,
  Claim,
  KeyFact,
} from '@/lib/agent/doc-analyzer/core/types';

/**
 * ApplicabilityAnalyzer — 法条状态处理测试
 *
 * Phase 0 硬性过滤对不同法条状态的处理：
 * - REPEALED / EXPIRED / DRAFT → applicable=false，reasons 包含原因
 * - AMENDED → 通过过滤，warnings 包含修订提示，由 AI 最终判断适用性
 * - VALID → 通过过滤，无状态警告
 *
 * 所有测试使用 useAI: false 以避免依赖外部 AI 服务，保证结果确定性。
 */
describe('ApplicabilityAnalyzer - 法条状态处理', () => {
  let analyzer: ApplicabilityAnalyzer;
  let mockCaseInfo: DocumentAnalysisOutput;

  beforeAll(async () => {
    analyzer = new ApplicabilityAnalyzer();
    await analyzer.initialize();

    const mockClaim: Claim = {
      type: 'PAY_PRINCIPAL',
      content: '支付货款100000元',
      currency: 'CNY',
    };

    const mockKeyFacts: KeyFact[] = [
      {
        id: 'fact-1',
        category: 'CONTRACT_TERM',
        description: '2024年1月签订合同',
        details: '双方签订买卖合同',
        importance: 8,
        confidence: 0.9,
        factType: 'EXPLICIT',
        relatedDisputes: [],
      },
    ];

    mockCaseInfo = {
      success: true,
      extractedData: {
        caseType: 'civil',
        parties: [
          { type: 'plaintiff', name: '张三' },
          { type: 'defendant', name: '李四' },
        ],
        claims: [mockClaim],
        keyFacts: mockKeyFacts,
        disputeFocuses: [],
        summary: '合同纠纷案件',
      },
      confidence: 0.9,
      processingTime: 1000,
      metadata: {
        pages: 10,
        wordCount: 5000,
        fileSize: 1024,
        analysisModel: 'gpt-4',
        tokenUsed: 1000,
        processingTime: 1000,
      },
    };
  });

  afterAll(async () => {
    await analyzer.destroy();
  });

  const createMockArticle = (overrides: Partial<LawArticle>): LawArticle =>
    ({
      id: 'test-article-id',
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
    }) as LawArticle;

  // 所有测试禁用 AI，使用规则层级评分，保证确定性
  const noAIConfig = { useAI: false };

  describe('废止法条', () => {
    it('应该将 REPEALED 法条标记为不适用', async () => {
      const articles = [
        createMockArticle({ id: 'art-1', status: LawStatus.REPEALED }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: noAIConfig,
      });

      const articleResult = result.results.find(r => r.articleId === 'art-1');
      expect(articleResult?.applicable).toBe(false);
      expect(articleResult?.score).toBe(0);
      expect(articleResult?.reasons.some(r => r.includes('废止'))).toBe(true);
    });
  });

  describe('修订法条', () => {
    it('AMENDED 法条应通过过滤并附加修订警告', async () => {
      const articles = [
        createMockArticle({ id: 'art-2', status: LawStatus.AMENDED }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: noAIConfig,
      });

      const articleResult = result.results.find(r => r.articleId === 'art-2');
      // 通过过滤，由法条层级分数决定是否适用
      expect(articleResult?.ruleValidation?.passed).toBe(true);
      // warnings 包含修订提示
      expect(articleResult?.warnings.some(w => w.includes('修订'))).toBe(true);
    });
  });

  describe('过期法条', () => {
    it('应该将 EXPIRED 状态法条标记为不适用', async () => {
      const articles = [
        createMockArticle({
          id: 'art-3',
          status: LawStatus.EXPIRED,
          expiryDate: new Date('2023-12-31'),
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: noAIConfig,
      });

      const articleResult = result.results.find(r => r.articleId === 'art-3');
      expect(articleResult?.applicable).toBe(false);
    });

    it('应该将已超过 expiryDate 的 VALID 法条标记为不适用', async () => {
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const articles = [
        createMockArticle({
          id: 'art-expired-date',
          status: LawStatus.VALID,
          expiryDate: pastDate,
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: noAIConfig,
      });

      const articleResult = result.results.find(
        r => r.articleId === 'art-expired-date'
      );
      expect(articleResult?.applicable).toBe(false);
      expect(articleResult?.ruleValidation?.passed).toBe(false);
    });
  });

  describe('有效法条', () => {
    it('应该正确处理有效法条（无状态警告）', async () => {
      const articles = [
        createMockArticle({
          id: 'art-4',
          status: LawStatus.VALID,
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: noAIConfig,
      });

      const articleResult = result.results.find(r => r.articleId === 'art-4');
      expect(articleResult?.ruleValidation?.passed).toBe(true);
      expect(articleResult?.ruleValidation?.warnings).toEqual([]);
    });
  });

  describe('混合状态法条', () => {
    it('应该正确处理混合状态的法条集合', async () => {
      const articles = [
        createMockArticle({ id: 'valid', status: LawStatus.VALID }),
        createMockArticle({ id: 'repealed', status: LawStatus.REPEALED }),
        createMockArticle({ id: 'amended', status: LawStatus.AMENDED }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: noAIConfig,
      });

      expect(result.results).toHaveLength(3);
      expect(
        result.results.find(r => r.articleId === 'repealed')?.applicable
      ).toBe(false);
      expect(
        result.results.find(r => r.articleId === 'amended')?.ruleValidation
          ?.passed
      ).toBe(true);
      expect(
        result.results.find(r => r.articleId === 'amended')?.warnings.length
      ).toBeGreaterThan(0);
      expect(
        result.results.find(r => r.articleId === 'valid')?.ruleValidation
          ?.warnings
      ).toEqual([]);
    });
  });
});
