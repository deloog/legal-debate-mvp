/**
 * 跟进提醒定时任务测试
 */

import { prisma } from '@/lib/db/prisma';
import {
  sendFollowUpReminders,
  getFollowUpRemindersStats,
  getTasksExpiringSoon,
  markExpiredFollowUpTasks,
} from '@/lib/cron/send-follow-up-reminders';
import { notificationService } from '@/lib/notification/notification-service';
import { FollowUpTaskPriority, FollowUpTaskStatus } from '@prisma/client';
import { NotificationChannel } from '@/types/notification';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    followUpTask: {
      findMany: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/notification/notification-service', () => ({
  notificationService: {
    getNotificationChannelsForTask: jest.fn(),
    sendFollowUpTaskReminder: jest.fn(),
  },
}));

jest.mock('@/lib/agent/security/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('sendFollowUpReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该在没有待处理任务时返回空结果', async () => {
    (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

    const result = await sendFollowUpReminders();

    expect(result.totalTasksChecked).toBe(0);
    expect(result.tasksWithRemindersSent).toBe(0);
    expect(result.tasksFailedToSend).toBe(0);
    expect(result.results).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('应该成功发送跟进任务提醒', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE' as const,
        summary: '电话跟进',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后
        priority: 'HIGH' as FollowUpTaskPriority,
        status: 'PENDING' as FollowUpTaskStatus,
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: {
          id: 'client-1',
          userId: 'user-1',
          name: '客户1',
          email: 'client1@test.com',
          phone: '13800138000',
        },
        user: {
          id: 'user-1',
          email: 'user@test.com',
          name: '用户1',
        },
      },
    ];

    (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue(
      mockTasks as never
    );
    (
      notificationService.getNotificationChannelsForTask as jest.Mock
    ).mockReturnValue([NotificationChannel.EMAIL]);
    (
      notificationService.sendFollowUpTaskReminder as jest.Mock
    ).mockResolvedValue({
      success: true,
      channels: [NotificationChannel.EMAIL],
    });

    const result = await sendFollowUpReminders();

    expect(result.totalTasksChecked).toBe(1);
    expect(result.tasksWithRemindersSent).toBe(1);
    expect(result.tasksFailedToSend).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].sent).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('应该处理提醒发送失败的情况', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'EMAIL' as const,
        summary: '邮件跟进',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        priority: 'HIGH' as FollowUpTaskPriority,
        status: 'PENDING' as FollowUpTaskStatus,
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: {
          id: 'client-1',
          userId: 'user-1',
          name: '客户1',
          email: 'client1@test.com',
          phone: '13800138000',
        },
        user: {
          id: 'user-1',
          email: 'user@test.com',
          name: '用户1',
        },
      },
    ];

    (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue(
      mockTasks as never
    );
    (
      notificationService.getNotificationChannelsForTask as jest.Mock
    ).mockReturnValue([NotificationChannel.EMAIL]);
    (
      notificationService.sendFollowUpTaskReminder as jest.Mock
    ).mockResolvedValue({
      success: false,
      channels: [NotificationChannel.EMAIL],
      errors: {
        [NotificationChannel.EMAIL]: '邮件发送失败',
      },
    });

    const result = await sendFollowUpReminders();

    expect(result.totalTasksChecked).toBe(1);
    expect(result.tasksWithRemindersSent).toBe(0);
    expect(result.tasksFailedToSend).toBe(1);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].sent).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].error).toBe('邮件发送失败');
  });

  it('应该处理不在提醒时间窗口内的任务', async () => {
    const mockTasks = [
      {
        id: 'task-1',
        clientId: 'client-1',
        communicationId: 'comm-1',
        userId: 'user-1',
        type: 'PHONE' as const,
        summary: '电话跟进',
        dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72小时后（不在HIGH优先级提醒窗口内）
        priority: 'HIGH' as FollowUpTaskPriority,
        status: 'PENDING' as FollowUpTaskStatus,
        completedAt: null,
        notes: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: {
          id: 'client-1',
          userId: 'user-1',
          name: '客户1',
          email: 'client1@test.com',
          phone: '13800138000',
        },
        user: {
          id: 'user-1',
          email: 'user@test.com',
          name: '用户1',
        },
      },
    ];

    (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue(
      mockTasks as never
    );

    const result = await sendFollowUpReminders();

    expect(result.totalTasksChecked).toBe(1);
    expect(result.tasksWithRemindersSent).toBe(0);
    expect(result.tasksFailedToSend).toBe(0);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].sent).toBe(false);
    expect(result.results[0].error).toBe('不在提醒时间窗口内');
    expect(result.errors).toEqual([]);
  });
});

