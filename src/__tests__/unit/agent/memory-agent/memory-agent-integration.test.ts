/**
 * MemoryAgent集成测试套件
 * 减少mock使用，让实际代码路径被执行以提升覆盖率
 */

import { MemoryAgent } from '@/lib/agent/memory-agent/memory-agent';
import {
  PrismaClient,
  MemoryType,
  ErrorType,
  ErrorSeverity,
} from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

// Mock uuid模块
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

// Mock AIService
const mockChatCompletion = jest.fn().mockResolvedValue({
  choices: [
    {
      message: {
        content: JSON.stringify({
          summary: '测试摘要',
          keyInfo: [{ field: 'field1', value: 'value1', importance: 0.9 }],
        }),
      },
    },
  ],
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

describe('MemoryAgent集成测试', () => {
  let memoryAgent: MemoryAgent;

  beforeEach(() => {
    jest.clearAllMocks();
    const aiService = {
      chatCompletion: mockChatCompletion,
    };
    memoryAgent = new MemoryAgent(mockPrisma, aiService as never);
  });

  afterEach(async () => {
    if (memoryAgent) {
      try {
        await memoryAgent.shutdown();
      } catch {
        // 忽略关闭错误
      }
    }
  });

  describe('compressMemory - 真实执行路径', () => {
    it('应该完整执行compressMemory代码路径（成功压缩）', async () => {
      const mockWorkingMemory = {
        id: 'mem-1',
        userId: 'user-1',
        caseId: null,
        debateId: null,
        agentName: 'MemoryAgent',
        memoryKey: 'test-key',
        memoryType: 'WORKING' as MemoryType,
        memoryValue: JSON.stringify({ data: 'test data' }),
        importance: 0.8,
        accessCount: 5,
        lastAccessedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        compressed: false,
        compressionRatio: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockUpdatedMemory = {
        ...mockWorkingMemory,
        compressed: true,
        compressionRatio: 0.5,
        memoryValue: JSON.stringify({ summary: '测试摘要' }),
      };

      (mockPrisma.agentMemory.findMany as jest.Mock).mockResolvedValue([
        mockWorkingMemory,
      ]);

      (mockPrisma.agentMemory.findFirst as jest.Mock).mockResolvedValue(
        mockWorkingMemory
      );

      (mockPrisma.agentMemory.update as jest.Mock).mockResolvedValue(
        mockUpdatedMemory
      );

      const result = await memoryAgent.compressMemory('mem-1');

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalled();
    });

    it('应该完整执行compressMemory代码路径（未找到记忆）', async () => {
      (mockPrisma.agentMemory.findMany as jest.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await memoryAgent.compressMemory('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Memory not found');
    });
  });

  describe('getMigrationStats - 真实执行路径', () => {
    it('应该完整执行getMigrationStats代码路径', async () => {
      const now = Date.now();
      const mockWorkingMemories = [
        {
          id: '1',
          memoryId: '1',
          userId: 'user-1',
          caseId: null,
          debateId: null,
          agentName: 'MemoryAgent',
          memoryKey: 'key1',
          memoryType: 'WORKING' as MemoryType,
          memoryValue: JSON.stringify('value1'),
          importance: 0.8,
          accessCount: 5,
          lastAccessedAt: new Date(),
          expiresAt: new Date(now + 15 * 60 * 1000), // 15分钟后过期
          compressed: false,
          compressionRatio: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockHotMemories = [
        {
          id: '2',
          memoryId: '2',
          userId: 'user-1',
          caseId: null,
          debateId: null,
          agentName: 'MemoryAgent',
          memoryKey: 'key2',
          memoryType: 'HOT' as MemoryType,
          memoryValue: JSON.stringify('value2'),
          importance: 0.9,
          accessCount: 10,
          lastAccessedAt: new Date(),
          expiresAt: new Date(now + 12 * 60 * 60 * 1000), // 12小时后过期
          compressed: false,
          compressionRatio: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const mockColdMemories = [
        {
          id: '3',
          memoryId: '3',
          userId: 'user-1',
          caseId: null,
          debateId: null,
          agentName: 'MemoryAgent',
          memoryKey: 'key3',
          memoryType: 'COLD' as MemoryType,
          memoryValue: JSON.stringify('value3'),
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
      ];

      (mockPrisma.agentMemory.findMany as jest.Mock)
        .mockResolvedValueOnce(mockWorkingMemories)
        .mockResolvedValueOnce(mockHotMemories)
        .mockResolvedValueOnce(mockColdMemories);

      const stats = await memoryAgent.getMigrationStats();

      expect(stats.workingCount).toBe(1);
      expect(stats.hotCount).toBe(1);
      expect(stats.coldCount).toBe(1);
      expect(stats.workingToHotEligible).toBe(1); // 15分钟内过期，访问5次，重要性0.8
      expect(stats.hotToColdEligible).toBe(1); // 12小时内过期，重要性0.9
      expect(mockPrisma.agentMemory.findMany).toHaveBeenCalledTimes(3); // migrator只调用3次
    });
  });

  describe('batchLearnErrors - 真实执行路径', () => {
    it('应该完整执行batchLearnErrors代码路径', async () => {
      const mockErrors = [
        {
          id: 'error-1',
          userId: null,
          caseId: null,
          errorType: 'AI_SERVICE_ERROR' as ErrorType,
          errorCode: 'AI_001',
          errorMessage: 'Test error 1',
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
        },
      ];

      (mockPrisma.errorLog.findMany as jest.Mock).mockResolvedValue(mockErrors);

      (mockPrisma.errorLog.findUnique as jest.Mock).mockResolvedValue(
        mockErrors[0]
      );

      const updatedError = {
        ...mockErrors[0],
        learned: true,
        learningNotes: '学习笔记',
      };
      (mockPrisma.errorLog.update as jest.Mock).mockResolvedValue(updatedError);

      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                pattern: {
                  patternId: 'pattern-1',
                  errorType: 'AI_SERVICE_ERROR',
                  frequency: 1,
                  commonCauses: ['原因1'],
                  rootCause: '根本原因',
                },
                prevention: [
                  {
                    measureId: 'measure-1',
                    description: '预防措施1',
                    priority: 1,
                    implementation: '实现方式1',
                    estimatedEffectiveness: 0.9,
                  },
                ],
              }),
            },
          },
        ],
      });

      ((mockPrisma as any).agentLearning.create as jest.Mock).mockResolvedValue(
        {
          id: 'learning-1',
          errorId: 'error-1',
          patternId: 'pattern-1',
          learnedAt: new Date(),
        }
      );

      (
        (mockPrisma as any).preventionMeasure.createMany as jest.Mock
      ).mockResolvedValue({
        count: 1,
      });

      const results = await memoryAgent.batchLearnErrors(10);

      expect(results).toHaveLength(1);
      expect(results[0].errorId).toBe('error-1');
      expect(mockPrisma.errorLog.findMany).toHaveBeenCalledWith({
        where: { learned: false },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });
    });

    it('应该使用默认限制数量', async () => {
      (mockPrisma.errorLog.findMany as jest.Mock).mockResolvedValue([]);

      await memoryAgent.batchLearnErrors();

      expect(mockPrisma.errorLog.findMany).toHaveBeenCalledWith({
        where: { learned: false },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });
    });
  });

  describe('healthCheck - 真实执行路径', () => {
    it('应该完整执行healthCheck代码路径（成功）', async () => {
      await memoryAgent.initialize();

      (mockPrisma.agentMemory.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(30)
        .mockResolvedValueOnce(60)
        .mockResolvedValueOnce(15)
        .mockResolvedValueOnce(5);

      (mockPrisma.agentMemory.aggregate as jest.Mock).mockResolvedValue({
        _avg: { importance: 0.7 },
      });

      const result = await memoryAgent.healthCheck();

      expect(result).toBe(true);
      expect(mockPrisma.agentMemory.count).toHaveBeenCalled();
    });

    it('应该完整执行healthCheck代码路径（未初始化）', async () => {
      const result = await memoryAgent.healthCheck();

      expect(result).toBe(false);
    });

    it('应该完整执行healthCheck代码路径（统计失败）', async () => {
      await memoryAgent.initialize();

      (mockPrisma.agentMemory.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await memoryAgent.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('cleanExpired - 真实执行路径', () => {
    it('应该完整执行cleanExpired代码路径', async () => {
      const now = new Date();
      (mockPrisma.agentMemory.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await memoryAgent.cleanExpired();

      expect(result).toBe(5);
      // memory-manager使用lt而不是lte
      expect(mockPrisma.agentMemory.deleteMany).toHaveBeenCalledWith({
        where: {
          agentName: 'MemoryAgent',
          expiresAt: {
            lt: now,
          },
        },
      });
    });
  });

  describe('完整的存储和获取流程', () => {
    it('应该完整执行存储和获取的代码路径', async () => {
      const testMemory = {
        id: 'test-id',
        memoryId: 'test-id',
        userId: 'user-123',
        caseId: 'case-456',
        debateId: null,
        agentName: 'MemoryAgent',
        memoryKey: 'test-key',
        memoryType: 'WORKING' as MemoryType,
        memoryValue: JSON.stringify({ test: 'data' }),
        importance: 0.5,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        compressed: false,
        compressionRatio: null,
        metadata: null,
      };

      (mockPrisma.agentMemory.create as jest.Mock).mockResolvedValue(
        testMemory
      );

      const memoryId = await memoryAgent.storeMemory(
        {
          memoryType: 'WORKING',
          memoryKey: 'test-key',
          memoryValue: { test: 'data' },
          importance: 5,
        },
        'user-123',
        'case-456'
      );

      expect(memoryId).toBeDefined();

      (mockPrisma.agentMemory.findFirst as jest.Mock).mockResolvedValue(
        testMemory
      );

      const retrievedMemory = await memoryAgent.getMemory({
        memoryType: 'WORKING',
        memoryKey: 'test-key',
      });

      expect(retrievedMemory).toEqual({ test: 'data' });

      expect(mockPrisma.agentMemory.update).toHaveBeenCalled();
    });
  });
});
