import { testPrisma } from "../../../test-utils/database";
import {
  setupTestDatabase,
  cleanupTestDatabase,
} from "../../../test-utils/database";

describe("Debate Flow Performance and Validation", () => {
  let testUser: any;
  let testCase: any;

  beforeAll(async () => {
    await setupTestDatabase();

    // 创建测试用户
    testUser = await testPrisma.user.create({
      data: {
        email: "test-perf@example.com",
        name: "性能测试用户",
        role: "USER",
      },
    });

    // 创建测试案件
    testCase = await testPrisma.case.create({
      data: {
        userId: testUser.id,
        title: "性能测试案件",
        description: "这是一个用于测试辩论性能和一致性的案件",
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

  describe("Data Consistency Validation", () => {
    it("should maintain data consistency throughout flow", async () => {
      const debate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: "一致性测试辩论",
          status: "IN_PROGRESS" as const,
          currentRound: 1,
        },
      });

      const round = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id },
          },
          roundNumber: 1,
          status: "IN_PROGRESS" as const,
          startedAt: new Date(),
        },
      });

      // 创建论点
      const argument = await testPrisma.argument.create({
        data: {
          round: {
            connect: { id: round.id },
          },
          side: "PLAINTIFF" as const,
          content: "一致性测试论点",
          type: "MAIN_POINT" as const,
          aiProvider: "test-provider",
          generationTime: 1000,
          confidence: 0.95,
        },
      });

      // 验证关联关系
      const validationQuery = await testPrisma.argument.findUnique({
        where: { id: argument.id },
        include: {
          round: {
            include: {
              debate: true,
            },
          },
        },
      });

      expect(validationQuery?.round.id).toBe(round.id);
      expect(validationQuery?.round.debate.id).toBe(debate.id);
      expect(validationQuery?.aiProvider).toBe("test-provider");
      expect(validationQuery?.generationTime).toBe(1000);
      expect(validationQuery?.confidence).toBe(0.95);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent argument creation", async () => {
      const debate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: "并发测试辩论",
          status: "IN_PROGRESS" as const,
          currentRound: 1,
        },
      });

      const round = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id },
          },
          roundNumber: 1,
          status: "IN_PROGRESS" as const,
          startedAt: new Date(),
        },
      });

      // 并发创建多个论点
      const argumentPromises = [];
      for (let i = 1; i <= 5; i++) {
        argumentPromises.push(
          testPrisma.argument.create({
            data: {
              round: {
                connect: { id: round.id },
              },
              side:
                i % 2 === 0 ? ("DEFENDANT" as const) : ("PLAINTIFF" as const),
              content: `并发论点${i}`,
              type: "MAIN_POINT" as const,
            },
          }),
        );
      }

      const createdArguments = await Promise.all(argumentPromises);

      expect(createdArguments).toHaveLength(5);

      // 验证所有论点都被正确创建
      const finalArguments = await testPrisma.argument.findMany({
        where: { roundId: round.id },
      });

      expect(finalArguments.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe("Performance Benchmarks", () => {
    it("should handle large debate creation efficiently", async () => {
      const startTime = Date.now();

      // 创建包含多轮的复杂辩论
      const debate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: "性能基准测试辩论",
          status: "DRAFT" as const,
          currentRound: 0,
          debateConfig: {
            mode: "adversarial",
            maxRounds: 5,
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
        },
      });

      // 快速创建多个轮次
      const rounds = [];
      for (let i = 1; i <= 5; i++) {
        const round = await testPrisma.debateRound.create({
          data: {
            debate: {
              connect: { id: debate.id },
            },
            roundNumber: i,
            status: i === 1 ? ("IN_PROGRESS" as const) : ("PENDING" as const),
            startedAt: i === 1 ? new Date() : undefined,
          },
        });
        rounds.push(round);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // 验证性能基准
      expect(duration).toBeLessThan(5000); // 应该在5秒内完成
      expect(rounds).toHaveLength(5);

      // 清理测试数据
      await testPrisma.argument.deleteMany({
        where: { round: { debateId: debate.id } },
      });
      await testPrisma.debateRound.deleteMany({
        where: { debateId: debate.id },
      });
      await testPrisma.debate.delete({
        where: { id: debate.id },
      });
    });
  });

  describe("Data Integrity Validation", () => {
    it("should enforce foreign key constraints", async () => {
      // 测试不存在的轮次ID
      await expect(
        testPrisma.argument.create({
          data: {
            round: {
              connect: { id: "non-existent-round-id" },
            },
            side: "PLAINTIFF" as const,
            content: "测试论点",
            type: "MAIN_POINT" as const,
          },
        }),
      ).rejects.toThrow();

      // 测试不存在的辩论ID
      await expect(
        testPrisma.debateRound.create({
          data: {
            debate: {
              connect: { id: "non-existent-debate-id" },
            },
            roundNumber: 1,
            status: "IN_PROGRESS" as const,
            startedAt: new Date(),
          },
        }),
      ).rejects.toThrow();
    });

    it("should validate enum constraints", async () => {
      const debate = await testPrisma.debate.create({
        data: {
          case: {
            connect: { id: testCase.id },
          },
          user: {
            connect: { id: testUser.id },
          },
          title: "约束验证测试辩论",
          status: "IN_PROGRESS" as const,
          currentRound: 1,
        },
      });

      const round = await testPrisma.debateRound.create({
        data: {
          debate: {
            connect: { id: debate.id },
          },
          roundNumber: 1,
          status: "IN_PROGRESS" as const,
          startedAt: new Date(),
        },
      });

      // 测试无效的枚举值会失败
      await expect(
        testPrisma.argument.create({
          data: {
            round: {
              connect: { id: round.id },
            },
            side: "INVALID_SIDE" as any,
            content: "测试论点",
            type: "MAIN_POINT" as const,
          },
        }),
      ).rejects.toThrow();
    });
  });
});
