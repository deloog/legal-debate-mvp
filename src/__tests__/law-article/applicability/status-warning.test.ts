import ApplicabilityAnalyzer from "@/lib/law-article/applicability/applicability-analyzer";
import { LawArticle, LawStatus, LawType, LawCategory } from "@prisma/client";
import type {
  DocumentAnalysisOutput,
  Claim,
  KeyFact,
} from "@/lib/agent/doc-analyzer/core/types";

describe("ApplicabilityAnalyzer - 状态警告功能", () => {
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
      {
        id: "fact-2",
        category: "BREACH_BEHAVIOR",
        description: "2024年6月违约",
        details: "被告未按期付款",
        importance: 9,
        confidence: 0.95,
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
      status: LawStatus.VALID,
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

  describe("废止法条状态警告", () => {
    it("应该为废止法条添加error级别警告", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "test-article-1",
          articleNumber: "第1条",
          status: LawStatus.REPEALED,
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
      });

      expect(result.results).toHaveLength(1);
      const articleResult = result.results[0];

      expect(articleResult.statusWarning).toBeDefined();
      expect(articleResult.statusWarning?.level).toBe("error");
      expect(articleResult.statusWarning?.message).toContain("已废止");
      expect(articleResult.statusWarning?.message).toContain("已失效");
    });
  });

  describe("修订法条状态警告", () => {
    it("应该为修订法条添加warning级别警告", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "test-article-2",
          articleNumber: "第2条",
          version: "2.0",
          status: LawStatus.AMENDED,
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
      });

      expect(result.results).toHaveLength(1);
      const articleResult = result.results[0];

      expect(articleResult.statusWarning).toBeDefined();
      expect(articleResult.statusWarning?.level).toBe("warning");
      expect(articleResult.statusWarning?.message).toContain("已修订");
      expect(articleResult.statusWarning?.message).toContain("最新版本");
    });
  });

  describe("过期法条状态警告", () => {
    it("应该为过期法条添加warning级别警告", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "test-article-3",
          articleNumber: "第3条",
          effectiveDate: new Date("2020-01-01"),
          expiryDate: new Date("2023-12-31"),
          status: LawStatus.EXPIRED,
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
      });

      expect(result.results).toHaveLength(1);
      const articleResult = result.results[0];

      expect(articleResult.statusWarning).toBeDefined();
      expect(articleResult.statusWarning?.level).toBe("warning");
      expect(articleResult.statusWarning?.message).toContain("已过期");
      expect(articleResult.statusWarning?.message).toContain("超过有效期");
    });
  });

  describe("有效法条无警告", () => {
    it("应该不为有效法条添加状态警告", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "test-article-4",
          articleNumber: "第4条",
          fullText: "合同当事人应当履行合同义务",
          searchableText: "合同当事人应当履行合同义务",
          status: LawStatus.VALID,
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
      });

      expect(result.results).toHaveLength(1);
      const articleResult = result.results[0];

      expect(articleResult.statusWarning).toBeUndefined();
    });
  });

  describe("混合状态法条", () => {
    it("应该正确处理混合状态法条", async () => {
      const articles: LawArticle[] = [
        createMockArticle({
          id: "test-article-valid",
          articleNumber: "第5条",
          fullText: "有效法条内容",
          searchableText: "有效法条内容",
          status: LawStatus.VALID,
        }),
        createMockArticle({
          id: "test-article-repealed",
          articleNumber: "第6条",
          fullText: "废止法条内容",
          searchableText: "废止法条内容",
          status: LawStatus.REPEALED,
        }),
        createMockArticle({
          id: "test-article-amended",
          articleNumber: "第7条",
          fullText: "修订法条内容",
          searchableText: "修订法条内容",
          version: "2.0",
          status: LawStatus.AMENDED,
        }),
      ];

      const result = await analyzer.analyze({
        caseInfo: mockCaseInfo,
        articles,
      });

      expect(result.results).toHaveLength(3);

      const validArticle = result.results.find(
        (r) => r.articleId === "test-article-valid",
      );
      const repealedArticle = result.results.find(
        (r) => r.articleId === "test-article-repealed",
      );
      const amendedArticle = result.results.find(
        (r) => r.articleId === "test-article-amended",
      );

      // 验证有效法条无警告
      expect(validArticle?.statusWarning).toBeUndefined();

      // 验证废止法条有error警告
      expect(repealedArticle?.statusWarning).toBeDefined();
      expect(repealedArticle?.statusWarning?.level).toBe("error");
      expect(repealedArticle?.statusWarning?.message).toContain("已废止");

      // 验证修订法条有warning警告
      expect(amendedArticle?.statusWarning).toBeDefined();
      expect(amendedArticle?.statusWarning?.level).toBe("warning");
      expect(amendedArticle?.statusWarning?.message).toContain("已修订");
    });
  });
});
