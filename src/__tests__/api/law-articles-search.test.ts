import { POST, OPTIONS } from "@/app/api/v1/law-articles/search/route";
import {
  createMockRequest,
  createTestResponse,
  assertions,
} from "./test-utils";

/**
 * 法条检索API单元测试
 */

// Mock LawArticleSearchService
const mockSearch = jest.fn();
jest.mock("@/lib/law-article/search-service", () => ({
  LawArticleSearchService: {
    search: () => mockSearch(),
  },
}));

describe("法条检索API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/law-articles/search", () => {
    it("应该成功返回法条检索结果", async () => {
      const mockArticles = [
        {
          id: "article-1",
          lawName: "中华人民共和国合同法",
          articleNumber: "第一百零七条",
          fullText:
            "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
          category: "CONTRACT",
          lawType: "CIVIL",
        },
        {
          id: "article-2",
          lawName: "中华人民共和国合同法",
          articleNumber: "第一百零八条",
          fullText:
            "当事人一方明确表示或者以自己的行为表明不履行合同义务的，对方可以在履行期限届满前请求其承担违约责任。",
          category: "CONTRACT",
          lawType: "CIVIL",
        },
      ];

      mockSearch.mockResolvedValue({
        results: mockArticles.map((article) => ({
          article,
          relevanceScore: 0.95,
          matchDetails: {
            keywordScore: 0.9,
            categoryScore: 0.95,
            tagScore: 0.8,
            popularityScore: 0.9,
          },
          matchedKeywords: ["违约", "合同"],
        })),
        pagination: {
          page: 1,
          pageSize: 20,
          total: 2,
          hasNext: false,
        },
        executionTime: 10,
        cached: false,
      });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: {
            keywords: ["违约", "合同"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.articles).toHaveLength(2);
      expect(testResponse.data.total).toBe(2);
      expect(testResponse.data.articles[0].id).toBe("article-1");
      expect(testResponse.data.articles[1].id).toBe("article-2");
    });

    it("应该在关键词为空时返回错误", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: {
            keywords: "",
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it("应该在keywords不是数组时返回错误", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: {
            keywords: "invalid",
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it("应该在无结果时返回空数组", async () => {
      mockSearch.mockResolvedValue({
        results: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          hasNext: false,
        },
        executionTime: 5,
        cached: false,
      });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: {
            keywords: ["不存在的关键词"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.articles).toEqual([]);
      expect(testResponse.data.total).toBe(0);
    });

    it("应该包含响应元数据", async () => {
      mockSearch.mockResolvedValue({
        results: [
          {
            article: {
              id: "article-1",
              lawName: "合同法",
              articleNumber: "第一百零七条",
              fullText: "text",
              category: "CONTRACT",
              lawType: "CIVIL",
            },
            relevanceScore: 0.9,
            matchDetails: {
              keywordScore: 0.8,
              categoryScore: 0.9,
              tagScore: 0.7,
              popularityScore: 0.8,
            },
            matchedKeywords: ["合同"],
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          hasNext: false,
        },
        executionTime: 10,
        cached: false,
      });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: {
            keywords: ["合同"],
            category: "CONTRACT",
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.data.total).toBe(1);
      expect(testResponse.meta).toBeDefined();
      expect(testResponse.meta.pagination).toBeDefined();
      expect(testResponse.meta.pagination.page).toBe(1);
      expect(testResponse.meta.pagination.limit).toBe(20);
      expect(testResponse.meta.pagination.hasMore).toBeDefined();
    });

    it("应该处理搜索服务错误", async () => {
      mockSearch.mockRejectedValue(new Error("Search service failed"));

      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: {
            keywords: ["合同"],
          },
        },
      );

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertError(testResponse, 500);
      expect(testResponse.error?.code).toBeDefined();
    });

    it("应该支持自定义分页参数", async () => {
      mockSearch.mockResolvedValue({
        results: [],
        pagination: {
          page: 2,
          pageSize: 10,
          total: 0,
          hasNext: false,
        },
        executionTime: 10,
        cached: false,
      });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: {
            keywords: ["合同"],
            page: 2,
            limit: 10,
          },
        },
      );

      await POST(request);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 2,
            pageSize: 10,
          }),
        }),
      );
    });

    it("应该支持排序参数", async () => {
      mockSearch.mockResolvedValue({
        results: [],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 0,
          hasNext: false,
        },
        executionTime: 10,
        cached: false,
      });

      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: {
            keywords: ["合同"],
            sortField: "relevance",
            sortOrder: "desc",
          },
        },
      );

      await POST(request);

      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: {
            field: "relevance",
            order: "desc",
          },
        }),
      );
    });
  });

  describe("OPTIONS /api/v1/law-articles/search", () => {
    it("应该返回正确的CORS头部", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/law-articles/search",
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
