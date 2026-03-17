/**
 * 跟进任务处理器测试
 */

import { FollowUpTaskPriority, FollowUpTaskStatus } from '@/types/client';

// 服务内部使用 new PrismaClient()，需要 mock @prisma/client
const mockQueryRaw = jest.fn();
const mockQueryRawUnsafe = jest.fn();

jest.mock('@prisma/client', () => {
  const actual = jest.requireActual(
    '@prisma/client'
  ) as typeof import('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn().mockImplementation(() => ({
      $queryRaw: mockQueryRaw,
      $queryRawUnsafe: mockQueryRawUnsafe,
      followUpTask: {
        create: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    })),
  };
});

// mockPrisma 别名，方便测试中使用
const mockPrisma = {
  $queryRaw: mockQueryRaw,
  $queryRawUnsafe: mockQueryRawUnsafe,
};

const {
  FollowUpTaskProcessor,
} = require('@/lib/client/follow-up-task-processor');

describe('FollowUpTaskProcessor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTasks', () => {
    it('应该返回跟进任务列表', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          clientId: 'client-1',
          communicationId: 'comm-1',
          userId: 'user-1',
          type: 'PHONE',
          summary: '跟进客户',
          dueDate: new Date('2026-01-25'),
          priority: 'HIGH',
          status: 'PENDING',
          completedAt: null,
          notes: null,
          metadata: null,
          createdAt: new Date('2026-01-20'),
          updatedAt: new Date('2026-01-20'),
          clientName: '张三',
          clientPhone: '13800138000',
          clientEmail: 'test@example.com',
        },
      ];

      const mockCountResult = [{ count: BigInt(1) }];

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockTasks);

      const result = await FollowUpTaskProcessor.getTasks({
        userId: 'user-1',
        page: 1,
        limit: 20,
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0].id).toBe('task-1');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.tasks[0].status).toBe(FollowUpTaskStatus.PENDING);
      expect(result.tasks[0].priority).toBe(FollowUpTaskPriority.HIGH);
    });

    it('应该支持按状态筛选', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          clientId: 'client-1',
          communicationId: 'comm-1',
          userId: 'user-1',
          type: 'PHONE',
          summary: '跟进客户',
          dueDate: new Date('2026-01-25'),
          priority: 'HIGH',
          status: 'COMPLETED',
          completedAt: new Date('2026-01-21'),
          notes: '已完成',
          metadata: null,
          createdAt: new Date('2026-01-20'),
          updatedAt: new Date('2026-01-21'),
          clientName: '张三',
          clientPhone: '13800138000',
          clientEmail: 'test@example.com',
        },
      ];

      const mockCountResult = [{ count: BigInt(1) }];

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockTasks);

      const result = await FollowUpTaskProcessor.getTasks({
        userId: 'user-1',
        status: FollowUpTaskStatus.COMPLETED,
        page: 1,
        limit: 20,
      });

      expect(result.tasks[0].status).toBe(FollowUpTaskStatus.COMPLETED);
    });

    it('应该支持按优先级筛选', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          clientId: 'client-1',
          communicationId: 'comm-1',
          userId: 'user-1',
          type: 'PHONE',
          summary: '跟进客户',
          dueDate: new Date('2026-01-25'),
          priority: 'LOW',
          status: 'PENDING',
          completedAt: null,
          notes: null,
          metadata: null,
          createdAt: new Date('2026-01-20'),
          updatedAt: new Date('2026-01-20'),
          clientName: '张三',
          clientPhone: '13800138000',
          clientEmail: 'test@example.com',
        },
      ];

      const mockCountResult = [{ count: BigInt(1) }];

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockTasks);

      const result = await FollowUpTaskProcessor.getTasks({
        userId: 'user-1',
        priority: FollowUpTaskPriority.LOW,
        page: 1,
        limit: 20,
      });

      expect(result.tasks[0].priority).toBe(FollowUpTaskPriority.LOW);
    });

    it('应该支持按日期范围筛选', async () => {
      const mockTasks: unknown[] = [];
      const mockCountResult = [{ count: BigInt(0) }];

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockTasks);

      const result = await FollowUpTaskProcessor.getTasks({
        userId: 'user-1',
        dueDateFrom: new Date('2026-01-01'),
        dueDateTo: new Date('2026-01-31'),
        page: 1,
        limit: 20,
      });

      expect(result.tasks).toHaveLength(0);
    });

    it('应该支持排序', async () => {
      const mockTasks = [
        {
          id: 'task-2',
          clientId: 'client-1',
          communicationId: 'comm-2',
          userId: 'user-1',
          type: 'PHONE',
          summary: '跟进客户2',
          dueDate: new Date('2026-01-26'),
          priority: 'HIGH',
          status: 'PENDING',
          completedAt: null,
          notes: null,
          metadata: null,
          createdAt: new Date('2026-01-20'),
          updatedAt: new Date('2026-01-20'),
          clientName: '张三',
          clientPhone: '13800138000',
          clientEmail: 'test@example.com',
        },
        {
          id: 'task-1',
          clientId: 'client-1',
          communicationId: 'comm-1',
          userId: 'user-1',
          type: 'PHONE',
          summary: '跟进客户1',
          dueDate: new Date('2026-01-25'),
          priority: 'HIGH',
          status: 'PENDING',
          completedAt: null,
          notes: null,
          metadata: null,
          createdAt: new Date('2026-01-20'),
          updatedAt: new Date('2026-01-20'),
          clientName: '张三',
          clientPhone: '13800138000',
          clientEmail: 'test@example.com',
        },
      ];

      const mockCountResult = [{ count: BigInt(2) }];

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockTasks);

      const result = await FollowUpTaskProcessor.getTasks({
        userId: 'user-1',
        sortBy: 'dueDate',
        sortOrder: 'asc',
        page: 1,
        limit: 20,
      });

      expect(result.tasks).toHaveLength(2);
    });

    it('应该处理空结果', async () => {
      const mockTasks: unknown[] = [];
      const mockCountResult = [{ count: BigInt(0) }];

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce(mockCountResult)
        .mockResolvedValueOnce(mockTasks);

      const result = await FollowUpTaskProcessor.getTasks({
        userId: 'user-1',
        page: 1,
        limit: 20,
      });

      expect(result.tasks).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });
  });

  describe('getTask', () => {
    it('应该返回任务详情', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'PENDING',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([mockTask]);

      const result = await FollowUpTaskProcessor.getTask('task-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('task-1');
      expect(result?.summary).toBe('跟进客户');
    });

    it('应该返回null当任务不存在', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await FollowUpTaskProcessor.getTask(
        'non-existent',
        'user-1'
      );

      expect(result).toBeNull();
    });

    it('应该验证用户权限', async () => {
      // 实现在 SQL 查询中包含 userId 过滤，不匹配时返回空结果
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await FollowUpTaskProcessor.getTask('task-1', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('completeTask', () => {
    it('应该标记任务为完成', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'PENDING',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      const mockCompletedTask = {
        ...mockTask,
        status: 'COMPLETED',
        completedAt: new Date('2026-01-21'),
        notes: '已完成',
        updatedAt: new Date('2026-01-21'),
      };

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([{ status: 'COMPLETED' }])
        .mockResolvedValueOnce([mockCompletedTask]);

      const result = await FollowUpTaskProcessor.completeTask(
        'task-1',
        'user-1',
        { notes: '已完成' }
      );

      expect(result).not.toBeNull();
      expect(result?.status).toBe(FollowUpTaskStatus.COMPLETED);
      expect(result?.completedAt).not.toBeNull();
      expect(result?.notes).toBe('已完成');
    });

    it('应该返回null当任务不存在', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await FollowUpTaskProcessor.completeTask(
        'non-existent',
        'user-1',
        { notes: '已完成' }
      );

      expect(result).toBeNull();
    });

    it('应该支持不带备注完成', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'PENDING',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      const mockCompletedTask = {
        ...mockTask,
        status: 'COMPLETED',
        completedAt: new Date('2026-01-21'),
        notes: null,
        updatedAt: new Date('2026-01-21'),
      };

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([{ status: 'COMPLETED' }])
        .mockResolvedValueOnce([mockCompletedTask]);

      const result = await FollowUpTaskProcessor.completeTask(
        'task-1',
        'user-1',
        {}
      );

      expect(result?.status).toBe(FollowUpTaskStatus.COMPLETED);
    });

    it('应该返回原任务当任务已完成', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'COMPLETED',
        completedAt: new Date('2026-01-21'),
        notes: '已完成',
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-21'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([mockTask]);

      const result = await FollowUpTaskProcessor.completeTask(
        'task-1',
        'user-1',
        { notes: '再次完成' }
      );

      expect(result?.status).toBe(FollowUpTaskStatus.COMPLETED);
      expect(result?.notes).toBe('已完成');
    });
  });

  describe('updateTask', () => {
    it('应该更新任务状态', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'PENDING',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      const mockUpdatedTask = {
        ...mockTask,
        status: 'COMPLETED',
        updatedAt: new Date('2026-01-21'),
      };

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([mockUpdatedTask]);

      const result = await FollowUpTaskProcessor.updateTask(
        'task-1',
        'user-1',
        {
          status: FollowUpTaskStatus.COMPLETED,
        }
      );

      expect(result?.status).toBe(FollowUpTaskStatus.COMPLETED);
    });

    it('应该更新任务优先级', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'PENDING',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      const mockUpdatedTask = {
        ...mockTask,
        priority: 'LOW',
        updatedAt: new Date('2026-01-21'),
      };

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([mockTask]) // getTask #1: 检查任务存在
        .mockResolvedValueOnce([]) // UPDATE 语句结果
        .mockResolvedValueOnce([mockUpdatedTask]); // getTask #2: 返回更新后任务

      const result = await FollowUpTaskProcessor.updateTask(
        'task-1',
        'user-1',
        {
          priority: FollowUpTaskPriority.LOW,
        }
      );

      expect(result?.priority).toBe(FollowUpTaskPriority.LOW);
    });

    it('应该更新任务备注', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'PENDING',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      const mockUpdatedTask = {
        ...mockTask,
        notes: '新备注',
        updatedAt: new Date('2026-01-21'),
      };

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([mockTask]) // getTask #1: 检查任务存在
        .mockResolvedValueOnce([]) // UPDATE 语句结果
        .mockResolvedValueOnce([mockUpdatedTask]); // getTask #2: 返回更新后任务

      const result = await FollowUpTaskProcessor.updateTask(
        'task-1',
        'user-1',
        {
          notes: '新备注',
        }
      );

      expect(result?.notes).toBe('新备注');
    });

    it('应该返回null当任务不存在', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await FollowUpTaskProcessor.updateTask(
        'non-existent',
        'user-1',
        {
          status: FollowUpTaskStatus.COMPLETED,
        }
      );

      expect(result).toBeNull();
    });

    it('应该返回原任务当没有更新字段', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'PENDING',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([mockTask]);

      const result = await FollowUpTaskProcessor.updateTask(
        'task-1',
        'user-1',
        {}
      );

      expect(result).toEqual(mockTask);
    });
  });

  describe('cancelTask', () => {
    it('应该取消任务', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'PENDING',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      (mockPrisma.$queryRaw as jest.Mock)
        .mockResolvedValueOnce([mockTask])
        .mockResolvedValueOnce([{ status: 'CANCELLED' }]);

      const result = await FollowUpTaskProcessor.cancelTask('task-1', 'user-1');

      expect(result).toBe(true);
    });

    it('应该返回false当任务不存在', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await FollowUpTaskProcessor.cancelTask(
        'non-existent',
        'user-1'
      );

      expect(result).toBe(false);
    });

    it('应该返回true当任务已取消', async () => {
      const mockTask = {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE',
        summary: '跟进客户',
        dueDate: new Date('2026-01-25'),
        priority: 'HIGH',
        status: 'CANCELLED',
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date('2026-01-20'),
        updatedAt: new Date('2026-01-20'),
        clientName: '张三',
        clientPhone: '13800138000',
        clientEmail: 'test@example.com',
      };

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([mockTask]);

      const result = await FollowUpTaskProcessor.cancelTask('task-1', 'user-1');

      expect(result).toBe(true);
    });
  });

  describe('getPendingCount', () => {
    it('应该返回待处理任务数量', async () => {
      const mockResult = [{ count: BigInt(5) }];

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockResult);

      const result = await FollowUpTaskProcessor.getPendingCount('user-1');

      expect(result).toBe(5);
    });

    it('应该返回0当没有待处理任务', async () => {
      const mockResult = [{ count: BigInt(0) }];

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockResult);

      const result = await FollowUpTaskProcessor.getPendingCount('user-1');

      expect(result).toBe(0);
    });
  });

  describe('getUpcomingTasks', () => {
    it('应该返回即将到期的任务', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          clientId: 'client-1',
          communicationId: 'comm-1',
          userId: 'user-1',
          type: 'PHONE',
          summary: '跟进客户',
          dueDate: new Date('2026-01-22'),
          priority: 'HIGH',
          status: 'PENDING',
          completedAt: null,
          notes: null,
          metadata: null,
          createdAt: new Date('2026-01-20'),
          updatedAt: new Date('2026-01-20'),
          clientName: '张三',
          clientPhone: '13800138000',
          clientEmail: 'test@example.com',
        },
      ];

      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(mockTasks);

      const result = await FollowUpTaskProcessor.getUpcomingTasks('user-1', 7);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
    });

    it('应该返回空数组当没有即将到期的任务', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      const result = await FollowUpTaskProcessor.getUpcomingTasks('user-1', 7);

      expect(result).toHaveLength(0);
    });

    it('应该使用默认天数7天', async () => {
      (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

      await FollowUpTaskProcessor.getUpcomingTasks('user-1');

      expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    });
  });
});
