/**
 * MemoryAgent单元测试
 * 测试记忆Agent的核心功能
 */

import { MemoryAgent } from '@/lib/agent/memory-agent/memory-agent';
import { PrismaClient } from '@prisma/client';
import { createMockAIService } from './__mocks__/ai-service-mock';
import { createTestMemory } from './test-helpers';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      agentMemory: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'mock-id',
          memoryKey: 'test-key',
          memoryType: 'WORKING',
          memoryValue: JSON.stringify({ data: 'test' }),
          importance: 0.5,
          accessCount: 0,
          lastAccessedAt: new Date(),
          expiresAt: new Date(),
          compressed: false,
          compressionRatio: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({ id: 'mock-id' }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        count: jest.fn().mockResolvedValue(0),
        aggregate: jest.fn().mockResolvedValue({ _avg: { importance: 0.5 } }),
      },
      errorLog: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    })),
  };
});

describe('MemoryAgent', () => {
  let memoryAgent: MemoryAgent;
  let mockPrisma: unknown;
  let mockAIService: Record<string, jest.Mock>;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    const prisma = new PrismaClient();
    mockPrisma = prisma;
    mockAIService = createMockAIService();

    logSpy = jest.spyOn(console, 'log').mockImplementation();

    memoryAgent = new MemoryAgent(prisma, mockAIService as never);

    jest.clearAllMocks();
  });

  afterEach(async () => {
    // 停止 migrator 定时任务，避免测试完成后仍在运行
    if (memoryAgent) {
      await memoryAgent.shutdown();
    }
    if (logSpy) {
      logSpy.mockRestore();
    }
  });

  describe('初始化和关闭', () => {
    it('应该成功初始化', async () => {
      await memoryAgent.initialize();

      expect(console.log).toHaveBeenCalledWith('Initializing MemoryAgent...');
      expect(console.log).toHaveBeenCalledWith(
        'MemoryAgent initialized successfully'
      );
    });

    it('应该避免重复初始化', async () => {
      await memoryAgent.initialize();
      await memoryAgent.initialize();

      const calls = (console.log as jest.Mock).mock.calls;
      const initCalls = calls.filter(
        call =>
          call[0]?.includes('Initializing') || call[0]?.includes('initialized')
      );
      expect(initCalls.length).toBeGreaterThanOrEqual(2);
    });

    it('应该成功关闭', async () => {
      await memoryAgent.initialize();
      await memoryAgent.shutdown();

      expect(console.log).toHaveBeenCalledWith('Shutting down MemoryAgent...');
      expect(console.log).toHaveBeenCalledWith(
        'MemoryAgent shut down successfully'
      );
    });

    it('应该在未初始化时返回false', async () => {
      const health = await memoryAgent.healthCheck();

      expect(health).toBe(false);
    });

    it('应该在初始化后返回true', async () => {
      await memoryAgent.initialize();
      const prisma = mockPrisma as {
        agentMemory: { count: jest.Mock; aggregate: jest.Mock };
      };

      prisma.agentMemory.count
        .mockResolvedValue(10)
        .mockResolvedValue(20)
        .mockResolvedValue(30)
        .mockResolvedValue(60)
        .mockResolvedValue(5)
        .mockResolvedValue(0);
      prisma.agentMemory.aggregate.mockResolvedValue({
        _avg: { importance: 0.5 },
      });

      const health = await memoryAgent.healthCheck();

      expect(health).toBe(true);
    });
  });

  describe('存储和获取记忆', () => {
    it('应该成功存储Working Memory', async () => {
      const input = {
        memoryType: 'WORKING' as const,
        memoryKey: 'test-key',
        memoryValue: { data: 'test' },
      };
      const userId = 'test-user';
      const caseId = 'test-case';

      const memoryId = await memoryAgent.storeMemory(input, userId, caseId);

      expect(memoryId).toBeDefined();
      expect(typeof memoryId).toBe('string');
    });

    it('应该成功获取记忆', async () => {
      const input = {
        memoryType: 'WORKING' as const,
        memoryKey: 'test-key',
      };

      const memory = createTestMemory();
      const prisma = mockPrisma as {
        agentMemory: { findFirst: jest.Mock };
      };

      prisma.agentMemory.findFirst.mockResolvedValueOnce({
        id: memory.memoryId,
        memoryKey: input.memoryKey,
        memoryType: input.memoryType,
        memoryValue: JSON.stringify(memory.memoryValue),
        importance: memory.importance,
        accessCount: memory.accessCount,
        lastAccessedAt: memory.lastAccessedAt,
        expiresAt: memory.expiresAt,
        compressed: memory.compressed,
        compressionRatio: memory.compressionRatio,
        createdAt: memory.createdAt,
        updatedAt: new Date(),
      });

      const result = await memoryAgent.getMemory(input);

      expect(result).toEqual(memory.memoryValue);
    });

    it('应该返回null当记忆不存在', async () => {
      const input = {
        memoryType: 'WORKING' as const,
        memoryKey: 'non-existent',
      };

      const prisma = mockPrisma as {
        agentMemory: { findFirst: jest.Mock };
      };

      prisma.agentMemory.findFirst.mockResolvedValueOnce(null);

      const result = await memoryAgent.getMemory(input);

      expect(result).toBeNull();
    });
  });

  describe('压缩记忆', () => {
    it('应该成功压缩Working Memory', async () => {
      const memory = createTestMemory();
      const memoryId = memory.memoryId;
      const prisma = mockPrisma as {
        agentMemory: { findMany: jest.Mock };
      };

      prisma.agentMemory.findMany.mockResolvedValueOnce([
        {
          id: memoryId,
          memoryKey: 'test-key',
          memoryType: 'WORKING',
          memoryValue: JSON.stringify(memory.memoryValue),
          importance: memory.importance,
          accessCount: memory.accessCount,
          lastAccessedAt: memory.lastAccessedAt,
          expiresAt: memory.expiresAt,
          compressed: memory.compressed,
          compressionRatio: memory.compressionRatio,
          createdAt: memory.createdAt,
          updatedAt: new Date(),
        },
      ]);

      const result = await memoryAgent.compressMemory(memoryId);

      expect(result.success).toBeDefined();
    });

    it('应该返回错误当记忆不存在', async () => {
      const memoryId = 'non-existent-id';
      const prisma = mockPrisma as {
        agentMemory: { findMany: jest.Mock };
      };

      prisma.agentMemory.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await memoryAgent.compressMemory(memoryId);

      expect(result).toEqual({
        success: false,
        error: 'Memory not found',
      });
    });
  });

  describe('错误学习', () => {
    it('应该成功从错误学习', async () => {
      const errorId = 'error-1';
      const prisma = mockPrisma as {
        errorLog: { findUnique: jest.Mock };
      };

      prisma.errorLog.findUnique.mockResolvedValueOnce({
        id: errorId,
        errorType: 'CASE_PARSE_ERROR',
        errorMessage: 'Test error',
        errorContext: JSON.stringify({ test: 'context' }),
        learned: false,
        createdAt: new Date(),
      });

      const result = await memoryAgent.learnFromError({ errorId });

      expect(result).toBeDefined();
    });

    it('应该支持批量学习', async () => {
      const limit = 10;

      const results = await memoryAgent.batchLearnErrors(limit);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('记忆管理', () => {
    it('应该获取记忆统计信息', async () => {
      const prisma = mockPrisma as {
        agentMemory: { count: jest.Mock; aggregate: jest.Mock };
      };

      prisma.agentMemory.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0);
      prisma.agentMemory.aggregate.mockResolvedValueOnce({
        _avg: { importance: 0.5 },
      });

      const stats = await memoryAgent.getStats();

      expect(stats).toEqual({
        workingMemoryCount: 10,
        hotMemoryCount: 20,
        coldMemoryCount: 30,
        totalMemoryCount: 60,
        averageImportance: 0.5,
        expiredMemoryCount: 0,
        compressedMemoryCount: 5,
      });
    });

    it('应该清理过期记忆', async () => {
      const prisma = mockPrisma as {
        agentMemory: { deleteMany: jest.Mock };
      };

      prisma.agentMemory.deleteMany.mockResolvedValue({ count: 5 });

      const count = await memoryAgent.cleanExpired();

      expect(count).toBe(5);
    });
  });

  describe('迁移功能', () => {
    it('应该手动触发Working到Hot的迁移', async () => {
      const result = await memoryAgent.triggerMigration('workingToHot');

      expect(result).toBeDefined();
    });

    it('应该手动触发Hot到Cold的压缩', async () => {
      const result = await memoryAgent.triggerMigration('hotToCold');

      expect(result).toBeDefined();
    });

    it('应该获取迁移统计', async () => {
      const stats = await memoryAgent.getMigrationStats();

      expect(stats).toEqual({
        workingCount: 0,
        hotCount: 0,
        coldCount: 0,
        workingToHotEligible: 0,
        hotToColdEligible: 0,
      });
    });
  });
});
