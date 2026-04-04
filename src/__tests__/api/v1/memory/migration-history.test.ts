/**
 * 记忆迁移历史API测试
 *
 * 注意：由于 Prisma 生成的 ActionType 枚举类型与实际使用的枚举值不完全兼容，
 * 在测试中需要使用 `as any` 类型断言来解决类型检查问题。
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GET } from '@/app/api/v1/memory/migration-history/route';
import { createMockGetRequest } from '@/test-utils/requests';

// Mock 认证中间件
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    agentAction: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

const mockGetAuthUser = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('迁移历史API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // 设置认证 mock - 返回管理员用户
    mockGetAuthUser.mockResolvedValue({ userId: 'admin-user-1' } as any);
    // 设置用户权限 mock - 返回管理员角色
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      role: 'ADMIN',
    });
  });

  describe('GET /api/v1/memory/migration-history', () => {
    it('应该返回空列表当没有迁移记录时', async () => {
      // Mock 返回空数组
      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(0);

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toEqual([]);
      expect(data.data.pagination.total).toBe(0);
    });

    it('应该返回迁移历史记录', async () => {
      const mockActions = [
        {
          id: 'action-2',
          actionType: 'MIGRATE_HOT_TO_COLD',
          actionName: 'Hot→Cold Migration',
          status: 'COMPLETED',
          executionTime: 200,
          createdAt: new Date('2024-01-02T00:00:00Z'),
          parameters: {
            memoryId: 'test-memory-2',
            memoryKey: 'test-key-2',
            originalType: 'HOT',
            targetType: 'COLD',
            importance: 0.9,
            accessCount: 10,
            compressionRatio: 0.5,
          },
          metadata: {},
        },
        {
          id: 'action-1',
          actionType: 'MIGRATE_WORKING_TO_HOT',
          actionName: 'Working→Hot Migration',
          status: 'COMPLETED',
          executionTime: 100,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'WORKING',
            targetType: 'HOT',
            importance: 0.8,
            accessCount: 5,
          },
          metadata: {},
        },
      ];

      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue(
        mockActions
      );
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(2);

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(2);
      expect(data.data.pagination.total).toBe(2);

      // 验证第一条记录（按创建时间降序）
      expect(data.data.items[0].actionType).toBe('MIGRATE_HOT_TO_COLD');
      expect(data.data.items[0].status).toBe('COMPLETED');
      expect(data.data.items[0].executionTime).toBe(200);

      // 验证第二条记录
      expect(data.data.items[1].actionType).toBe('MIGRATE_WORKING_TO_HOT');
      expect(data.data.items[1].status).toBe('COMPLETED');
      expect(data.data.items[1].executionTime).toBe(100);
    });

    it('应该支持分页', async () => {
      const mockActions = Array.from({ length: 10 }, (_, i) => ({
        id: `action-${i}`,
        actionType: 'MIGRATE_WORKING_TO_HOT',
        actionName: 'Working→Hot Migration',
        status: 'COMPLETED',
        executionTime: 100,
        createdAt: new Date(),
        parameters: {
          memoryId: `test-memory-${i}`,
          memoryKey: `test-key-${i}`,
          originalType: 'WORKING',
          targetType: 'HOT',
          importance: 0.8,
          accessCount: i,
        },
        metadata: {},
      }));

      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue(
        mockActions
      );
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(15);

      // 第一页
      const request1 = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history?page=1&limit=10'
      );

      const response1 = await GET(request1);
      const data1 = await response1.json();

      expect(response1.status).toBe(200);
      expect(data1.success).toBe(true);
      expect(data1.data.items).toHaveLength(10);
      expect(data1.data.pagination.total).toBe(15);
      expect(data1.data.pagination.totalPages).toBe(2);
      expect(data1.data.pagination.page).toBe(1);
      expect(data1.data.pagination.limit).toBe(10);
    });

    it('应该支持按actionType过滤', async () => {
      const mockActions = [
        {
          id: 'action-1',
          actionType: 'MIGRATE_WORKING_TO_HOT',
          actionName: 'Working→Hot Migration',
          status: 'COMPLETED',
          executionTime: 100,
          createdAt: new Date(),
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'WORKING',
            targetType: 'HOT',
            importance: 0.8,
            accessCount: 5,
          },
          metadata: {},
        },
      ];

      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue(
        mockActions
      );
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(1);

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history?actionType=MIGRATE_WORKING_TO_HOT'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(1);
      expect(data.data.items[0].actionType).toBe('MIGRATE_WORKING_TO_HOT');
    });

    it('应该支持按status过滤', async () => {
      const mockActions = [
        {
          id: 'action-2',
          actionType: 'MIGRATE_HOT_TO_COLD',
          actionName: 'Hot→Cold Migration',
          status: 'FAILED',
          executionTime: 0,
          createdAt: new Date(),
          parameters: {
            memoryId: 'test-memory-2',
            memoryKey: 'test-key-2',
            originalType: 'HOT',
            targetType: 'COLD',
            importance: 0.9,
            accessCount: 10,
          },
          metadata: {},
        },
      ];

      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue(
        mockActions
      );
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(1);

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history?status=FAILED'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(1);
      expect(data.data.items[0].status).toBe('FAILED');
    });

    it('应该限制最大每页记录数为100', async () => {
      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(0);

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history?limit=200'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.limit).toBe(100);
    });

    it('应该正确格式化压缩比', async () => {
      const mockActions = [
        {
          id: 'action-1',
          actionType: 'MIGRATE_HOT_TO_COLD',
          actionName: 'Hot→Cold Migration',
          status: 'COMPLETED',
          executionTime: 200,
          createdAt: new Date(),
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'HOT',
            targetType: 'COLD',
            importance: 0.9,
            accessCount: 10,
            compressionRatio: 0.75,
          },
          metadata: {},
        },
      ];

      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue(
        mockActions
      );
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(1);

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.items[0].compressionRatio).toBe(0.75);
    });

    it('应该正确格式化错误信息', async () => {
      const mockActions = [
        {
          id: 'action-1',
          actionType: 'MIGRATE_WORKING_TO_HOT',
          actionName: 'Working→Hot Migration',
          status: 'FAILED',
          executionTime: 0,
          createdAt: new Date(),
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'WORKING',
            targetType: 'HOT',
            importance: 0.8,
            accessCount: 5,
            error: 'Connection timeout',
          },
          metadata: {},
        },
      ];

      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue(
        mockActions
      );
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(1);

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.items[0].error).toBe('Connection timeout');
    });

    it('应该按创建时间降序排列', async () => {
      const mockActions = [
        {
          id: 'action-2',
          actionType: 'MIGRATE_HOT_TO_COLD',
          actionName: 'Hot→Cold Migration',
          status: 'COMPLETED',
          executionTime: 200,
          createdAt: new Date('2024-01-02T00:00:00Z'),
          parameters: {
            memoryId: 'test-memory-2',
            memoryKey: 'test-key-2',
            originalType: 'HOT',
            targetType: 'COLD',
            importance: 0.9,
            accessCount: 10,
          },
          metadata: {},
        },
        {
          id: 'action-1',
          actionType: 'MIGRATE_WORKING_TO_HOT',
          actionName: 'Working→Hot Migration',
          status: 'COMPLETED',
          executionTime: 100,
          createdAt: new Date('2024-01-01T00:00:00Z'),
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'WORKING',
            targetType: 'HOT',
            importance: 0.8,
            accessCount: 5,
          },
          metadata: {},
        },
      ];

      (mockPrisma.agentAction.findMany as jest.Mock).mockResolvedValue(
        mockActions
      );
      (mockPrisma.agentAction.count as jest.Mock).mockResolvedValue(2);

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.items[0].actionType).toBe('MIGRATE_HOT_TO_COLD');
      expect(data.data.items[1].actionType).toBe('MIGRATE_WORKING_TO_HOT');
    });
  });
});
