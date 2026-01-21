/**
 * 提醒服务单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { reminderService } from '@/lib/notification/reminder-service';
import { reminderGenerator } from '@/lib/notification/reminder-generator';
import { reminderSender } from '@/lib/notification/reminder-sender';
import { prisma } from '@/lib/db/prisma';
import {
  ReminderType,
  ReminderStatus,
  NotificationChannel,
  ReminderPreferences,
} from '@/types/notification';

// Mock Prisma 客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    reminder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    courtSchedule: {
      findUnique: jest.fn(),
    },
    followUpTask: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('@/lib/agent/security/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock 邮件服务
jest.mock('@/lib/notification/email-service', () => ({
  getEmailService: jest.fn(() => ({
    sendCustomEmail: jest.fn().mockResolvedValue({
      success: true,
      messageId: 'test-message-id',
    }),
  })),
}));

describe('ReminderService', () => {
  const mockUserId = 'test-user-id';
  const mockReminder = {
    id: 'reminder-1',
    userId: mockUserId,
    type: 'COURT_SCHEDULE',
    title: '法庭提醒',
    message: '请准时出庭',
    reminderTime: new Date('2024-12-01T09:00:00Z'),
    channels: ['IN_APP', 'EMAIL'],
    status: 'PENDING',
    relatedType: 'CourtSchedule',
    relatedId: 'schedule-1',
    metadata: { caseTitle: '案件测试' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createReminder', () => {
    it('应该成功创建提醒', async () => {
      const mockCreate = prisma.reminder.create as jest.Mock;
      mockCreate.mockResolvedValue(mockReminder);

      const result = await reminderService.createReminder({
        userId: mockUserId,
        type: ReminderType.COURT_SCHEDULE,
        title: '法庭提醒',
        reminderTime: new Date('2024-12-01T09:00:00Z'),
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('reminder-1');
      expect(result.title).toBe('法庭提醒');
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('应该正确处理创建提醒失败的情况', async () => {
      const mockCreate = prisma.reminder.create as jest.Mock;
      mockCreate.mockRejectedValue(new Error('数据库错误'));

      await expect(
        reminderService.createReminder({
          userId: mockUserId,
          type: ReminderType.COURT_SCHEDULE,
          title: '法庭提醒',
          reminderTime: new Date('2024-12-01T09:00:00Z'),
          channels: [NotificationChannel.IN_APP],
        })
      ).rejects.toThrow('数据库错误');
    });
  });

  describe('getReminders', () => {
    it('应该成功获取提醒列表', async () => {
      const mockFindMany = prisma.reminder.findMany as jest.Mock;
      const mockCount = prisma.reminder.count as jest.Mock;

      mockFindMany.mockResolvedValue([mockReminder]);
      mockCount.mockResolvedValue(1);

      const result = await reminderService.getReminders({
        userId: mockUserId,
        page: 1,
        limit: 20,
      });

      expect(result.reminders).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('应该正确处理空列表', async () => {
      const mockFindMany = prisma.reminder.findMany as jest.Mock;
      const mockCount = prisma.reminder.count as jest.Mock;

      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const result = await reminderService.getReminders({
        userId: mockUserId,
        page: 1,
        limit: 20,
      });

      expect(result.reminders).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('updateReminder', () => {
    it('应该成功更新提醒', async () => {
      const mockUpdate = prisma.reminder.update as jest.Mock;
      const updatedReminder = {
        ...mockReminder,
        title: '更新后的标题',
      };
      mockUpdate.mockResolvedValue(updatedReminder);

      const result = await reminderService.updateReminder(
        'reminder-1',
        mockUserId,
        { title: '更新后的标题' }
      );

      expect(result.title).toBe('更新后的标题');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('应该正确处理更新失败的情况', async () => {
      const mockUpdate = prisma.reminder.update as jest.Mock;
      mockUpdate.mockRejectedValue(new Error('提醒不存在'));

      await expect(
        reminderService.updateReminder('reminder-1', mockUserId, {
          title: '更新后的标题',
        })
      ).rejects.toThrow('提醒不存在');
    });
  });

  describe('deleteReminder', () => {
    it('应该成功删除提醒', async () => {
      const mockDelete = prisma.reminder.delete as jest.Mock;
      mockDelete.mockResolvedValue(mockReminder);

      const result = await reminderService.deleteReminder(
        'reminder-1',
        mockUserId
      );

      expect(result).toBe(true);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });

    it('应该正确处理删除失败的情况', async () => {
      const mockDelete = prisma.reminder.delete as jest.Mock;
      mockDelete.mockRejectedValue(new Error('提醒不存在'));

      const result = await reminderService.deleteReminder(
        'reminder-1',
        mockUserId
      );

      expect(result).toBe(false);
    });
  });

  describe('markAsSent', () => {
    it('应该成功标记提醒为已发送', async () => {
      const mockUpdate = prisma.reminder.update as jest.Mock;
      const sentReminder = {
        ...mockReminder,
        status: 'SENT',
      };
      mockUpdate.mockResolvedValue(sentReminder);

      const result = await reminderService.markAsSent('reminder-1');

      expect(result.status).toBe(ReminderStatus.SENT);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('markAsRead', () => {
    it('应该成功标记提醒为已读', async () => {
      const mockUpdate = prisma.reminder.update as jest.Mock;
      const readReminder = {
        ...mockReminder,
        status: 'READ',
      };
      mockUpdate.mockResolvedValue(readReminder);

      const result = await reminderService.markAsRead('reminder-1', mockUserId);

      expect(result.status).toBe(ReminderStatus.READ);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismissReminder', () => {
    it('应该成功忽略提醒', async () => {
      const mockUpdate = prisma.reminder.update as jest.Mock;
      const dismissedReminder = {
        ...mockReminder,
        status: 'DISMISSED',
      };
      mockUpdate.mockResolvedValue(dismissedReminder);

      const result = await reminderService.dismissReminder(
        'reminder-1',
        mockUserId
      );

      expect(result.status).toBe(ReminderStatus.DISMISSED);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ReminderGenerator', () => {
  const mockCourtSchedule = {
    id: 'schedule-1',
    title: '开庭通知',
    startTime: new Date('2024-12-01T10:00:00Z'),
    location: '第一法庭',
    judge: '张法官',
    case: {
      id: 'case-1',
      userId: 'user-1',
      title: '测试案件',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCourtScheduleReminders', () => {
    it('应该成功生成法庭日程提醒', async () => {
      const mockCreate = prisma.reminder.create as jest.Mock;
      const mockFindUnique = prisma.courtSchedule.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(mockCourtSchedule);

      mockCreate.mockResolvedValue({ id: 'reminder-1' });

      await reminderGenerator.generateCourtScheduleReminders('schedule-1');

      // 默认配置有2个提前提醒时间：24小时和1小时
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('应该在法庭日程不存在时跳过', async () => {
      const mockFindUnique = prisma.courtSchedule.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(null);

      await reminderGenerator.generateCourtScheduleReminders('nonexistent-id');

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
    });

    it('应该使用用户自定义配置', async () => {
      const mockCreate = prisma.reminder.create as jest.Mock;
      const mockFindUnique = prisma.courtSchedule.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(mockCourtSchedule);

      const customPreferences: ReminderPreferences = {
        courtSchedule: {
          enabled: true,
          hoursBefore: [48, 24, 1],
          channels: [NotificationChannel.EMAIL],
        },
        deadline: {
          enabled: true,
          daysBefore: [7, 1],
          channels: [NotificationChannel.IN_APP],
        },
        followUp: {
          enabled: true,
          hoursBefore: [24],
          channels: [NotificationChannel.IN_APP],
        },
      };

      mockCreate.mockResolvedValue({ id: 'reminder-1' });

      await reminderGenerator.generateCourtScheduleReminders(
        'schedule-1',
        customPreferences
      );

      // 自定义配置有3个提前提醒时间
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('generateDeadlineReminders', () => {
    it('应该成功生成截止日期提醒', async () => {
      const mockCreate = prisma.reminder.create as jest.Mock;
      mockCreate.mockResolvedValue({ id: 'reminder-1' });

      await reminderGenerator.generateDeadlineReminders(
        'user-1',
        new Date('2024-12-10T00:00:00Z'),
        '文档提交截止',
        '请确保所有材料按时提交'
      );

      // 默认配置有3个提前提醒时间：7天、3天、1天
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });

  describe('getDefaultPreferences', () => {
    it('应该返回默认提醒配置', () => {
      const preferences = reminderGenerator.getDefaultPreferences();

      expect(preferences).toBeDefined();
      expect(preferences.courtSchedule.enabled).toBe(true);
      expect(preferences.courtSchedule.hoursBefore).toEqual([24, 1]);
      expect(preferences.deadline.enabled).toBe(true);
      expect(preferences.deadline.daysBefore).toEqual([7, 3, 1]);
      expect(preferences.followUp.enabled).toBe(true);
    });
  });

  describe('mergePreferences', () => {
    it('应该正确合并用户配置和默认配置', () => {
      const userPreferences: Partial<ReminderPreferences> = {
        courtSchedule: {
          enabled: false,
          hoursBefore: [48],
          channels: [NotificationChannel.EMAIL],
        },
      };

      const merged = reminderGenerator.mergePreferences(userPreferences);

      expect(merged.courtSchedule.enabled).toBe(false);
      expect(merged.courtSchedule.hoursBefore).toEqual([48]);
      expect(merged.deadline.enabled).toBe(true); // 保持默认值
    });
  });
});

describe('ReminderSender', () => {
  const mockUser = {
    id: 'user-1',
    name: '测试用户',
    username: 'testuser',
    email: 'test@example.com',
  };

  const mockReminder = {
    id: 'reminder-1',
    userId: 'user-1',
    type: ReminderType.COURT_SCHEDULE,
    title: '法庭提醒',
    message: '请准时出庭',
    reminderTime: new Date(),
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    status: ReminderStatus.PENDING,
    relatedType: 'CourtSchedule',
    relatedId: 'schedule-1',
    metadata: { caseTitle: '测试案件' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('sendReminder', () => {
    it('应该成功发送邮件提醒', async () => {
      const mockFindUnique = prisma.user.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(mockUser);

      const result = await reminderSender.sendReminder(mockReminder);

      expect(result).toBe(true);
      expect(mockFindUnique).toHaveBeenCalledTimes(1);
    });

    it('应该在用户不存在时返回false', async () => {
      const mockFindUnique = prisma.user.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(null);

      const result = await reminderSender.sendReminder(mockReminder);

      expect(result).toBe(false);
    });

    it('应该处理只有应用内通知的提醒', async () => {
      const mockFindUnique = prisma.user.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(mockUser);

      const inAppOnlyReminder = {
        ...mockReminder,
        channels: [NotificationChannel.IN_APP],
      };

      const result = await reminderSender.sendReminder(inAppOnlyReminder);

      // 只有应用内通知时，应该仍然返回true，因为站内消息发送成功
      expect(result).toBe(true);
    });
  });

  describe('sendPendingReminders', () => {
    it('应该批量发送待发送提醒', async () => {
      const mockFindUnique = prisma.user.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(mockUser);

      jest
        .spyOn(reminderService, 'getPendingReminders')
        .mockResolvedValue([
          mockReminder,
          { ...mockReminder, id: 'reminder-2' },
        ]);

      const result = await reminderSender.sendPendingReminders();

      expect(result.success).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('应该正确处理发送失败的情况', async () => {
      const mockFindUnique = prisma.user.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(mockUser);

      jest
        .spyOn(reminderService, 'getPendingReminders')
        .mockResolvedValue([mockReminder]);

      const result = await reminderSender.sendPendingReminders();

      expect(result.success + result.failed).toBe(1);
    });
  });
});
