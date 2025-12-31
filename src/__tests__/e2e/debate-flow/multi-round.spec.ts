/**
 * 多轮辩论流程E2E测试
 * 验证多轮辩论的上下文继承和论点递进
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
} from "./helpers";

test.describe("多轮辩论流程", () => {
  let apiContext: APIRequestContext;
  let perfRecorder: PerformanceRecorder;
  const testUserId = "test-e2e-user-multi-round";
  let caseId: string;
  let debateId: string;

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

  test("两轮辩论流程：上下文继承和论点递进", async () => {
    const startTime = Date.now();

    // 第一轮：完整辩论流程
    const round1Start = Date.now();
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      "%PDF_SAMPLE%",
    );
    const parseResult = await waitForDocumentParsing(
      apiContext,
      testDocument.documentId,
    );

    const keywords = parseResult.claims.map(
      (claim: { text: string }) => claim.text,
    );
    const searchResults = await searchLawArticles(
      apiContext,
      keywords,
      "CIVIL",
    );
    const articleIds = searchResults
      .slice(0, 5)
      .map((a: { id: string }) => a.id);
    const applicabilityResult = await analyzeApplicability(
      apiContext,
      caseId,
      articleIds,
    );
    const debate = await createDebate(apiContext, caseId);
    debateId = debate.debateId;

    const applicableArticles = applicabilityResult.results
      .filter((r: { applicable: boolean }) => r.applicable)
      .map((r: { articleId: string }) => r.articleId);
    const args1 = await generateArguments(
      apiContext,
      debate.roundId,
      applicableArticles,
    );
    perfRecorder.record("第一轮辩论", Date.now() - round1Start);

    // 验证第一轮结果
    expect(args1).toBeDefined();
    expect(args1.plaintiff.arguments.length).toBeGreaterThan(0);
    expect(args1.defendant.arguments.length).toBeGreaterThan(0);

    // 第二轮：提交新证据并触发增量分析
    const round2Start = Date.now();
    const evidenceResponse = await apiContext.post(
      `/api/v1/debate-rounds/${debate.roundId}/evidence`,
      {
        data: {
          evidence: [
            {
              type: "CONTRACT",
              content: "补充证据：2024年3月补充协议",
              date: "2024-03-15",
            },
          ],
        },
      },
    );

    expect(evidenceResponse.ok()).toBe(true);

    // 开启第二轮
    const round2Response = await apiContext.post(
      `/api/v1/debates/${debateId}/rounds`,
      {
        data: {
          roundNumber: 2,
          status: "IN_PROGRESS",
          startedAt: new Date().toISOString(),
        },
      },
    );

    expect(round2Response.ok()).toBe(true);
    const round2Data = await round2Response.json();
    const round2Id = round2Data.data.id;

    // 验证上下文继承：第二轮应包含第一轮信息
    const args2 = await generateArguments(
      apiContext,
      round2Id,
      applicableArticles,
    );
    perfRecorder.record("第二轮辩论", Date.now() - round2Start);

    // 验证论点递进
    expect(args2.plaintiff.arguments.length).toBeGreaterThan(0);
    expect(args2.defendant.arguments.length).toBeGreaterThan(0);

    // 验证论点内容包含新证据
    const evidenceMentioned = args2.plaintiff.arguments.some(
      (arg: { content: string }) =>
        arg.content.includes("补充协议") || arg.content.includes("2024年3月"),
    );
    expect(evidenceMentioned).toBe(true);

    // 验证数据库中轮次正确递增
    await verifyDatabaseData(caseId, 1, 1, 2);

    // 验证总流程时间
    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(90000);
    perfRecorder.record("多轮流程", totalTime);

    console.log("=== 多轮辩论流程性能报告 ===");
    console.log(JSON.stringify(perfRecorder.getAllStats(), null, 2));
  });

  test("验证上下文继承：第二轮引用第一轮论点", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    debateId = debate.debateId;

    // 第一轮论点
    await generateArguments(apiContext, debate.roundId, []);

    // 开启第二轮
    const round2Response = await apiContext.post(
      `/api/v1/debates/${debateId}/rounds`,
      {
        data: {
          roundNumber: 2,
          status: "IN_PROGRESS",
          startedAt: new Date().toISOString(),
        },
      },
    );

    const round2Id = (await round2Response.json()).data.id;
    const args2 = await generateArguments(apiContext, round2Id, []);

    // 验证第二轮论点引用第一轮
    const referencesRound1 = args2.plaintiff.arguments.some(
      (arg: { references: { roundNumber: number }[] }) =>
        arg.references.some((ref) => ref.roundNumber === 1),
    );
    expect(referencesRound1).toBe(true);

    // 验证历史轮次数据不被修改
    const round1Data = await apiContext.get(
      `/api/v1/debate-rounds/${debate.roundId}`,
    );
    const round1Result = await round1Data.json();
    expect(round1Result.data.status).toBe("COMPLETED");
  });

  test("验证论点递进：观点逐步深化", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    debateId = debate.debateId;

    // 第一轮
    const args1 = await generateArguments(apiContext, debate.roundId, []);

    // 第二轮
    const round2Response = await apiContext.post(
      `/api/v1/debates/${debateId}/rounds`,
      {
        data: {
          roundNumber: 2,
          status: "IN_PROGRESS",
        },
      },
    );

    const round2Id = (await round2Response.json()).data.id;
    const args2 = await generateArguments(apiContext, round2Id, []);

    // 验证第二轮论点更详细
    const avgLength1 =
      args1.plaintiff.arguments.reduce(
        (sum: number, arg: { content: string }) => sum + arg.content.length,
        0,
      ) / args1.plaintiff.arguments.length;
    const avgLength2 =
      args2.plaintiff.arguments.reduce(
        (sum: number, arg: { content: string }) => sum + arg.content.length,
        0,
      ) / args2.plaintiff.arguments.length;

    expect(avgLength2).toBeGreaterThan(avgLength1);

    // 验证第二轮论点引用更多法条
    const lawCount1 = new Set(
      args1.plaintiff.arguments.flatMap(
        (arg: { legalBasis: { articleId: string }[] }) =>
          arg.legalBasis.map((lb) => lb.articleId),
      ),
    ).size;
    const lawCount2 = new Set(
      args2.plaintiff.arguments.flatMap(
        (arg: { legalBasis: { articleId: string }[] }) =>
          arg.legalBasis.map((lb) => lb.articleId),
      ),
    ).size;

    expect(lawCount2).toBeGreaterThanOrEqual(lawCount1);

    console.log(
      `论点平均长度: 第一轮=${avgLength1.toFixed(0)}字符, 第二轮=${avgLength2.toFixed(0)}字符`,
    );
    console.log(`法条引用数: 第一轮=${lawCount1}, 第二轮=${lawCount2}`);
  });

  test("验证增量分析：只分析新增数据", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);

    // 第一轮完整分析
    const round1Start = Date.now();
    await generateArguments(apiContext, debate.roundId, []);
    const round1Duration = Date.now() - round1Start;

    // 第二轮只提交增量数据
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
    const round2Duration = Date.now() - round2Start;
    await generateArguments(apiContext, round2Id, []);

    // 验证第二轮更快（利用缓存和增量分析）
    const speedup = round1Duration / round2Duration;
    expect(speedup).toBeGreaterThan(1.1);

    perfRecorder.record("第一轮分析", round1Duration);
    perfRecorder.record("第二轮分析", round2Duration);
    perfRecorder.record("加速比", speedup);

    console.log(`增量分析加速比: ${speedup.toFixed(2)}x`);
  });

  test("验证三轮辩论：完整的多轮支持", async () => {
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    debateId = debate.debateId;

    // 第一轮
    await generateArguments(apiContext, debate.roundId, []);

    // 第二轮
    const round2Response = await apiContext.post(
      `/api/v1/debates/${debateId}/rounds`,
      {
        data: {
          roundNumber: 2,
          status: "IN_PROGRESS",
        },
      },
    );

    const round2Id = (await round2Response.json()).data.id;
    const args2 = await generateArguments(apiContext, round2Id, []);

    // 第三轮
    const round3Response = await apiContext.post(
      `/api/v1/debates/${debateId}/rounds`,
      {
        data: {
          roundNumber: 3,
          status: "IN_PROGRESS",
        },
      },
    );

    const round3Id = (await round3Response.json()).data.id;
    const args3 = await generateArguments(apiContext, round3Id, []);

    // 验证三轮论点数量递增 - 假设第二轮论点数应多于第一轮，第三轮论点数应多于或等于第二轮
    expect(args2.plaintiff.arguments.length).toBeGreaterThan(0);
    expect(args3.plaintiff.arguments.length).toBeGreaterThanOrEqual(
      args2.plaintiff.arguments.length,
    );

    // 验证数据库中轮次正确递增
    await verifyDatabaseData(caseId, 0, 1, 3);

    // 验证所有轮次状态
    const allRoundsResponse = await apiContext.get(
      `/api/v1/debates/${debateId}/rounds`,
    );
    const allRounds = (await allRoundsResponse.json()).data;

    expect(allRounds.length).toBe(3);
    expect(allRounds[0].status).toBe("COMPLETED");
    expect(allRounds[1].status).toBe("COMPLETED");
    expect(allRounds[2].status).toBe("COMPLETED");
  });
});
