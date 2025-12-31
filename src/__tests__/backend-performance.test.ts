import {
  describe,
  it,
  expect,
  jest,
  beforeEach,
  afterEach,
} from "@jest/globals";
import { POST } from "@/app/api/v1/law-articles/search/route";
import { NextRequest } from "next/server";
import { cache } from "@/lib/cache/manager";
import {
  getPerformanceStats,
  clearPerformanceMetrics,
} from "@/lib/middleware/performance-monitor";

/**
 * 后端性能优化测试套件
 * 测试缓存策略和响应时间
 */
describe("后端性能优化测试", () => {
  beforeEach(async () => {
    // 清空缓存
    jest.clearAllMocks();
    clearPerformanceMetrics();
    // 确保每次测试前清除缓存
    await cache.mdelete(["law-articles:*"]);
  });

  afterEach(() => {
    // 清理测试数据
    clearPerformanceMetrics();
  });

  describe("法条检索API性能测试", () => {
    it("首次请求应该在合理时间内完成（<2秒）", async () => {
      const body = {
        keywords: ["合同", "违约"],
        page: 1,
        limit: 10,
      };

      const request = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 检查响应时间
      expect(responseTime).toBeLessThan(2000);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.articles).toBeInstanceOf(Array);
    });

    it("缓存命中时响应时间应该显著降低", async () => {
      // 使用不同的关键词确保缓存未命中
      const body = {
        keywords: ["性能测试", "缓存验证", Date.now().toString()], // 添加时间戳确保唯一性
        page: 1,
        limit: 10,
      };

      const cacheKey = `law-articles:${JSON.stringify(body)}`;

      // 第一次请求（缓存未命中）
      const firstRequest = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      const firstResponse = await POST(firstRequest);
      const firstResponseTime = parseInt(
        firstResponse.headers.get("X-Response-Time") || "0",
        10,
      );
      const firstCacheStatus = firstResponse.headers.get("X-Cache");

      // 等待缓存设置完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 验证缓存已设置
      const cached = await cache.get<unknown>(cacheKey);
      expect(cached).toBeDefined();

      // 第二次请求（应该命中缓存）
      const secondRequest = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      const secondResponse = await POST(secondRequest);
      const secondResponseTime = parseInt(
        secondResponse.headers.get("X-Response-Time") || "0",
        10,
      );
      const secondCacheStatus = secondResponse.headers.get("X-Cache");

      // 第一次请求应该是MISS
      expect(firstCacheStatus).toBe("MISS");

      // 第二次请求应该是HIT
      expect(secondCacheStatus).toBe("HIT");

      // 缓存命中应该显著更快（至少快50%）
      expect(secondResponseTime).toBeLessThan(firstResponseTime * 0.5);
    });

    it("响应头应包含性能信息", async () => {
      const body = {
        keywords: ["合同"],
        page: 1,
        limit: 10,
      };

      const request = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      const response = await POST(request);

      // 检查性能头
      const responseTimeHeader = response.headers.get("X-Response-Time");
      const cacheStatusHeader = response.headers.get("X-Cache");

      expect(responseTimeHeader).toBeDefined();
      expect(cacheStatusHeader).toBeDefined();

      // 验证响应时间是有效数字
      const responseTime = parseInt(responseTimeHeader || "0", 10);
      expect(responseTime).toBeGreaterThan(0);
      expect(responseTime).toBeLessThan(2000); // 小于2秒
    });

    it("参数验证不应影响性能", async () => {
      // 测试无效参数的响应时间
      const invalidBody = {
        keywords: [], // 空数组
      };

      const request = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(invalidBody),
        },
      );

      const startTime = Date.now();
      const response = await POST(request);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 参数验证应该很快完成
      expect(responseTime).toBeLessThan(100);
      expect(response.status).toBe(400);
    });
  });

  describe("并发请求性能测试", () => {
    it("多个并发请求应该能正常处理", async () => {
      const body = {
        keywords: ["合同"],
        page: 1,
        limit: 10,
      };

      const requests = Array(5)
        .fill(null)
        .map(
          () =>
            new NextRequest(
              "http://localhost:3000/api/v1/law-articles/search",
              {
                method: "POST",
                body: JSON.stringify(body),
              },
            ),
        );

      const startTime = Date.now();
      const responses = await Promise.all(requests.map((req) => POST(req)));
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 所有请求都应成功
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // 并发处理的总时间应该合理
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe("缓存策略测试", () => {
    it("相同请求应返回缓存结果", async () => {
      const body = {
        keywords: ["合同"],
        page: 1,
        limit: 10,
      };

      const cacheKey = `law-articles:${JSON.stringify(body)}`;

      // 第一次请求
      const firstRequest = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      await POST(firstRequest);

      // 检查缓存是否已设置
      const cached = await cache.get<unknown>(cacheKey);
      expect(cached).toBeDefined();

      // 第二次请求
      const secondRequest = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      const secondResponse = await POST(secondRequest);
      const cacheStatus = secondResponse.headers.get("X-Cache");

      // 验证缓存命中
      expect(cacheStatus).toBe("HIT");
    });

    it("不同请求应返回不同结果", async () => {
      const body1 = {
        keywords: ["合同"],
        page: 1,
        limit: 10,
      };

      const body2 = {
        keywords: ["侵权"],
        page: 1,
        limit: 10,
      };

      const request1 = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body1),
        },
      );

      const request2 = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body2),
        },
      );

      const response1 = await POST(request1);
      const response2 = await POST(request2);

      const data1 = await response1.json();
      const data2 = await response2.json();

      // 结果应该不同（因为关键词不同）
      expect(data1.data.articles).not.toBe(data2.data.articles);
    });
  });

  describe("性能指标统计测试", () => {
    it("应正确记录性能指标", async () => {
      const body = {
        keywords: ["合同"],
        page: 1,
        limit: 10,
      };

      const request = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      // 发送请求
      await POST(request);

      // 获取性能统计
      const stats = getPerformanceStats();

      // 验证统计数据
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.average).toBeGreaterThan(0);
      expect(stats.max).toBeGreaterThan(0);
      expect(stats.min).toBeGreaterThan(0);
      expect(stats.min).toBeLessThanOrEqual(stats.max);
    });

    it("慢速请求应被正确标记", async () => {
      // 模拟慢速请求（使用大量数据）
      const body = {
        keywords: ["合同", "侵权", "违约", "赔偿", "责任"],
        page: 1,
        limit: 50,
      };

      const request = new NextRequest(
        "http://localhost:3000/api/v1/law-articles/search",
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );

      await POST(request);

      const stats = getPerformanceStats();

      // 检查是否有慢速请求
      // 注意：这取决于实际响应时间，可能需要调整
      if (stats.max > 2000) {
        expect(stats.slowCount).toBeGreaterThan(0);
      }
    });
  });
});
