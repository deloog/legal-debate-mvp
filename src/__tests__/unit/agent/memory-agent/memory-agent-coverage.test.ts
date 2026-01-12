/**
 * MemoryAgent覆盖率专项测试
 * 专门测试memory-agent.ts的未覆盖代码路径
 */

import { MemoryAgent } from '@/lib/agent/memory-agent/memory-agent';
import {
  PrismaClient,
  MemoryType,
  ErrorType,
  ErrorSeverity,
} from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('test-uuid'),
}));

// Mock AIService
const mockChatCompletion = jest.fn();
jest.mock('@/lib/ai/service-refactored', () => {
  return {
    AIService: jest.fn().mockImplementation(() => ({
      chatCompletion: mockChatCompletion,
    })),
  };
});

const mockPrisma = mockDeep<PrismaClient>();

describe('MemoryAgent覆盖率测试', () => {
  let memoryAgent: MemoryAgent;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let aiService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    aiService = {
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

  describe('storeMemory - 完整代码路径', () => {
    it('应该处理所有类型的记忆存储', async () => {
      const testCases = [
        { type: 'WORKING' as const, importance: 0.3 },
        { type: 'HOT' as const, importance: 0.7 },
        { type: 'COLD' as const, importance: 1.0 },
      ];

      for (const testCase of testCases) {
        const mockMemory = {
          id: `mem-${testCase.type}`,
          memoryKey: `key-${testCase.type}`,
          memoryValue: JSON.stringify({ test: testCase.type }),
          importance: testCase.importance,
          memoryType: testCase.type as MemoryType,
          agentName: 'MemoryAgent',
          userId: 'test-user',
          caseId: null,
          debateId: null,
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
          mockMemory
        );

        const result = await memoryAgent.storeMemory(
          {
            memoryType: testCase.type,
            memoryKey: `key-${testCase.type}`,
            memoryValue: { test: testCase.type },
            importance: testCase.importance * 10,
          },
          'test-user'
        );

        expect(result).toBeDefined();
      }
    });

    it('应该正确设置过期时间', async () => {
      const beforeCreate = Date.now();
      const mockMemory = {
        id: 'mem-expire',
        memoryKey: 'expire-key',
        memoryValue: JSON.stringify({ test: 'data' }),
        importance: 0.5,
        memoryType: 'WORKING' as MemoryType,
        agentName: 'MemoryAgent',
        userId: 'test-user',
        caseId: null,
        debateId: null,
        accessCount: 0,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000), // 1小时后过期
        compressed: false,
        compressionRatio: null,
        metadata: null,
      };

      (mockPrisma.agentMemory.create as jest.Mock).mockResolvedValue(
        mockMemory
      );

      await memoryAgent.storeMemory(
        {
          memoryType: 'WORKING',
          memoryKey: 'expire-key',
          memoryValue: { test: 'data' },
          importance: 5,
        },
        'test-user'
      );

      const afterCreate = Date.now();
      const createCall = (mockPrisma.agentMemory.create as jest.Mock).mock
        .calls[0][0];

      const expiresAt = createCall.data.expiresAt as Date;
      const expectedMin = new Date(beforeCreate + 3600000);
      const expectedMax = new Date(afterCreate + 3600000);

      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });
  });

  describe('getMemory - 完整代码路径', () => {
    it('应该处理所有类型的记忆获取', async () => {
      const testCases = ['WORKING' as const, 'HOT' as const, 'COLD' as const];

      for (const memoryType of testCases) {
        const mockMemory = {
          id: `mem-${memoryType}`,
          memoryKey: `key-${memoryType}`,
          memoryValue: JSON.stringify({ test: memoryType }),
          importance: 0.5,
          memoryType: memoryType as MemoryType,
          agentName: 'MemoryAgent',
          userId: 'test-user',
          caseId: null,
          debateId: null,
          accessCount: 0,
          lastAccessedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          expiresAt:
            memoryType === 'COLD' ? null : new Date(Date.now() + 3600000),
          compressed: false,
          compressionRatio: null,
          metadata: null,
        };

        (mockPrisma.agentMemory.findFirst as jest.Mock).mockResolvedValue(
          mockMemory
        );
        (mockPrisma.agentMemory.update as jest.Mock).mockResolvedValue({
          ...mockMemory,
          accessCount: 1,
        });

        const result = await memoryAgent.getMemory({
          memoryType: memoryType,
          memoryKey: `key-${memoryType}`,
        });

        expect(result).toEqual({ test: memoryType });
      }
    });
  });

  describe('triggerMigration - 完整代码路径', () => {
    it('应该处理所有迁移类型', async () => {
      await memoryAgent.initialize();

      const migrationTypes = [
        { type: 'workingToHot' as const, method: 'migrateWorkingToHot' },
        { type: 'hotToCold' as const, method: 'compressHotToCold' },
      ];

      for (const migrationType of migrationTypes) {
        // 由于使用了真实的migrator，这里只验证方法调用
        const result = await memoryAgent.triggerMigration(migrationType.type);

        expect(result).toBeDefined();
        expect(typeof result.migratedCount).toBe('number');
      }
    });
  });

  describe('learnFromError - 完整代码路径', () => {
    it('应该处理错误学习流程', async () => {
      const mockError = {
        id: 'error-1',
        errorMessage: 'Test error',
        errorType: 'AI_SERVICE_ERROR' as ErrorType,
        errorCode: 'AI_001',
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
        userId: null,
        caseId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.errorLog.findUnique as jest.Mock).mockResolvedValue(
        mockError
      );
      (mockPrisma.errorLog.findMany as jest.Mock).mockResolvedValue([
        mockError,
      ]);
      (mockPrisma.errorLog.update as jest.Mock).mockResolvedValue({
        ...mockError,
        learned: true,
      });

      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                rootCause: '根本原因',
                prevention: ['预防措施'],
              }),
            },
          },
        ],
      });

      const result = await memoryAgent.learnFromError({
        errorId: 'error-1',
      });

      expect(result.learningId).toBeDefined();
      expect(result.errorId).toBe('error-1');
    });
  });
});
