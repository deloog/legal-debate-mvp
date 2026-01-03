/**
 * ErrorLog模型测试
 * 测试错误学习机制
 */

import { PrismaClient, ErrorType, ErrorSeverity } from "@prisma/client";

const prisma = new PrismaClient();

describe("ErrorLog模型", () => {
  let testUserId: string;
  let testCaseId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: "test-error@example.com",
        username: "test_error",
        role: "USER",
      },
    });
    testUserId = user.id;

    const testCase = await prisma.case.create({
      data: {
        userId: testUserId,
        title: "测试案件",
        description: "测试描述",
        type: "CIVIL",
        status: "DRAFT",
      },
    });
    testCaseId = testCase.id;
  });

  afterAll(async () => {
    await prisma.errorLog.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.case.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { email: "test-error@example.com" },
    });
    await prisma.$disconnect();
  });

  describe("创建错误日志", () => {
    it("应成功创建AI服务错误日志", async () => {
      const errorLog = await prisma.errorLog.create({
        data: {
          userId: testUserId,
          caseId: testCaseId,
          errorType: ErrorType.AI_SERVICE_ERROR,
          errorCode: "AI_TIMEOUT",
          errorMessage: "AI服务超时",
          context: { provider: "deepseek", model: "deepseek-chat" },
          attemptedAction: { type: "generate", prompt: "测试提示" },
          severity: ErrorSeverity.HIGH,
        },
      });

      expect(errorLog).toBeDefined();
      expect(errorLog.errorType).toBe(ErrorType.AI_SERVICE_ERROR);
      expect(errorLog.errorCode).toBe("AI_TIMEOUT");
      expect(errorLog.severity).toBe(ErrorSeverity.HIGH);
    });

    it("应成功创建解析错误日志", async () => {
      const errorLog = await prisma.errorLog.create({
        data: {
          userId: testUserId,
          errorType: ErrorType.VALIDATION_ERROR,
          errorCode: "PARSE_FAILED",
          errorMessage: "解析AI响应失败",
          context: { response: "无效的响应" },
          severity: ErrorSeverity.MEDIUM,
        },
      });

      expect(errorLog).toBeDefined();
      expect(errorLog.errorType).toBe(ErrorType.VALIDATION_ERROR);
    });

    it("应成功创建验证错误日志", async () => {
      const errorLog = await prisma.errorLog.create({
        data: {
          userId: testUserId,
          caseId: testCaseId,
          errorType: ErrorType.VALIDATION_ERROR,
          errorCode: "VALIDATION_FAILED",
          errorMessage: "验证失败",
          context: { field: "amount", value: "invalid" },
          stackTrace: "ValidationError: Invalid amount",
          severity: ErrorSeverity.MEDIUM,
        },
      });

      expect(errorLog).toBeDefined();
      expect(errorLog.stackTrace).toBeDefined();
    });

    it("应成功创建严重错误日志", async () => {
      const errorLog = await prisma.errorLog.create({
        data: {
          userId: testUserId,
          errorType: ErrorType.AGENT_ERROR,
          errorCode: "CRITICAL_ERROR",
          errorMessage: "严重逻辑错误",
          context: { operation: "save_data" },
          severity: ErrorSeverity.CRITICAL,
        },
      });

      expect(errorLog).toBeDefined();
      expect(errorLog.severity).toBe(ErrorSeverity.CRITICAL);
    });
  });

  describe("错误日志查询", () => {
    it("应按错误类型查询", async () => {
      const errors = await prisma.errorLog.findMany({
        where: {
          errorType: ErrorType.AI_SERVICE_ERROR,
        },
      });

      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.every((e) => e.errorType === ErrorType.AI_SERVICE_ERROR),
      ).toBe(true);
    });

    it("应按严重程度查询", async () => {
      const criticalErrors = await prisma.errorLog.findMany({
        where: {
          severity: ErrorSeverity.CRITICAL,
        },
      });

      expect(criticalErrors.length).toBeGreaterThan(0);
    });

    it("应按错误代码查询", async () => {
      const error = await prisma.errorLog.findFirst({
        where: {
          errorCode: "AI_TIMEOUT",
        },
      });

      expect(error).toBeDefined();
      expect(error?.errorCode).toBe("AI_TIMEOUT");
    });

    it("应查询已恢复的错误", async () => {
      await prisma.errorLog.create({
        data: {
          userId: testUserId,
          errorType: ErrorType.NETWORK_ERROR,
          errorCode: "NETWORK_RETRY",
          errorMessage: "网络错误已恢复",
          context: { attempt: 1 },
          recoveryAttempts: 2,
          recovered: true,
          recoveryMethod: "retry",
          recoveryTime: 5000,
          severity: ErrorSeverity.LOW,
        },
      });

      const recoveredErrors = await prisma.errorLog.findMany({
        where: {
          recovered: true,
        },
      });

      expect(recoveredErrors.length).toBeGreaterThan(0);
    });

    it("应查询已学习的错误", async () => {
      await prisma.errorLog.create({
        data: {
          userId: testUserId,
          errorType: ErrorType.VALIDATION_ERROR,
          errorCode: "LEARNED_ERROR",
          errorMessage: "已学习的错误",
          context: { pattern: "common" },
          learned: true,
          learningNotes: "这是一个常见错误，已添加到验证规则",
          severity: ErrorSeverity.MEDIUM,
        },
      });

      const learnedErrors = await prisma.errorLog.findMany({
        where: {
          learned: true,
        },
      });

      expect(learnedErrors.length).toBeGreaterThan(0);
    });
  });

  describe("错误日志更新", () => {
    it("应更新恢复状态", async () => {
      const errorLog = await prisma.errorLog.create({
        data: {
          userId: testUserId,
          errorType: ErrorType.AI_TIMEOUT,
          errorCode: "UPDATE_TEST",
          errorMessage: "更新测试",
          context: { test: true },
          recovered: false,
          severity: ErrorSeverity.MEDIUM,
        },
      });

      const updated = await prisma.errorLog.update({
        where: { id: errorLog.id },
        data: {
          recovered: true,
          recoveryMethod: "retry",
          recoveryTime: 3000,
          recoveryAttempts: 2,
        },
      });

      expect(updated.recovered).toBe(true);
      expect(updated.recoveryMethod).toBe("retry");
      expect(updated.recoveryTime).toBe(3000);
      expect(updated.recoveryAttempts).toBe(2);
    });

    it("应更新学习状态", async () => {
      const errorLog = await prisma.errorLog.create({
        data: {
          userId: testUserId,
          errorType: ErrorType.UNKNOWN_ERROR,
          errorCode: "LEARNING_TEST",
          errorMessage: "学习测试",
          context: { pattern: "new" },
          learned: false,
          severity: ErrorSeverity.LOW,
        },
      });

      const updated = await prisma.errorLog.update({
        where: { id: errorLog.id },
        data: {
          learned: true,
          learningNotes: "已添加到错误知识库",
        },
      });

      expect(updated.learned).toBe(true);
      expect(updated.learningNotes).toBe("已添加到错误知识库");
    });
  });

  describe("错误日志删除", () => {
    it("应删除错误日志", async () => {
      const errorLog = await prisma.errorLog.create({
        data: {
          userId: testUserId,
          errorType: ErrorType.DATABASE_ERROR,
          errorCode: "DELETE_TEST",
          errorMessage: "删除测试",
          context: { test: true },
          severity: ErrorSeverity.LOW,
        },
      });

      await prisma.errorLog.delete({
        where: { id: errorLog.id },
      });

      const deleted = await prisma.errorLog.findUnique({
        where: { id: errorLog.id },
      });

      expect(deleted).toBeNull();
    });
  });

  describe("错误日志统计", () => {
    it("应按严重程度统计", async () => {
      const criticalErrors = await prisma.errorLog.count({
        where: { severity: ErrorSeverity.CRITICAL },
      });
      const highErrors = await prisma.errorLog.count({
        where: { severity: ErrorSeverity.HIGH },
      });
      const mediumErrors = await prisma.errorLog.count({
        where: { severity: ErrorSeverity.MEDIUM },
      });
      const lowErrors = await prisma.errorLog.count({
        where: { severity: ErrorSeverity.LOW },
      });

      const total = criticalErrors + highErrors + mediumErrors + lowErrors;
      expect(total).toBeGreaterThan(0);
    });

    it("应计算恢复率", async () => {
      const allErrors = await prisma.errorLog.findMany({
        where: { userId: testUserId },
      });
      const recoveredErrors = allErrors.filter((e) => e.recovered);
      const recoveryRate =
        allErrors.length > 0 ? recoveredErrors.length / allErrors.length : 0;

      expect(recoveryRate).toBeGreaterThanOrEqual(0);
      expect(recoveryRate).toBeLessThanOrEqual(1);
    });

    it("应计算学习率", async () => {
      const allErrors = await prisma.errorLog.findMany({
        where: { userId: testUserId },
      });
      const learnedErrors = allErrors.filter((e) => e.learned);
      const learningRate =
        allErrors.length > 0 ? learnedErrors.length / allErrors.length : 0;

      expect(learningRate).toBeGreaterThanOrEqual(0);
      expect(learningRate).toBeLessThanOrEqual(1);
    });
  });
});
