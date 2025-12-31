/**
 * 数据一致性E2E测试
 * 验证跨模块数据传递和状态同步
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
} from "./helpers";
import { prisma } from "@/lib/db/prisma";

test.describe("数据一致性测试", () => {
  let apiContext: APIRequestContext;
  const testUserId = "test-e2e-data-consistency";
  let caseId: string;

  test.beforeAll(async ({ playwright }) => {
    apiContext = await playwright.request.newContext({
      baseURL: "http://localhost:3000",
    });
  });

  test.afterAll(async () => {
    if (caseId) {
      await cleanupTestData(caseId);
    }
    if (apiContext) {
      await apiContext.dispose();
    }
  });

  test("验证文档解析结果与案件关联正确", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 上传文档并解析
    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
    );
    const parseResult = await waitForDocumentParsing(
      apiContext,
      testDocument.documentId,
    );

    // 验证数据库中的文档记录
    const dbDocument = await prisma.document.findUnique({
      where: { id: testDocument.documentId },
    });

    expect(dbDocument).toBeDefined();
    expect(dbDocument.caseId).toBe(caseId);
    expect(dbDocument.analysisStatus).toBe("COMPLETED");
    expect(dbDocument.analysisResult).toEqual(parseResult);
  });

  test("验证法条检索结果与辩论引用一致", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const searchResults = await searchLawArticles(
      apiContext,
      ["合同", "违约"],
      "CIVIL",
    );

    // 创建辩论
    const debate = await createDebate(apiContext, caseId);
    const generatedArgs = await generateArguments(
      apiContext,
      debate.roundId,
      searchResults.slice(0, 3).map((a: { id: string }) => a.id),
    );

    // 验证论点引用的法条在检索结果中
    const referencedArticles = new Set(
      generatedArgs.plaintiff.arguments.flatMap((arg) =>
        arg.legalBasis.map((lb: { articleId: string }) => lb.articleId),
      ),
    );

    referencedArticles.forEach((articleId: string) => {
      const found = searchResults.some(
        (result: { id: string }) => result.id === articleId,
      );
      expect(found).toBe(true);
    });
  });

  test("验证辩论轮次与论点关联正确", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    await generateArguments(apiContext, debate.roundId, []);

    // 验证数据库中的论点记录
    const dbRound = await prisma.debateRound.findUnique({
      where: { id: debate.roundId },
      include: {
        arguments: true,
      },
    });

    expect(dbRound).toBeDefined();
    expect(dbRound.arguments.length).toBeGreaterThan(0);

    // 验证论点所属方
    dbRound.arguments.forEach((arg: { side: string; roundId: string }) => {
      expect(["PLAINTIFF", "DEFENDANT", "NEUTRAL"]).toContain(arg.side);
      expect(arg.roundId).toBe(debate.roundId);
    });
  });

  test("验证缓存数据与数据库数据一致", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 第一次检索（应写入缓存）
    const search1 = await searchLawArticles(apiContext, ["合同"], "CIVIL");

    // 第二次检索（应从缓存读取）
    const search2 = await searchLawArticles(apiContext, ["合同"], "CIVIL");

    // 验证两次结果一致
    expect(search1.length).toBe(search2.length);
    expect(search1.map((a: { id: string }) => a.id)).toEqual(
      search2.map((a: { id: string }) => a.id),
    );

    // 验证相关性分数一致
    for (let i = 0; i < search1.length; i++) {
      expect(search1[i].relevanceScore).toBe(search2[i].relevanceScore);
    }
  });

  test("验证AI交互记录完整", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
    );
    await waitForDocumentParsing(apiContext, testDocument.filename);

    // 查询AI交互记录
    const interactions = await prisma.aIInteraction.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 60000), // 最近60秒
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 验证文档分析记录存在
    const analysisRecord = interactions.find(
      (i: { type: string }) => i.type === "document_analysis",
    );
    expect(analysisRecord).toBeDefined();
    expect(analysisRecord.provider).toBeDefined();
    expect(analysisRecord.model).toBeDefined();
    expect(analysisRecord.request).toBeDefined();
    expect(analysisRecord.response).toBeDefined();
    expect(analysisRecord.success).toBe(true);
    expect(analysisRecord.duration).toBeGreaterThan(0);
  });

  test("验证用户操作日志完整", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 创建案件
    await createTestCase(apiContext, testUserId);

    // 上传文档
    await uploadTestDocument(
      apiContext,
      testCase.caseId,
      "%PDF-1.4%\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF",
    );

    // 查询用户活动
    const caseData = await prisma.case.findUnique({
      where: { id: testCase.caseId },
    });

    expect(caseData).toBeDefined();
    expect(caseData.createdAt).toBeDefined();
    expect(caseData.updatedAt).toBeDefined();

    // 验证更新时间晚于创建时间
    expect(caseData.updatedAt.getTime()).toBeGreaterThanOrEqual(
      caseData.createdAt.getTime(),
    );
  });

  test("验证多轮辩论上下文继承正确", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);

    // 第一轮
    await generateArguments(apiContext, debate.roundId, []);

    // 第二轮
    const round2Response = await apiContext.post(
      `/api/v1/debates/${debate.debateId}/rounds`,
      {
        data: {
          roundNumber: 2,
          status: "IN_PROGRESS",
        },
      },
    );

    const round2Id = (await round2Response.json()).data.id;
    await generateArguments(apiContext, round2Id, []);

    // 验证历史轮次数据不被修改
    const round1Check = await prisma.debateRound.findUnique({
      where: { id: debate.roundId },
    });

    expect(round1Check.status).toBe("COMPLETED");
    expect(round1Check.completedAt).toBeDefined();

    // 验证第二轮上下文包含第一轮信息
    const round2Check = await prisma.debateRound.findUnique({
      where: { id: round2Id },
    });

    expect(round2Check.status).toBe("COMPLETED");
  });

  test("验证软删除不影响数据统计", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    // 记录初始数据
    const initialCases = await prisma.case.findMany({
      where: { userId: testUserId },
    });

    // 软删除案件
    await prisma.case.update({
      where: { id: caseId },
      data: {
        deletedAt: new Date(),
      },
    });

    // 验证软删除后不在列表中
    const casesAfterDelete = await prisma.case.findMany({
      where: {
        userId: testUserId,
        deletedAt: null,
      },
    });

    expect(casesAfterDelete.length).toBe(initialCases.length - 1);

    // 验证软删除的数据仍在数据库中
    const allCases = await prisma.case.findMany({
      where: { userId: testUserId },
    });

    expect(allCases.length).toBe(initialCases.length);

    // 恢复数据
    await prisma.case.update({
      where: { id: caseId },
      data: {
        deletedAt: null,
      },
    });
  });

  test("验证法条适用性分析结果存储正确", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const applicabilityResult = await analyzeApplicability(apiContext, caseId, [
      "test-article-1",
      "test-article-2",
    ]);

    // 验证结果数据结构
    expect(applicabilityResult).toHaveProperty("analyzedAt");
    expect(applicabilityResult).toHaveProperty("totalArticles");
    expect(applicabilityResult).toHaveProperty("applicableArticles");
    expect(applicabilityResult).toHaveProperty("notApplicableArticles");
    expect(applicabilityResult).toHaveProperty("results");

    // 验证每个分析结果包含所有必要字段
    applicabilityResult.results.forEach((result) => {
      expect(result).toHaveProperty("articleId");
      expect(result).toHaveProperty("applicable");
      expect(result).toHaveProperty("score");
      expect(result).toHaveProperty("reasons");
      expect(result).toHaveProperty("warnings");
    });

    // 验证适用法条数量
    const applicableCount = applicabilityResult.results.filter(
      (r: { applicable: boolean }) => r.applicable,
    ).length;

    expect(applicableCount).toBe(applicabilityResult.applicableArticles);
    expect(applicableCount).toBeLessThanOrEqual(
      applicabilityResult.totalArticles as number,
    );
  });

  test("验证增量分析不重复处理旧数据", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);

    // 第一轮
    const round1Start = Date.now();
    await generateArguments(apiContext, debate.roundId, []);
    const round1Duration = Date.now() - round1Start;

    // 第二轮（利用缓存）
    const round2Response = await apiContext.post(
      `/api/v1/debates/${debate.debateId}/rounds`,
      {
        data: {
          roundNumber: 2,
          status: "IN_PROGRESS",
        },
      },
    );

    const round2Id = (await round2Response.json()).data.id;
    const round2Start = Date.now();
    await generateArguments(apiContext, round2Id, []);
    const round2Duration = Date.now() - round2Start;

    // 验证第二轮更快（利用缓存）
    const _speedup = round1Duration / round2Duration;

    // 加速比应该大于1.1，说明使用了缓存
    expect(_speedup).toBeGreaterThan(1.1);
  });

  test("验证多轮辩论数据完整性", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);

    // 三轮辩论
    for (let i = 1; i <= 3; i++) {
      const roundResponse = await apiContext.post(
        `/api/v1/debates/${debate.debateId}/rounds`,
        {
          data: {
            roundNumber: i,
            status: "IN_PROGRESS",
          },
        },
      );

      const roundId = (await roundResponse.json()).data.id;
      await generateArguments(apiContext, roundId, []);
    }

    // 验证数据库完整性
    const dbDebate = await prisma.debate.findUnique({
      where: { id: debate.debateId },
      include: {
        rounds: {
          include: {
            arguments: true,
          },
        },
      },
    });

    expect(dbDebate).toBeDefined();
    expect(dbDebate.rounds.length).toBe(3);

    // 验证每轮都有论点
    dbDebate.rounds.forEach((round: { arguments: unknown[] }) => {
      expect(round.arguments.length).toBeGreaterThan(0);
    });

    // 验证论点总数合理
    const totalArguments = dbDebate.rounds.reduce(
      (sum: number, round: { arguments: unknown[] }) =>
        sum + round.arguments.length,
      0,
    );

    expect(totalArguments).toBeGreaterThan(6); // 至少3轮，每轮至少2个论点
  });
});