describe('getFollowUpRemindersStats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该返回正确的统计信息', async () => {
    (prisma.followUpTask.count as jest.Mock)
      .mockResolvedValueOnce(10) // pendingTasksCount
      .mockResolvedValueOnce(5) // urgentTasksCount
      .mockResolvedValueOnce(2) // highPriorityTasksCount
      .mockResolvedValueOnce(3) // mediumPriorityTasksCount
      .mockResolvedValueOnce(5); // lowPriorityTasksCount

    (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'task-1',
        clientId: 'client-1',
        summary: '任务1',
        dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        priority: 'HIGH' as FollowUpTaskPriority,
        client: {
          id: 'client-1',
          userId: 'user-1',
          name: '客户1',
        },
      },
    ] as never);

    const stats = await getFollowUpRemindersStats();

    expect(stats.pendingTasksCount).toBe(10);
    expect(stats.urgentTasksCount).toBe(5);
    expect(stats.highPriorityTasksCount).toBe(2);
    expect(stats.mediumPriorityTasksCount).toBe(3);
    expect(stats.lowPriorityTasksCount).toBe(5);
    expect(stats.tasksExpiringNext24h).toHaveLength(1);
  });
});

describe('getTasksExpiringSoon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该返回即将到期的任务列表', async () => {
    (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'task-2',
        clientId: 'client-2',
        summary: '任务2',
        dueDate: new Date(Date.now() + 6 * 60 * 60 * 1000),
        priority: 'MEDIUM' as FollowUpTaskPriority,
        client: {
          id: 'client-2',
          userId: 'user-2',
          name: '客户2',
        },
      },
      {
        id: 'task-1',
        clientId: 'client-1',
        summary: '任务1',
        dueDate: new Date(Date.now() + 12 * 60 * 60 * 1000),
        priority: 'HIGH' as FollowUpTaskPriority,
        client: {
          id: 'client-1',
          userId: 'user-1',
          name: '客户1',
        },
      },
    ] as never);

    const tasks = await getTasksExpiringSoon(24, 10);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('task-2'); // 应该按dueDate排序，先到期的在前
    expect(tasks[1].id).toBe('task-1');
    expect(tasks[0].hoursUntilDue).toBe(6);
    expect(tasks[1].hoursUntilDue).toBe(12);
  });

  it('应该使用默认参数', async () => {
    (prisma.followUpTask.findMany as jest.Mock).mockResolvedValue([]);

    await getTasksExpiringSoon();

    expect(prisma.followUpTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: expect.objectContaining({
            lte: expect.any(Date),
          }),
        }),
        take: 50,
      })
    );
  });
});

describe('markExpiredFollowUpTasks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该标记已过期的跟进任务', async () => {
    (prisma.followUpTask.updateMany as jest.Mock).mockResolvedValue({
      count: 5,
    });

    const result = await markExpiredFollowUpTasks();

    expect(result.cancelledCount).toBe(5);
    expect(prisma.followUpTask.updateMany).toHaveBeenCalledWith({
      where: {
        status: 'PENDING',
        dueDate: {
          lt: expect.any(Date),
        },
      },
      data: {
        status: 'CANCELLED',
        notes: '任务已过期，自动取消',
      },
    });
  });

  it('应该在没有过期任务时返回0', async () => {
    (prisma.followUpTask.updateMany as jest.Mock).mockResolvedValue({
      count: 0,
    });

    const result = await markExpiredFollowUpTasks();

    expect(result.cancelledCount).toBe(0);
  });
});
