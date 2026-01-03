/**
 * VerificationResult模型测试
 * 测试三重验证机制（事实准确性、逻辑一致性、任务完成度）
 */

import { PrismaClient, VerificationType } from "@prisma/client";

const prisma = new PrismaClient();

describe("VerificationResult模型", () => {
  let testUserId: string;
  let testCaseId: string;
  let testArgumentId: string;

  beforeAll(async () => {
    // 创建测试数据
    const user = await prisma.user.create({
      data: {
        email: "test-verification@example.com",
        username: "test_verification",
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

    // 创建测试辩论和轮次
    const debate = await prisma.debate.create({
      data: {
        caseId: testCaseId,
        userId: testUserId,
        title: "测试辩论",
        status: "DRAFT",
      },
    });

    const round = await prisma.debateRound.create({
      data: {
        debateId: debate.id,
        roundNumber: 1,
        status: "COMPLETED",
      },
    });

    // 创建测试论点
    const argument = await prisma.argument.create({
      data: {
        roundId: round.id,
        side: "PLAINTIFF",
        content: "测试论点内容",
      },
    });
    testArgumentId = argument.id;
  });

  afterAll(async () => {
    await prisma.verificationResult.deleteMany({
      where: {
        OR: [{ entityType: "Argument" }, { entityType: "Document" }],
      },
    });
    await prisma.argument.deleteMany({
      where: { id: testArgumentId },
    });
    await prisma.debateRound.deleteMany({
      where: { debate: { userId: testUserId } },
    });
    await prisma.debate.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.case.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { email: "test-verification@example.com" },
    });
    await prisma.$disconnect();
  });

  describe("创建验证结果", () => {
    it("应成功创建事实准确性验证", async () => {
      const verification = await prisma.verificationResult.create({
        data: {
          entityType: "Argument",
          entityId: testArgumentId,
          verificationType: VerificationType.FACTUAL,
          overallScore: 0.85,
          factualAccuracy: 0.9,
          logicalConsistency: 0.8,
          taskCompleteness: 0.85,
          passed: true,
          issues: [],
          suggestions: ["添加更多证据"],
          verifiedBy: "VerificationAgent",
          verificationTime: 1500,
        },
      });

      expect(verification).toBeDefined();
      expect(verification.verificationType).toBe(VerificationType.FACTUAL);
      expect(verification.overallScore).toBe(0.85);
      expect(verification.passed).toBe(true);
    });

    it("应成功创建逻辑一致性验证", async () => {
      const verification = await prisma.verificationResult.create({
        data: {
          entityType: "Argument",
          entityId: `${testArgumentId}-logical`,
          verificationType: VerificationType.LOGICAL,
          overallScore: 0.75,
          logicalConsistency: 0.75,
          passed: false,
          issues: [{ type: "contradiction", message: "存在逻辑矛盾" }],
          suggestions: ["修正推理过程"],
          verifiedBy: "LogicAgent",
          verificationTime: 1200,
        },
      });

      expect(verification).toBeDefined();
      expect(verification.verificationType).toBe(VerificationType.LOGICAL);
      expect(verification.passed).toBe(false);
    });

    it("应成功创建任务完成度验证", async () => {
      const verification = await prisma.verificationResult.create({
        data: {
          entityType: "Argument",
          entityId: `${testArgumentId}-completeness`,
          verificationType: VerificationType.COMPLETENESS,
          overallScore: 0.95,
          taskCompleteness: 0.95,
          passed: true,
          verifiedBy: "CompletenessAgent",
          verificationTime: 800,
        },
      });

      expect(verification).toBeDefined();
      expect(verification.verificationType).toBe(VerificationType.COMPLETENESS);
    });

    it("应成功创建综合验证", async () => {
      const verification = await prisma.verificationResult.create({
        data: {
          entityType: "Argument",
          entityId: `${testArgumentId}-comprehensive`,
          verificationType: VerificationType.COMPREHENSIVE,
          overallScore: 0.88,
          factualAccuracy: 0.9,
          logicalConsistency: 0.85,
          taskCompleteness: 0.9,
          passed: true,
          issues: [],
          suggestions: ["优化表达方式"],
          verifiedBy: "ComprehensiveAgent",
          verificationTime: 3000,
        },
      });

      expect(verification).toBeDefined();
      expect(verification.verificationType).toBe(
        VerificationType.COMPREHENSIVE,
      );
      expect(verification.factualAccuracy).toBe(0.9);
      expect(verification.logicalConsistency).toBe(0.85);
      expect(verification.taskCompleteness).toBe(0.9);
    });

    it("应拒绝创建重复的实体验证", async () => {
      const entityId = `${testArgumentId}-duplicate`;
      const data = {
        entityType: "Argument",
        entityId,
        verificationType: VerificationType.FACTUAL,
        overallScore: 0.8,
        factualAccuracy: 0.8,
        passed: true,
        verifiedBy: "DuplicateAgent",
        verificationTime: 1000,
      };

      await prisma.verificationResult.create({ data });

      await expect(
        prisma.verificationResult.create({ data }),
      ).rejects.toThrow();
    });
  });

  describe("验证结果查询", () => {
    it("应按验证类型查询", async () => {
      const verifications = await prisma.verificationResult.findMany({
        where: {
          verificationType: VerificationType.FACTUAL,
        },
      });

      expect(verifications.length).toBeGreaterThan(0);
      expect(
        verifications.every(
          (v) => v.verificationType === VerificationType.FACTUAL,
        ),
      ).toBe(true);
    });

    it("应按实体类型和ID查询", async () => {
      const verification = await prisma.verificationResult.findFirst({
        where: {
          entityType: "Argument",
          entityId: testArgumentId,
        },
      });

      expect(verification).toBeDefined();
      expect(verification?.entityType).toBe("Argument");
      expect(verification?.entityId).toBe(testArgumentId);
    });

    it("应按通过状态查询", async () => {
      const passedVerifications = await prisma.verificationResult.findMany({
        where: {
          passed: true,
        },
      });

      expect(passedVerifications.length).toBeGreaterThan(0);
      expect(passedVerifications.every((v) => v.passed)).toBe(true);
    });

    it("应按分数范围查询", async () => {
      const highScoreVerifications = await prisma.verificationResult.findMany({
        where: {
          overallScore: { gte: 0.8 },
        },
      });

      expect(highScoreVerifications.length).toBeGreaterThan(0);
      expect(highScoreVerifications.every((v) => v.overallScore >= 0.8)).toBe(
        true,
      );
    });

    it("应查询有问题的验证结果", async () => {
      // 先创建一个有问题的验证结果
      await prisma.verificationResult.create({
        data: {
          entityType: "Argument",
          entityId: `${testArgumentId}-issues`,
          verificationType: VerificationType.LOGICAL,
          overallScore: 0.5,
          logicalConsistency: 0.5,
          passed: false,
          issues: [{ type: "error", message: "验证失败" }],
          suggestions: ["修复错误"],
          verifiedBy: "IssuesAgent",
          verificationTime: 1000,
        },
      });

      const verificationsWithIssues = await prisma.verificationResult.findMany({
        where: {
          issues: { not: [] },
        },
      });

      expect(verificationsWithIssues.length).toBeGreaterThan(0);
    });
  });

  describe("验证结果更新", () => {
    it("应更新验证分数", async () => {
      const verification = await prisma.verificationResult.create({
        data: {
          entityType: "Document",
          entityId: "doc_update_test",
          verificationType: VerificationType.COMPREHENSIVE,
          overallScore: 0.7,
          factualAccuracy: 0.7,
          logicalConsistency: 0.7,
          taskCompleteness: 0.7,
          passed: false,
          verifiedBy: "UpdateAgent",
          verificationTime: 2000,
        },
      });

      const updated = await prisma.verificationResult.update({
        where: { id: verification.id },
        data: {
          overallScore: 0.9,
          factualAccuracy: 0.9,
          logicalConsistency: 0.9,
          taskCompleteness: 0.9,
          passed: true,
          issues: [],
        },
      });

      expect(updated.overallScore).toBe(0.9);
      expect(updated.passed).toBe(true);
      expect(updated.issues).toEqual([]);
    });

    it("应添加改进建议", async () => {
      const verification = await prisma.verificationResult.create({
        data: {
          entityType: "Document",
          entityId: "suggestion_test",
          verificationType: VerificationType.FACTUAL,
          overallScore: 0.8,
          factualAccuracy: 0.8,
          passed: true,
          verifiedBy: "SuggestionAgent",
          verificationTime: 1500,
        },
      });

      const updated = await prisma.verificationResult.update({
        where: { id: verification.id },
        data: {
          suggestions: ["添加法律依据", "补充案例引用"],
        },
      });

      expect(updated.suggestions).toEqual(["添加法律依据", "补充案例引用"]);
    });
  });

  describe("验证结果删除", () => {
    it("应删除验证结果", async () => {
      const verification = await prisma.verificationResult.create({
        data: {
          entityType: "Document",
          entityId: "delete_test",
          verificationType: VerificationType.LOGICAL,
          overallScore: 0.6,
          logicalConsistency: 0.6,
          passed: false,
          verifiedBy: "DeleteAgent",
          verificationTime: 1000,
        },
      });

      await prisma.verificationResult.delete({
        where: { id: verification.id },
      });

      const deleted = await prisma.verificationResult.findUnique({
        where: { id: verification.id },
      });

      expect(deleted).toBeNull();
    });
  });

  describe("验证结果统计", () => {
    it("应计算平均分数", async () => {
      const results = await prisma.verificationResult.findMany({
        where: {
          entityType: "Argument",
        },
        select: {
          overallScore: true,
        },
      });

      const avgScore =
        results.reduce((sum, r) => sum + r.overallScore, 0) / results.length;
      expect(avgScore).toBeGreaterThan(0);
      expect(avgScore).toBeLessThanOrEqual(1);
    });

    it("应计算通过率", async () => {
      const allResults = await prisma.verificationResult.findMany();
      const passedResults = allResults.filter((r) => r.passed);
      const passRate = passedResults.length / allResults.length;

      expect(passRate).toBeGreaterThanOrEqual(0);
      expect(passRate).toBeLessThanOrEqual(1);
    });
  });
});
