/**
 * 任务提醒模块测试
 */

// Mock Prisma before importing
const mockPrismaTaskFindUnique = jest.fn();
const mockPrismaTaskFindMany = jest.fn();
const mockPrismaReminderCount = jest.fn();
const mockPrismaReminderDeleteMany = jest.fn();
const mockPrismaReminderDelete = jest.fn();
const mockPrismaReminderFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    task: {
      findUnique: mockPrismaTaskFindUnique,
      findMany: mockPrismaTaskFindMany,
    },
    reminder: {
      count: mockPrismaReminderCount,
      deleteMany: mockPrismaReminderDeleteMany,
      delete: mockPrismaReminderDelete,
      findMany: mockPrismaReminderFindMany,
    },
  },
}));

// Mock logger before importing
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('@/lib/agent/security/logger', () => ({
  logger: mockLogger,
}));

// Mock reminder service before importing
const mockCreateReminders = jest.fn();

jest.mock('@/lib/notification/reminder-service', () => ({
  reminderService: {
    createReminders: mockCreateReminders,
  },
}));

import { taskReminderGenerator } from '@/lib/task/task-reminder';
import { NotificationChannel, _ReminderType } from '@/types/notification';
import { TaskPriority } from '@/types/task';

describe('TaskReminderGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTaskReminders', () => {
    it('应该为高优先级的待办任务生成提醒', async () => {
      const mockTask = {
        id: 'task-1',
        title: '测试任务',
        description: '测试描述',
        status: 'TODO',
        priority: 'HIGH',
        assignedTo: 'user-1',
        createdBy: 'user-1',
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        assignedUser: { name: '测试用户', email: 'test@example.com' },
        case: null,
        caseId: null,
        completedAt: null,
        deletedAt: null,
        tags: [],
        estimatedHours: null,
        actualHours: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never;

      mockPrismaTaskFindUnique.mockResolvedValue(mockTask);
      mockCreateReminders.mockResolvedValue([]);

      await taskReminderGenerator.generateTaskReminders('task-1');

      expect(mockPrismaTaskFindUnique).toHaveBeenCalledWith({
        where: { id: 'task-1', deletedAt: null },
        include: { assignedUser: true, case: true },
      });

      expect(mockCreateReminders).toHaveBeenCalled();
    });

    it('不应该为已完成的任务生成提醒', async () => {
      const mockTask = {
        id: 'task-1',
        title: '测试任务',
        status: 'COMPLETED',
        priority: 'HIGH',
        assignedTo: 'user-1',
        createdBy: 'user-1',
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        assignedUser: { name: '测试用户', email: 'test@example.com' },
        case: null,
        caseId: null,
        completedAt: null,
        deletedAt: null,
        tags: [],
        estimatedHours: null,
        actualHours: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never;

      mockPrismaTaskFindUnique.mockResolvedValue(mockTask);

      await taskReminderGenerator.generateTaskReminders('task-1');

      expect(mockCreateReminders).not.toHaveBeenCalled();
    });

    it('不应该为没有截止日期的任务生成提醒', async () => {
      const mockTask = {
        id: 'task-1',
        title: '测试任务',
        status: 'TODO',
        priority: 'HIGH',
        assignedTo: 'user-1',
        createdBy: 'user-1',
        dueDate: null,
        assignedUser: { name: '测试用户', email: 'test@example.com' },
        case: null,
        caseId: null,
        completedAt: null,
        deletedAt: null,
        tags: [],
        estimatedHours: null,
        actualHours: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never;

      mockPrismaTaskFindUnique.mockResolvedValue(mockTask);

      await taskReminderGenerator.generateTaskReminders('task-1');

      expect(mockCreateReminders).not.toHaveBeenCalled();
    });

    it('不应该为低优先级的任务生成提醒（当配置中限制优先级时）', async () => {
      const mockTask = {
        id: 'task-1',
        title: '测试任务',
        status: 'TODO',
        priority: 'LOW',
        assignedTo: 'user-1',
        createdBy: 'user-1',
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        assignedUser: { name: '测试用户', email: 'test@example.com' },
        case: null,
        caseId: null,
        completedAt: null,
        deletedAt: null,
        tags: [],
        estimatedHours: null,
        actualHours: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never;

      mockPrismaTaskFindUnique.mockResolvedValue(mockTask);

      await taskReminderGenerator.generateTaskReminders('task-1', {
        task: {
          enabled: true,
          hoursBefore: [24, 1],
          channels: [NotificationChannel.IN_APP],
          priorities: [TaskPriority.HIGH, TaskPriority.URGENT],
        },
      });

      expect(mockCreateReminders).not.toHaveBeenCalled();
    });

    it('应该在任务不存在时记录警告', async () => {
      mockPrismaTaskFindUnique.mockResolvedValue(null);

      await taskReminderGenerator.generateTaskReminders('nonexistent-task');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '任务不存在: nonexistent-task'
      );
      expect(mockCreateReminders).not.toHaveBeenCalled();
    });

    it('应该为关联案件的任务生成包含案件信息的提醒', async () => {
      const mockTask = {
        id: 'task-1',
        title: '测试任务',
        status: 'TODO',
        priority: 'HIGH',
        assignedTo: 'user-1',
        createdBy: 'user-1',
        dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
        assignedUser: { name: '测试用户', email: 'test@example.com' },
        case: { id: 'case-1', title: '测试案件' },
        caseId: 'case-1',
        completedAt: null,
        deletedAt: null,
        tags: [],
        estimatedHours: null,
        actualHours: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never;

      mockPrismaTaskFindUnique.mockResolvedValue(mockTask);
      mockCreateReminders.mockResolvedValue([]);

      await taskReminderGenerator.generateTaskReminders('task-1');

      expect(mockCreateReminders).toHaveBeenCalled();
    });
  });

  describe('generateAllPendingTaskReminders', () => {
    it('应该为所有即将到期的任务生成提醒', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: '任务1',
          description: '',
          status: 'TODO',
          priority: 'HIGH',
          assignedTo: 'user-1',
          createdBy: 'user-1',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          assignedUser: { name: '用户1', email: 'user1@example.com' },
          case: null,
          caseId: null,
          completedAt: null,
          deletedAt: null,
          tags: [],
          estimatedHours: null,
          actualHours: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'task-2',
          title: '任务2',
          description: '',
          status: 'IN_PROGRESS',
          priority: 'URGENT',
          assignedTo: 'user-2',
          createdBy: 'user-2',
          dueDate: new Date(Date.now() + 48 * 60 * 60 * 1000),
          assignedUser: { name: '用户2', email: 'user2@example.com' },
          case: null,
          caseId: null,
          completedAt: null,
          deletedAt: null,
          tags: [],
          estimatedHours: null,
          actualHours: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never[];

      mockPrismaTaskFindMany.mockResolvedValue(mockTasks);
      mockPrismaReminderCount.mockResolvedValue(0);

      jest
        .spyOn(taskReminderGenerator, 'generateTaskReminders')
        .mockResolvedValue();

      const count =
        await taskReminderGenerator.generateAllPendingTaskReminders();

      expect(count).toBe(2);
      expect(taskReminderGenerator.generateTaskReminders).toHaveBeenCalledWith(
        'task-1'
      );
      expect(taskReminderGenerator.generateTaskReminders).toHaveBeenCalledWith(
        'task-2'
      );
    });

    it('不应该为已有足够提醒的任务重新生成提醒', async () => {
      const mockTasks = [
        {
          id: 'task-1',
          title: '任务1',
          description: '',
          status: 'TODO',
          priority: 'HIGH',
          assignedTo: 'user-1',
          createdBy: 'user-1',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          assignedUser: { name: '用户1', email: 'user1@example.com' },
          case: null,
          caseId: null,
          completedAt: null,
          deletedAt: null,
          tags: [],
          estimatedHours: null,
          actualHours: null,
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never[];

      mockPrismaTaskFindMany.mockResolvedValue(mockTasks);
      mockPrismaReminderCount.mockResolvedValue(2);

      jest
        .spyOn(taskReminderGenerator, 'generateTaskReminders')
        .mockResolvedValue();

      const count =
        await taskReminderGenerator.generateAllPendingTaskReminders();

      expect(count).toBe(0);
      expect(
        taskReminderGenerator.generateTaskReminders
      ).not.toHaveBeenCalled();
    });
  });

  describe('cleanupOrphanTaskReminders', () => {
    it('应该清理没有关联任务的提醒', async () => {
      const mockReminders = [
        {
          id: 'reminder-1',
          relatedId: 'task-1',
          relatedType: 'Task',
          userId: 'user-1',
          type: 'TASK',
          title: '提醒1',
          message: '',
          reminderTime: new Date(),
          channels: [],
          status: 'PENDING',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'reminder-2',
          relatedId: 'task-2',
          relatedType: 'Task',
          userId: 'user-2',
          type: 'TASK',
          title: '提醒2',
          message: '',
          reminderTime: new Date(),
          channels: [],
          status: 'PENDING',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never[];

      mockPrismaReminderFindMany.mockResolvedValue(mockReminders);
      mockPrismaTaskFindUnique.mockResolvedValue(null);
      mockPrismaReminderDelete.mockResolvedValue({} as never);

      const count = await taskReminderGenerator.cleanupOrphanTaskReminders();

      expect(count).toBe(2);
      expect(mockPrismaReminderDelete).toHaveBeenCalledTimes(2);
    });

    it('应该保留有关联任务的提醒', async () => {
      const mockReminders = [
        {
          id: 'reminder-1',
          relatedId: 'task-1',
          relatedType: 'Task',
          userId: 'user-1',
          type: 'TASK',
          title: '提醒1',
          message: '',
          reminderTime: new Date(),
          channels: [],
          status: 'PENDING',
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as never[];

      mockPrismaReminderFindMany.mockResolvedValue(mockReminders);
      mockPrismaTaskFindUnique.mockResolvedValue({ id: 'task-1' } as never);

      const count = await taskReminderGenerator.cleanupOrphanTaskReminders();

      expect(count).toBe(0);
      expect(mockPrismaReminderDelete).not.toHaveBeenCalled();
    });
  });

  describe('cleanupCompletedTaskReminders', () => {
    it('应该清理已完成任务的待发送提醒', async () => {
      mockPrismaReminderDeleteMany.mockResolvedValue({ count: 3 });

      const count =
        await taskReminderGenerator.cleanupCompletedTaskReminders('task-1');

      expect(count).toBe(3);
      expect(mockPrismaReminderDeleteMany).toHaveBeenCalledWith({
        where: {
          relatedType: 'Task',
          relatedId: 'task-1',
          status: { in: ['PENDING', 'SENT'] },
        },
      });
    });
  });

  describe('getDefaultConfig', () => {
    it('应该返回默认的任务提醒配置', () => {
      const config = taskReminderGenerator.getDefaultConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.hoursBefore).toEqual([24, 1]);
      expect(config.channels).toContain(NotificationChannel.IN_APP);
      expect(config.channels).toContain(NotificationChannel.EMAIL);
      expect(config.priorities).toContain(TaskPriority.HIGH);
      expect(config.priorities).toContain(TaskPriority.URGENT);
    });
  });
});
