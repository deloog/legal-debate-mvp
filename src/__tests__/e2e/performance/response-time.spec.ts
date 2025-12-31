/**
 * 响应时间性能测试
 * 验证关键接口的响应时间是否达标
 */

import { test, expect, APIRequestContext } from "@playwright/test";
import {
  createTestCase,
  uploadTestDocument,
  waitForDocumentParsing,
  searchLawArticles,
  analyzeApplicability,
  createDebate,
  generateArguments,
  cleanupTestData,
  PerformanceRecorder,
  assertPerformance,
} from "../debate-flow/helpers";

test.describe("响应时间性能测试", () => {
  let apiContext: APIRequestContext;
  let perfRecorder: PerformanceRecorder;
  const testUserId = "test-e2e-performance";
  let caseId: string;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
    });
    perfRecorder = new PerformanceRecorder();
  });

  test.afterAll(async () => {
    if (caseId) {
      await cleanupTestData(caseId);
    }
    if (apiContext) {
      await apiContext.dispose();
    }

    console.log("=== 响应时间性能报告 ===");
    console.log(JSON.stringify(perfRecorder.getAllStats(), null, 2));
  });

  test("文档上传响应时间 < 3秒", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const start = Date.now();
    await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
    );
    const duration = Date.now() - start;

    perfRecorder.record("文档上传", duration);
    assertPerformance(duration, 3000, "文档上传", 1.2);

    expect(duration).toBeLessThan(3000);
  });

  test("文档解析时间 < 20秒", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
    );

    const start = Date.now();
    await waitForDocumentParsing(apiContext, testDocument.documentId);
    const duration = Date.now() - start;

    perfRecorder.record("文档解析", duration);
    assertPerformance(duration, 20000, "文档解析", 1.2);

    expect(duration).toBeLessThan(20000);
  });

  test("法条检索响应时间 < 1秒", async () => {
    const iterations = 5;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await searchLawArticles(apiContext, ["合同", "违约"], "CIVIL");
      const duration = Date.now() - start;

      durations.push(duration);
      perfRecorder.record(`法条检索_${i}`, duration);
    }

    const avgDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;

    perfRecorder.record("法条检索_平均", avgDuration);
    assertPerformance(avgDuration, 1000, "法条检索_平均", 1.2);

    expect(avgDuration).toBeLessThan(1000);

    // 验证99%的请求达标
    const passedCount = durations.filter((d) => d < 1000).length;
    const passRate = (passedCount / durations.length) * 100;

    expect(passRate).toBeGreaterThanOrEqual(99);
  });

  test("法条适用性分析 < 2秒", async () => {
    const iterations = 3;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const testCase = await createTestCase(apiContext, testUserId);
      const start = Date.now();
      await analyzeApplicability(apiContext, testCase.caseId, [
        "test-article-1",
        "test-article-2",
      ]);
      const duration = Date.now() - start;

      durations.push(duration);
      perfRecorder.record(`适用性分析_${i}`, duration);

      await cleanupTestData(testCase.caseId);
    }

    const avgDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;

    perfRecorder.record("适用性分析_平均", avgDuration);
    assertPerformance(avgDuration, 2000, "适用性分析_平均", 1.2);

    expect(avgDuration).toBeLessThan(2000);
  });

  test("辩论生成时间 < 30秒", async () => {
    const iterations = 3;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const testCase = await createTestCase(apiContext, testUserId);
      const debate = await createDebate(apiContext, testCase.caseId);

      const start = Date.now();
      await generateArguments(apiContext, debate.roundId, []);
      const duration = Date.now() - start;

      durations.push(duration);
      perfRecorder.record(`辩论生成_${i}`, duration);

      await cleanupTestData(testCase.caseId);
    }

    const avgDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;

    perfRecorder.record("辩论生成_平均", avgDuration);
    assertPerformance(avgDuration, 30000, "辩论生成_平均", 1.2);

    expect(avgDuration).toBeLessThan(30000);

    // 验证95%的请求达标
    const passedCount = durations.filter((d) => d < 30000).length;
    const passRate = (passedCount / durations.length) * 100;

    expect(passRate).toBeGreaterThanOrEqual(95);
  });

  test("完整单轮辩论流程 < 60秒", async () => {
    const iterations = 3;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const testCase = await createTestCase(apiContext, testUserId);
      const startTime = Date.now();

      const testDocument = await uploadTestDocument(
        apiContext,
        testCase.caseId,
        "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
      );
      await waitForDocumentParsing(apiContext, testDocument.documentId);

      const searchResults = await searchLawArticles(
        apiContext,
        ["合同", "违约"],
        "CIVIL",
      );

      await analyzeApplicability(
        apiContext,
        testCase.caseId,
        searchResults.slice(0, 3).map((a: { id: string }) => a.id),
      );

      const debate = await createDebate(apiContext, testCase.caseId);
      await generateArguments(apiContext, debate.roundId, []);

      const duration = Date.now() - startTime;
      durations.push(duration);
      perfRecorder.record(`完整流程_${i}`, duration);

      await cleanupTestData(testCase.caseId);
    }

    const avgDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;

    perfRecorder.record("完整流程_平均", avgDuration);
    assertPerformance(avgDuration, 60000, "完整流程_平均", 1.2);

    expect(avgDuration).toBeLessThan(60000);

    // 验证95%的请求达标
    const passedCount = durations.filter((d) => d < 60000).length;
    const passRate = (passedCount / durations.length) * 100;

    expect(passRate).toBeGreaterThanOrEqual(95);
  });

  test("数据库查询性能 < 100ms（平均值）", async () => {
    const iterations = 10;
    const durations: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await apiContext.get("/api/v1/cases");
      const duration = Date.now() - start;

      durations.push(duration);
      perfRecorder.record(`数据库查询_${i}`, duration);
    }

    const avgDuration =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;

    perfRecorder.record("数据库查询_平均", avgDuration);
    assertPerformance(avgDuration, 100, "数据库查询_平均", 1.2);

    expect(avgDuration).toBeLessThan(100);
  });

  test("案件列表分页查询性能", async () => {
    const pageSizes = [10, 20, 50];
    const results: Record<string, number> = {};

    for (const pageSize of pageSizes) {
      const start = Date.now();
      const result = await apiContext.get("/api/v1/cases", {
        params: {
          page: 1,
          pageSize,
        },
      });
      const duration = Date.now() - start;

      results[`分页_${pageSize}`] = duration;
      perfRecorder.record(`案件列表_分页_${pageSize}`, duration);

      expect(result.ok()).toBe(true);
      const data = await result.json();
      expect(data.data.items.length).toBeLessThanOrEqual(pageSize);
    }

    console.log("分页性能结果:", results);
  });

  test("缓存命中性能 < 50ms", async () => {
    // 第一次请求（缓存未命中）
    const start1 = Date.now();
    await searchLawArticles(apiContext, ["合同"], "CIVIL");
    const duration1 = Date.now() - start1;

    // 第二次请求（应该命中缓存）
    const start2 = Date.now();
    await searchLawArticles(apiContext, ["合同"], "CIVIL");
    const duration2 = Date.now() - start2;

    perfRecorder.record("缓存未命中", duration1);
    perfRecorder.record("缓存命中", duration2);

    console.log(`缓存未命中: ${duration1}ms, 缓存命中: ${duration2}ms`);

    // 缓存命中应该更快
    expect(duration2).toBeLessThan(duration1);

    // 缓存命中应该在50ms内
    expect(duration2).toBeLessThan(50);
  });

  test("文档上传大文件性能", async () => {
    const fileSizes = [
      { size: "1MB", bytes: 1024 * 1024 },
      { size: "5MB", bytes: 5 * 1024 * 1024 },
      { size: "10MB", bytes: 10 * 1024 * 1024 },
    ];

    const results: Record<string, number> = {};

    for (const { size, bytes } of fileSizes) {
      const testCase = await createTestCase(apiContext, testUserId);
      const largeFile = new Blob([new Array(bytes / 1024).fill("a").join("")], {
        type: "application/pdf",
      });
      const formData = new FormData();
      formData.append("file", largeFile, `test-${size}.pdf`);
      formData.append("caseId", testCase.caseId);

      const start = Date.now();
      const response = await apiContext.post("/api/v1/documents/upload", {
        multipart: formData,
      });
      const duration = Date.now() - start;

      results[size] = duration;
      perfRecorder.record(`文档上传_${size}`, duration);

      expect(response.ok()).toBe(true);

      await cleanupTestData(testCase.caseId);
    }

    console.log("不同文件大小上传性能:", results);

    // 验证10MB文件上传在合理时间内（考虑到网络限制，设置为60秒）
    expect(results["10MB"]).toBeLessThan(60000);
  });

  test("API冷启动与热启动性能对比", async () => {
    // 冷启动：首次请求
    const start1 = Date.now();
    await searchLawArticles(apiContext, ["合同"], "CIVIL");
    const coldStart = Date.now() - start1;

    // 热启动：后续多次请求
    const hotDurations: number[] = [];
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await searchLawArticles(apiContext, ["合同"], "CIVIL");
      hotDurations.push(Date.now() - start);
    }

    const avgHotStart =
      hotDurations.reduce((sum, d) => sum + d, 0) / hotDurations.length;

    perfRecorder.record("冷启动", coldStart);
    perfRecorder.record("热启动_平均", avgHotStart);

    console.log(`冷启动: ${coldStart}ms, 热启动平均: ${avgHotStart}ms`);

    // 热启动应该比冷启动快
    expect(avgHotStart).toBeLessThan(coldStart);
  });

  test("多轮辩论性能对比", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);

    const roundDurations: number[] = [];

    // 三轮辩论
    for (let i = 1; i <= 3; i++) {
      if (i > 1) {
        await apiContext.post(`/api/v1/debates/${debate.debateId}/rounds`, {
          data: {
            roundNumber: i,
            status: "IN_PROGRESS",
          },
        });
      }

      const roundId =
        i === 1
          ? debate.roundId
          : (
              await apiContext
                .get(`/api/v1/debates/${debate.debateId}/rounds`)
                .then((r) => r.json())
            ).data[i - 1].id;

      const start = Date.now();
      await generateArguments(apiContext, roundId, []);
      const duration = Date.now() - start;

      roundDurations.push(duration);
      perfRecorder.record(`第${i}轮辩论`, duration);
    }

    console.log("各轮辩论耗时:", roundDurations);

    // 验证第二、三轮利用缓存后更快
    const speedup1 = roundDurations[0] / roundDurations[1];
    const speedup2 = roundDurations[1] / roundDurations[2];

    console.log(`第2轮加速比: ${speedup1.toFixed(2)}x`);
    console.log(`第3轮加速比: ${speedup2.toFixed(2)}x`);

    // 至少第二轮应该利用缓存加速
    expect(speedup1).toBeGreaterThan(1.1);
  });
});
