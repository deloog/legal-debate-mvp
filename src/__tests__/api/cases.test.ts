import { GET, POST } from "@/app/api/v1/cases/route";
import {
  createMockRequest,
  createTestResponse,
  assertions,
  mockData,
} from "./test-utils";

describe("Cases API", () => {
  describe("GET /api/v1/cases", () => {
    it("should return paginated cases list", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/cases?page=1&limit=10",
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(testResponse.data.data).toHaveLength(2); // 模拟数据有2个案件
      expect(testResponse.meta.pagination.page).toBe(1);
      expect(testResponse.meta.pagination.limit).toBe(10);
    });

    it("should handle search parameter", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/cases?search=合同",
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(Array.isArray(testResponse.data.data)).toBe(true);
    });

    it("should handle sort parameter", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/cases?sort=title&order=asc",
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertSuccess(testResponse);
      expect(Array.isArray(testResponse.data.data)).toBe(true);
    });

    it("should validate pagination parameters", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/cases?page=0&limit=101",
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it("should validate pagination boundaries", async () => {
      // 测试page边界值
      const request1 = createMockRequest(
        "http://localhost:3000/api/v1/cases?page=1&limit=100",
      );
      const response1 = await GET(request1);
      const testResponse1 = await createTestResponse(response1);
      assertions.assertSuccess(testResponse1);

      // 测试limit边界值
      const request2 = createMockRequest(
        "http://localhost:3000/api/v1/cases?page=1&limit=1",
      );
      const response2 = await GET(request2);
      const testResponse2 = await createTestResponse(response2);
      assertions.assertSuccess(testResponse2);
    });

    it("should use default pagination values", async () => {
      const request = createMockRequest("http://localhost:3000/api/v1/cases");
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      assertions.assertPaginated(testResponse);
      expect(testResponse.meta.pagination.page).toBe(1);
      expect(testResponse.meta.pagination.limit).toBe(20);
    });
  });

  describe("POST /api/v1/cases", () => {
    it("should create a new case", async () => {
      const caseData = mockData.case();
      delete caseData.id; // 移除ID，让服务器生成
      delete caseData.createdAt;
      delete caseData.updatedAt;

      const request = createMockRequest("http://localhost:3000/api/v1/cases", {
        method: "POST",
        body: caseData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.data.title).toBe(caseData.title);
      expect(testResponse.data.data.description).toBe(caseData.description);
      expect(testResponse.data.data.type).toBe(caseData.type);
      expect(testResponse.data.data.status).toBe(caseData.status);
      expect(testResponse.data.data.id).toBeDefined();
      expect(testResponse.data.data.createdAt).toBeDefined();
      expect(testResponse.data.data.updatedAt).toBeDefined();
    });

    it("should validate required fields", async () => {
      const request = createMockRequest("http://localhost:3000/api/v1/cases", {
        method: "POST",
        body: {}, // 空对象
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
      expect(testResponse.error?.details?.validationErrors).toBeDefined();
    });

    it("should validate title length", async () => {
      const caseData = mockData.case({
        title: "a".repeat(201), // 超过200字符限制
      });

      const request = createMockRequest("http://localhost:3000/api/v1/cases", {
        method: "POST",
        body: caseData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it("should validate case type", async () => {
      const caseData = mockData.case({
        type: "invalid-type",
      });

      const request = createMockRequest("http://localhost:3000/api/v1/cases", {
        method: "POST",
        body: caseData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it("should validate description length", async () => {
      const caseData = mockData.case({
        description: "a".repeat(2001), // 超过2000字符限制
      });

      const request = createMockRequest("http://localhost:3000/api/v1/cases", {
        method: "POST",
        body: caseData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });

    it("should accept valid case types", async () => {
      const validTypes = [
        "civil",
        "criminal",
        "administrative",
        "labor",
        "commercial",
        "intellectual_property",
        "other",
      ];

      for (const type of validTypes) {
        const caseData = mockData.case({ type });

        const request = createMockRequest(
          "http://localhost:3000/api/v1/cases",
          {
            method: "POST",
            body: caseData,
          },
        );

        const response = await POST(request);
        const testResponse = await createTestResponse(response);

        assertions.assertCreated(testResponse);
        expect(testResponse.data.data.type).toBe(type);
      }
    });

    it("should set default status", async () => {
      const caseData = mockData.case();
      delete caseData.status;

      const request = createMockRequest("http://localhost:3000/api/v1/cases", {
        method: "POST",
        body: caseData,
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertCreated(testResponse);
      expect(testResponse.data.data.status).toBe("draft");
    });

    it("should handle JSON parsing errors", async () => {
      const request = createMockRequest("http://localhost:3000/api/v1/cases", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: "invalid json",
      });

      const response = await POST(request);
      const testResponse = await createTestResponse(response);

      assertions.assertValidationError(testResponse);
    });
  });

  describe("OPTIONS /api/v1/cases", () => {
    it("should return CORS headers", async () => {
      const { OPTIONS } = require("@/app/api/v1/cases/route");
      const request = createMockRequest("http://localhost:3000/api/v1/cases", {
        method: "OPTIONS",
      });
      const response = await OPTIONS(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, OPTIONS",
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type, Authorization",
      );
    });
  });

  describe("Response structure", () => {
    it("should return consistent response format", async () => {
      const request = createMockRequest("http://localhost:3000/api/v1/cases");
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.success).toBeDefined();
      expect(testResponse.data).toBeDefined();
      expect(testResponse.meta).toBeDefined();
      expect(testResponse.meta.timestamp).toBeDefined();
      expect(testResponse.meta.version).toBe("v1");
    });

    it("should include pagination metadata", async () => {
      const request = createMockRequest(
        "http://localhost:3000/api/v1/cases?page=1&limit=5",
      );
      const response = await GET(request);
      const testResponse = await createTestResponse(response);

      expect(testResponse.meta.pagination).toBeDefined();
      expect(testResponse.meta.pagination.page).toBe(1);
      expect(testResponse.meta.pagination.limit).toBe(5);
      expect(testResponse.meta.pagination.total).toBeGreaterThanOrEqual(0);
      expect(testResponse.meta.pagination.totalPages).toBeGreaterThanOrEqual(0);
      expect(typeof testResponse.meta.pagination.hasNext).toBe("boolean");
      expect(typeof testResponse.meta.pagination.hasPrev).toBe("boolean");
    });
  });
});
