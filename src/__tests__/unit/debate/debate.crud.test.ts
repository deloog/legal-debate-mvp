import { testPrisma } from "../../../test-utils/database";
import {
  setupTestDatabase,
  cleanupTestDatabase,
} from "../../../test-utils/database";

describe("Debate CRUD Operations", () => {
  let testUser: any;
  let testCase: any;

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: "test-debate@example.com",
        name: "测试用户",
        role: "USER",
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: "测试案件",
        description: "这是一个用于测试辩论功能的案件",
        type: "CIVIL",
        status: "ACTIVE",
        plaintiffName: "张三",
        defendantName: "李四",
      },
    });
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe("Create Debate", () => {
    it("should create a new debate successfully", async () => {
      const debateData = {
        case: {
          connect: { id: testCase.id },
        },
        user: {
          connect: { id: testUser.id },
        },
        title: "违约责任辩论",
        status: "DRAFT" as const,
        debateConfig: {
          mode: "adversarial",
          maxRounds: 3,
          aiConfig: {
            plaintiff: {
              provider: "deepseek",
              model: "deepseek-chat",
              temperature: 0.7,
            },
            defendant: {
              provider: "zhipu",
              model: "glm-4-flash",
              temperature: 0.7,
            },
          },
        },
      };

      const debate = await testPrisma.debate.create({
        data: debateData,
      });

      expect(debate.id).toBeDefined();
      expect(debate.title).toBe("违约责任辩论");
      expect(debate.status).toBe("DRAFT");
      expect(debate.currentRound).toBe(0);
      expect(debate.createdAt).toBeInstanceOf(Date);
      expect(debate.updatedAt).toBeInstanceOf(Date);
    });

    it("should create debate with minimal required fields", async () => {
      const debateData = {
        case: {
          connect: { id: testCase.id },
        },
        user: {
          connect: { id: testUser.id },
        },
        title: "最小配置辩论",
      };

      const debate = await testPrisma.debate.create({
        data: debateData,
      });

      expect(debate.id).toBeDefined();
      expect(debate.title).toBe("最小配置辩论");
      expect(debate.status).toBe("DRAFT");
      expect(debate.currentRound).toBe(0);
      expect(debate.debateConfig).toBeNull();
    });

    it("should fail when required fields are missing", async () => {
      const invalidData = {
        title: "缺少必要字段的辩论",
        // 缺少 caseId 和 userId - 真正缺少必需字段
      };

      await expect(
        testPrisma.debate.create({ data: invalidData as any }),
      ).rejects.toThrow();
    });
  });

  describe("Read Debate", () => {
    let testDebate: any;

    beforeAll(async () => {
      testDebate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: "读取测试辩论",
          status: "IN_PROGRESS" as const,
          currentRound: 2,
        },
      });
    });

    it("should retrieve debate by id", async () => {
      const debate = await testPrisma.debate.findUnique({
        where: { id: testDebate.id },
      });

      expect(debate).not.toBeNull();
      expect(debate?.id).toBe(testDebate.id);
      expect(debate?.title).toBe("读取测试辩论");
      expect(debate?.status).toBe("IN_PROGRESS");
      expect(debate?.currentRound).toBe(2);
    });

    it("should retrieve debate with relations", async () => {
      const debate = await testPrisma.debate.findUnique({
        where: { id: testDebate.id },
        include: {
          case: true,
          user: true,
          rounds: true,
        },
      });

      expect(debate).not.toBeNull();
      expect(debate?.case).toBeDefined();
      expect(debate?.user).toBeDefined();
      expect(debate?.rounds).toBeDefined();
      expect(debate?.case.id).toBe(testCase.id);
      expect(debate?.user.id).toBe(testUser.id);
    });

    it("should return null for non-existent debate", async () => {
      const debate = await testPrisma.debate.findUnique({
        where: { id: "non-existent-id" },
      });

      expect(debate).toBeNull();
    });

    it("should filter debates by user", async () => {
      const debates = await testPrisma.debate.findMany({
        where: { userId: testUser.id },
      });

      expect(debates.length).toBeGreaterThan(0);
      debates.forEach((debate) => {
        expect(debate.userId).toBe(testUser.id);
      });
    });

    it("should filter debates by status", async () => {
      const debates = await testPrisma.debate.findMany({
        where: { status: "IN_PROGRESS" },
      });

      debates.forEach((debate) => {
        expect(debate.status).toBe("IN_PROGRESS");
      });
    });
  });

  describe("Update Debate", () => {
    let testDebate: any;

    beforeAll(async () => {
      testDebate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: "更新测试辩论",
          status: "DRAFT" as const,
          currentRound: 0,
        },
      });
    });

    it("should update debate status", async () => {
      const updatedDebate = await testPrisma.debate.update({
        where: { id: testDebate.id },
        data: { status: "IN_PROGRESS" as const },
      });

      expect(updatedDebate.status).toBe("IN_PROGRESS");
      expect(updatedDebate.updatedAt.getTime()).toBeGreaterThan(
        testDebate.updatedAt.getTime(),
      );
    });

    it("should update current round", async () => {
      const updatedDebate = await testPrisma.debate.update({
        where: { id: testDebate.id },
        data: { currentRound: 3 },
      });

      expect(updatedDebate.currentRound).toBe(3);
    });

    it("should update debate config", async () => {
      const newConfig = {
        mode: "collaborative",
        maxRounds: 5,
        autoAdvance: true,
      };

      const updatedDebate = await testPrisma.debate.update({
        where: { id: testDebate.id },
        data: { debateConfig: newConfig },
      });

      expect(updatedDebate.debateConfig).toMatchObject(newConfig);
    });

    it("should update multiple fields simultaneously", async () => {
      const updateData = {
        title: "更新的标题",
        status: "COMPLETED" as const,
        currentRound: 4,
        debateConfig: {
          mode: "adversarial",
          completedAt: new Date().toISOString(),
        },
      };

      const updatedDebate = await testPrisma.debate.update({
        where: { id: testDebate.id },
        data: updateData,
      });

      expect(updatedDebate.title).toBe(updateData.title);
      expect(updatedDebate.status).toBe(updateData.status);
      expect(updatedDebate.currentRound).toBe(updateData.currentRound);
      expect(updatedDebate.debateConfig).toMatchObject(updateData.debateConfig);
    });
  });

  describe("Delete Debate", () => {
    let testDebate: any;

    beforeEach(async () => {
      testDebate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: "删除测试辩论",
          status: "DRAFT" as const,
        },
      });
    });

    it("should delete debate permanently", async () => {
      await testPrisma.debate.delete({
        where: { id: testDebate.id },
      });

      const deletedDebate = await testPrisma.debate.findUnique({
        where: { id: testDebate.id },
      });

      expect(deletedDebate).toBeNull();
    });

    it("should handle deletion of non-existent debate", async () => {
      await expect(
        testPrisma.debate.delete({
          where: { id: "non-existent-id" },
        }),
      ).rejects.toThrow();
    });
  });

  describe("Soft Delete Debate", () => {
    let testDebate: any;

    beforeEach(async () => {
      testDebate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: "软删除测试辩论",
          status: "DRAFT" as const,
        },
      });
    });

    it("should soft delete debate", async () => {
      const deletedAt = new Date();

      await testPrisma.debate.update({
        where: { id: testDebate.id },
        data: { deletedAt },
      });

      const softDeletedDebate = await testPrisma.debate.findUnique({
        where: { id: testDebate.id },
      });

      expect(softDeletedDebate).not.toBeNull();
      expect(softDeletedDebate?.deletedAt).toEqual(deletedAt);
    });

    it("should filter out soft deleted debates in queries", async () => {
      // 软删除一个辩论
      await testPrisma.debate.update({
        where: { id: testDebate.id },
        data: { deletedAt: new Date() },
      });

      // 查询活跃的辩论（未被软删除）
      const activeDebates = await testPrisma.debate.findMany({
        where: { deletedAt: null },
      });

      activeDebates.forEach((debate) => {
        expect(debate.deletedAt).toBeNull();
      });
    });
  });
});
