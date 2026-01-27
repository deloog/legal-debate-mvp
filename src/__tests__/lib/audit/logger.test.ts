/**
 * 审计日志系统单元测试
 */

import { NextRequest } from 'next/server';
import {
  createAuditLog,
  logCreateAction,
  logUpdateAction,
  logDeleteAction,
  logViewAction,
  logAIAction,
  createActionTimer,
} from '@/lib/audit/logger';
import { prisma } from '@/lib/db/prisma';
import type { ActionLogCategory } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    actionLog: {
      create: jest.fn(),
    },
  },
}));

describe('审计日志系统', () => {
  const mockUserId = 'test-user-id';
  const mockCategory: ActionLogCategory = 'DEBATE';
  const mockResourceType = 'DEBATE';
  const mockResourceId = 'test-resource-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createAuditLog', () => {
    it('应该成功创建审计日志', async () => {
      const mockLogData = {
        userId: mockUserId,
        actionType: 'CREATE_DEBATE' as const,
        actionCategory: mockCategory,
        description: '创建测试辩论',
        resourceType: mockResourceType,
        resourceId: mockResourceId,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        requestMethod: 'POST',
        requestPath: '/api/v1/debates',
        responseStatus: 201,
        executionTime: 150,
      };

      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
        ...mockLogData,
      });

      await createAuditLog(mockLogData);

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          actionType: 'CREATE_DEBATE',
          actionCategory: mockCategory,
          description: '创建测试辩论',
          resourceType: mockResourceType,
          resourceId: mockResourceId,
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
          requestMethod: 'POST',
          requestPath: '/api/v1/debates',
          responseStatus: 201,
          executionTime: 150,
          requestParams: undefined,
          metadata: undefined,
        },
      });
    });

    it('数据库错误时应该不抛出异常', async () => {
      const mockLogData = {
        userId: mockUserId,
        actionType: 'CREATE_DEBATE' as const,
        actionCategory: mockCategory,
        description: '创建测试辩论',
      };

      (prisma.actionLog.create as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await expect(createAuditLog(mockLogData)).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '创建审计日志失败:',
        expect.any(Error)
      );
    });
  });

  describe('logCreateAction', () => {
    it('应该记录创建操作', async () => {
      const mockRequest = {
        headers: {
          get: jest.fn((header: string) => {
            if (header === 'user-agent') return 'Mozilla/5.0';
            return null;
          }),
        },
        method: 'POST',
        nextUrl: {
          pathname: '/api/v1/debates',
        },
        cookies: new Map(),
        page: { pathname: '/api/v1/debates' },
        ua: 'Mozilla/5.0',
      } as unknown as NextRequest;

      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logCreateAction({
        userId: mockUserId,
        category: mockCategory,
        resourceType: mockResourceType,
        resourceId: mockResourceId,
        description: '创建新辩论',
        request: mockRequest,
        responseStatus: 201,
        executionTime: 200,
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          actionType: 'CREATE_DEBATE',
          actionCategory: mockCategory,
          description: '创建新辩论',
          resourceType: mockResourceType,
          resourceId: mockResourceId,
          requestMethod: 'POST',
          requestPath: '/api/v1/debates',
          userAgent: 'Mozilla/5.0',
          responseStatus: 201,
          executionTime: 200,
        }),
      });
    });

    it('不提供request时应该使用默认值', async () => {
      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logCreateAction({
        userId: mockUserId,
        category: mockCategory,
        resourceType: mockResourceType,
        resourceId: mockResourceId,
        description: '创建新辩论',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          actionType: 'CREATE_DEBATE',
          actionCategory: mockCategory,
          description: '创建新辩论',
          resourceType: mockResourceType,
          resourceId: mockResourceId,
          ipAddress: undefined,
          userAgent: undefined,
          requestMethod: undefined,
          requestPath: undefined,
        }),
      });
    });
  });

  describe('logUpdateAction', () => {
    it('应该记录更新操作', async () => {
      const changes = {
        title: '新标题',
        status: 'IN_PROGRESS',
      };

      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logUpdateAction({
        userId: mockUserId,
        category: mockCategory,
        resourceType: mockResourceType,
        resourceId: mockResourceId,
        description: '更新辩论标题',
        changes,
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          actionType: 'UPDATE_DEBATE',
          actionCategory: mockCategory,
          description: '更新辩论标题',
          resourceType: mockResourceType,
          resourceId: mockResourceId,
          metadata: expect.objectContaining({
            changes,
          }),
        }),
      });
    });
  });

  describe('logDeleteAction', () => {
    it('应该记录删除操作', async () => {
      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logDeleteAction({
        userId: mockUserId,
        category: mockCategory,
        resourceType: mockResourceType,
        resourceId: mockResourceId,
        description: '删除辩论',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          actionType: 'DELETE_DEBATE',
          actionCategory: mockCategory,
          description: '删除辩论',
          resourceType: mockResourceType,
          resourceId: mockResourceId,
        }),
      });
    });
  });

  describe('logViewAction', () => {
    it('应该记录查看操作', async () => {
      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logViewAction({
        userId: mockUserId,
        category: mockCategory,
        resourceType: mockResourceType,
        resourceId: mockResourceId,
        description: '查看辩论详情',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          actionType: 'VIEW_DEBATE',
          actionCategory: mockCategory,
          description: '查看辩论详情',
          resourceType: mockResourceType,
          resourceId: mockResourceId,
        }),
      });
    });
  });

  describe('logAIAction', () => {
    it('应该记录AI分析文档操作', async () => {
      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logAIAction({
        userId: mockUserId,
        actionType: 'ANALYZE_DOCUMENT',
        resourceId: mockResourceId,
        description: '分析文档',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          actionType: 'ANALYZE_DOCUMENT',
          actionCategory: 'DEBATE',
          resourceType: 'DEBATE',
          description: '分析文档',
          resourceId: mockResourceId,
        }),
      });
    });

    it('应该记录AI生成辩论操作', async () => {
      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logAIAction({
        userId: mockUserId,
        actionType: 'GENERATE_DEBATE',
        description: '生成辩论',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          actionType: 'GENERATE_DEBATE',
          actionCategory: 'DEBATE',
          resourceType: 'DEBATE',
          description: '生成辩论',
        }),
      });
    });
  });

  describe('createActionTimer', () => {
    it('应该正确计算执行时间', async () => {
      const timer = createActionTimer();

      // 模拟异步操作
      await new Promise(resolve => setTimeout(resolve, 100));

      const mockCallback = jest.fn().mockResolvedValue(undefined);
      await timer(mockCallback);

      expect(mockCallback).toHaveBeenCalledWith(expect.any(Number));

      const duration = mockCallback.mock.calls[0][0] as number;
      expect(duration).toBeGreaterThanOrEqual(90); // 考虑误差
      expect(duration).toBeLessThan(200);
    });

    it('应该在回调中传入正确的执行时间', async () => {
      const timer = createActionTimer();

      const mockCallback = jest.fn().mockResolvedValue(undefined);
      await timer(mockCallback);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(typeof mockCallback.mock.calls[0][0]).toBe('number');
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空字符串resourceId', async () => {
      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logCreateAction({
        userId: mockUserId,
        category: mockCategory,
        resourceType: mockResourceType,
        resourceId: '',
        description: '创建资源',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resourceId: '',
        }),
      });
    });

    it('应该处理undefined参数', async () => {
      (prisma.actionLog.create as jest.Mock).mockResolvedValue({
        id: 'log-id-1',
      });

      await logUpdateAction({
        userId: mockUserId,
        category: mockCategory,
        resourceType: mockResourceType,
        resourceId: mockResourceId,
        description: '更新资源',
      });

      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            changes: undefined,
          }),
        }),
      });
    });
  });
});
