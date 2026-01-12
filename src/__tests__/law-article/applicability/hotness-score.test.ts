import RuleValidator from '@/lib/law-article/applicability/rule-validator';
import { LawArticle, LawType, LawCategory } from '@prisma/client';
import type {
  DocumentAnalysisOutput,
  Claim,
  KeyFact,
} from '@/lib/agent/doc-analyzer/core/types';

describe('RuleValidator - 热度评分功能', () => {
  let validator: RuleValidator;
  let mockCaseInfo: DocumentAnalysisOutput;

  beforeAll(() => {
    validator = new RuleValidator();

    // 创建完整的Claim对象
    const mockClaim: Claim = {
      type: 'PAY_PRINCIPAL',
      content: '支付货款100000元',
      currency: 'CNY',
    };

    // 创建完整的KeyFact对象
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

  const createMockArticle = (overrides: Partial<LawArticle>): LawArticle => {
    return {
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
      status: 'VALID',
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
    } as LawArticle;
  };

  describe('热度评分计算', () => {
    it('应该正确计算高热度法条的评分', () => {
      const article = createMockArticle({
        id: 'hot-article',
        viewCount: 10000, // 最大浏览量
        referenceCount: 5000, // 最大引用量
        lawType: LawType.LAW,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(10000/10000)*0.6 + (5000/5000)*0.4 = 1.0
      // 综合评分：1.0*0.8 + 1.0*0.2 = 1.0
      expect(result.levelScore).toBe(1.0);
    });

    it('应该正确计算低热度法条的评分', () => {
      const article = createMockArticle({
        id: 'low-hotness-article',
        viewCount: 10, // 低浏览量
        referenceCount: 5, // 低引用量
        lawType: LawType.LAW,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(10/10000)*0.6 + (5/5000)*0.4 = 0.0016
      // 综合评分：1.0*0.8 + 0.0016*0.2 ≈ 0.8003
      expect(result.levelScore).toBeCloseTo(0.8, 3);
    });

    it('应该正确计算中等热度法条的评分', () => {
      const article = createMockArticle({
        id: 'medium-hotness-article',
        viewCount: 5000, // 中等浏览量
        referenceCount: 2500, // 中等引用量
        lawType: LawType.LAW,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(5000/10000)*0.6 + (2500/5000)*0.4 = 0.5
      // 综合评分：1.0*0.8 + 0.5*0.2 = 0.9
      expect(result.levelScore).toBe(0.9);
    });

    it('应该正确处理只有浏览量的法条', () => {
      const article = createMockArticle({
        id: 'view-only-article',
        viewCount: 8000, // 高浏览量
        referenceCount: 0, // 无引用量
        lawType: LawType.LAW,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(8000/10000)*0.6 + (0/5000)*0.4 = 0.48
      // 综合评分：1.0*0.8 + 0.48*0.2 = 0.896
      expect(result.levelScore).toBeCloseTo(0.896, 3);
    });

    it('应该正确处理只有引用量的法条', () => {
      const article = createMockArticle({
        id: 'reference-only-article',
        viewCount: 0, // 无浏览量
        referenceCount: 4000, // 高引用量
        lawType: LawType.LAW,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(0/10000)*0.6 + (4000/5000)*0.4 = 0.32
      // 综合评分：1.0*0.8 + 0.32*0.2 = 0.864
      expect(result.levelScore).toBeCloseTo(0.864, 3);
    });
  });

  describe('不同法条类型的热度影响', () => {
    it('应该为法律类型法条计算正确评分（高热度）', () => {
      const article = createMockArticle({
        id: 'law-high-hotness',
        lawType: LawType.LAW,
        viewCount: 9000,
        referenceCount: 4500,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(9000/10000)*0.6 + (4500/5000)*0.4 = 0.9
      // 综合评分：1.0*0.8 + 0.9*0.2 = 0.98
      expect(result.levelScore).toBeCloseTo(0.98, 2);
    });

    it('应该为行政法规类型法条计算正确评分（高热度）', () => {
      const article = createMockArticle({
        id: 'admin-reg-high-hotness',
        lawType: LawType.ADMINISTRATIVE_REGULATION,
        viewCount: 9000,
        referenceCount: 4500,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：0.85
      // 热度评分：0.9
      // 综合评分：0.85*0.8 + 0.9*0.2 = 0.86
      expect(result.levelScore).toBeCloseTo(0.86, 2);
    });

    it('应该为部门规章类型法条计算正确评分（高热度）', () => {
      const article = createMockArticle({
        id: 'dept-rule-high-hotness',
        lawType: LawType.DEPARTMENTAL_RULE,
        viewCount: 9000,
        referenceCount: 4500,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：0.65
      // 热度评分：0.9
      // 综合评分：0.65*0.8 + 0.9*0.2 = 0.7
      expect(result.levelScore).toBeCloseTo(0.7, 2);
    });
  });

  describe('边界值处理', () => {
    it('应该正确处理最大浏览量', () => {
      const article = createMockArticle({
        id: 'max-view-article',
        lawType: LawType.LAW,
        viewCount: 10000,
        referenceCount: 1000,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(10000/10000)*0.6 + (1000/5000)*0.4 = 0.68
      // 综合评分：1.0*0.8 + 0.68*0.2 = 0.936
      expect(result.levelScore).toBeCloseTo(0.936, 3);
    });

    it('应该正确处理最大引用量', () => {
      const article = createMockArticle({
        id: 'max-reference-article',
        lawType: LawType.LAW,
        viewCount: 1000,
        referenceCount: 5000,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(1000/10000)*0.6 + (5000/5000)*0.4 = 0.46
      // 综合评分：1.0*0.8 + 0.46*0.2 = 0.892
      expect(result.levelScore).toBeCloseTo(0.892, 3);
    });

    it('应该正确处理零热度', () => {
      const article = createMockArticle({
        id: 'zero-hotness-article',
        lawType: LawType.LAW,
        viewCount: 0,
        referenceCount: 0,
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：(0/10000)*0.6 + (0/5000)*0.4 = 0
      // 综合评分：1.0*0.8 + 0*0.2 = 0.8
      expect(result.levelScore).toBe(0.8);
    });

    it('应该限制最大评分为1.0', () => {
      const article = createMockArticle({
        id: 'beyond-max-article',
        lawType: LawType.LAW,
        viewCount: 20000, // 超过最大值
        referenceCount: 10000, // 超过最大值
      });

      const result = validator.validateArticle(article, mockCaseInfo);

      // 类型评分：1.0
      // 热度评分：1.0（归一化后）
      // 综合评分：1.0*0.8 + 1.0*0.2 = 1.0
      expect(result.levelScore).toBe(1.0);
    });
  });
});
