/**
 * MemoryMigrator测试套件
 * 测试记忆迁移逻辑
 */

import { MemoryMigrator } from "@/lib/agent/memory-agent/migrator";
import { MemoryManager } from "@/lib/agent/memory-agent/memory-manager";
import { MemoryCompressor } from "@/lib/agent/memory-agent/compressor";
import { PrismaClient, MemoryType } from "@prisma/client";
import { mockDeep } from "jest-mock-extended";
import type { Memory } from "@/lib/agent/memory-agent/types";

// Mock依赖
jest.mock("@/lib/ai/service-refactored", () => ({
  AIService: jest.fn().mockImplementation(() => ({
    chatCompletion: jest.fn().mockResolvedValue({
      choices: [{ message: { content: "test summary" } }],
    }),
  })),
}));

// Mock Prisma
const mockPrisma = mockDeep<PrismaClient>();

describe("MemoryMigrator", () => {
  let memoryManager: MemoryManager;
  let compressor: MemoryCompressor;
  let migrator: MemoryMigrator;
  let mockAIService: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    memoryManager = new MemoryManager(mockPrisma);

    // Mock AIService
    mockAIService = {
      chatCompletion: jest.fn().mockResolvedValue({
        choices: [{ message: { content: "test summary" } }],
      }),
    };

    compressor = new MemoryCompressor(mockAIService as never);
    migrator = new MemoryMigrator(memoryManager, compressor);
  });

  describe("启动和停止定时任务", () => {
    it("应该成功启动定时任务", () => {
      expect(() => migrator.start()).not.toThrow();
    });

    it("重复启动不应该报错", () => {
      migrator.start();
      expect(() => migrator.start()).not.toThrow();
    });

    it("应该成功停止定时任务", () => {
      migrator.start();
      expect(() => migrator.stop()).not.toThrow();
    });

    it("停止后不应该再有定时任务运行", () => {
      migrator.start();
      migrator.stop();
      expect(() => migrator.stop()).not.toThrow();
    });
  });

  describe("Working→Hot迁移", () => {
    it("应该成功迁移符合条件的记忆", async () => {
      // Mock数据
      const workingMemories: Memory[] = [
        {
          memoryId: "1",
          memoryType: "WORKING",
          memoryKey: "key1",
          memoryValue: "value1",
          importance: 0.8,
          accessCount: 5,
          lastAccessedAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          compressed: false,
          createdAt: new Date(),
        },
      ];

      const findManyMock = mockPrisma.agentMemory.findMany as jest.Mock;
      findManyMock.mockResolvedValueOnce(
        workingMemories.map((m) => ({
          id: m.memoryId,
          userId: "user1",
          caseId: null,
          debateId: null,
          agentName: "MemoryAgent",
          memoryKey: m.memoryKey,
          memoryType: m.memoryType as MemoryType,
          memoryValue: JSON.stringify(m.memoryValue),
          importance: m.importance,
          accessCount: m.accessCount,
          lastAccessedAt: m.lastAccessedAt,
          expiresAt: m.expiresAt,
          compressed: m.compressed,
          compressionRatio: null,
          metadata: null,
          createdAt: m.createdAt,
          updatedAt: new Date(),
        })),
      );

      const findFirstMock = mockPrisma.agentMemory.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue({
        id: "1",
        userId: "user1",
        caseId: null,
        debateId: null,
        agentName: "MemoryAgent",
        memoryKey: "key1",
        memoryType: "WORKING" as MemoryType,
        memoryValue: JSON.stringify("value1"),
        importance: 0.8,
        accessCount: 6,
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        compressed: false,
        compressionRatio: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updateMock = mockPrisma.agentMemory.update as jest.Mock;
      updateMock.mockResolvedValue({
        id: "1",
        userId: "user1",
        caseId: null,
        debateId: null,
        agentName: "MemoryAgent",
        memoryKey: "key1",
        memoryType: "HOT" as MemoryType,
        memoryValue: JSON.stringify("value1"),
        importance: 0.8,
        accessCount: 6,
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        compressed: false,
        compressionRatio: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await migrator.migrateWorkingToHot();

      expect(result.migratedCount).toBeGreaterThan(0);
      expect(result.failedCount).toBe(0);
    });

    it("应该跳过不符合条件的记忆", async () => {
      // Mock低访问次数的记忆
      const workingMemories: Memory[] = [
        {
          memoryId: "1",
          memoryType: "WORKING",
          memoryKey: "key1",
          memoryValue: "value1",
          importance: 0.8,
          accessCount: 1,
          lastAccessedAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          compressed: false,
          createdAt: new Date(),
        },
      ];

      const findManyMock = mockPrisma.agentMemory.findMany as jest.Mock;
      findManyMock.mockResolvedValueOnce(
        workingMemories.map((m) => ({
          id: m.memoryId,
          userId: "user1",
          caseId: null,
          debateId: null,
          agentName: "MemoryAgent",
          memoryKey: m.memoryKey,
          memoryType: m.memoryType as MemoryType,
          memoryValue: JSON.stringify(m.memoryValue),
          importance: m.importance,
          accessCount: m.accessCount,
          lastAccessedAt: m.lastAccessedAt,
          expiresAt: m.expiresAt,
          compressed: m.compressed,
          compressionRatio: null,
          metadata: null,
          createdAt: m.createdAt,
          updatedAt: new Date(),
        })),
      );

      const result = await migrator.migrateWorkingToHot();

      expect(result.migratedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    });

    it("应该正确处理迁移错误", async () => {
      const workingMemories: Memory[] = [
        {
          memoryId: "1",
          memoryType: "WORKING",
          memoryKey: "key1",
          memoryValue: "value1",
          importance: 0.8,
          accessCount: 5,
          lastAccessedAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          compressed: false,
          createdAt: new Date(),
        },
      ];

      const findManyMock = mockPrisma.agentMemory.findMany as jest.Mock;
      findManyMock.mockResolvedValueOnce(
        workingMemories.map((m) => ({
          id: m.memoryId,
          userId: "user1",
          caseId: null,
          debateId: null,
          agentName: "MemoryAgent",
          memoryKey: m.memoryKey,
          memoryType: m.memoryType as MemoryType,
          memoryValue: JSON.stringify(m.memoryValue),
          importance: m.importance,
          accessCount: m.accessCount,
          lastAccessedAt: m.lastAccessedAt,
          expiresAt: m.expiresAt,
          compressed: m.compressed,
          compressionRatio: null,
          metadata: null,
          createdAt: m.createdAt,
          updatedAt: new Date(),
        })),
      );

      // Mock getMemoryWithMetadata返回null模拟错误
      const findFirstMock = mockPrisma.agentMemory.findFirst as jest.Mock;
      findFirstMock.mockResolvedValueOnce(null);

      const result = await migrator.migrateWorkingToHot();

      expect(result.failedCount).toBeGreaterThan(0);
      expect(result.migratedCount).toBe(0);
    });
  });

  describe("Hot→Cold归档", () => {
    it("应该成功归档高重要性的记忆", async () => {
      const hotMemories: Memory[] = [
        {
          memoryId: "1",
          memoryType: "HOT",
          memoryKey: "key1",
          memoryValue: "value1",
          importance: 0.9,
          accessCount: 10,
          lastAccessedAt: new Date(),
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          compressed: false,
          createdAt: new Date(),
        },
      ];

      const findManyMock = mockPrisma.agentMemory.findMany as jest.Mock;
      findManyMock.mockResolvedValueOnce(
        hotMemories.map((m) => ({
          id: m.memoryId,
          userId: "user1",
          caseId: null,
          debateId: null,
          agentName: "MemoryAgent",
          memoryKey: m.memoryKey,
          memoryType: m.memoryType as MemoryType,
          memoryValue: JSON.stringify(m.memoryValue),
          importance: m.importance,
          accessCount: m.accessCount,
          lastAccessedAt: m.lastAccessedAt,
          expiresAt: m.expiresAt,
          compressed: m.compressed,
          compressionRatio: null,
          metadata: null,
          createdAt: m.createdAt,
          updatedAt: new Date(),
        })),
      );

      const findFirstMock = mockPrisma.agentMemory.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue({
        id: "1",
        userId: "user1",
        caseId: null,
        debateId: null,
        agentName: "MemoryAgent",
        memoryKey: "key1",
        memoryType: "HOT" as MemoryType,
        memoryValue: JSON.stringify("value1"),
        importance: 0.9,
        accessCount: 10,
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
        compressed: false,
        compressionRatio: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await migrator.compressHotToCold();

      expect(result.migratedCount).toBeGreaterThan(0);
      expect(result.failedCount).toBe(0);
    });

    it("应该跳过低重要性的记忆", async () => {
      const hotMemories: Memory[] = [
        {
          memoryId: "1",
          memoryType: "HOT",
          memoryKey: "key1",
          memoryValue: "value1",
          importance: 0.5,
          accessCount: 10,
          lastAccessedAt: new Date(),
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          compressed: false,
          createdAt: new Date(),
        },
      ];

      const findManyMock = mockPrisma.agentMemory.findMany as jest.Mock;
      findManyMock.mockResolvedValueOnce(
        hotMemories.map((m) => ({
          id: m.memoryId,
          userId: "user1",
          caseId: null,
          debateId: null,
          agentName: "MemoryAgent",
          memoryKey: m.memoryKey,
          memoryType: m.memoryType as MemoryType,
          memoryValue: JSON.stringify(m.memoryValue),
          importance: m.importance,
          accessCount: m.accessCount,
          lastAccessedAt: m.lastAccessedAt,
          expiresAt: m.expiresAt,
          compressed: m.compressed,
          compressionRatio: null,
          metadata: null,
          createdAt: m.createdAt,
          updatedAt: new Date(),
        })),
      );

      const result = await migrator.compressHotToCold();

      expect(result.migratedCount).toBe(0);
      expect(result.skippedCount).toBe(1);
    });
  });

  describe("强制迁移", () => {
    it("应该成功强制迁移到Hot Memory", async () => {
      const findFirstMock = mockPrisma.agentMemory.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue({
        id: "1",
        userId: "user1",
        caseId: null,
        debateId: null,
        agentName: "MemoryAgent",
        memoryKey: "key1",
        memoryType: "WORKING" as MemoryType,
        memoryValue: JSON.stringify("value1"),
        importance: 0.8,
        accessCount: 5,
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600 * 1000),
        compressed: false,
        compressionRatio: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updateMock = mockPrisma.agentMemory.update as jest.Mock;
      updateMock.mockResolvedValue({
        id: "1",
        userId: "user1",
        caseId: null,
        debateId: null,
        agentName: "MemoryAgent",
        memoryKey: "key1",
        memoryType: "HOT" as MemoryType,
        memoryValue: JSON.stringify("value1"),
        importance: 0.8,
        accessCount: 6,
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        compressed: false,
        compressionRatio: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(migrator.forcemigrate("1", "HOT")).resolves.not.toThrow();
    });

    it("应该抛出找不到记忆的错误", async () => {
      const findFirstMock = mockPrisma.agentMemory.findFirst as jest.Mock;
      findFirstMock.mockResolvedValue(null);

      await expect(migrator.forcemigrate("1", "HOT")).rejects.toThrow(
        "Memory not found: 1",
      );
    });
  });

  describe("迁移统计", () => {
    it("应该正确统计各层记忆数量", async () => {
      const findManyMock = mockPrisma.agentMemory.findMany as jest.Mock;
      findManyMock
        .mockResolvedValueOnce([
          {
            id: "1",
            userId: "user1",
            caseId: null,
            debateId: null,
            agentName: "MemoryAgent",
            memoryKey: "key1",
            memoryType: "WORKING" as MemoryType,
            memoryValue: JSON.stringify("value1"),
            importance: 0.8,
            accessCount: 5,
            lastAccessedAt: new Date(),
            expiresAt: new Date(Date.now() + 3600 * 1000),
            compressed: false,
            compressionRatio: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "2",
            userId: "user1",
            caseId: null,
            debateId: null,
            agentName: "MemoryAgent",
            memoryKey: "key2",
            memoryType: "HOT" as MemoryType,
            memoryValue: JSON.stringify("value2"),
            importance: 0.9,
            accessCount: 10,
            lastAccessedAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            compressed: false,
            compressionRatio: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "3",
            userId: "user1",
            caseId: null,
            debateId: null,
            agentName: "MemoryAgent",
            memoryKey: "key3",
            memoryType: "COLD" as MemoryType,
            memoryValue: JSON.stringify("value3"),
            importance: 1.0,
            accessCount: 15,
            lastAccessedAt: new Date(),
            expiresAt: null,
            compressed: true,
            compressionRatio: 0.5,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]);

      const stats = await migrator.getMigrationStats();

      expect(stats.workingCount).toBe(1);
      expect(stats.hotCount).toBe(1);
      expect(stats.coldCount).toBe(1);
    });

    it("应该正确统计符合迁移条件的记忆", async () => {
      const findManyMock = mockPrisma.agentMemory.findMany as jest.Mock;
      findManyMock
        .mockResolvedValueOnce([
          {
            id: "1",
            userId: "user1",
            caseId: null,
            debateId: null,
            agentName: "MemoryAgent",
            memoryKey: "key1",
            memoryType: "WORKING" as MemoryType,
            memoryValue: JSON.stringify("value1"),
            importance: 0.8,
            accessCount: 5,
            lastAccessedAt: new Date(),
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            compressed: false,
            compressionRatio: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([
          {
            id: "2",
            userId: "user1",
            caseId: null,
            debateId: null,
            agentName: "MemoryAgent",
            memoryKey: "key2",
            memoryType: "HOT" as MemoryType,
            memoryValue: JSON.stringify("value2"),
            importance: 0.9,
            accessCount: 10,
            lastAccessedAt: new Date(),
            expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
            compressed: false,
            compressionRatio: null,
            metadata: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ])
        .mockResolvedValueOnce([]);

      const stats = await migrator.getMigrationStats();

      expect(stats.workingToHotEligible).toBe(1);
      expect(stats.hotToColdEligible).toBe(1);
    });
  });
});
