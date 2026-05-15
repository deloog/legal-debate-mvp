/**
 * 提醒发送器测试
 *
 * 测试提醒发送器的核心功能
 */

import { reminderSender } from '@/lib/notification/reminder-sender';
import { reminderService } from '@/lib/notification/reminder-service';
import { inAppMessageService } from '@/lib/notification/in-app-message-service';
import { prisma } from '@/lib/db/prisma';
import {
  NotificationChannel,
  ReminderType,
  ReminderStatus,
} from '@/types/notification';
import type { Reminder as PrismaReminder } from '@prisma/client';

// Mock dependencies
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    reminder: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/notification/reminder-service', () => ({
  reminderService: {
    getPendingReminders: jest.fn(),
    markAsSent: jest.fn(),
  },
}));

jest.mock('@/lib/notification/email-service', () => ({
  getEmailService: jest.fn(() => ({
    sendCustomEmail: jest.fn(),
  })),
}));

jest.mock('@/lib/notification/in-app-message-service', () => ({
  inAppMessageService: {
    createMessage: jest.fn(),
  },
}));

jest.mock('@/lib/agent/security/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ReminderSender', () => {
  const mockUser = {
    id: 'user-1',
    name: '测试用户',
    username: 'testuser',
    email: 'test@example.com',
    phone: '+8613800138000',
  };

  const mockReminder: PrismaReminder = {
    id: 'reminder-1',
    userId: 'user-1',
    type: ReminderType.FOLLOW_UP,
    title: '跟进任务提醒',
    message: '请及时跟进客户',
    reminderTime: new Date('2024-01-15T10:00:00Z'),
    channels: [NotificationChannel.EMAIL, NotificationChannel.IN_APP],
    status: ReminderStatus.PENDING,
    relatedType: 'FollowUpTask',
    relatedId: 'task-1',
    metadata: {
      clientName: '张三',
      summary: '跟进合同签署',
    },
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendReminder', () => {
    it('应该成功发送站内消息和邮件', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (inAppMessageService.createMessage as jest.Mock).mockResolvedValue({
        id: 'message-1',
      });
      const mockEmailService = {
        sendCustomEmail: jest.fn().mockResolvedValue({
          success: true,
          messageId: 'email-1',
        }),
        sendFollowUpTaskEmail: jest.fn(),
      };

      const { getEmailService } = jest.mocked(
        await import('@/lib/notification/email-service')
      );
      getEmailService.mockReturnValue(mockEmailService);

      const result = await reminderSender.sendReminder(mockReminder as never);

      expect(result).toBe(true);
      expect(inAppMessageService.createMessage).toHaveBeenCalledWith({
        userId: mockReminder.userId,
        type: mockReminder.type,
        title: mockReminder.title,
        content: mockReminder.message,
        relatedType: mockReminder.relatedType,
        relatedId: mockReminder.relatedId,
        metadata: mockReminder.metadata,
        reminderTime: mockReminder.reminderTime,
      });
      expect(mockEmailService.sendCustomEmail).toHaveBeenCalled();
      expect(reminderService.markAsSent).toHaveBeenCalledWith(mockReminder.id);
    });

    it('应该只发送站内消息当只有站内消息渠道', async () => {
      const reminderWithoutEmail = {
        ...mockReminder,
        channels: [NotificationChannel.IN_APP],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (inAppMessageService.createMessage as jest.Mock).mockResolvedValue({
        id: 'message-1',
      });

      const result = await reminderSender.sendReminder(
        reminderWithoutEmail as never
      );

      expect(result).toBe(true);
      expect(inAppMessageService.createMessage).toHaveBeenCalled();
      expect(reminderService.markAsSent).toHaveBeenCalledWith(mockReminder.id);
    });

    it('应该只发送邮件当只有邮件渠道', async () => {
      const reminderWithoutInApp = {
        ...mockReminder,
        channels: [NotificationChannel.EMAIL],
      };

      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      const mockEmailService = {
        sendCustomEmail: jest.fn().mockResolvedValue({
          success: true,
          messageId: 'email-1',
        }),
        sendFollowUpTaskEmail: jest.fn(),
      };

      const { getEmailService } = jest.mocked(
        await import('@/lib/notification/email-service')
      );
      getEmailService.mockReturnValue(mockEmailService);

      const result = await reminderSender.sendReminder(
        reminderWithoutInApp as never
      );

      expect(result).toBe(true);
      expect(mockEmailService.sendCustomEmail).toHaveBeenCalled();
      expect(reminderService.markAsSent).toHaveBeenCalledWith(mockReminder.id);
    });

    it('应该在用户不存在时返回false', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await reminderSender.sendReminder(mockReminder as never);

      expect(result).toBe(false);
      expect(inAppMessageService.createMessage).not.toHaveBeenCalled();
    });

    it('应该在所有渠道发送失败时返回false', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (inAppMessageService.createMessage as jest.Mock).mockResolvedValue(null);
      const mockEmailService = {
        sendCustomEmail: jest.fn().mockResolvedValue({
          success: false,
          error: '发送失败',
        }),
        sendFollowUpTaskEmail: jest.fn(),
      };

      const { getEmailService } = jest.mocked(
        await import('@/lib/notification/email-service')
      );
      getEmailService.mockReturnValue(mockEmailService);

      const result = await reminderSender.sendReminder(mockReminder as never);

      expect(result).toBe(false);
      expect(reminderService.markAsSent).not.toHaveBeenCalled();
    });

    it('应该在邮件发送失败但站内消息成功时返回true', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (inAppMessageService.createMessage as jest.Mock).mockResolvedValue({
        id: 'message-1',
      });
      const mockEmailService = {
        sendCustomEmail: jest.fn().mockResolvedValue({
          success: false,
          error: '发送失败',
        }),
        sendFollowUpTaskEmail: jest.fn(),
      };

      const { getEmailService } = jest.mocked(
        await import('@/lib/notification/email-service')
      );
      getEmailService.mockReturnValue(mockEmailService);

      const result = await reminderSender.sendReminder(mockReminder as never);

      expect(result).toBe(true);
      expect(reminderService.markAsSent).toHaveBeenCalledWith(mockReminder.id);
    });
  });

  describe('sendPendingReminders', () => {
    it('应该批量发送待发送的提醒', async () => {
      const pendingReminders = [
        mockReminder,
        { ...mockReminder, id: 'reminder-2' },
      ];

      (reminderService.getPendingReminders as jest.Mock).mockResolvedValue(
        pendingReminders
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (inAppMessageService.createMessage as jest.Mock).mockResolvedValue({
        id: 'message-1',
      });
      const mockEmailService = {
        sendCustomEmail: jest.fn().mockResolvedValue({
          success: true,
          messageId: 'email-1',
        }),
        sendFollowUpTaskEmail: jest.fn(),
      };

      const { getEmailService } = jest.mocked(
        await import('@/lib/notification/email-service')
      );
      getEmailService.mockReturnValue(mockEmailService);

      const result = await reminderSender.sendPendingReminders();

      expect(result).toEqual({ success: 2, failed: 0 });
      expect(reminderService.getPendingReminders).toHaveBeenCalled();
    });

    it('应该正确统计成功和失败的数量', async () => {
      const pendingReminders = [
        mockReminder,
        { ...mockReminder, id: 'reminder-2' },
        { ...mockReminder, id: 'reminder-3' },
      ];

      (reminderService.getPendingReminders as jest.Mock).mockResolvedValue(
        pendingReminders
      );
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce(null) // 用户不存在
        .mockResolvedValueOnce(mockUser);
      (inAppMessageService.createMessage as jest.Mock)
        .mockResolvedValueOnce({ id: 'message-1' })
        .mockResolvedValueOnce({ id: 'message-3' });
      const mockEmailService = {
        sendCustomEmail: jest.fn().mockResolvedValue({
          success: true,
          messageId: 'email-1',
        }),
        sendFollowUpTaskEmail: jest.fn(),
      };

      const { getEmailService } = jest.mocked(
        await import('@/lib/notification/email-service')
      );
      getEmailService.mockReturnValue(mockEmailService);

      const result = await reminderSender.sendPendingReminders();

      expect(result).toEqual({ success: 2, failed: 1 });
    });

    it('应该在获取待发送提醒失败时返回0', async () => {
      (reminderService.getPendingReminders as jest.Mock).mockRejectedValue(
        new Error('获取失败')
      );

      const result = await reminderSender.sendPendingReminders();

      expect(result).toEqual({ success: 0, failed: 0 });
    });
  });
});
