/**
 * 单轮辩论完整流程E2E测试
 * 验证从文档上传到辩论生成的完整流程
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
  verifyDatabaseData,
  PerformanceRecorder,
  assertPerformance,
} from "./helpers";

test.describe("单轮辩论完整流程", () => {
  let apiContext: APIRequestContext;
  let perfRecorder: PerformanceRecorder;
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
  });

  test("完整流程测试：文档上传→解析→检索→分析→辩论", async () => {
    const startTime = Date.now();

    // 步骤1: 创建测试案件
    const createStart = Date.now();
    const testCase = await createTestCase(apiContext);
    caseId = testCase.caseId;
    perfRecorder.record("创建案件", Date.now() - createStart);
    assertPerformance(Date.now() - createStart, 1000, "创建案件", 1.5);

    // 步骤2: 上传测试文档
    const uploadStart = Date.now();
    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
    );
    perfRecorder.record("上传文档", Date.now() - uploadStart);
    assertPerformance(Date.now() - uploadStart, 3000, "上传文档", 1.2);

    // 步骤3: 等待文档解析完成
    const parseStart = Date.now();
    const parseResult = await waitForDocumentParsing(
      apiContext,
      testDocument.documentId,
    );
    perfRecorder.record("文档解析", Date.now() - parseStart);
    assertPerformance(Date.now() - parseStart, 20000, "文档解析", 1.2);

    // 验证解析结果
    expect(parseResult).toBeDefined();
    expect(parseResult.parties).toBeDefined();
    expect(parseResult.parties.length).toBeGreaterThan(0);
    expect(parseResult.claims).toBeDefined();
    expect(parseResult.claims.length).toBeGreaterThan(0);

    // 步骤4: 触发法条检索
    const searchStart = Date.now();
    const keywords = parseResult.claims.map(
      (claim: { text: string }) => claim.text,
    );
    const searchResults = await searchLawArticles(
      apiContext,
      keywords,
      "CIVIL",
    );
    perfRecorder.record("法条检索", Date.now() - searchStart);
    assertPerformance(Date.now() - searchStart, 1000, "法条检索", 1.5);

    // 验证检索结果
    expect(searchResults).toBeDefined();
    expect(searchResults.length).toBeGreaterThan(3);

    // 步骤5: 执行法条适用性分析
    const analysisStart = Date.now();
    const articleIds = searchResults
      .slice(0, 10)
      .map((article: { id: string }) => article.id);
    const applicabilityResult = await analyzeApplicability(
      apiContext,
      caseId,
      articleIds,
    );
    perfRecorder.record("适用性分析", Date.now() - analysisStart);
    assertPerformance(Date.now() - analysisStart, 2000, "适用性分析", 1.5);

    // 验证适用性分析结果
    expect(applicabilityResult).toBeDefined();
    expect(applicabilityResult.analyzedAt).toBeDefined();
    expect(applicabilityResult.totalArticles).toBe(articleIds.length);
    expect(applicabilityResult.applicableArticles).toBeGreaterThan(0);
    expect(applicabilityResult.results.length).toBe(articleIds.length);

    // 步骤6: 创建辩论
    const debateStart = Date.now();
    const debate = await createDebate(apiContext, caseId);
    perfRecorder.record("创建辩论", Date.now() - debateStart);
    assertPerformance(Date.now() - debateStart, 1000, "创建辩论", 1.5);

    // 步骤7: 生成辩论论点
    const generateStart = Date.now();
    const applicableArticles = applicabilityResult.results
      .filter((r: { applicable: boolean }) => r.applicable)
      .map((r: { articleId: string }) => r.articleId);
    const argumentsResult = await generateArguments(
      apiContext,
      debate.roundId,
      applicableArticles,
    );
    perfRecorder.record("生成论点", Date.now() - generateStart);
    assertPerformance(Date.now() - generateStart, 30000, "生成论点", 1.3);

    // 验证辩论生成结果
    expect(argumentsResult).toBeDefined();
    expect(argumentsResult.plaintiff).toBeDefined();
    expect(argumentsResult.defendant).toBeDefined();
    expect(argumentsResult.plaintiff.arguments.length).toBeGreaterThan(0);
    expect(argumentsResult.defendant.arguments.length).toBeGreaterThan(0);

    // 验证总流程时间
    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(60000);
    perfRecorder.record("完整流程", totalTime);

    // 数据一致性验证
    await verifyDatabaseData(caseId, 1, 1, 1);

    // 输出性能报告
    console.log("=== 单轮辩论流程性能报告 ===");
    console.log(JSON.stringify(perfRecorder.getAllStats(), null, 2));
  });

  test("验证文档解析结果数据结构", async () => {
    const testCase = await createTestCase(apiContext);
    caseId = testCase.caseId;

    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
    );
    const parseResult = await waitForDocumentParsing(
      apiContext,
      testDocument.documentId,
    );

    // 验证当事人信息
    expect(parseResult.parties).toBeInstanceOf(Array);
    expect(parseResult.parties[0]).toHaveProperty("name");
    expect(parseResult.parties[0]).toHaveProperty("role");

    // 验证诉讼请求
    expect(parseResult.claims).toBeInstanceOf(Array);
    expect(parseResult.claims[0]).toHaveProperty("type");
    expect(parseResult.claims[0]).toHaveProperty("amount");
    expect(parseResult.claims[0]).toHaveProperty("description");

    // 验证关键事实
    expect(parseResult.facts).toBeInstanceOf(Array);
    expect(parseResult.facts[0]).toHaveProperty("date");
    expect(parseResult.facts[0]).toHaveProperty("description");
  });

  test("验证法条检索结果相关性", async () => {
    const testCase = await createTestCase(apiContext);
    caseId = testCase.caseId;

    const searchResults = await searchLawArticles(
      apiContext,
      ["违约", "合同"],
      "CIVIL",
    );

    // 验证结果包含相关性信息
    expect(searchResults[0]).toHaveProperty("relevanceScore");
    expect(searchResults[0].relevanceScore).toBeGreaterThan(0);
    expect(searchResults[0].relevanceScore).toBeLessThanOrEqual(1);

    // 验证结果按相关性排序
    for (let i = 1; i < searchResults.length; i++) {
      expect(searchResults[i - 1].relevanceScore).toBeGreaterThanOrEqual(
        searchResults[i].relevanceScore,
      );
    }
  });

  test("验证法条适用性分析准确性", async () => {
    const testCase = await createTestCase(apiContext);
    caseId = testCase.caseId;

    const applicabilityResult = await analyzeApplicability(apiContext, caseId, [
      "mock-article-id-1",
      "mock-article-id-2",
    ]);

    // 验证分析结构
    expect(applicabilityResult).toHaveProperty("analyzedAt");
    expect(applicabilityResult).toHaveProperty("totalArticles");
    expect(applicabilityResult).toHaveProperty("applicableArticles");
    expect(applicabilityResult).toHaveProperty("notApplicableArticles");
    expect(applicabilityResult).toHaveProperty("results");

    // 验证每条法条的分析结果
    const result = applicabilityResult.results[0];
    expect(result).toHaveProperty("articleId");
    expect(result).toHaveProperty("applicable");
    expect(result).toHaveProperty("score");
    expect(result).toHaveProperty("reasons");
    expect(result).toHaveProperty("warnings");
  });

  test("验证辩论论点质量和平衡性", async () => {
    const testCase = await createTestCase(apiContext);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    const argumentsResult = await generateArguments(
      apiContext,
      debate.roundId,
      [],
    );

    // 验证正反方都有论点
    expect(argumentsResult.plaintiff.arguments.length).toBeGreaterThan(0);
    expect(argumentsResult.defendant.arguments.length).toBeGreaterThan(0);

    // 验证论点数量基本平衡（差异不超过30%）
    const plaintiffCount = argumentsResult.plaintiff.arguments.length;
    const defendantCount = argumentsResult.defendant.arguments.length;
    const ratio =
      Math.abs(plaintiffCount - defendantCount) /
      Math.max(plaintiffCount, defendantCount);
    expect(ratio).toBeLessThan(0.3);

    // 验证每个论点都有法律依据
    argumentsResult.plaintiff.arguments.forEach((arg) => {
      expect(arg.legalBasis).toBeDefined();
      expect(arg.legalBasis.length).toBeGreaterThan(0);
    });

    // 验证论点类型
    const argumentTypes = new Set();
    argumentsResult.plaintiff.arguments.forEach((arg) => {
      if (arg.type) {
        argumentTypes.add(arg.type);
      }
    });
    expect(argumentTypes.size).toBeGreaterThan(1);
  });

  test("验证数据库数据一致性", async () => {
    const testCase = await createTestCase(apiContext);
    caseId = testCase.caseId;

    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
    );
    await waitForDocumentParsing(apiContext, testDocument.documentId);

    await createDebate(apiContext, caseId);

    // 验证数据库中的数据关系
    await verifyDatabaseData(caseId, 1, 1, 1);
  });
});
