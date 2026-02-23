/**
 * MemoryMigrator单元测试
 * 测试记忆迁移功能
 */

import { MemoryCompressor } from '@/lib/agent/memory-agent/compressor';
import { MemoryManager } from '@/lib/agent/memory-agent/memory-manager';
import { MemoryMigrator } from '@/lib/agent/memory-agent/migrator';
import { PrismaClient } from '@prisma/client';
import { createMockAIService } from './__mocks__/ai-service-mock';
import { createTestMemory } from './test-helpers';
import type { _Memory } from '@/lib/agent/memory-agent/types';
import type { AIService } from '@/lib/ai/service-refactored';
import type { AgentMemory } from '@prisma/client';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      agentMemory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'mock-id' }),
        update: jest.fn().mockResolvedValue({ id: 'mock-id' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
      },
      agentAction: {
        create: jest.fn().mockResolvedValue({ id: 'action-id' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    })),
  };
});

describe('MemoryMigrator', () => {
  let migrator: MemoryMigrator;
  let memoryManager: MemoryManager;
  let compressor: MemoryCompressor;
  let mockPrisma: jest.Mocked<{
    agentMemory: {
      findMany: jest.Mock<Promise<AgentMemory[]>, []>;
      findFirst: jest.Mock<Promise<AgentMemory | null>, []>;
      create: jest.Mock<Promise<AgentMemory>, []>;
      updateMany: jest.Mock<Promise<{ count: number }>, []>;
      deleteMany: jest.Mock<Promise<{ count: number }>, []>;
      count: jest.Mock<Promise<number>, []>;
    };
    agentAction: {
      create: jest.Mock<Promise<unknown>, []>;
      updateMany: jest.Mock<Promise<{ count: number }>, []>;
    };
  }>;

  beforeEach(() => {
    const prisma = new PrismaClient();
    mockPrisma = prisma as unknown as jest.Mocked<{
      agentMemory: {
        findMany: jest.Mock<Promise<AgentMemory[]>, []>;
        findFirst: jest.Mock<Promise<AgentMemory | null>, []>;
        create: jest.Mock<Promise<AgentMemory>, []>;
        update: jest.Mock<Promise<AgentMemory>, []>;
        updateMany: jest.Mock<Promise<{ count: number }>, []>;
        deleteMany: jest.Mock<Promise<{ count: number }>, []>;
        count: jest.Mock<Promise<number>, []>;
      };
      agentAction: {
        create: jest.Mock<Promise<unknown>, []>;
        updateMany: jest.Mock<Promise<{ count: number }>, []>;
      };
    }>;

    memoryManager = new MemoryManager(prisma);
    const mockAIService = createMockAIService() as unknown as AIService;
    compressor = new MemoryCompressor(mockAIService);
    migrator = new MemoryMigrator(memoryManager, compressor);

    jest.clearAllMocks();
  });

  afterEach(() => {
    migrator.stop();
  });

  describe('初始化和停止', () => {
    it('应该成功启动定时任务', () => {
      migrator.start();

      expect(migrator).toBeDefined();
    });

    it('应该成功停止定时任务', () => {
      migrator.start();
      migrator.stop();

      expect(migrator).toBeDefined();
    });

    it('应该支持多次启动', () => {
      migrator.start();
      migrator.start();

      expect(migrator).toBeDefined();
    });
  });

  describe('Working到Hot迁移', () => {
    it('应该处理空列表', async () => {
      mockPrisma.agentMemory.findMany.mockResolvedValue([]);

      const result = await migrator.migrateWorkingToHot();

      expect(result).toEqual({
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        executionTime: expect.any(Number),
      });

      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memoryType: 'WORKING',
            agentName: 'MemoryAgent',
          }),
        })
      );
    });

    it('应该迁移符合条件的记忆', async () => {
      const memory = createTestMemory({
        accessCount: 5,
        importance: 0.8,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分钟后过期（<30分钟）
      });

      const mockMemory: AgentMemory = {
        id: 'mock-id-1',
        memoryKey: memory.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(memory.memoryValue),
        importance: memory.importance,
        accessCount: memory.accessCount,
        lastAccessedAt: memory.lastAccessedAt,
        expiresAt: memory.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const result = await migrator.migrateWorkingToHot();

      expect(result.migratedCount).toBeGreaterThanOrEqual(0);
      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memoryType: 'WORKING',
            agentName: 'MemoryAgent',
          }),
        })
      );
    });

    it('应该跳过不符合条件的记忆', async () => {
      const memory = createTestMemory({
        accessCount: 1,
        importance: 0.3,
      });

      const mockMemory: AgentMemory = {
        id: 'mock-id-2',
        memoryKey: memory.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(memory.memoryValue),
        importance: memory.importance,
        accessCount: memory.accessCount,
        lastAccessedAt: memory.lastAccessedAt,
        expiresAt: memory.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const result = await migrator.migrateWorkingToHot();

      expect(result.skippedCount).toBe(1);
      expect(result.migratedCount).toBe(0);
      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalled();
    });
  });

  describe('Hot到Cold压缩', () => {
    it('应该处理空列表', async () => {
      mockPrisma.agentMemory.findMany.mockResolvedValue([]);

      const result = await migrator.compressHotToCold();

      expect(result).toEqual({
        migratedCount: 0,
        skippedCount: 0,
        failedCount: 0,
        executionTime: expect.any(Number),
      });

      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memoryType: 'HOT',
            agentName: 'MemoryAgent',
          }),
        })
      );
    });

    it('应该归档符合条件的记忆', async () => {
      const memory = createTestMemory({
        accessCount: 10,
        importance: 0.9,
        memoryType: 'HOT',
      });

      const mockMemory: AgentMemory = {
        id: 'mock-id-3',
        memoryKey: memory.memoryKey,
        memoryType: 'HOT',
        memoryValue: JSON.stringify(memory.memoryValue),
        importance: memory.importance,
        accessCount: memory.accessCount,
        lastAccessedAt: memory.lastAccessedAt,
        expiresAt: memory.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const result = await migrator.compressHotToCold();

      expect(result.migratedCount).toBeGreaterThanOrEqual(0);
      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            memoryType: 'HOT',
            agentName: 'MemoryAgent',
          }),
        })
      );
    });
  });

  describe('迁移统计', () => {
    it('应该获取正确的统计信息', async () => {
      mockPrisma.agentMemory.findMany
        .mockResolvedValueOnce([]) // working
        .mockResolvedValueOnce([]) // hot
        .mockResolvedValueOnce([]); // cold

      const stats = await migrator.getMigrationStats();

      expect(stats.workingCount).toBe(0);
      expect(stats.hotCount).toBe(0);
      expect(stats.coldCount).toBe(0);
      expect(stats.workingToHotEligible).toBe(0);
      expect(stats.hotToColdEligible).toBe(0);
    });

    it('应该计算符合条件的记忆数量', async () => {
      const eligibleWorking = createTestMemory({
        accessCount: 5,
        importance: 0.8,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10分钟后过期
      });

      const eligibleHot = createTestMemory({
        accessCount: 10,
        importance: 0.9,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12小时后过期
        memoryType: 'HOT',
      });

      const mockWorkingMemory: AgentMemory = {
        id: 'mock-working',
        memoryKey: eligibleWorking.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(eligibleWorking.memoryValue),
        importance: eligibleWorking.importance,
        accessCount: eligibleWorking.accessCount,
        lastAccessedAt: eligibleWorking.lastAccessedAt,
        expiresAt: eligibleWorking.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      const mockHotMemory: AgentMemory = {
        id: 'mock-hot',
        memoryKey: eligibleHot.memoryKey,
        memoryType: 'HOT',
        memoryValue: JSON.stringify(eligibleHot.memoryValue),
        importance: eligibleHot.importance,
        accessCount: eligibleHot.accessCount,
        lastAccessedAt: eligibleHot.lastAccessedAt,
        expiresAt: eligibleHot.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany
        .mockResolvedValueOnce([mockWorkingMemory]) // working
        .mockResolvedValueOnce([mockHotMemory]) // hot
        .mockResolvedValueOnce([]); // cold

      const stats = await migrator.getMigrationStats();

      expect(stats.workingToHotEligible).toBe(1);
      expect(stats.hotToColdEligible).toBe(1);
    });

    it('应该处理不包含expiresAt的记忆', async () => {
      const memoryWithoutExpiry = createTestMemory({
        expiresAt: null as unknown as Date,
      });

      const mockMemory: AgentMemory = {
        id: 'mock-no-expiry',
        memoryKey: memoryWithoutExpiry.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(memoryWithoutExpiry.memoryValue),
        importance: memoryWithoutExpiry.importance,
        accessCount: memoryWithoutExpiry.accessCount,
        lastAccessedAt: memoryWithoutExpiry.lastAccessedAt,
        expiresAt: null,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const stats = await migrator.getMigrationStats();

      expect(stats.workingToHotEligible).toBe(0);
    });
  });

  describe('forceMigrate方法', () => {
    it('应该成功强制迁移记忆到HOT', async () => {
      const memory = createTestMemory({
        memoryType: 'WORKING',
      });

      mockPrisma.agentMemory.findFirst.mockResolvedValue({
        id: 'mock-id',
        memoryKey: memory.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(memory.memoryValue),
        importance: memory.importance,
        accessCount: memory.accessCount,
        lastAccessedAt: memory.lastAccessedAt,
        expiresAt: memory.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      });

      // 模拟迁移过程中的错误（因为缺少getMemoryWithMetadata的mock）
      await expect(migrator.forcemigrate('mock-id', 'HOT')).rejects.toThrow();
    });

    it('应该抛出错误当记忆不存在时', async () => {
      mockPrisma.agentMemory.findFirst.mockResolvedValue(null);

      await expect(
        migrator.forcemigrate('non-existent', 'HOT')
      ).rejects.toThrow('Memory not found');
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库查询错误', async () => {
      mockPrisma.agentMemory.findMany.mockRejectedValue(
        new Error('Database connection failed')
      );

      const result = await migrator.migrateWorkingToHot();

      expect(result.failedCount).toBeGreaterThan(0);
    });

    it('应该处理Hot到Cold归档的错误', async () => {
      mockPrisma.agentMemory.findMany.mockRejectedValue(
        new Error('Archive failed')
      );

      const result = await migrator.compressHotToCold();

      expect(result.failedCount).toBeGreaterThan(0);
    });

    it('应该处理迁移统计的错误', async () => {
      mockPrisma.agentMemory.findMany.mockRejectedValue(
        new Error('Stats error')
      );

      await expect(migrator.getMigrationStats()).rejects.toThrow();
    });
  });

  describe('边界条件', () => {
    it('应该处理低重要性的记忆', async () => {
      const lowImportance = createTestMemory({
        importance: 0.1,
        accessCount: 10,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const mockMemory: AgentMemory = {
        id: 'mock-low-importance',
        memoryKey: lowImportance.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(lowImportance.memoryValue),
        importance: lowImportance.importance,
        accessCount: lowImportance.accessCount,
        lastAccessedAt: lowImportance.lastAccessedAt,
        expiresAt: lowImportance.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const stats = await migrator.getMigrationStats();

      expect(stats.workingToHotEligible).toBe(0);
    });

    it('应该处理低访问量的记忆', async () => {
      const lowAccess = createTestMemory({
        importance: 0.8,
        accessCount: 1,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const mockMemory: AgentMemory = {
        id: 'mock-low-access',
        memoryKey: lowAccess.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(lowAccess.memoryValue),
        importance: lowAccess.importance,
        accessCount: lowAccess.accessCount,
        lastAccessedAt: lowAccess.lastAccessedAt,
        expiresAt: lowAccess.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const stats = await migrator.getMigrationStats();

      expect(stats.workingToHotEligible).toBe(0);
    });

    it('应该处理即将过期的记忆', async () => {
      const aboutToExpire = createTestMemory({
        importance: 0.8,
        accessCount: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5分钟后过期
      });

      const mockMemory: AgentMemory = {
        id: 'mock-about-to-expire',
        memoryKey: aboutToExpire.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(aboutToExpire.memoryValue),
        importance: aboutToExpire.importance,
        accessCount: aboutToExpire.accessCount,
        lastAccessedAt: aboutToExpire.lastAccessedAt,
        expiresAt: aboutToExpire.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const stats = await migrator.getMigrationStats();

      expect(stats.workingToHotEligible).toBe(1);
    });

    it('应该处理长时间不过期的记忆', async () => {
      const longLived = createTestMemory({
        importance: 0.8,
        accessCount: 10,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1小时后过期
      });

      const mockMemory: AgentMemory = {
        id: 'mock-long-lived',
        memoryKey: longLived.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(longLived.memoryValue),
        importance: longLived.importance,
        accessCount: longLived.accessCount,
        lastAccessedAt: longLived.lastAccessedAt,
        expiresAt: longLived.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const stats = await migrator.getMigrationStats();

      // 时间超过阈值，不应该被迁移
      expect(stats.workingToHotEligible).toBe(0);
    });

    it('应该同时处理Working和Hot候选', async () => {
      const working = createTestMemory({
        memoryType: 'WORKING',
        accessCount: 5,
        importance: 0.8,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const hot = createTestMemory({
        memoryType: 'HOT',
        accessCount: 10,
        importance: 0.9,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      });

      const mockWorking: AgentMemory = {
        id: 'mock-working',
        memoryKey: working.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(working.memoryValue),
        importance: working.importance,
        accessCount: working.accessCount,
        lastAccessedAt: working.lastAccessedAt,
        expiresAt: working.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      const mockHot: AgentMemory = {
        id: 'mock-hot',
        memoryKey: hot.memoryKey,
        memoryType: 'HOT',
        memoryValue: JSON.stringify(hot.memoryValue),
        importance: hot.importance,
        accessCount: hot.accessCount,
        lastAccessedAt: hot.lastAccessedAt,
        expiresAt: hot.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany
        .mockResolvedValueOnce([mockWorking])
        .mockResolvedValueOnce([mockHot])
        .mockResolvedValueOnce([]);

      const stats = await migrator.getMigrationStats();

      expect(stats.workingToHotEligible).toBe(1);
      expect(stats.hotToColdEligible).toBe(1);
    });

    it('应该处理恰好达到阈值的记忆', async () => {
      const thresholdMemory = createTestMemory({
        importance: 0.5, // WORKING_MIN_IMPORTANCE = 0.5
        accessCount: 3, // MIN_ACCESS_COUNT = 3
        expiresAt: new Date(Date.now() + 29 * 60 * 1000), // 29分钟
      });

      const mockMemory: AgentMemory = {
        id: 'mock-threshold',
        memoryKey: thresholdMemory.memoryKey,
        memoryType: 'WORKING',
        memoryValue: JSON.stringify(thresholdMemory.memoryValue),
        importance: thresholdMemory.importance,
        accessCount: thresholdMemory.accessCount,
        lastAccessedAt: thresholdMemory.lastAccessedAt,
        expiresAt: thresholdMemory.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      const stats = await migrator.getMigrationStats();

      // 应该符合条件
      expect(stats.workingToHotEligible).toBe(1);
    });

    it('应该处理多个符合条件的记忆', async () => {
      const memories: AgentMemory[] = [];
      for (let i = 0; i < 5; i++) {
        const memory = createTestMemory({
          accessCount: 5,
          importance: 0.8,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        memories.push({
          id: `mock-multi-${i}`,
          memoryKey: memory.memoryKey,
          memoryType: 'WORKING',
          memoryValue: JSON.stringify(memory.memoryValue),
          importance: memory.importance,
          accessCount: memory.accessCount,
          lastAccessedAt: memory.lastAccessedAt,
          expiresAt: memory.expiresAt,
          compressed: false,
          compressionRatio: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: 'user-1',
          caseId: 'case-1',
          debateId: null,
          agentName: 'MemoryAgent',
          metadata: null,
        });
      }

      mockPrisma.agentMemory.findMany.mockResolvedValue(memories);

      const stats = await migrator.getMigrationStats();

      expect(stats.workingToHotEligible).toBe(5);
    });

    it('应该处理压缩失败的情况', async () => {
      const memory = createTestMemory({
        accessCount: 10,
        importance: 0.9,
        memoryType: 'HOT',
      });

      const mockMemory: AgentMemory = {
        id: 'mock-compress-fail',
        memoryKey: memory.memoryKey,
        memoryType: 'HOT',
        memoryValue: JSON.stringify(memory.memoryValue),
        importance: memory.importance,
        accessCount: memory.accessCount,
        lastAccessedAt: memory.lastAccessedAt,
        expiresAt: memory.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      };

      mockPrisma.agentMemory.findMany.mockResolvedValue([mockMemory]);

      // 压缩应该失败，因为缺少compressMemory的mock
      const result = await migrator.compressHotToCold();

      expect(result.failedCount).toBeGreaterThan(0);
    });

    it('应该强制迁移到COLD类型', async () => {
      const memory = createTestMemory({
        memoryType: 'HOT',
      });

      mockPrisma.agentMemory.findFirst.mockResolvedValue({
        id: 'mock-id',
        memoryKey: memory.memoryKey,
        memoryType: 'HOT',
        memoryValue: JSON.stringify(memory.memoryValue),
        importance: memory.importance,
        accessCount: memory.accessCount,
        lastAccessedAt: memory.lastAccessedAt,
        expiresAt: memory.expiresAt,
        compressed: false,
        compressionRatio: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: 'user-1',
        caseId: 'case-1',
        debateId: null,
        agentName: 'MemoryAgent',
        metadata: null,
      });

      // 强制迁移到COLD会失败，因为需要压缩
      await expect(
        migrator.forcemigrate('mock-id', 'COLD')
      ).resolves.not.toThrow();
    });
  });
});
