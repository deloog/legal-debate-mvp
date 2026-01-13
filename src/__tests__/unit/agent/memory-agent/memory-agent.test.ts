/**
 * MemoryAgent测试套件
 * 测试MemoryAgent的所有公共方法
 */

import { MemoryAgent } from '@/lib/agent/memory-agent/memory-agent';
import { MemoryManager } from '@/lib/agent/memory-agent/memory-manager';
import {
  PrismaClient,
  MemoryType,
  AgentMemory,
  ErrorType,
  ErrorSeverity,
} from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

// Mock uuid模块（因为error-learner.ts使用了uuid）
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid-v4'),
}));

// Mock AIService
const mockChatCompletion = jest.fn().mockResolvedValue({
  choices: [{ message: { content: 'test response' } }],
});

jest.mock('@/lib/ai/service-refactored', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      chatCompletion: mockChatCompletion,
    })),
  };
});

// Mock Prisma
const mockPrisma = mockDeep<PrismaClient>();

describe('MemoryAgent', () => {
  let memoryAgent: MemoryAgent;
  let mockAIService: { chatCompletion: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建AIService mock实例
    mockAIService = {
      chatCompletion: mockChatCompletion,
    };

    memoryAgent = new MemoryAgent(mockPrisma, mockAIService as never);
  });

  describe('初始化和关闭', () => {
    it('应该成功初始化', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await memoryAgent.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('Initializing MemoryAgent...');
      expect(consoleSpy).toHaveBeenCalledWith(
        'MemoryAgent initialized successfully'
      );

      consoleSpy.mockRestore();
    });

    it('重复初始化不应该报错', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await memoryAgent.initialize();
      await memoryAgent.initialize(); // 第二次初始化

      // 初始化会触发MemoryMigrator的启动，所以会有额外日志
      // 只需要确保没有报错
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('应该成功关闭', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await memoryAgent.initialize();
      await memoryAgent.shutdown();

      expect(consoleSpy).toHaveBeenCalledWith('Shutting down MemoryAgent...');
      expect(consoleSpy).toHaveBeenCalledWith(
        'MemoryAgent shut down successfully'
      );

      consoleSpy.mockRestore();
    });

    it('未初始化时关闭不应该报错', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await memoryAgent.shutdown();

      expect(consoleSpy).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('存储记忆', () => {
    it('应该成功存储Working Memory', async () => {
      const memoryData: Partial<AgentMemory> = {
        id: 'test-id-1',
        agentName: 'MemoryAgent',
        memoryType: 'WORKING' as MemoryType,
        memoryKey: 'test-key',
        memoryValue: JSON.stringify({ test: 'data' }),
        importance: 0.5,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      (mockPrisma.agentMemory.create as jest.Mock).mockResolvedValue(
        memoryData
      );

      const result = await memoryAgent.storeMemory(
        {
          memoryType: 'WORKING',
          memoryKey: 'test-key',
          memoryValue: { test: 'data' },
          importance: 5,
        },
        'user-123',
        'case-456',
        'debate-789'
      );

      expect(result).toBe('test-id-1');
    });

    it('应该成功存储Hot Memory', async () => {
      const memoryData: Partial<AgentMemory> = {
        id: 'test-id-2',
        agentName: 'MemoryAgent',
        memoryType: 'HOT' as MemoryType,
        memoryKey: 'hot-key',
        memoryValue: JSON.stringify({ hot: 'data' }),
        importance: 0.8,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 604800000),
      };

      (mockPrisma.agentMemory.create as jest.Mock).mockResolvedValue(
        memoryData
      );

      const result = await memoryAgent.storeMemory(
        {
          memoryType: 'HOT',
          memoryKey: 'hot-key',
          memoryValue: { hot: 'data' },
          importance: 8,
        },
        'user-123',
        'case-456'
      );

      expect(result).toBe('test-id-2');
    });

    it('应该成功存储Cold Memory', async () => {
      const memoryData: Partial<AgentMemory> = {
        id: 'test-id-3',
        agentName: 'MemoryAgent',
        memoryType: 'COLD' as MemoryType,
        memoryKey: 'cold-key',
        memoryValue: JSON.stringify({ cold: 'data' }),
        importance: 1.0,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      };

      (mockPrisma.agentMemory.create as jest.Mock).mockResolvedValue(
        memoryData
      );

      const result = await memoryAgent.storeMemory(
        {
          memoryType: 'COLD',
          memoryKey: 'cold-key',
          memoryValue: { cold: 'data' },
          importance: 10,
        },
        'user-123'
      );

      expect(result).toBe('test-id-3');
    });

    it('应该处理存储失败', async () => {
      (mockPrisma.agentMemory.create as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        memoryAgent.storeMemory(
          {
            memoryType: 'WORKING',
            memoryKey: 'test-key',
            memoryValue: { test: 'data' },
            importance: 5,
          },
          'user-123'
        )
      ).rejects.toThrow('Database error');
    });
  });

  describe('获取记忆', () => {
    it('应该成功获取存在的记忆', async () => {
      const memoryData: Partial<AgentMemory> = {
        id: 'test-id-1',
        agentName: 'MemoryAgent',
        memoryKey: 'test-key-1',
        memoryValue: JSON.stringify({ test: 'data' }),
        memoryType: 'WORKING' as MemoryType,
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
      };

      (mockPrisma.agentMemory.findFirst as jest.Mock).mockResolvedValue(
        memoryData
      );

      const result = await memoryAgent.getMemory({
        memoryType: 'WORKING',
        memoryKey: 'test-key-1',
      });

      expect(result).toEqual({ test: 'data' });
    });

    it('应该返回null对于不存在的记忆', async () => {
      (mockPrisma.agentMemory.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await memoryAgent.getMemory({
        memoryType: 'WORKING',
        memoryKey: 'non-existent',
      });

      expect(result).toBeNull();
    });

    it('应该处理获取失败', async () => {
      (mockPrisma.agentMemory.findFirst as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(
        memoryAgent.getMemory({
          memoryType: 'WORKING',
          memoryKey: 'test-key',
        })
      ).rejects.toThrow('Database error');
    });
  });

  describe('从错误学习', () => {
    it('应该成功从错误学习', async () => {
      const errorData = {
        id: 'error-1',
        userId: null,
        caseId: null,
        errorType: 'AI_SERVICE_ERROR' as ErrorType,
        errorCode: 'AI_001',
        errorMessage: 'Test error',
        stackTrace: null,
        context: {},
        attemptedAction: {},
        recoveryAttempts: 0,
        recovered: false,
        recoveryMethod: null,
        recoveryTime: null,
        learned: false,
        learningNotes: null,
        severity: 'MEDIUM' as ErrorSeverity,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.errorLog.findUnique as jest.Mock).mockResolvedValue(
        errorData
      );
      (mockPrisma.errorLog.findMany as jest.Mock).mockResolvedValue([
        errorData,
      ]);
      (mockPrisma.errorLog.update as jest.Mock).mockResolvedValue(errorData);
      (mockAIService.chatCompletion as jest.Mock).mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rootCause: '根本原因',
                prevention: ['预防措施1'],
              }),
            },
          },
        ],
      });

      const result = await memoryAgent.learnFromError({
        errorId: 'error-1',
      });

      expect(result.learningId).toBeDefined();
    });

    it('应该处理找不到错误', async () => {
      (mockPrisma.errorLog.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        memoryAgent.learnFromError({
          errorId: 'non-existent',
        })
      ).rejects.toThrow();
    });

    it('应该处理学习失败', async () => {
      const errorData = {
        id: 'error-1',
        errorMessage: 'Test error',
      };

      (mockPrisma.errorLog.findUnique as jest.Mock).mockResolvedValue(
        errorData as never
      );
      (mockAIService.chatCompletion as jest.Mock).mockRejectedValue(
        new Error('AI service error')
      );

      await expect(
        memoryAgent.learnFromError({
          errorId: 'error-1',
        })
      ).rejects.toThrow();
    });
  });

  describe('获取统计信息', () => {
    it('应该成功获取统计信息', async () => {
      const countMock = mockPrisma.agentMemory.count as jest.Mock;
      const aggregateMock = mockPrisma.agentMemory.aggregate as jest.Mock;
      countMock
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5);
      aggregateMock.mockResolvedValue({ _avg: { importance: 0.7 } });

      const result = await memoryAgent.getStats();

      expect(result.totalMemoryCount).toBe(60);
      expect(result.workingMemoryCount).toBe(10);
      expect(result.hotMemoryCount).toBe(20);
      expect(result.coldMemoryCount).toBe(30);
    });

    it('应该处理空统计信息', async () => {
      const countMock = mockPrisma.agentMemory.count as jest.Mock;
      const aggregateMock = mockPrisma.agentMemory.aggregate as jest.Mock;
      countMock.mockResolvedValue(0);
      aggregateMock.mockResolvedValue({ _avg: { importance: 0 } });

      const result = await memoryAgent.getStats();

      expect(result.totalMemoryCount).toBe(0);
      expect(result.workingMemoryCount).toBe(0);
      expect(result.hotMemoryCount).toBe(0);
      expect(result.coldMemoryCount).toBe(0);
    });

    it('应该处理统计信息获取失败', async () => {
      (mockPrisma.agentMemory.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(memoryAgent.getStats()).rejects.toThrow('Database error');
    });
  });

  describe('清理过期记忆', () => {
    it('应该成功清理过期记忆', async () => {
      (mockPrisma.agentMemory.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await memoryAgent.cleanExpired();

      expect(result).toBe(5);
    });

    it('应该处理没有过期记忆的情况', async () => {
      (mockPrisma.agentMemory.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const result = await memoryAgent.cleanExpired();

      expect(result).toBe(0);
    });

    it('应该处理清理失败', async () => {
      (mockPrisma.agentMemory.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(memoryAgent.cleanExpired()).rejects.toThrow(
        'Database error'
      );
    });
  });

  describe('压缩记忆', () => {
    it('应该成功压缩记忆', async () => {
      // Mock memoryManager返回记忆

      const memoryManagerMock = (memoryAgent as any)
        .memoryManager as MemoryManager;
      const getMemoriesSpy = jest
        .spyOn(memoryManagerMock, 'getMemoriesByType')
        .mockResolvedValue([
          {
            memoryId: 'mem-1',
            memoryType: 'WORKING',
            memoryKey: 'working-key',
            memoryValue: { data: 'working' },
            importance: 0.8,
            accessCount: 5,
            lastAccessedAt: new Date(),
            createdAt: new Date(),
            compressed: false,
          },
        ]);

      // Mock compressor返回成功结果

      const compressorMock = (memoryAgent as any).compressor;
      const compressSpy = jest

        .spyOn(compressorMock as any, 'compressMemory')
        .mockResolvedValue({
          success: true,
          summary: 'Test summary',
          keyInfo: [{ field: 'test', value: 'value', importance: 0.9 }],
          ratio: 0.5,
        });

      const result = await memoryAgent.compressMemory('mem-1');

      expect(result.success).toBe(true);
      expect(result.summary).toBe('Test summary');

      getMemoriesSpy.mockRestore();
      compressSpy.mockRestore();
    });

    it('应该处理找不到记忆的情况', async () => {
      const memoryManagerMock = (memoryAgent as any)
        .memoryManager as MemoryManager;
      const getMemoriesSpy = jest
        .spyOn(memoryManagerMock, 'getMemoriesByType')
        .mockResolvedValue([]);

      const result = await memoryAgent.compressMemory('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Memory not found');

      getMemoriesSpy.mockRestore();
    });
  });

  describe('触发迁移', () => {
    it('应该成功触发Working到Hot的迁移', async () => {
      const migratorMock = (memoryAgent as any).migrator;
      const migrateSpy = jest

        .spyOn(migratorMock as any, 'migrateWorkingToHot')
        .mockResolvedValue({
          migratedCount: 5,
          skippedCount: 0,
          failedCount: 0,
          executionTime: 100,
        });

      const result = await memoryAgent.triggerMigration('workingToHot');

      expect(result.migratedCount).toBe(5);
      expect(result.failedCount).toBe(0);

      migrateSpy.mockRestore();
    });

    it('应该成功触发Hot到Cold的迁移', async () => {
      const migratorMock = (memoryAgent as any).migrator;
      const compressSpy = jest

        .spyOn(migratorMock as any, 'compressHotToCold')
        .mockResolvedValue({
          migratedCount: 3,
          skippedCount: 0,
          failedCount: 0,
          executionTime: 50,
        });

      const result = await memoryAgent.triggerMigration('hotToCold');

      expect(result.migratedCount).toBe(3);
      expect(result.failedCount).toBe(0);

      compressSpy.mockRestore();
    });
  });

  describe('迁移统计', () => {
    it('应该成功获取迁移统计', async () => {
      const stats = {
        workingCount: 10,
        hotCount: 20,
        coldCount: 30,
        workingToHotEligible: 5,
        hotToColdEligible: 8,
      };

      const migratorMock = (memoryAgent as any).migrator;
      const getStatsSpy = jest

        .spyOn(migratorMock as any, 'getMigrationStats')
        .mockResolvedValue(stats);

      const result = await memoryAgent.getMigrationStats();

      expect(result.workingCount).toBe(10);
      expect(result.hotCount).toBe(20);
      expect(result.coldCount).toBe(30);
      expect(result.workingToHotEligible).toBe(5);
      expect(result.hotToColdEligible).toBe(8);

      getStatsSpy.mockRestore();
    });
  });

  describe('批量学习错误', () => {
    it('应该成功批量学习错误', async () => {
      const errorLearnerMock = (memoryAgent as any).errorLearner;
      const batchLearnSpy = jest

        .spyOn(errorLearnerMock as any, 'batchLearn')
        .mockResolvedValue([
          { learningId: 'l1', errorId: 'e1', learnedAt: new Date() },
          { learningId: 'l2', errorId: 'e2', learnedAt: new Date() },
        ]);

      const results = await memoryAgent.batchLearnErrors(10);

      expect(results).toHaveLength(2);

      batchLearnSpy.mockRestore();
    });

    it('应该使用默认限制数量', async () => {
      const errorLearnerMock = (memoryAgent as any).errorLearner;
      const batchLearnSpy = jest

        .spyOn(errorLearnerMock as any, 'batchLearn')
        .mockResolvedValue([]);

      await memoryAgent.batchLearnErrors();

      expect(batchLearnSpy).toHaveBeenCalledWith(50);

      batchLearnSpy.mockRestore();
    });
  });

  describe('健康检查', () => {
    it('初始化后应该返回true', async () => {
      await memoryAgent.initialize();

      const countMock = mockPrisma.agentMemory.count as jest.Mock;
      const aggregateMock = mockPrisma.agentMemory.aggregate as jest.Mock;
      countMock.mockResolvedValue(0);
      aggregateMock.mockResolvedValue({ _avg: { importance: 0 } });

      const result = await memoryAgent.healthCheck();

      expect(result).toBe(true);
    });

    it('未初始化时应该返回false', async () => {
      const result = await memoryAgent.healthCheck();

      expect(result).toBe(false);
    });

    it('获取统计信息出错时应该返回false', async () => {
      await memoryAgent.initialize();

      (mockPrisma.agentMemory.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await memoryAgent.healthCheck();

      expect(result).toBe(false);
    });
  });
});
