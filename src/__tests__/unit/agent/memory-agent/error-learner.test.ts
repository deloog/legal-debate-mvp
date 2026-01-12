/**
 * ErrorLearner测试套件
 * 测试错误学习机制
 */

import { ErrorLearner } from '@/lib/agent/memory-agent/error-learner';
import { MemoryManager } from '@/lib/agent/memory-agent/memory-manager';
import { ErrorType, PrismaClient, ErrorSeverity } from '@prisma/client';
import { mockDeep } from 'jest-mock-extended';

// Mock uuid模块
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

// Mock MemoryManager
const mockMemoryManager = {
  getColdMemory: jest.fn(),
  storeColdMemory: jest.fn(),
} as unknown as MemoryManager & {
  getColdMemory: jest.Mock;
  storeColdMemory: jest.Mock;
};

describe('ErrorLearner', () => {
  let errorLearner: ErrorLearner;
  let mockAIService: { chatCompletion: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    // 创建AIService mock实例
    mockAIService = {
      chatCompletion: mockChatCompletion,
    };

    errorLearner = new ErrorLearner(
      mockPrisma,
      mockAIService as never,
      mockMemoryManager
    );
  });

  describe('从错误学习', () => {
    it('应该成功学习单个错误', async () => {
      const errorRecord = {
        id: 'error1',
        userId: 'user1',
        caseId: null,
        errorType: 'TIMEOUT_ERROR' as ErrorType,
        errorCode: 'TIMEOUT_001',
        errorMessage: 'API request timeout',
        stackTrace: null,
        context: { url: '/api/test' },
        attemptedAction: { method: 'GET' },
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

      const findUniqueMock = mockPrisma.errorLog.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(errorRecord);

      const findManyMock = mockPrisma.errorLog.findMany as jest.Mock;
      findManyMock.mockResolvedValue([errorRecord]);

      mockMemoryManager.getColdMemory.mockResolvedValue(null);

      const updateMock = mockPrisma.errorLog.update as jest.Mock;
      updateMock.mockResolvedValue({
        ...errorRecord,
        learned: true,
        learningNotes: 'test learning notes',
        updatedAt: new Date(),
      });

      const result = await errorLearner.learnFromError('error1');

      expect(result.errorId).toBe('error1');
      expect(result.knowledgeUpdated).toBe(true);
      expect(result.learningNotes).toBeTruthy();
      expect(updateMock).toHaveBeenCalledWith({
        where: { id: 'error1' },
        data: expect.objectContaining({
          learned: true,
        }),
      });
    });

    it('应该抛出找不到错误的异常', async () => {
      const findUniqueMock = mockPrisma.errorLog.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(null);

      await expect(errorLearner.learnFromError('nonexistent')).rejects.toThrow(
        'Error not found: nonexistent'
      );
    });

    it('应该更新已存在的知识库', async () => {
      const errorRecord = {
        id: 'error1',
        userId: 'user1',
        caseId: null,
        errorType: 'TIMEOUT_ERROR' as ErrorType,
        errorCode: 'TIMEOUT_001',
        errorMessage: 'API request timeout',
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

      const existingKnowledge = {
        errorType: 'TIMEOUT_ERROR',
        patterns: {},
        preventionMeasures: [],
        lastUpdated: '2024-01-01',
        errorCount: 5,
      };

      const findUniqueMock = mockPrisma.errorLog.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(errorRecord);

      const findManyMock = mockPrisma.errorLog.findMany as jest.Mock;
      findManyMock.mockResolvedValue([errorRecord]);

      mockMemoryManager.getColdMemory.mockResolvedValue(existingKnowledge);

      const updateMock = mockPrisma.errorLog.update as jest.Mock;
      updateMock.mockResolvedValue({
        ...errorRecord,
        learned: true,
        updatedAt: new Date(),
      });

      await errorLearner.learnFromError('error1');

      expect(mockMemoryManager.storeColdMemory).toHaveBeenCalledWith(
        'error_pattern_TIMEOUT_ERROR',
        expect.objectContaining({
          errorCount: 6, // 现有5 + 新增1
        }),
        'user1'
      );
    });
  });

  describe('批量学习', () => {
    it('应该成功批量学习多个错误', async () => {
      const errors = [
        {
          id: 'error1',
          userId: 'user1',
          caseId: null,
          errorType: 'TIMEOUT_ERROR' as ErrorType,
          errorCode: 'TIMEOUT_001',
          errorMessage: 'API timeout',
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
        {
          id: 'error2',
          userId: 'user1',
          caseId: null,
          errorType: 'DATA_INCONSISTENCY' as ErrorType,
          errorCode: 'DATA_001',
          errorMessage: 'Data validation failed',
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

      // Mock findMany返回未学习的错误
      const findManyMock = mockPrisma.errorLog.findMany as jest.Mock;
      findManyMock.mockResolvedValue(errors);

      // Mock findUnique返回对应的错误详情
      const findUniqueMock = mockPrisma.errorLog.findUnique as jest.Mock;
      findUniqueMock.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          errors.find(e => e.id === where.id)
      );

      // Mock getColdMemory返回null（不存在已有知识）
      mockMemoryManager.getColdMemory.mockResolvedValue(null);

      // Mock update返回更新后的错误
      const updateMock = mockPrisma.errorLog.update as jest.Mock;
      updateMock.mockImplementation(({ where }: { where: { id: string } }) => ({
        ...errors.find(e => e.id === where.id),
        learned: true,
        updatedAt: new Date(),
      }));

      const results = await errorLearner.batchLearn(50);

      expect(results).toHaveLength(2);
      expect(results[0].knowledgeUpdated).toBe(true);
      expect(results[1].knowledgeUpdated).toBe(true);
    });

    it('应该限制学习的错误数量', async () => {
      const errors = Array.from({ length: 100 }, (_, i) => ({
        id: `error${i}`,
        userId: 'user1',
        caseId: null,
        errorType: 'TIMEOUT_ERROR' as ErrorType,
        errorCode: `TIMEOUT_${i}`,
        errorMessage: 'API timeout',
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
      }));

      // Mock findMany根据take参数返回对应数量的错误
      const findManyMock = mockPrisma.errorLog.findMany as jest.Mock;
      findManyMock.mockImplementation(({ take }: { take?: number }) => {
        const limit = take || 50;
        return errors.slice(0, limit);
      });

      // Mock findUnique返回对应的错误详情
      const findUniqueMock = mockPrisma.errorLog.findUnique as jest.Mock;
      findUniqueMock.mockImplementation(
        ({ where }: { where: { id: string } }) =>
          errors.find(e => e.id === where.id)
      );

      // Mock getColdMemory返回null
      mockMemoryManager.getColdMemory.mockResolvedValue(null);

      // Mock update返回更新后的错误
      const updateMock = mockPrisma.errorLog.update as jest.Mock;
      updateMock.mockImplementation(({ where }: { where: { id: string } }) => ({
        ...errors.find(e => e.id === where.id),
        learned: true,
        updatedAt: new Date(),
      }));

      const results = await errorLearner.batchLearn(50);

      expect(results.length).toBeLessThanOrEqual(50);
      expect(findManyMock).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      );
    });
  });

  describe('错误分析', () => {
    it('应该成功分析错误', async () => {
      const errorRecord = {
        id: 'error1',
        userId: null,
        caseId: null,
        errorType: 'TIMEOUT_ERROR' as ErrorType,
        errorCode: 'TIMEOUT_001',
        errorMessage: 'API timeout',
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

      const findUniqueMock = mockPrisma.errorLog.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(errorRecord);

      const findManyMock = mockPrisma.errorLog.findMany as jest.Mock;
      findManyMock.mockResolvedValue([errorRecord]);

      const analysis = await errorLearner.analyzeError('error1');

      expect(analysis.errorId).toBe('error1');
      expect(analysis.errorType).toBe('TIMEOUT_ERROR');
      expect(analysis.frequency).toBe(1);
    });

    it('应该抛出找不到错误的异常', async () => {
      const findUniqueMock = mockPrisma.errorLog.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(null);

      await expect(errorLearner.analyzeError('nonexistent')).rejects.toThrow(
        'Error not found: nonexistent'
      );
    });

    it('应该正确计算错误频率', async () => {
      const errors = Array.from({ length: 5 }, (_, i) => ({
        id: `error${i}`,
        userId: null,
        caseId: null,
        errorType: 'TIMEOUT_ERROR' as ErrorType,
        errorCode: 'TIMEOUT_001',
        errorMessage: 'API timeout',
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
      }));

      const findUniqueMock = mockPrisma.errorLog.findUnique as jest.Mock;
      findUniqueMock.mockResolvedValue(errors[0]);

      const findManyMock = mockPrisma.errorLog.findMany as jest.Mock;
      findManyMock.mockResolvedValue(errors);

      const analysis = await errorLearner.analyzeError('error0');

      expect(analysis.frequency).toBe(5);
    });
  });
});
