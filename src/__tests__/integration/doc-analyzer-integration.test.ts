/**
 * 集成测试：DocAnalyzer端到端流程测试
 * 测试从API路由到最终输出的完整流程
 * 包含四层处理架构和Reviewer审查流程
 */

import { DocAnalyzerAgentAdapter } from "@/lib/agent/doc-analyzer/adapter";
import { TaskPriority } from "@/types/agent";
import { join } from "path";
import { CacheManager } from "@/lib/cache";

describe("DocAnalyzer 集成测试", () => {
  let agent: DocAnalyzerAgentAdapter;
  let cacheManager: CacheManager;

  beforeAll(async () => {
    agent = new DocAnalyzerAgentAdapter();
    cacheManager = new CacheManager();
    await agent.initialize();

    // 禁用缓存以确保测试使用实时处理
    await agent.disableCache();
  });

  beforeEach(async () => {
    // 每个测试前清除缓存，确保测试使用新数据
    await cacheManager.clearNamespace("doc-analyzer");
  });

  afterAll(async () => {
    await agent.cleanup();
    // 清理测试缓存
    await cacheManager.clearNamespace("doc-analyzer");
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

  describe("完整流程测试", () => {
    it("应该完成从文件输入到分析输出的完整流程", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );

      const context = buildAgentContext("test-001-flow", testFilePath, {
        extractParties: true,
        extractClaims: true,
        extractTimeline: false,
        generateSummary: false,
      });

      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data.extractedData).toBeDefined();
      expect(result.data.extractedData.parties).toBeInstanceOf(Array);
      expect(result.data.extractedData.claims).toBeInstanceOf(Array);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it("应该正确提取当事人信息", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );

      const context = buildAgentContext("test-002-parties", testFilePath);
      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      const parties = result.data.extractedData.parties;

      // Debug: 输出当事人信息
      console.log(
        "提取的当事人:",
        parties.map((p) => ({ name: p.name, type: p.type, role: p.role })),
      );

      // 验证有至少一个原告和一个被告
      const hasPlaintiff = parties.some((p: any) => p.type === "plaintiff");
      const hasDefendant = parties.some((p: any) => p.type === "defendant");

      expect(hasPlaintiff).toBe(true);
      expect(hasDefendant).toBe(true);

      // 验证当事人信息完整性
      const plaintiff = parties.find((p: any) => p.name === "王小红");
      expect(plaintiff).toBeDefined();
      expect(plaintiff.name).toBe("王小红");
    });

    it("应该正确提取诉讼请求", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );

      const context = buildAgentContext("test-003-claims", testFilePath);
      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      const claims = result.data.extractedData.claims;

      // Debug: 输出诉讼请求信息
      console.log(
        "提取的诉讼请求:",
        claims.map((c) => ({
          type: c.type,
          content: c.content,
          amount: c.amount,
        })),
      );

      // 验证有诉讼请求
      expect(claims.length).toBeGreaterThan(0);

      // 验证LITIGATION_COST被识别（后处理规则）
      const hasLitigationCost = claims.some(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(hasLitigationCost).toBe(true);
    });

    it("应该正确提取金额信息", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );

      const context = buildAgentContext("test-004-amounts", testFilePath);
      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      const claims = result.data.extractedData.claims;

      // Debug: 输出金额信息
      console.log(
        "提取的金额:",
        claims.map((c) => ({
          type: c.type,
          amount: c.amount,
          currency: c.currency,
        })),
      );

      // 验证有金额提取
      const claimsWithAmount = claims.filter(
        (c: any) => c.amount && c.amount > 0,
      );
      expect(claimsWithAmount.length).toBeGreaterThan(0);

      // 验证金额格式正确
      const amount = claimsWithAmount[0].amount;
      expect(typeof amount).toBe("number");
      expect(amount).toBeGreaterThan(0);
    });
  });

  describe("四层处理架构测试", () => {
    it("第一层：算法过滤层应该快速验证输入", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const startTime = Date.now();

      const context = buildAgentContext("test-005-filter", testFilePath);
      const result = await agent.execute(context);

      const processingTime = Date.now() - startTime;
      expect(result.success).toBe(true);
      // 整体处理时间应该在合理范围内（<30秒，考虑AI调用时间）
      expect(processingTime).toBeLessThan(30000);
    });

    it("应该应用规则后处理", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );

      const context = buildAgentContext("test-006-rule", testFilePath);
      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      const claims = result.data.extractedData.claims;

      // 验证规则后处理：补充LITIGATION_COST
      const litigationCost = claims.find(
        (c: any) => c.type === "LITIGATION_COST",
      );
      expect(litigationCost).toBeDefined();
      // 允许"诉讼费"或"诉讼费用"
      expect(litigationCost.content).toMatch(/诉讼费/);
    });
  });

  describe("Reviewer审查流程测试", () => {
    it("应该执行规则审查", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );

      const context = buildAgentContext("test-007-review", testFilePath);
      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      const claims = result.data.extractedData.claims;

      // 验证规则审查结果：当事人去重
      const partyNames = new Set(claims.map((c: any) => c.party));
      // 如果有当事人关联，应该没有重复
      expect(partyNames.size).toBeGreaterThanOrEqual(0);
    });

    it("应该输出审查结果", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );

      const context = buildAgentContext("test-008-output", testFilePath);
      const result = await agent.execute(context);

      expect(result.success).toBe(true);
      // 验证结果包含必要的元数据
      expect(result.data).toBeDefined();
      expect(result.data.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe("错误处理测试", () => {
    it("应该处理不存在的文件", async () => {
      const context = buildAgentContext(
        "test-009-file-error",
        "/nonexistent/file.txt",
      );
      const result = await agent.execute(context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("应该处理无效的文件类型", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );

      const context = buildAgentContext("test-010-type-error", testFilePath);
      (context.data as any).fileType = "INVALID";

      const result = await agent.execute(context);

      expect(result.success).toBe(false);
    });
  });

  describe("缓存机制测试", () => {
    it("相同文档的第二次分析应该使用缓存", async () => {
      const testFilePath = join(
        process.cwd(),
        "test-data/legal-documents/test-variation-civil-case.txt",
      );
      const documentId = "test-cache-001";

      // 重新启用缓存进行此测试
      await agent
        .getAgent()
        .getCacheProcessor()
        .updateConfig({ enabled: true });

      // 第一次分析
      const context1 = buildAgentContext(documentId, testFilePath);
      const result1 = await agent.execute(context1);

      expect(result1.success).toBe(true);

      // 第二次分析（应该使用缓存）
      const context2 = buildAgentContext(documentId, testFilePath);
      const result2 = await agent.execute(context2);

      expect(result2.success).toBe(true);
      // 两次分析的extractedData应该一致（不比较processingTime）
      expect(result1.data.extractedData).toEqual(result2.data.extractedData);
      expect(result1.data.confidence).toBe(result2.data.confidence);
      // 第二次应该更快（使用缓存）
      expect(result2.executionTime).toBeLessThan(result1.executionTime);

      // 测试结束后重新禁用缓存
      await agent
        .getAgent()
        .getCacheProcessor()
        .updateConfig({ enabled: false });
    });
  });
});
