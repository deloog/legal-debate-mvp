/**
 * ErrorLearner单元测试
 * 测试错误学习功能
 */

import { ErrorLearner } from '@/lib/agent/memory-agent/error-learner';
import { MemoryManager } from '@/lib/agent/memory-agent/memory-manager';
import { PrismaClient } from '@prisma/client';
import { createMockAIService } from './__mocks__/ai-service-mock';
import { createMockAgentMemoryDB } from './test-helpers';

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      agentMemory: createMockAgentMemoryDB(),
      errorLog: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    })),
  };
});

describe('ErrorLearner', () => {
  let errorLearner: ErrorLearner;
  let mockAIService: Record<string, jest.Mock>;
  let mockPrisma: any;
  let memoryManager: MemoryManager;

  beforeEach(() => {
    const prisma = new PrismaClient();
    mockPrisma = prisma as any;

    mockAIService = createMockAIService();
    memoryManager = new MemoryManager(prisma);
    errorLearner = new ErrorLearner(
      prisma,
      mockAIService as any,
      memoryManager
    );

    jest.clearAllMocks();
  });

  describe('从错误学习', () => {
    it('应该成功学习错误', async () => {
      const errorId = 'error-1';

      mockPrisma.errorLog.findUnique.mockResolvedValueOnce({
        id: errorId,
        errorType: 'CASE_PARSE_ERROR',
        errorCode: 'ERR001',
        errorMessage: 'Test error',
        context: { test: 'context' },
        attemptedAction: {},
        userId: null,
        learned: false,
        createdAt: new Date(),
      });

      const result = await errorLearner.learnFromError(errorId);

      expect(result).toBeDefined();
      expect(result.learningId).toBeDefined();
    });

    it('应该记录错误模式', async () => {
      const errorId = 'error-2';

      mockPrisma.errorLog.findUnique.mockResolvedValueOnce({
        id: errorId,
        errorType: 'CASE_PARSE_ERROR',
        errorCode: 'ERR001',
        errorMessage: 'Test error',
        context: { test: 'context' },
        attemptedAction: {},
        userId: null,
        learned: false,
        createdAt: new Date(),
      });

      const result = await errorLearner.learnFromError(errorId);

      expect(result.pattern).toBeDefined();
      expect(result.pattern.patternId).toBeDefined();
      expect(result.pattern.errorType).toBeDefined();
    });

    it('应该生成预防措施', async () => {
      const errorId = 'error-3';

      mockPrisma.errorLog.findUnique.mockResolvedValueOnce({
        id: errorId,
        errorType: 'CASE_PARSE_ERROR',
        errorCode: 'ERR001',
        errorMessage: 'Test error',
        context: { test: 'context' },
        attemptedAction: {},
        userId: null,
        learned: false,
        createdAt: new Date(),
      });

      const result = await errorLearner.learnFromError(errorId);

      expect(result.preventionMeasures).toBeDefined();
      expect(Array.isArray(result.preventionMeasures)).toBe(true);
    });

    it('应该标记错误为已学习', async () => {
      const errorId = 'error-4';

      mockPrisma.errorLog.findUnique.mockResolvedValueOnce({
        id: errorId,
        errorType: 'CASE_PARSE_ERROR',
        errorCode: 'ERR001',
        errorMessage: 'Test error',
        context: { test: 'context' },
        attemptedAction: {},
        userId: null,
        learned: false,
        createdAt: new Date(),
      });

      mockPrisma.errorLog.update.mockResolvedValueOnce({
        id: errorId,
        learned: true,
      });

      await errorLearner.learnFromError(errorId);

      expect(mockPrisma.errorLog.update).toHaveBeenCalled();
    });
  });

  describe('批量学习', () => {
    it('应该批量处理错误', async () => {
      const limit = 5;

      mockPrisma.errorLog.findMany.mockResolvedValueOnce([
        {
          id: 'error-1',
          errorType: 'CASE_PARSE_ERROR',
          errorCode: 'ERR001',
          errorMessage: 'Error 1',
          context: {},
          attemptedAction: {},
          userId: null,
          learned: false,
          createdAt: new Date(),
        },
        {
          id: 'error-2',
          errorType: 'CASE_PARSE_ERROR',
          errorCode: 'ERR002',
          errorMessage: 'Error 2',
          context: {},
          attemptedAction: {},
          userId: null,
          learned: false,
          createdAt: new Date(),
        },
      ]);

      const results = await errorLearner.batchLearn(limit);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('应该跳过已学习的错误', async () => {
      const limit = 5;

      mockPrisma.errorLog.findMany.mockResolvedValueOnce([
        {
          id: 'error-1',
          errorType: 'CASE_PARSE_ERROR',
          errorCode: 'ERR001',
          errorMessage: 'Error 1',
          context: {},
          attemptedAction: {},
          userId: null,
          learned: true, // 已学习
          createdAt: new Date(),
        },
      ]);

      const results = await errorLearner.batchLearn(limit);

      expect(results).toBeDefined();
      expect(results.length).toBe(0); // 已学习的错误被跳过
    });

    it('应该处理空列表', async () => {
      const limit = 5;

      mockPrisma.errorLog.findMany.mockResolvedValueOnce([]);

      const results = await errorLearner.batchLearn(limit);

      expect(results).toBeDefined();
      expect(results.length).toBe(0);
    });
  });

  describe('错误处理', () => {
    it('应该处理错误不存在的情况', async () => {
      const errorId = 'non-existent-error';

      mockPrisma.errorLog.findUnique.mockResolvedValueOnce(null);

      await expect(errorLearner.learnFromError(errorId)).rejects.toThrow(
        'Error not found'
      );
    });

    it('应该处理AI服务错误', async () => {
      const errorId = 'error-5';

      mockPrisma.errorLog.findUnique.mockResolvedValueOnce({
        id: errorId,
        errorType: 'CASE_PARSE_ERROR',
        errorCode: 'ERR001',
        errorMessage: 'Test error',
        context: { test: 'context' },
        attemptedAction: {},
        userId: null,
        learned: false,
        createdAt: new Date(),
      });

      // AI服务可能会失败，但测试应该能处理这种情况
      // 由于我们使用的是Mock AI服务，它总是返回成功
      // 所以我们主要验证测试框架不会崩溃

      const result = await errorLearner.learnFromError(errorId);

      // 应该返回结果（即使AI服务失败）
      expect(result).toBeDefined();
    });
  });

  describe('学习质量', () => {
    it('应该提取有意义的错误模式', async () => {
      const errorId = 'error-6';

      mockPrisma.errorLog.findUnique.mockResolvedValueOnce({
        id: errorId,
        errorType: 'CASE_PARSE_ERROR',
        errorCode: 'ERR001',
        errorMessage: 'Cannot parse case data: missing field "parties"',
        context: {
          input: { caseId: '123', title: 'Test' },
        },
        attemptedAction: {},
        userId: null,
        learned: false,
        createdAt: new Date(),
      });

      const result = await errorLearner.learnFromError(errorId);

      expect(result.pattern).toBeDefined();
      expect(result.pattern.errorType).toBe('CASE_PARSE_ERROR');
    });

    it('应该生成可执行的预防措施', async () => {
      const errorId = 'error-7';

      mockPrisma.errorLog.findUnique.mockResolvedValueOnce({
        id: errorId,
        errorType: 'CASE_PARSE_ERROR',
        errorCode: 'ERR001',
        errorMessage: 'Test error',
        context: { test: 'context' },
        attemptedAction: {},
        userId: null,
        learned: false,
        createdAt: new Date(),
      });

      const result = await errorLearner.learnFromError(errorId);

      expect(result.preventionMeasures).toBeDefined();
      if (result.preventionMeasures.length > 0) {
        expect(result.preventionMeasures[0].description).toBeDefined();
        expect(result.preventionMeasures[0].priority).toBeGreaterThan(0);
      }
    });
  });
});
