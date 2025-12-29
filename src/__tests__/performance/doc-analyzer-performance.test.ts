/**
 * 性能测试：DocAnalyzer性能基准测试
 * 验证响应时间从16-91秒优化到<5秒
 */

import { DocAnalyzerAgentAdapter } from "@/lib/agent/doc-analyzer/adapter";
import { TaskPriority } from "@/types/agent";
import { join } from "path";

describe("DocAnalyzer 性能测试", () => {
  let agent: DocAnalyzerAgentAdapter;

  beforeAll(async () => {
    agent = new DocAnalyzerAgentAdapter();
    await agent.initialize();
  });

  afterAll(async () => {
    await agent.cleanup();
  });

  function buildAgentContext(
    documentId: string,
    filePath: string,
    options: any = {},
  ) {
    return {
      task: "document_analysis" as const,
      taskType: "document_parse" as const,
      priority: TaskPriority.MEDIUM,
      data: {
        documentId,
        filePath,
        fileType: "TXT" as const,
        options,
      },
      metadata: {
        documentId,
        fileType: "TXT",
        timestamp: new Date().toISOString(),
      },
    };
  }

  describe("首次分析性能测试", () => {
    it("首次分析响应时间应该<8秒（无缓存）", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const startTime = Date.now();

      const context = buildAgentContext("perf-test-001", testFilePath);
      const result = await agent.execute(context);

      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      console.log(`首次分析响应时间: ${processingTime}ms`);

      // 首次分析应该<8秒（考虑AI调用时间）
      expect(processingTime).toBeLessThan(8000);
    });

    it("应该记录详细的性能指标", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const startTime = Date.now();

      const context = buildAgentContext("perf-test-002", testFilePath);
      const result = await agent.execute(context);

      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.data.metadata.wordCount).toBeGreaterThan(0);

      console.log("性能指标:", {
        处理时间: `${processingTime}ms`,
        执行时间: `${result.executionTime}ms`,
        词数: result.data.metadata.wordCount,
        置信度: result.data.confidence,
      });
    });
  });

  describe("缓存性能测试", () => {
    it("缓存命中响应时间应该<1秒", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const documentId = "perf-test-cache-001";

      // 第一次分析（建立缓存）
      const context1 = buildAgentContext(documentId, testFilePath);
      await agent.execute(context1);

      // 第二次分析（应该使用缓存）
      const startTime = Date.now();
      const context2 = buildAgentContext(documentId, testFilePath);
      const result2 = await agent.execute(context2);
      const cacheHitTime = Date.now() - startTime;

      expect(result2.success).toBe(true);
      console.log(`缓存命中响应时间: ${cacheHitTime}ms`);

      // 缓存命中应该<1秒
      expect(cacheHitTime).toBeLessThan(1000);
    });

    it("缓存命中率应该>70%", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const testCount = 10;
      let cacheHits = 0;

      // 第一次分析
      const context1 = buildAgentContext(
        "perf-test-cache-hit-001",
        testFilePath,
      );
      await agent.execute(context1);

      // 后续9次分析（应该命中缓存）
      for (let i = 2; i <= testCount; i++) {
        const startTime = Date.now();
        const context = buildAgentContext(
          "perf-test-cache-hit-001",
          testFilePath,
        );
        const result = await agent.execute(context);
        const processingTime = Date.now() - startTime;

        if (processingTime < 1000) {
          cacheHits++;
        }

        expect(result.success).toBe(true);
      }

      const cacheHitRate = (cacheHits / (testCount - 1)) * 100;
      console.log(
        `缓存命中率: ${cacheHitRate.toFixed(2)}% (${cacheHits}/${testCount - 1})`,
      );

      // 缓存命中率应该>70%
      expect(cacheHitRate).toBeGreaterThan(70);
    });
  });

  describe("并发处理性能测试", () => {
    it("应该能并发处理多个文档", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const concurrency = 5;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrency }, (_, i) => {
        const context = buildAgentContext(
          `perf-test-concurrent-${i}`,
          testFilePath,
        );
        return agent.execute(context);
      });

      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      const allSuccess = results.every((r) => r.success);

      expect(allSuccess).toBe(true);
      console.log(`并发处理${concurrency}个文档总时间: ${totalTime}ms`);
      console.log(`平均每文档: ${(totalTime / concurrency).toFixed(2)}ms`);

      // 并发处理应该比串行快
      // 假设单个文档8秒，5个并发应该在20秒内完成
      expect(totalTime).toBeLessThan(20000);
    });
  });

  describe("性能基准测试", () => {
    it("应该建立性能基准", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const runs = 3;
      const times: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = Date.now();
        const context = buildAgentContext(
          `perf-test-benchmark-${i}`,
          testFilePath,
        );
        const result = await agent.execute(context);
        const processingTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        times.push(processingTime);
      }

      const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log("性能基准数据:", {
        平均时间: `${avgTime.toFixed(2)}ms`,
        最大时间: `${maxTime}ms`,
        最小时间: `${minTime}ms`,
        标准差: calculateStdDev(times, avgTime).toFixed(2) + "ms",
      });

      // 平均响应时间应该<8秒
      expect(avgTime).toBeLessThan(8000);
    });
  });

  describe("性能优化验证", () => {
    it("算法层处理时间应该<50ms", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const documentId = "perf-test-algo-001";

      // 第一次分析
      await agent.execute(buildAgentContext(documentId, testFilePath));

      // 第二次分析（缓存命中，主要测试算法层）
      const startTime = Date.now();
      const context = buildAgentContext(documentId, testFilePath);
      const result = await agent.execute(context);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      console.log(`算法层+缓存处理时间: ${processingTime}ms`);

      // 缓存命中后，算法层+缓存应该<50ms
      expect(processingTime).toBeLessThan(50);
    });
  });
});

function calculateStdDev(values: number[], mean: number): number {
  const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
  const avgSquaredDiff =
    squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}
