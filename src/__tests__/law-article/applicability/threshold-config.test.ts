import ApplicabilityAnalyzer from "@/lib/law-article/applicability/applicability-analyzer";
import { LawArticle, LawType, LawCategory } from "@prisma/client";
import type {
  DocumentAnalysisOutput,
  Claim,
  KeyFact,
} from "@/lib/agent/doc-analyzer/core/types";

describe("ApplicabilityAnalyzer - 阈值配置功能", () => {
  let analyzer: ApplicabilityAnalyzer;
  let mockCaseInfo: DocumentAnalysisOutput;

  beforeAll(async () => {
    analyzer = new ApplicabilityAnalyzer();
    await analyzer.initialize();

    // 创建完整的Claim对象
    const mockClaim: Claim = {
      type: "PAY_PRINCIPAL",
      content: "支付货款100000元",
      currency: "CNY",
    };

    // 创建完整的KeyFact对象
    const mockKeyFacts: KeyFact[] = [
      {
        id: "fact-1",
        category: "CONTRACT_TERM",
        description: "2024年1月签订合同",
        details: "双方签订买卖合同",
        importance: 8,
        confidence: 0.9,
        factType: "EXPLICIT",
        relatedDisputes: [],
      },
    ];

    mockCaseInfo = {
      success: true,
      extractedData: {
        caseType: "civil",
        parties: [
          { type: "plaintiff", name: "张三" },
          { type: "defendant", name: "李四" },
        ],
        claims: [mockClaim],
        keyFacts: mockKeyFacts,
        disputeFocuses: [],
        summary: "合同纠纷案件",
      },
      confidence: 0.9,
      processingTime: 1000,
      metadata: {
        pages: 10,
        wordCount: 5000,
        fileSize: 1024,
        analysisModel: "gpt-4",
        tokenUsed: 1000,
        processingTime: 1000,
      },
    };
  });

  afterAll(async () => {
    await analyzer.destroy();
  });

  const createMockArticle = (overrides: Partial<LawArticle>): LawArticle => {
    return {
      id: "test-article-id",
      lawName: "测试法",
      articleNumber: "第1条",
      fullText: "测试内容",
      lawType: LawType.LAW,
      category: LawCategory.CIVIL,
      subCategory: "合同",
      tags: [],
      keywords: [],
      version: "1.0",
      effectiveDate: new Date("2020-01-01"),
      expiryDate: null,
      status: "VALID",
      amendmentHistory: null,
      parentId: null,
      chapterNumber: null,
      sectionNumber: null,
      level: 0,
      issuingAuthority: "测试机关",
      jurisdiction: "全国",
      relatedArticles: [],
      legalBasis: null,
      searchableText: "测试内容",
      viewCount: 100,
      referenceCount: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as LawArticle;
  };

  describe("默认阈值配置", () => {
    it("应该使用默认阈值配置", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "article-1",
          articleNumber: "第1条",
        }),
        createMockArticle({
          id: "article-2",
          articleNumber: "第2条",
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
      });

      // 验证配置中的默认阈值
      expect(result.config.minExclusionScore).toBe(0.1);
      expect(result.config.aiLowConfidenceThreshold).toBe(0.3);
      expect(result.config.defaultApplicabilityThreshold).toBe(0.2);
    });
  });

  describe("自定义阈值配置", () => {
    it("应该使用自定义的排除阈值", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "article-1",
          articleNumber: "第1条",
          viewCount: 100,
          referenceCount: 50,
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: {
          minExclusionScore: 0.05, // 降低排除阈值
        },
      });

      // 验证自定义配置生效
      expect(result.config.minExclusionScore).toBe(0.05);
    });

    it("应该使用自定义的AI低置信度阈值", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "article-1",
          articleNumber: "第1条",
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: {
          aiLowConfidenceThreshold: 0.25, // 降低AI低置信度阈值
        },
      });

      // 验证自定义配置生效
      expect(result.config.aiLowConfidenceThreshold).toBe(0.25);
    });

    it("应该使用自定义的默认适用性阈值", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "article-1",
          articleNumber: "第1条",
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: {
          defaultApplicabilityThreshold: 0.15, // 提高适用性阈值
        },
      });

      // 验证自定义配置生效
      expect(result.config.defaultApplicabilityThreshold).toBe(0.15);
    });

    it("应该同时应用多个自定义阈值", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "article-1",
          articleNumber: "第1条",
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: {
          minExclusionScore: 0.08,
          aiLowConfidenceThreshold: 0.28,
          defaultApplicabilityThreshold: 0.18,
        },
      });

      // 验证所有自定义配置生效
      expect(result.config.minExclusionScore).toBe(0.08);
      expect(result.config.aiLowConfidenceThreshold).toBe(0.28);
      expect(result.config.defaultApplicabilityThreshold).toBe(0.18);
    });
  });

  describe("阈值对结果的影响", () => {
    it("较低的排除阈值应该通过更多法条", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "article-1",
          articleNumber: "第1条",
          viewCount: 10,
          referenceCount: 5,
        }),
        createMockArticle({
          id: "article-2",
          articleNumber: "第2条",
          viewCount: 10000,
          referenceCount: 5000,
        }),
      ];

      // 使用默认配置
      const resultDefault = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
      });

      // 使用更低的排除阈值
      const resultLowThreshold = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: {
          minExclusionScore: 0.01, // 非常低的排除阈值
        },
      });

      // 低阈值应该通过更多或相同的法条
      expect(resultLowThreshold.applicableArticles).toBeGreaterThanOrEqual(
        resultDefault.applicableArticles,
      );
    });

    it("较高的适用性阈值应该通过更少法条", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "article-1",
          articleNumber: "第1条",
        }),
        createMockArticle({
          id: "article-2",
          articleNumber: "第2条",
        }),
        createMockArticle({
          id: "article-3",
          articleNumber: "第3条",
        }),
      ];

      // 使用默认配置
      const resultDefault = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
      });

      // 使用更高的适用性阈值
      const resultHighThreshold = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
        config: {
          defaultApplicabilityThreshold: 0.5, // 提高阈值
        },
      });

      // 高阈值应该通过更少或相同的法条
      expect(resultHighThreshold.applicableArticles).toBeLessThanOrEqual(
        resultDefault.applicableArticles,
      );
    });
  });
});
