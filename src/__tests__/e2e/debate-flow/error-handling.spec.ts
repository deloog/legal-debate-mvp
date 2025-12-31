/**
 * 异常处理流程E2E测试
 * 验证各种异常情况的处理机制
 */

import { expect, test, APIRequestContext } from "@playwright/test";
import {
  cleanupTestData,
  createTestCase,
  searchLawArticles,
  uploadTestDocument,
  waitForDocumentParsing,
} from "./helpers";

type LawCategory =
  | "CIVIL"
  | "CRIMINAL"
  | "ADMINISTRATIVE"
  | "LABOR"
  | "COMMERCIAL"
  | "INTELLECTUAL"
  | "PROCEDURAL";

test.describe("异常处理流程", () => {
  let apiContext: APIRequestContext;
  const testUserId = "test-e2e-error-handling";
  let caseId: string;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
    });
  });

  test.afterEach(async () => {
    if (caseId) {
      await cleanupTestData(caseId);
      caseId = "";
    }
  });

  test.afterAll(async () => {
    if (apiContext) {
      await apiContext.dispose();
    }
  });

  test("文档解析失败：无效文档格式", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 上传无效格式文档
    const invalidFile = new Blob(["invalid content"], {
      type: "text/plain",
    });
    const formData = new FormData();
    formData.append("file", invalidFile, "invalid.txt");
    formData.append("caseId", caseId);

    const response = await apiContext.post("/api/v1/documents/upload", {
      multipart: formData,
    });

    // 验证返回错误
    expect(response.status()).toBe(400);

    const result = await response.json();
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("格式");
  });

  test("文档解析失败：超大文件", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 上传超大文件（超过限制）
    const largeFile = new Blob(
      [new Array(11 * 1024 * 1024).fill("a").join("")],
      {
        type: "application/pdf",
      },
    );
    const formData = new FormData();
    formData.append("file", largeFile, "large.pdf");
    formData.append("caseId", caseId);

    const response = await apiContext.post("/api/v1/documents/upload", {
      multipart: formData,
    });

    // 验证返回错误
    expect(response.status()).toBe(413); // Payload Too Large

    const result = await response.json();
    expect(result.success).toBe(false);
  });

  test("法条检索无结果：关键词过于冷门", async () => {
    const results = await searchLawArticles(
      apiContext,
      ["非常冷门的关键词xyz123"],
      "CIVIL",
    );

    // 验证返回空结果
    expect(results).toBeDefined();
    expect(results.length).toBe(0);
  });

  test("法条检索失败：非法分类", async () => {
    const results = await searchLawArticles(
      apiContext,
      ["合同"],
      "INVALID_CATEGORY" as LawCategory,
    );

    // 验证返回空结果或错误
    expect(results).toBeDefined();
  });

  test("AI服务超时：模拟超时响应", async ({ page }) => {
    page.route("/api/v1/ai/analyze", (route) => {
      // 模拟30秒超时
      setTimeout(() => {
        route.abort("timedout");
      }, 30000);
    });

    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 上传文档并等待解析
    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF_SAMPLE%",
    );

    try {
      await waitForDocumentParsing(apiContext, testDocument.filename, 20000);
      // 超时错误应该被抛出
      expect(true).toBe(false);
    } catch (_error) {
      expect((_error as Error).message).toContain("超时");
    }
  });

  test("AI服务错误：模拟500错误", async ({ page }) => {
    page.route("/api/v1/ai/analyze", (route) => {
      route.fulfill({
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: false,
          error: "Internal Server Error",
        }),
      });
    });

    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF_SAMPLE%",
    );

    // 验证错误被正确处理
    const parseResult = await waitForDocumentParsing(
      apiContext,
      testDocument.filename,
    );

    expect(parseResult).toBeNull();

    // 验证文档状态为FAILED
    const docResponse = await apiContext.get(
      `/api/v1/documents/${testDocument.documentId}`,
    );
    const docResult = await docResponse.json();
    expect(docResult.data.analysisStatus).toBe("FAILED");
    expect(docResult.data.analysisError).toBeDefined();
  });

  test("SSE连接中断：断线重连机制", async ({ page }) => {
    let connectionCount = 0;

    page.route("/api/v1/debates/*/stream", (route) => {
      connectionCount++;

      const streamData: string[] = [];

      // 模拟前3个chunk正常发送
      for (let i = 0; i < 3; i++) {
        const data = {
          type: "argument",
          content: `论点${i + 1}`,
          side: "PLAINTIFF",
        };
        streamData.push(`data: ${JSON.stringify(data)}\n\n`);
      }

      // 第2次连接后模拟断开
      if (connectionCount === 2) {
        route.abort("failed");
        return;
      }

      // 第3次连接完整发送
      route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: streamData.join(""),
      });
    });

    // 监听SSE事件
    page.evaluate(() => {
      const eventSource = new EventSource("/api/v1/debates/test/stream");

      eventSource.addEventListener("argument", (event: Event) => {
        const data = JSON.parse((event as MessageEvent).data);
        console.log("收到论点:", data.content);
      });

      eventSource.onerror = () => {
        console.log("连接错误，将自动重连...");
      };

      eventSource.addEventListener("close", () => {
        console.log("连接关闭");
      });
    });

    // 验证连接尝试次数
    await page.waitForTimeout(5000);

    expect(connectionCount).toBeGreaterThan(1);
  });

  test("数据库操作失败：并发请求冲突", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 同时发起两个更新请求
    const update1 = apiContext.put(`/api/v1/cases/${caseId}`, {
      data: {
        title: "更新1",
      },
    });

    const update2 = apiContext.put(`/api/v1/cases/${caseId}`, {
      data: {
        title: "更新2",
      },
    });

    const [result1, result2] = await Promise.all([update1, update2]);

    // 验证至少一个成功
    const atLeastOneSuccess = result1.ok() || result2.ok();
    expect(atLeastOneSuccess).toBe(true);

    // 验证最终数据一致性
    const finalResponse = await apiContext.get(`/api/v1/cases/${caseId}`);
    const finalResult = await finalResponse.json();
    expect(finalResult.data.title).toMatch(/更新[12]/);
  });

  test("验证友好的错误提示信息", async ({ page }) => {
    // 测试页面上的错误提示
    page.route("/api/v1/cases", (route) => {
      route.fulfill({
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          success: false,
          error: "数据库连接失败",
          code: "DB_CONNECTION_ERROR",
          timestamp: new Date().toISOString(),
        }),
      });
    });

    // 访问案件页面
    await page.goto("/cases");

    // 验证错误提示显示
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();
    await expect(errorMessage).toHaveText(/数据库连接失败/);

    // 验证重试按钮存在
    const retryButton = page.locator('[data-testid="retry-button"]');
    await expect(retryButton).toBeVisible();
  });

  test("验证系统状态可恢复：错误后继续操作", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 触发一个错误操作
    const errorResponse = await apiContext.post(
      "/api/v1/cases/invalid-id/documents/upload",
      {
        multipart: new FormData(),
      },
    );

    expect(errorResponse.status()).toBe(404);

    // 验证系统可以继续正常操作
    const newResponse = await apiContext.post("/api/v1/cases", {
      data: {
        userId: testUserId,
        title: "恢复测试案件",
        description: "测试",
        type: "CIVIL",
        status: "ACTIVE",
      },
    });

    expect(newResponse.ok()).toBe(true);
    const result = await newResponse.json();
    expect(result.data.id).toBeDefined();
  });

  test("验证数据不丢失：失败操作不影响已有数据", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF_SAMPLE%",
    );
    const parseResult = await waitForDocumentParsing(
      apiContext,
      testDocument.filename,
    );

    // 记录原始数据
    const originalClaimsCount = parseResult.claims?.length || 0;
    const originalPartiesCount = parseResult.parties?.length || 0;

    // 触发一个失败操作
    const errorResponse = await apiContext.put(
      `/api/v1/documents/${testDocument.filename}/invalid-field`,
      {
        data: {
          invalid: "data",
        },
      },
    );

    expect(errorResponse.status()).toBe(404);

    // 验证原始数据未被修改
    const docResponse = await apiContext.get(
      `/api/v1/documents/${testDocument.filename}`,
    );
    const docResult = await docResponse.json();

    const currentClaimsCount =
      docResult.data.analysisResult?.claims?.length || 0;
    const currentPartiesCount =
      docResult.data.analysisResult?.parties?.length || 0;

    expect(currentClaimsCount).toBe(originalClaimsCount);
    expect(currentPartiesCount).toBe(originalPartiesCount);
  });
});
