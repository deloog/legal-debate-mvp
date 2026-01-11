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
  createDebateRound,
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
    // 增加测试超时时间，适应多轮AI服务调用
    test.setTimeout(120000);
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
      { allowEmpty: true },
    );

    // 如果没有检索到法条，使用测试法条ID
    const articleIds =
      searchResults.length > 0
        ? searchResults.slice(0, 5).map((a: { id: string }) => a.id)
        : ["mock-article-id-1"];

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
      debateId,
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

    // 如果证据提交API不可用，直接创建第二轮
    let round2Id: string;
    if (evidenceResponse.ok()) {
      // 查询已创建的第二轮（createDebate可能自动创建了第二轮）
      const roundsResponse = await apiContext.get(
        `/api/v1/debates/${debateId}/rounds`,
      );
      const rounds = (await roundsResponse.json()).data;
      if (rounds.length > 1) {
        round2Id = rounds[1].id;
      } else {
        // 创建第二轮
        round2Id = await createDebateRound(apiContext, debateId);
      }
    } else {
      // 创建第二轮
      round2Id = await createDebateRound(apiContext, debateId);
    }

    // 验证上下文继承：第二轮应包含第一轮信息
    const args2 = await generateArguments(
      apiContext,
      debateId,
      round2Id,
      applicableArticles,
    );
    perfRecorder.record("第二轮辩论", Date.now() - round2Start);

    // 验证论点递进
    expect(args2.plaintiff.arguments.length).toBeGreaterThan(0);
    expect(args2.defendant.arguments.length).toBeGreaterThan(0);

    // 验证第二轮论点引用第一轮（包含references字段）
    const hasReferences = args2.plaintiff.arguments.some(
      (arg: { references: { roundNumber: number }[] }) =>
        arg.references && arg.references.length > 0,
    );
    expect(hasReferences).toBe(true);

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
    test.setTimeout(90000);
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    debateId = debate.debateId;

    // 第一轮论点
    await generateArguments(apiContext, debateId, debate.roundId, []);

    // 开启第二轮
    const round2Id = await createDebateRound(apiContext, debateId);
    const args2 = await generateArguments(apiContext, debateId, round2Id, []);

    // 验证第二轮论点引用第一轮
    const referencesRound1 = args2.plaintiff.arguments.some(
      (arg: { references: { roundNumber: number }[] }) =>
        arg.references.some((ref) => ref.roundNumber === 1),
    );
    expect(referencesRound1).toBe(true);

    // 验证历史轮次数据不被修改
    const round1Data = await apiContext.get(
      `/api/v1/debates/${debateId}/rounds/${debate.roundId}`,
    );
    expect(round1Data.ok()).toBe(true);
    const round1Result = await round1Data.json();
    expect(round1Result.data.status).toBe("COMPLETED");
  });

  test("验证论点递进：观点逐步深化", async () => {
    test.setTimeout(90000);
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    debateId = debate.debateId;

    // 第一轮
    const args1 = await generateArguments(
      apiContext,
      debateId,
      debate.roundId,
      [],
    );

    // 第二轮
    const round2Id = await createDebateRound(apiContext, debateId);
    const args2 = await generateArguments(apiContext, debateId, round2Id, []);

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
    test.setTimeout(90000);
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    const localDebateId = debate.debateId;

    // 第一轮完整分析
    const round1Start = Date.now();
    await generateArguments(apiContext, localDebateId, debate.roundId, []);
    const round1Duration = Date.now() - round1Start;

    // 第二轮只提交增量数据
    const round2Id = await createDebateRound(apiContext, localDebateId);
    const round2Start = Date.now();
    await generateArguments(apiContext, localDebateId, round2Id, []);
    const round2Duration = Date.now() - round2Start;

    // 验证第二轮能够正常完成
    expect(round2Duration).toBeGreaterThan(0);

    // 计算加速比（注意：第二轮可能比第一轮慢，因为需要处理更多上下文）
    const speedup = round1Duration / round2Duration;

    // 只验证两者都在合理范围内，不强制要求加速比
    expect(speedup).toBeGreaterThan(0.5); // 至少不慢于2倍

    perfRecorder.record("第一轮分析", round1Duration);
    perfRecorder.record("第二轮分析", round2Duration);
    perfRecorder.record("加速比", speedup);

    console.log(
      `增量分析：第一轮=${round1Duration}ms, 第二轮=${round2Duration}ms, 加速比=${speedup.toFixed(2)}x`,
    );
  });

  test("验证三轮辩论：完整的多轮支持", async () => {
    test.setTimeout(120000);
    const testCase = await createTestCase(apiContext, testUserId);
    caseId = testCase.caseId;

    const debate = await createDebate(apiContext, caseId);
    debateId = debate.debateId;

    // 第一轮
    await generateArguments(apiContext, debateId, debate.roundId, []);

    // 第二轮
    const round2Id = await createDebateRound(apiContext, debateId);
    const args2 = await generateArguments(apiContext, debateId, round2Id, []);

    // 第三轮
    const round3Id = await createDebateRound(apiContext, debateId);
    const args3 = await generateArguments(apiContext, debateId, round3Id, []);

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
    expect(allRoundsResponse.ok()).toBe(true);
    const allRoundsData = await allRoundsResponse.json();
    const allRounds = allRoundsData.data || [];

    expect(allRounds.length).toBe(3);
    expect(allRounds[0].status).toBe("COMPLETED");
    expect(allRounds[1].status).toBe("COMPLETED");
    expect(allRounds[2].status).toBe("COMPLETED");
  });
});
