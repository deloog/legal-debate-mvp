import { POST, OPTIONS } from "@/app/api/v1/legal-analysis/applicability/route";
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from "./test-utils";

/**
 * 法条适用性分析API单元测试
 */

// Mock ApplicabilityAnalyzer
const mockAnalyze = jest.fn();
const mockInitialize = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/law-article/applicability/applicability-analyzer", () => ({
  ApplicabilityAnalyzer: jest.fn().mockImplementation(() => ({
    analyze: mockAnalyze,
    initialize: mockInitialize,
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock SemanticMatcher, RuleValidator, AIReviewer
jest.mock("@/lib/law-article/applicability/semantic-matcher", () => ({
  default: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    matchArticles: jest.fn().mockResolvedValue(new Map()),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/lib/law-article/applicability/rule-validator", () => ({
  default: jest.fn().mockImplementation(() => ({
    validateArticles: jest.fn().mockReturnValue(new Map()),
  })),
}));

jest.mock("@/lib/law-article/applicability/ai-reviewer", () => ({
  default: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    reviewArticles: jest.fn().mockResolvedValue(new Map()),
    destroy: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Mock prisma
const mockLegalReferenceUpsert = jest.fn();
const mockCaseFindUnique = jest.fn();
const mockLawArticleFindMany = jest.fn();

jest.mock("@/lib/db/prisma", () => {
  const prisma = {
    legalReference: {
      upsert: jest
        .fn()
        .mockImplementation((options) => mockLegalReferenceUpsert(options)),
    },
    case: {
      findUnique: jest.fn().mockImplementation(() => mockCaseFindUnique()),
    },
    lawArticle: {
      findMany: jest.fn().mockImplementation(() => mockLawArticleFindMany()),
    },
  };
  return { prisma };
});

describe("法条适用性分析API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/legal-analysis/applicability", () => {
    it("应该成功返回法条适用性分析结果", async () => {
      mockCaseFindUnique.mockResolvedValue({
        id: "case-1",
        documents: [
          {
            analysisResult: {
              extractedData: {
                parties: [{ type: "plaintiff", name: "张三" }],
                claims: [{ content: "赔偿损失" }],
                keyFacts: [{ description: "违约事实" }],
                disputeFocuses: [{ description: "违约" }],
                timeline: [],
              },
            },
          },
        ],
      });

      mockLawArticleFindMany.mockResolvedValue([
        {
          id: "article-1",
          fullText: "当事人一方不履行合同义务...",
          lawType: "CIVIL",
          category: "CONTRACT",
        },
        {
          id: "article-2",
          fullText: "当事人应当承担违约责任...",
          lawType: "CIVIL",
          category: "CONTRACT",
        },
      ]);

      mockAnalyze.mockResolvedValue({
        analyzedAt: new Date(),
        totalArticles: 2,
        applicableArticles: 2,
        notApplicableArticles: 0,
        results: [
          {
            articleId: "article-1",
            articleNumber: "第一百零七条",
            lawName: "合同法",
            applicable: true,
            score: 0.85,
            semanticScore: 0.9,
            ruleScore: 0.8,
            reasons: ["法条与案情直接相关"],
            warnings: [],
            semanticMatch: { semanticRelevance: 0.9 },
            ruleValidation: {
              validity: { passed: true },
              scope: { passed: true },
              levelScore: 0.8,
              overallScore: 0.8,
            },
          },
          {
            articleId: "article-2",
            articleNumber: "第一百零八条",
            lawName: "合同法",
            applicable: true,
            score: 0.72,
            semanticScore: 0.75,
            ruleScore: 0.7,
            reasons: ["法条部分相关"],
            warnings: [],
            semanticMatch: { semanticRelevance: 0.75 },
            ruleValidation: {
              validity: { passed: true },
              scope: { passed: true },
              levelScore: 0.7,
              overallScore: 0.7,
            },
          },
        ],
        statistics: {
          averageScore: 0.785,
          maxScore: 0.85,
          minScore: 0.72,
          executionTime: 100,
          semanticMatchingTime: 50,
          ruleValidationTime: 30,
          aiReviewTime: 20,
          applicableRatio: 1,
          byType: {},
          byCategory: {},
        },
        config: {
          useAI: true,
          useRuleValidation: true,
          useAIReview: true,
          minSemanticRelevance: 0.3,
          minApplicabilityScore: 0.5,
          parallel: true,
          useCache: true,
        },
      });

      mockLegalReferenceUpsert.mockResolvedValue({
        id: "ref-1",
      });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "case-1",
            articleIds: ["article-1", "article-2"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      assertions.assertSuccess(testResponse);
      expect(testResponse.data.results).toHaveLength(2);
      expect(testResponse.data.totalArticles).toBe(2);
      expect(testResponse.data.applicableArticles).toBe(2);
      expect(testResponse.data.results[0].applicable).toBe(true);
      expect(testResponse.data.results[0].score).toBeGreaterThan(0.7);
      expect(mockAnalyze).toHaveBeenCalled();
    });

    it("应该在缺少caseId时返回错误", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            articleIds: ["article-1"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error?.code).toBe("INVALID_PARAMS");
    });

    it("应该在articleIds为空时返回错误", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "case-1",
            articleIds: [],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error?.code).toBe("INVALID_PARAMS");
    });

    it("应该在articleIds不是数组时返回错误", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "case-1",
            articleIds: "invalid",
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 400);
      expect(testResponse.error?.code).toBe("INVALID_PARAMS");
    });

    it("应该在案件不存在时返回错误", async () => {
      mockCaseFindUnique.mockResolvedValue(null);

      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "non-existent-case",
            articleIds: ["article-1"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 404);
      expect(testResponse.error?.code).toBe("CASE_NOT_FOUND");
    });

    it("应该在法条不存在时返回错误", async () => {
      mockCaseFindUnique.mockResolvedValue({
        id: "case-1",
        documents: [
          {
            analysisResult: {
              extractedData: {
                parties: [],
                claims: [],
                keyFacts: [],
                disputeFocuses: [],
                timeline: [],
              },
            },
          },
        ],
      });
      mockLawArticleFindMany.mockResolvedValue([]);

      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "case-1",
            articleIds: ["article-1"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 404);
      expect(testResponse.error?.code).toBe("ARTICLES_NOT_FOUND");
    });

    it("应该正确标记不适用法条", async () => {
      mockCaseFindUnique.mockResolvedValue({
        id: "case-1",
        documents: [
          {
            analysisResult: {
              extractedData: {
                parties: [],
                claims: [],
                keyFacts: [],
                disputeFocuses: [],
                timeline: [],
              },
            },
          },
        ],
      });

      mockLawArticleFindMany.mockResolvedValue([
        {
          id: "article-1",
          fullText: "text",
          lawType: "CIVIL",
          category: "OTHER",
        },
      ]);

      mockAnalyze.mockResolvedValue({
        analyzedAt: new Date(),
        totalArticles: 1,
        applicableArticles: 0,
        notApplicableArticles: 1,
        results: [
          {
            articleId: "article-1",
            articleNumber: "第一条",
            lawName: "民法典",
            applicable: false,
            score: 0.3,
            semanticScore: 0.2,
            ruleScore: 0.4,
            reasons: ["法条与案情无关"],
            warnings: [],
          },
        ],
        statistics: {
          averageScore: 0.3,
          maxScore: 0.3,
          minScore: 0.3,
          executionTime: 50,
          semanticMatchingTime: 20,
          ruleValidationTime: 15,
          aiReviewTime: 15,
          applicableRatio: 0,
          byType: {},
          byCategory: {},
        },
        config: {
          useAI: true,
          useRuleValidation: true,
          useAIReview: true,
          minSemanticRelevance: 0.3,
          minApplicabilityScore: 0.5,
          parallel: true,
          useCache: true,
        },
      });

      mockLegalReferenceUpsert.mockResolvedValue({ id: "ref-1" });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "case-1",
            articleIds: ["article-1"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.results[0].applicable).toBe(false);
      expect(testResponse.data.notApplicableArticles).toBe(1);
    });

    it("应该包含分析元数据", async () => {
      mockCaseFindUnique.mockResolvedValue({
        id: "case-1",
        documents: [
          {
            analysisResult: {
              extractedData: {
                parties: [],
                claims: [],
                keyFacts: [],
                disputeFocuses: [],
                timeline: [],
              },
            },
          },
        ],
      });

      mockLawArticleFindMany.mockResolvedValue([
        {
          id: "article-1",
          fullText: "text",
          lawType: "CIVIL",
          category: "OTHER",
        },
        {
          id: "article-2",
          fullText: "text",
          lawType: "CIVIL",
          category: "OTHER",
        },
      ]);

      mockAnalyze.mockResolvedValue({
        analyzedAt: new Date(),
        totalArticles: 2,
        applicableArticles: 1,
        notApplicableArticles: 1,
        results: [
          {
            articleId: "article-1",
            articleNumber: "第一条",
            lawName: "民法典",
            applicable: true,
            score: 0.8,
            semanticScore: 0.85,
            ruleScore: 0.8,
            reasons: ["相关"],
            warnings: [],
          },
          {
            articleId: "article-2",
            articleNumber: "第二条",
            lawName: "民法典",
            applicable: false,
            score: 0.4,
            semanticScore: 0.3,
            ruleScore: 0.5,
            reasons: [],
            warnings: ["不相关"],
          },
        ],
        statistics: {
          averageScore: 0.6,
          maxScore: 0.8,
          minScore: 0.4,
          executionTime: 100,
          semanticMatchingTime: 40,
          ruleValidationTime: 30,
          aiReviewTime: 30,
          applicableRatio: 0.5,
          byType: {},
          byCategory: {},
        },
        config: {
          useAI: true,
          useRuleValidation: true,
          useAIReview: true,
          minSemanticRelevance: 0.3,
          minApplicabilityScore: 0.5,
          parallel: true,
          useCache: true,
        },
      });

      mockLegalReferenceUpsert.mockResolvedValue({ id: "ref-1" });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "case-1",
            articleIds: ["article-1", "article-2"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.totalArticles).toBeDefined();
      expect(testResponse.data.applicableArticles).toBe(1);
      expect(testResponse.data.notApplicableArticles).toBe(1);
      expect(testResponse.data.statistics).toBeDefined();
      expect(testResponse.data.config).toBeDefined();
    });

    it("应该处理分析器错误", async () => {
      mockCaseFindUnique.mockResolvedValue({
        id: "case-1",
        documents: [
          {
            analysisResult: {
              extractedData: {
                parties: [],
                claims: [],
                keyFacts: [],
                disputeFocuses: [],
                timeline: [],
              },
            },
          },
        ],
      });

      mockLawArticleFindMany.mockResolvedValue([
        {
          id: "article-1",
          fullText: "text",
          lawType: "CIVIL",
          category: "OTHER",
        },
      ]);

      mockAnalyze.mockRejectedValue(new Error("Analysis failed"));

      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "case-1",
            articleIds: ["article-1"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 500);
      expect(testResponse.error?.code).toBeDefined();
    });

    it("应该保存分析结果到数据库", async () => {
      mockCaseFindUnique.mockResolvedValue({
        id: "case-1",
        documents: [
          {
            analysisResult: {
              extractedData: {
                parties: [],
                claims: [],
                keyFacts: [],
                disputeFocuses: [],
                timeline: [],
              },
            },
          },
        ],
      });

      mockLawArticleFindMany.mockResolvedValue([
        {
          id: "article-1",
          fullText: "text",
          lawType: "CIVIL",
          category: "CONTRACT",
        },
      ]);

      mockAnalyze.mockResolvedValue({
        analyzedAt: new Date(),
        totalArticles: 1,
        applicableArticles: 1,
        notApplicableArticles: 0,
        results: [
          {
            articleId: "article-1",
            articleNumber: "第一条",
            lawName: "民法典",
            applicable: true,
            score: 0.9,
            semanticScore: 0.85,
            ruleScore: 0.9,
            reasons: ["相关"],
            warnings: [],
          },
        ],
        statistics: {
          averageScore: 0.9,
          maxScore: 0.9,
          minScore: 0.9,
          executionTime: 50,
          semanticMatchingTime: 20,
          ruleValidationTime: 15,
          aiReviewTime: 15,
          applicableRatio: 1,
          byType: {},
          byCategory: {},
        },
        config: {
          useAI: true,
          useRuleValidation: true,
          useAIReview: true,
          minSemanticRelevance: 0.3,
          minApplicabilityScore: 0.5,
          parallel: true,
          useCache: true,
        },
      });

      mockLegalReferenceUpsert.mockResolvedValue({ id: "ref-1" });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "POST",
          body: {
            caseId: "case-1",
            articleIds: ["article-1"],
          },
        },
      );

      await POST(request);

      expect(mockLegalReferenceUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "article-1" },
          update: expect.objectContaining({
            applicabilityScore: 0.9,
            status: "VALID",
          }),
        }),
      );
    });
  });

  describe("OPTIONS /api/v1/legal-analysis/applicability", () => {
    it("应该返回正确的CORS头部", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/legal-analysis/applicability",
        {
          method: "OPTIONS",
        },
      );

      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, OPTIONS",
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type",
      );
      expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
    });
  });
});
