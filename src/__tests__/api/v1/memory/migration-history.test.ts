/**
 * 记忆迁移历史API测试
 *
 * 注意：由于 Prisma 生成的 ActionType 枚举类型与实际使用的枚举值不完全兼容，
 * 在测试中需要使用 `as any` 类型断言来解决类型检查问题。
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { GET } from '@/app/api/v1/memory/migration-history/route';
import { createMockGetRequest } from '@/test-utils/requests';

const prisma = new PrismaClient();

describe('迁移历史API', () => {
  beforeEach(async () => {
    // 清理测试数据
    await prisma.agentAction.deleteMany({
      where: {
        agentName: 'MemoryAgent',
        actionType: {
          in: ['MIGRATE_WORKING_TO_HOT', 'MIGRATE_HOT_TO_COLD'] as any,
        },
      },
    });
  });

  afterEach(async () => {
    // 清理测试数据
    await prisma.agentAction.deleteMany({
      where: {
        agentName: 'MemoryAgent',
        actionType: {
          in: ['MIGRATE_WORKING_TO_HOT', 'MIGRATE_HOT_TO_COLD'] as any,
        },
      },
    });
  });

  describe('GET /api/v1/memory/migration-history', () => {
    it('应该返回空列表当没有迁移记录时', async () => {
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
      // 创建测试数据
      await prisma.agentAction.create({
        data: {
          agentName: 'MemoryAgent',
          actionType: 'MIGRATE_WORKING_TO_HOT' as any,
          actionName: 'Working→Hot Migration',
          actionLayer: 'SCRIPT',
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'WORKING',
            targetType: 'HOT',
            importance: 0.8,
            accessCount: 5,
          },
          status: 'COMPLETED',
          executionTime: 100,
        },
      });

      await prisma.agentAction.create({
        data: {
          agentName: 'MemoryAgent',
          actionType: 'MIGRATE_HOT_TO_COLD' as any,
          actionName: 'Hot→Cold Migration',
          actionLayer: 'SCRIPT',
          parameters: {
            memoryId: 'test-memory-2',
            memoryKey: 'test-key-2',
            originalType: 'HOT',
            targetType: 'COLD',
            importance: 0.9,
            accessCount: 10,
            compressionRatio: 0.5,
          },
          status: 'COMPLETED',
          executionTime: 200,
        },
      });

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items).toHaveLength(2);
      expect(data.data.pagination.total).toBe(2);

      // 验证第一条记录
      expect(data.data.items[0].actionType).toBe('MIGRATE_HOT_TO_COLD');
      expect(data.data.items[0].status).toBe('COMPLETED');
      expect(data.data.items[0].executionTime).toBe(200);

      // 验证第二条记录
      expect(data.data.items[1].actionType).toBe('MIGRATE_WORKING_TO_HOT');
      expect(data.data.items[1].status).toBe('COMPLETED');
      expect(data.data.items[1].executionTime).toBe(100);
    });

    it('应该支持分页', async () => {
      // 创建15条测试数据
      for (let i = 0; i < 15; i++) {
        await prisma.agentAction.create({
          data: {
            agentName: 'MemoryAgent',
            actionType: 'MIGRATE_WORKING_TO_HOT' as any,
            actionName: 'Working→Hot Migration',
            actionLayer: 'SCRIPT',
            parameters: {
              memoryId: `test-memory-${i}`,
              memoryKey: `test-key-${i}`,
              originalType: 'WORKING',
              targetType: 'HOT',
              importance: 0.8,
              accessCount: i,
            },
            status: 'COMPLETED',
            executionTime: 100,
          },
        });
      }

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

      // 第二页
      const request2 = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history?page=2&limit=10'
      );

      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.success).toBe(true);
      expect(data2.data.items).toHaveLength(5);
      expect(data2.data.pagination.page).toBe(2);
    });

    it('应该支持按actionType过滤', async () => {
      await prisma.agentAction.createMany({
        data: [
          {
            agentName: 'MemoryAgent',
            actionType: 'MIGRATE_WORKING_TO_HOT' as any,
            actionName: 'Working→Hot Migration',
            actionLayer: 'SCRIPT',
            parameters: {
              memoryId: 'test-memory-1',
              memoryKey: 'test-key-1',
              originalType: 'WORKING',
              targetType: 'HOT',
              importance: 0.8,
              accessCount: 5,
            },
            status: 'COMPLETED',
            executionTime: 100,
          },
          {
            agentName: 'MemoryAgent',
            actionType: 'MIGRATE_HOT_TO_COLD' as any,
            actionName: 'Hot→Cold Migration',
            actionLayer: 'SCRIPT',
            parameters: {
              memoryId: 'test-memory-2',
              memoryKey: 'test-key-2',
              originalType: 'HOT',
              targetType: 'COLD',
              importance: 0.9,
              accessCount: 10,
            },
            status: 'COMPLETED',
            executionTime: 200,
          },
        ],
      });

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
      await prisma.agentAction.createMany({
        data: [
          {
            agentName: 'MemoryAgent',
            actionType: 'MIGRATE_WORKING_TO_HOT' as any,
            actionName: 'Working→Hot Migration',
            actionLayer: 'SCRIPT',
            parameters: {
              memoryId: 'test-memory-1',
              memoryKey: 'test-key-1',
              originalType: 'WORKING',
              targetType: 'HOT',
              importance: 0.8,
              accessCount: 5,
            },
            status: 'COMPLETED',
            executionTime: 100,
          },
          {
            agentName: 'MemoryAgent',
            actionType: 'MIGRATE_HOT_TO_COLD' as any,
            actionName: 'Hot→Cold Migration',
            actionLayer: 'SCRIPT',
            parameters: {
              memoryId: 'test-memory-2',
              memoryKey: 'test-key-2',
              originalType: 'HOT',
              targetType: 'COLD',
              importance: 0.9,
              accessCount: 10,
            },
            status: 'FAILED',
            executionTime: 0,
          },
        ],
      });

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
      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history?limit=200'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.pagination.limit).toBe(100);
    });

    it('应该正确格式化压缩比', async () => {
      await prisma.agentAction.create({
        data: {
          agentName: 'MemoryAgent',
          actionType: 'MIGRATE_HOT_TO_COLD' as any,
          actionName: 'Hot→Cold Migration',
          actionLayer: 'SCRIPT',
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'HOT',
            targetType: 'COLD',
            importance: 0.9,
            accessCount: 10,
            compressionRatio: 0.75,
          },
          status: 'COMPLETED',
          executionTime: 200,
        },
      });

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.items[0].compressionRatio).toBe(0.75);
    });

    it('应该正确格式化错误信息', async () => {
      await prisma.agentAction.create({
        data: {
          agentName: 'MemoryAgent',
          actionType: 'MIGRATE_WORKING_TO_HOT' as any,
          actionName: 'Working→Hot Migration',
          actionLayer: 'SCRIPT',
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'WORKING',
            targetType: 'HOT',
            importance: 0.8,
            accessCount: 5,
            error: 'Connection timeout',
          },
          status: 'FAILED',
          executionTime: 0,
        },
      });

      const request = createMockGetRequest(
        'http://localhost:3000/api/v1/memory/migration-history'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(data.data.items[0].error).toBe('Connection timeout');
    });

    it('应该按创建时间降序排列', async () => {
      const baseTime = new Date('2024-01-01T00:00:00Z');

      await prisma.agentAction.create({
        data: {
          agentName: 'MemoryAgent',
          actionType: 'MIGRATE_WORKING_TO_HOT' as any,
          actionName: 'Working→Hot Migration',
          actionLayer: 'SCRIPT',
          parameters: {
            memoryId: 'test-memory-1',
            memoryKey: 'test-key-1',
            originalType: 'WORKING',
            targetType: 'HOT',
            importance: 0.8,
            accessCount: 5,
          },
          status: 'COMPLETED',
          executionTime: 100,
          createdAt: baseTime,
        },
      });

      await prisma.agentAction.create({
        data: {
          agentName: 'MemoryAgent',
          actionType: 'MIGRATE_HOT_TO_COLD' as any,
          actionName: 'Hot→Cold Migration',
          actionLayer: 'SCRIPT',
          parameters: {
            memoryId: 'test-memory-2',
            memoryKey: 'test-key-2',
            originalType: 'HOT',
            targetType: 'COLD',
            importance: 0.9,
            accessCount: 10,
          },
          status: 'COMPLETED',
          executionTime: 200,
          createdAt: new Date(baseTime.getTime() + 1000),
        },
      });

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
