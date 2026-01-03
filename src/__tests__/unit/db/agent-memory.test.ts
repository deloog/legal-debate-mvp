/**
 * AgentMemory模型测试
 * 测试三层记忆架构（工作记忆、热记忆、冷记忆）
 */

import { PrismaClient, MemoryType } from "@prisma/client";

const prisma = new PrismaClient();

describe("AgentMemory模型", () => {
  let testUserId: string;
  let testCaseId: string;
  let testDebateId: string;

  beforeAll(async () => {
    // 创建测试用户、案件和辩论
    const user = await prisma.user.create({
      data: {
        email: "test-agent-memory@example.com",
        username: "test_agent_memory",
        name: "Test Agent Memory",
        role: "USER",
      },
    });
    testUserId = user.id;

    const testCase = await prisma.case.create({
      data: {
        userId: testUserId,
        title: "测试案件",
        description: "测试案件描述",
        type: "CIVIL",
        status: "DRAFT",
      },
    });
    testCaseId = testCase.id;

    const testDebate = await prisma.debate.create({
      data: {
        caseId: testCaseId,
        userId: testUserId,
        title: "测试辩论",
        status: "DRAFT",
      },
    });
    testDebateId = testDebate.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.agentMemory.deleteMany({
      where: {
        userId: testUserId,
      },
    });
    await prisma.debate.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.case.deleteMany({
      where: { userId: testUserId },
    });
    await prisma.user.deleteMany({
      where: { email: "test-agent-memory@example.com" },
    });
    await prisma.$disconnect();
  });

  describe("创建记忆记录", () => {
    it("应成功创建工作记忆", async () => {
      const memory = await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          caseId: testCaseId,
          debateId: testDebateId,
          memoryType: MemoryType.WORKING,
          agentName: "TestAgent",
          memoryKey: "current_task",
          memoryValue: { task: "analyze_case", step: 1 },
          importance: 0.8,
          expiresAt: new Date(Date.now() + 3600000), // 1小时后过期
        },
      });

      expect(memory).toBeDefined();
      expect(memory.id).toBeDefined();
      expect(memory.memoryType).toBe(MemoryType.WORKING);
      expect(memory.agentName).toBe("TestAgent");
      expect(memory.importance).toBe(0.8);
    });

    it("应成功创建热记忆", async () => {
      const memory = await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          caseId: testCaseId,
          memoryType: MemoryType.HOT,
          agentName: "TestAgent",
          memoryKey: "last_case_pattern",
          memoryValue: { pattern: "contract_dispute", successRate: 0.95 },
          importance: 0.7,
          expiresAt: new Date(Date.now() + 604800000), // 7天后过期
        },
      });

      expect(memory).toBeDefined();
      expect(memory.memoryType).toBe(MemoryType.HOT);
    });

    it("应成功创建冷记忆", async () => {
      const memory = await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          memoryType: MemoryType.COLD,
          agentName: "TestAgent",
          memoryKey: "knowledge_law_article_123",
          memoryValue: { lawId: "123", summary: "合同法相关条款" },
          importance: 0.9,
        },
      });

      expect(memory).toBeDefined();
      expect(memory.memoryType).toBe(MemoryType.COLD);
      expect(memory.expiresAt).toBeNull(); // 冷记忆无过期时间
    });

    it("应拒绝创建重复的记忆键", async () => {
      const memoryData = {
        userId: testUserId,
        memoryType: MemoryType.WORKING,
        agentName: "TestAgent",
        memoryKey: "unique_key",
        memoryValue: { test: "data" },
      };

      await prisma.agentMemory.create({
        data: memoryData,
      });

      await expect(
        prisma.agentMemory.create({
          data: memoryData,
        }),
      ).rejects.toThrow();
    });
  });

  describe("记忆记录查询", () => {
    it("应按记忆类型查询", async () => {
      await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          memoryType: MemoryType.WORKING,
          agentName: "QueryAgent",
          memoryKey: "query_test_1",
          memoryValue: { type: "working" },
        },
      });

      const workingMemories = await prisma.agentMemory.findMany({
        where: {
          userId: testUserId,
          memoryType: MemoryType.WORKING,
        },
      });

      expect(workingMemories.length).toBeGreaterThan(0);
      expect(
        workingMemories.every((m) => m.memoryType === MemoryType.WORKING),
      ).toBe(true);
    });

    it("应按Agent名称查询", async () => {
      const agentMemories = await prisma.agentMemory.findMany({
        where: {
          userId: testUserId,
          agentName: "TestAgent",
        },
      });

      expect(agentMemories.length).toBeGreaterThan(0);
    });

    it("应按重要性排序查询", async () => {
      const memories = await prisma.agentMemory.findMany({
        where: {
          userId: testUserId,
        },
        orderBy: {
          importance: "desc",
        },
        take: 5,
      });

      expect(memories.length).toBe(5);
      for (let i = 0; i < memories.length - 1; i++) {
        expect(memories[i].importance).toBeGreaterThanOrEqual(
          memories[i + 1].importance,
        );
      }
    });

    it("应查询已过期的记忆", async () => {
      await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          memoryType: MemoryType.WORKING,
          agentName: "TestAgent",
          memoryKey: "expired_memory",
          memoryValue: { expired: true },
          expiresAt: new Date(Date.now() - 1000), // 已过期
        },
      });

      const now = new Date();
      const expiredMemories = await prisma.agentMemory.findMany({
        where: {
          userId: testUserId,
          expiresAt: { lt: now },
        },
      });

      expect(expiredMemories.length).toBeGreaterThan(0);
    });
  });

  describe("记忆记录更新", () => {
    it("应更新记忆访问计数", async () => {
      const memory = await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          memoryType: MemoryType.WORKING,
          agentName: "TestAgent",
          memoryKey: "access_count_test",
          memoryValue: { count: 0 },
        },
      });

      const updated = await prisma.agentMemory.update({
        where: { id: memory.id },
        data: {
          accessCount: memory.accessCount + 1,
          lastAccessedAt: new Date(),
        },
      });

      expect(updated.accessCount).toBe(memory.accessCount + 1);
      expect(updated.lastAccessedAt).toBeDefined();
    });

    it("应更新记忆值", async () => {
      const memory = await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          memoryType: MemoryType.WORKING,
          agentName: "TestAgent",
          memoryKey: "value_update_test",
          memoryValue: { old: "value" },
        },
      });

      const updated = await prisma.agentMemory.update({
        where: { id: memory.id },
        data: {
          memoryValue: { new: "value" },
        },
      });

      expect(updated.memoryValue).toEqual({ new: "value" });
    });

    it("应支持压缩标记", async () => {
      const memory = await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          memoryType: MemoryType.COLD,
          agentName: "TestAgent",
          memoryKey: "compressed_test",
          memoryValue: { large: "data".repeat(100) },
          compressed: false,
        },
      });

      const updated = await prisma.agentMemory.update({
        where: { id: memory.id },
        data: {
          compressed: true,
          compressionRatio: 0.5,
        },
      });

      expect(updated.compressed).toBe(true);
      expect(updated.compressionRatio).toBe(0.5);
    });
  });

  describe("记忆记录删除", () => {
    it("应删除过期记忆", async () => {
      const memory = await prisma.agentMemory.create({
        data: {
          userId: testUserId,
          memoryType: MemoryType.WORKING,
          agentName: "TestAgent",
          memoryKey: "delete_test",
          memoryValue: { delete: true },
          expiresAt: new Date(Date.now() - 1000),
        },
      });

      await prisma.agentMemory.delete({
        where: { id: memory.id },
      });

      const deleted = await prisma.agentMemory.findUnique({
        where: { id: memory.id },
      });

      expect(deleted).toBeNull();
    });

    it("应批量删除低重要性记忆", async () => {
      await prisma.agentMemory.createMany({
        data: [
          {
            userId: testUserId,
            memoryType: MemoryType.WORKING,
            agentName: "BatchDeleteAgent",
            memoryKey: "low_importance_1",
            memoryValue: { low: 1 },
            importance: 0.1,
          },
          {
            userId: testUserId,
            memoryType: MemoryType.WORKING,
            agentName: "BatchDeleteAgent",
            memoryKey: "low_importance_2",
            memoryValue: { low: 2 },
            importance: 0.2,
          },
        ],
      });

      const result = await prisma.agentMemory.deleteMany({
        where: {
          userId: testUserId,
          importance: { lt: 0.3 },
        },
      });

      expect(result.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe("关联查询", () => {
    it("应查询案件相关记忆", async () => {
      const memories = await prisma.agentMemory.findMany({
        where: {
          caseId: testCaseId,
        },
      });

      expect(memories.length).toBeGreaterThan(0);
    });

    it("应查询辩论相关记忆", async () => {
      const memories = await prisma.agentMemory.findMany({
        where: {
          debateId: testDebateId,
        },
      });

      expect(memories.length).toBeGreaterThan(0);
    });
  });
});
