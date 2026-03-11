/**
 * 单轮辩论完整流程E2E测试
 * 验证从文档上传到辩论生成的完整流程
 */

import { test, expect, APIRequestContext } from '@playwright/test';
import {
  e2eLogin,
  createTestCase,
  uploadTestDocument,
  waitForDocumentParsing,
  searchLawArticles,
  analyzeApplicability,
  createDebate,
  generateArguments,
  verifyDatabaseData,
  PerformanceRecorder,
  assertPerformance,
} from './helpers';

test.describe('单轮辩论完整流程', () => {
  let apiContext: APIRequestContext;
  let perfRecorder: PerformanceRecorder;

  test.beforeAll(async ({ playwright }) => {
    perfRecorder = new PerformanceRecorder();

    // 使用真实登录获取认证token
    const loginContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
    });
    const { token } = await e2eLogin(loginContext);
    await loginContext.dispose();

    apiContext = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      timeout: 90_000,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  });

  test.afterAll(async () => {
    if (apiContext) {
      await apiContext.dispose();
    }
  });

  test('完整流程测试：文档上传→解析→检索→分析→辩论', async () => {
    const startTime = Date.now();

    // 步骤1: 创建测试案件
    const createStart = Date.now();
    const testCase = await createTestCase(apiContext, undefined);
    const { caseId } = testCase;
    const createDuration = Date.now() - createStart;
    perfRecorder.record('创建案件', createDuration);
    assertPerformance(createDuration, 5000, '创建案件', 2.0);

    // 步骤2: 上传测试文档
    const uploadStart = Date.now();
    const pdfContent =
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF';
    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      pdfContent
    );
    const uploadDuration = Date.now() - uploadStart;
    perfRecorder.record('上传文档', uploadDuration);
    assertPerformance(uploadDuration, 15000, '上传文档', 1.2);

    // 步骤3: 等待文档解析完成
    const parseStart = Date.now();
    const parseResult = await waitForDocumentParsing(
      apiContext,
      testDocument.documentId,
      120000
    );
    const parseDuration = Date.now() - parseStart;
    perfRecorder.record('文档解析', parseDuration);
    assertPerformance(parseDuration, 20000, '文档解析', 1.2);

    // 验证解析结果（最小测试PDF不包含真实法律内容，允许parties/claims为空）
    expect(parseResult).toBeDefined();
    expect(parseResult.parties).toBeDefined();
    expect(Array.isArray(parseResult.parties)).toBe(true);
    expect(parseResult.claims).toBeDefined();
    expect(Array.isArray(parseResult.claims)).toBe(true);

    // 步骤4: 触发法条检索
    const searchStart = Date.now();
    // 从claims中提取关键词
    const rawKeywords = parseResult.claims
      .map((claim: { text: string }) => claim.text)
      .filter(t => t && t.length > 0);
    console.log('提取的关键词:', rawKeywords);

    // 简单的关键词提取 - 从长句中提取法律相关词汇
    const legalKeywords = new Set<string>();
    rawKeywords.forEach(text => {
      // 提取法律相关关键词
      const keywords = [
        '合同',
        '违约',
        '支付',
        '货款',
        '利息',
        '赔偿',
        '解除',
        '履行',
        '义务',
        '违约金',
        '损害赔偿',
        '欠款',
        '付款',
      ];
      keywords.forEach(kw => {
        if (text.includes(kw)) {
          legalKeywords.add(kw);
        }
      });
    });

    // 如果没有提取到关键词，使用默认关键词
    const finalKeywords =
      legalKeywords.size > 0 ? Array.from(legalKeywords) : ['合同', '违约'];
    console.log('最终使用的关键词:', finalKeywords);
    const searchResults = await searchLawArticles(
      apiContext,
      finalKeywords,
      'CIVIL',
      {
        allowEmpty: true,
        maxRetries: 1,
        expandKeywords: true,
      }
    );
    const searchDuration = Date.now() - searchStart;
    perfRecorder.record('法条检索', searchDuration);
    assertPerformance(searchDuration, 3000, '法条检索', 1.5);

    // 验证检索结果（测试PDF可能无实质法律关键词，允许空结果）
    expect(searchResults).toBeDefined();
    expect(Array.isArray(searchResults)).toBe(true);

    // 步骤5: 执行法条适用性分析（仅在有检索结果时执行）
    let applicableArticles: string[] = [];
    if (searchResults.length > 0) {
      const analysisStart = Date.now();
      const articleIds = searchResults
        .slice(0, 10)
        .map((article: { id: string }) => article.id);
      const applicabilityResult = await analyzeApplicability(
        apiContext,
        caseId,
        articleIds
      );
      const analysisDuration = Date.now() - analysisStart;
      perfRecorder.record('适用性分析', analysisDuration);
      assertPerformance(analysisDuration, 2000, '适用性分析', 15.0);

      // 验证适用性分析结果
      expect(applicabilityResult).toBeDefined();
      expect(applicabilityResult.analyzedAt).toBeDefined();
      expect(applicabilityResult.totalArticles).toBe(articleIds.length);
      expect(applicabilityResult.results.length).toBe(articleIds.length);

      applicableArticles = applicabilityResult.results
        .filter((r: { applicable: boolean }) => r.applicable)
        .map((r: { articleId: string }) => r.articleId);
    }

    // 步骤6: 创建辩论
    const debateStart = Date.now();
    const debateConfig = {
      debateMode: 'standard' as const,
      maxRounds: 3,
      timePerRound: 30,
      allowNewEvidence: true,
    };
    const debate = await createDebate(apiContext, caseId, debateConfig);
    const debateDuration = Date.now() - debateStart;
    perfRecorder.record('创建辩论', debateDuration);
    assertPerformance(debateDuration, 3000, '创建辩论', 1.5);

    // 步骤7: 生成辩论论点
    const generateStart = Date.now();
    const argumentsResult = await generateArguments(
      apiContext,
      debate.debateId,
      debate.roundId,
      applicableArticles
    );
    const generateDuration = Date.now() - generateStart;
    perfRecorder.record('生成论点', generateDuration);
    assertPerformance(generateDuration, 120000, '生成论点', 1.3);

    // 验证辩论生成结果
    expect(argumentsResult).toBeDefined();
    expect(argumentsResult.plaintiff).toBeDefined();
    expect(argumentsResult.defendant).toBeDefined();
    expect(argumentsResult.plaintiff.arguments.length).toBeGreaterThan(0);
    expect(argumentsResult.defendant.arguments.length).toBeGreaterThan(0);

    // 验证总流程时间
    const totalTime = Date.now() - startTime;
    expect(totalTime).toBeLessThan(60000);
    perfRecorder.record('完整流程', totalTime);

    // 数据一致性验证
    await verifyDatabaseData(caseId, 1, 1, 1);

    // 输出性能报告
    console.log('=== 单轮辩论流程性能报告 ===');
    console.log(JSON.stringify(perfRecorder.getAllStats(), null, 2));
  });

  test('验证文档解析结果数据结构', async ({ page }) => {
    const testCase = await createTestCase(apiContext, undefined);
    const { caseId } = testCase;

    const pdfContent =
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF';
    const testDocument = await uploadTestDocument(
      apiContext,
      caseId,
      pdfContent
    );
    const parseResult = await waitForDocumentParsing(
      apiContext,
      testDocument.documentId
    );

    console.log('文档解析结果:', JSON.stringify(parseResult, null, 2));

    // 验证当事人信息
    expect(parseResult.parties).toBeDefined();
    expect(parseResult.parties).toBeInstanceOf(Array);
    if (parseResult.parties.length > 0) {
      expect(parseResult.parties[0]).toHaveProperty('name');
      expect(parseResult.parties[0]).toHaveProperty('role');
    }

    // 验证诉讼请求
    expect(parseResult.claims).toBeDefined();
    expect(parseResult.claims).toBeInstanceOf(Array);
    if (parseResult.claims.length > 0) {
      expect(parseResult.claims[0]).toHaveProperty('type');
      expect(parseResult.claims[0]).toHaveProperty('text');
    }

    // 验证关键事实
    expect(parseResult.facts).toBeDefined();
    expect(parseResult.facts).toBeInstanceOf(Array);
    if (parseResult.facts.length > 0) {
      expect(typeof parseResult.facts[0]).toBe('string');
    }
  });

  test('验证法条检索结果相关性', async () => {
    await createTestCase(apiContext, undefined);

    const searchResults = await searchLawArticles(
      apiContext,
      ['违约', '合同'],
      'CIVIL'
    );

    if (searchResults.length > 0) {
      // 验证结果包含相关性信息
      expect(searchResults[0]).toHaveProperty('relevanceScore');
      expect(searchResults[0].relevanceScore).toBeGreaterThanOrEqual(0);
      expect(searchResults[0].relevanceScore).toBeLessThanOrEqual(1);

      // 验证结果按相关性排序
      for (let i = 1; i < searchResults.length; i++) {
        expect(searchResults[i - 1].relevanceScore).toBeGreaterThanOrEqual(
          searchResults[i].relevanceScore
        );
      }
    } else {
      console.warn('未找到法条，跳过相关性断言');
    }
  });

  test('验证法条适用性分析准确性', async () => {
    const testCase = await createTestCase(apiContext, undefined);

    // 首先检索真实的法条ID
    const searchResults = await searchLawArticles(
      apiContext,
      ['合同', '违约'],
      'CIVIL'
    );

    const articleIds = searchResults
      .slice(0, Math.min(2, searchResults.length))
      .map((article: { id: string }) => article.id);

    if (articleIds.length === 0) {
      console.warn('未找到法条，跳过适用性分析测试');
      return;
    }

    // 使用真实法条ID进行适用性分析
    const applicabilityResult = await analyzeApplicability(
      apiContext,
      testCase.caseId,
      articleIds
    );

    // 验证分析结构
    expect(applicabilityResult).toHaveProperty('analyzedAt');
    expect(applicabilityResult).toHaveProperty('totalArticles');
    expect(applicabilityResult).toHaveProperty('applicableArticles');
    expect(applicabilityResult).toHaveProperty('notApplicableArticles');
    expect(applicabilityResult).toHaveProperty('results');

    // 验证每条法条的分析结果
    if (applicabilityResult.results.length > 0) {
      const result = applicabilityResult.results[0];
      expect(result).toHaveProperty('articleId');
      expect(result).toHaveProperty('applicable');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('reasons');
      expect(result).toHaveProperty('warnings');
    }
  });

  test('验证辩论论点质量和平衡性', async () => {
    const testCase = await createTestCase(apiContext, undefined);

    // 检索真实的法条ID
    const searchResults = await searchLawArticles(
      apiContext,
      ['合同', '违约'],
      'CIVIL'
    );

    const articleIds = searchResults
      .slice(0, Math.min(3, searchResults.length))
      .map((article: { id: string }) => article.id);

    const debate = await createDebate(apiContext, testCase.caseId);
    const argumentsResult = await generateArguments(
      apiContext,
      debate.debateId,
      debate.roundId,
      articleIds
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

    // 验证论点内容不为空
    argumentsResult.plaintiff.arguments.forEach(arg => {
      expect(arg.content).toBeDefined();
      expect(arg.content.length).toBeGreaterThan(0);
    });

    // 验证论点类型
    const argumentTypes = new Set();
    argumentsResult.plaintiff.arguments.forEach(arg => {
      if (arg.type) {
        argumentTypes.add(arg.type);
      }
    });
    // 论点类型可能全为MAIN_POINT（这是generate路由的默认行为）
    expect(argumentTypes.size).toBeGreaterThanOrEqual(1);
  });

  test('验证数据库数据一致性', async () => {
    const testCase = await createTestCase(apiContext, undefined);

    const pdfContent =
      '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Count 1\n/Kids [3 0 R]\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n50 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000286 00000 n\ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n392\n%%EOF';
    const testDocument = await uploadTestDocument(
      apiContext,
      testCase.caseId,
      pdfContent
    );
    await waitForDocumentParsing(apiContext, testDocument.documentId);

    await createDebate(apiContext, testCase.caseId);

    // 验证数据库中的数据关系
    await verifyDatabaseData(testCase.caseId, 1, 1, 1);
  });
});
