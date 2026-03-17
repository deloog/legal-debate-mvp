/**
 * 站内消息服务测试
 *
 * 测试站内消息的创建、查询、标记已读等功能
 */

import { prisma } from '@/lib/db/prisma';
import { inAppMessageService } from '@/lib/notification/in-app-message-service';
import {
  NotificationChannel,
  ReminderStatus,
  ReminderType,
} from '@/types/notification';
import type { Reminder as PrismaReminder } from '@prisma/client';

// Mock dependencies - 使用内联工厂避免变量提升问题
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    reminder: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('InAppMessageService', () => {
  // 内联mock对象用于测试断言
  const __mockPrismaReminder = {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  };

  const mockReminder: PrismaReminder = {
    id: 'reminder-1',
    userId: 'user-1',
    type: ReminderType.FOLLOW_UP,
    title: '测试消息',
    message: '消息内容',
    reminderTime: new Date('2024-01-15T10:00:00Z'),
    channels: [NotificationChannel.IN_APP],
    status: ReminderStatus.SENT,
    relatedType: 'FollowUpTask',
    relatedId: 'task-1',
    metadata: { readAt: new Date().toISOString() } as never,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMessage', () => {
    it('应该成功创建站内消息', async () => {
      (prisma.reminder.create as jest.Mock).mockResolvedValue(mockReminder);

      const input = {
        userId: 'user-1',
        type: ReminderType.FOLLOW_UP,
        title: '测试消息',
        content: '消息内容',
        relatedType: 'FollowUpTask',
        relatedId: 'task-1',
        metadata: { clientName: '张三' },
        reminderTime: new Date(),
      };

      const result = await inAppMessageService.createMessage(input);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('reminder-1');
      expect(result?.userId).toBe('user-1');
      expect(result?.title).toBe('测试消息');
      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: {
          userId: input.userId,
          type: input.type,
          title: input.title,
          message: input.content,
          reminderTime: input.reminderTime,
          channels: [NotificationChannel.IN_APP],
          status: ReminderStatus.SENT,
          relatedType: input.relatedType,
          relatedId: input.relatedId,
          metadata: input.metadata,
        },
      });
    });

    it('应该在创建失败时返回null', async () => {
      (prisma.reminder.create as jest.Mock).mockRejectedValue(
        new Error('创建失败')
      );

      const input = {
        userId: 'user-1',
        type: ReminderType.FOLLOW_UP,
        title: '测试消息',
      };

      const result = await inAppMessageService.createMessage(input);

      expect(result).toBeNull();
    });
  });

  describe('createMessages', () => {
    it('应该批量创建站内消息', async () => {
      (prisma.reminder.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      const inputs = [
        {
          userId: 'user-1',
          type: ReminderType.FOLLOW_UP,
          title: '消息1',
        },
        {
          userId: 'user-1',
          type: ReminderType.FOLLOW_UP,
          title: '消息2',
        },
      ];

      const result = await inAppMessageService.createMessages(inputs);

      expect(result).toEqual([]);
      expect(prisma.reminder.createMany).toHaveBeenCalled();
    });

    it('应该在批量创建失败时返回空数组', async () => {
      (prisma.reminder.createMany as jest.Mock).mockRejectedValue(
        new Error('批量创建失败')
      );

      const inputs = [
        {
          userId: 'user-1',
          type: ReminderType.FOLLOW_UP,
          title: '消息1',
        },
      ];

      const result = await inAppMessageService.createMessages(inputs);

      expect(result).toEqual([]);
    });
  });

  describe('getMessages', () => {
    it('应该获取站内消息列表', async () => {
      (prisma.reminder.count as jest.Mock).mockResolvedValue(10);
      (prisma.reminder.findMany as jest.Mock).mockResolvedValue([mockReminder]);

      const result = await inAppMessageService.getMessages({
        userId: 'user-1',
        page: 1,
        limit: 20,
      });

      expect(result.messages).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(prisma.reminder.count).toHaveBeenCalled();
      expect(prisma.reminder.findMany).toHaveBeenCalled();
    });

    it('应该筛选已读和未读消息', async () => {
      (prisma.reminder.count as jest.Mock).mockResolvedValue(5);
      (prisma.reminder.findMany as jest.Mock).mockResolvedValue([mockReminder]);

      const __result = await inAppMessageService.getMessages({
        userId: 'user-1',
        isRead: false,
      });

      expect(prisma.reminder.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'user-1',
          status: ReminderStatus.SENT,
        }),
      });
    });
  });

  describe('getUnreadCount', () => {
    it('应该获取未读消息数量', async () => {
      (prisma.reminder.count as jest.Mock).mockResolvedValue(5);

      const count = await inAppMessageService.getUnreadCount('user-1');

      expect(count).toBe(5);
      expect(prisma.reminder.count).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: ReminderStatus.SENT,
          channels: { has: NotificationChannel.IN_APP },
        },
      });
    });
  });

  describe('markAsRead', () => {
    it('应该成功标记消息为已读', async () => {
      (prisma.reminder.findUnique as jest.Mock).mockResolvedValue(mockReminder);
      (prisma.reminder.update as jest.Mock).mockResolvedValue(mockReminder);

      const result = await inAppMessageService.markAsRead(
        'reminder-1',
        'user-1'
      );

      expect(result).toBe(true);
      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'reminder-1' },
        data: {
          status: ReminderStatus.READ,
          metadata: expect.objectContaining({
            readAt: expect.any(Date),
          }),
        },
      });
    });

    it('应该在消息不存在时返回false', async () => {
      (prisma.reminder.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await inAppMessageService.markAsRead(
        'reminder-1',
        'user-1'
      );

      expect(result).toBe(false);
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });

    it('应该在用户无权限时返回false', async () => {
      const otherUserReminder = { ...mockReminder, userId: 'user-2' };
      (prisma.reminder.findUnique as jest.Mock).mockResolvedValue(
        otherUserReminder
      );

      const result = await inAppMessageService.markAsRead(
        'reminder-1',
        'user-1'
      );

      expect(result).toBe(false);
      expect(prisma.reminder.update).not.toHaveBeenCalled();
    });
  });

  describe('markMultipleAsRead', () => {
    it('应该批量标记消息为已读', async () => {
      (prisma.reminder.findUnique as jest.Mock).mockResolvedValue(mockReminder);
      (prisma.reminder.update as jest.Mock).mockResolvedValue(mockReminder);

      const result = await inAppMessageService.markMultipleAsRead(
        ['reminder-1', 'reminder-2'],
        'user-1'
      );

      expect(result).toEqual({ success: 2, failed: 0 });
    });

    it('应该正确统计成功和失败的数量', async () => {
      (prisma.reminder.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockReminder)
        .mockResolvedValueOnce(null);
      (prisma.reminder.update as jest.Mock).mockResolvedValue(mockReminder);

      const result = await inAppMessageService.markMultipleAsRead(
        ['reminder-1', 'reminder-2'],
        'user-1'
      );

      expect(result).toEqual({ success: 1, failed: 1 });
    });
  });

  describe('markAllAsRead', () => {
    it('应该标记所有未读消息为已读', async () => {
      (prisma.reminder.updateMany as jest.Mock).mockResolvedValue({
        count: 10,
      });

      const count = await inAppMessageService.markAllAsRead('user-1');

      expect(count).toBe(10);
      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: ReminderStatus.SENT,
          channels: { has: NotificationChannel.IN_APP },
        },
        data: {
          status: ReminderStatus.READ,
        },
      });
    });
  });

  describe('deleteMessage', () => {
    it('应该成功删除消息', async () => {
      (prisma.reminder.findUnique as jest.Mock).mockResolvedValue(mockReminder);
      (prisma.reminder.delete as jest.Mock).mockResolvedValue(mockReminder);

      const result = await inAppMessageService.deleteMessage(
        'reminder-1',
        'user-1'
      );

      expect(result).toBe(true);
      expect(prisma.reminder.delete).toHaveBeenCalledWith({
        where: { id: 'reminder-1' },
      });
    });

    it('应该在消息不存在时返回false', async () => {
      (prisma.reminder.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await inAppMessageService.deleteMessage(
        'reminder-1',
        'user-1'
      );

      expect(result).toBe(false);
      expect(prisma.reminder.delete).not.toHaveBeenCalled();
    });
  });

  describe('getMessageById', () => {
    it('应该获取消息详情', async () => {
      (prisma.reminder.findUnique as jest.Mock).mockResolvedValue(mockReminder);

      const result = await inAppMessageService.getMessageById(
        'reminder-1',
        'user-1'
      );

      expect(result).not.toBeNull();
      expect(result?.id).toBe('reminder-1');
    });

    it('应该在消息不存在时返回null', async () => {
      (prisma.reminder.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await inAppMessageService.getMessageById(
        'reminder-1',
        'user-1'
      );

      expect(result).toBeNull();
    });
  });

  describe('cleanupExpiredMessages', () => {
    it('应该清理过期消息', async () => {
      (prisma.reminder.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const count = await inAppMessageService.cleanupExpiredMessages(30);

      expect(count).toBe(5);
      // deleteMany 使用 { where: {...} } 格式调用
      expect(prisma.reminder.deleteMany).toHaveBeenCalled();
    });
  });
});
