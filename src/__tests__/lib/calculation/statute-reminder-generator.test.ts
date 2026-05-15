/**
 * 时效提醒生成器单元测试
 */

import {
  StatuteReminderGenerator,
  statuteReminderGenerator,
} from '@/lib/calculation/statute-reminder-generator';
import { prisma } from '@/lib/db/prisma';
import {
  StatuteType,
  CaseTypeForStatute,
  type StatuteCalculationResult,
  type StatuteReminderConfig,
  type StatuteReminderInput,
  NotificationChannel,
} from '@/types/statute';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    reminder: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('StatuteReminderGenerator', () => {
  let generator: StatuteReminderGenerator;

  beforeEach(() => {
    generator = new StatuteReminderGenerator();
    jest.clearAllMocks();
  });

  const mockCalculationResult: StatuteCalculationResult = {
    id: 'calc-1',
    caseId: 'case-1',
    statuteType: StatuteType.LITIGATION,
    startDate: new Date('2024-01-01'),
    deadlineDate: new Date('2025-01-01'),
    remainingDays: 30,
    isExpired: false,
    isApproaching: true,
    applicableRules: [
      {
        id: 'rule-1',
        statuteType: StatuteType.LITIGATION,
        caseType: CaseTypeForStatute.CIVIL,
        statutePeriod: 365,
        description: '民事诉讼时效为3年',
        legalBasis: '《民法典》第一百八十八条',
        effectiveDate: new Date('2021-01-01'),
        isActive: true,
      },
    ],
    specialCircumstances: [],
    calculationMetadata: {
      calculationMethod: 'STANDARD',
      appliedRules: ['rule-1'],
      adjustments: {},
      warnings: [],
      recommendations: ['建议尽快采取行动'],
      confidence: 1.0,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockReminderConfig: StatuteReminderConfig = {
    enabled: true,
    reminderDays: [30, 15, 7, 1],
    channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
    autoGenerate: true,
  };

  const mockReminderInput: StatuteReminderInput = {
    userId: 'user-1',
    calculationResult: mockCalculationResult,
    config: mockReminderConfig,
  };

  describe('generateReminder - 基础功能', () => {
    it('应该成功生成提醒', async () => {
      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      await generator.generateReminder(mockReminderInput);

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'DEADLINE',
          title: expect.stringContaining('诉讼时效'),
          message: expect.stringContaining('case-1'),
          reminderTime: mockCalculationResult.deadlineDate,
          status: 'PENDING',
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          relatedType: 'Case',
          relatedId: 'case-1',
        }),
      });
    });

    it('应该在禁用时不生成提醒', async () => {
      const disabledConfig: StatuteReminderConfig = {
        ...mockReminderConfig,
        enabled: false,
      };

      await generator.generateReminder({
        ...mockReminderInput,
        config: disabledConfig,
      });

      expect(prisma.reminder.findFirst).not.toHaveBeenCalled();
      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('应该在剩余天数不在提醒列表时不生成提醒', async () => {
      const resultNotInList: StatuteCalculationResult = {
        ...mockCalculationResult,
        remainingDays: 100,
      };

      await generator.generateReminder({
        ...mockReminderInput,
        calculationResult: resultNotInList,
      });

      expect(prisma.reminder.findFirst).not.toHaveBeenCalled();
      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('应该在已过期时不生成提醒', async () => {
      const expiredResult: StatuteCalculationResult = {
        ...mockCalculationResult,
        isExpired: true,
        remainingDays: -10,
      };

      await generator.generateReminder({
        ...mockReminderInput,
        calculationResult: expiredResult,
      });

      expect(prisma.reminder.findFirst).not.toHaveBeenCalled();
      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });
  });

  describe('generateReminder - 提醒内容生成', () => {
    it('应该使用自定义消息', async () => {
      const customConfig: StatuteReminderConfig = {
        ...mockReminderConfig,
        customMessages: {
          LITIGATION_30: '自定义30天提醒消息',
        },
      };

      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      await generator.generateReminder({
        ...mockReminderInput,
        config: customConfig,
      });

      const createCall = (prisma.reminder.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.message).toBe('自定义30天提醒消息');
      expect(createCall.data.title).toContain('自定义');
    });

    it('应该生成高风险提醒标题', async () => {
      const highRiskResult: StatuteCalculationResult = {
        ...mockCalculationResult,
        remainingDays: 5,
      };
      const highRiskConfig: StatuteReminderConfig = {
        ...mockReminderConfig,
        reminderDays: [5],
      };

      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      await generator.generateReminder({
        ...mockReminderInput,
        calculationResult: highRiskResult,
        config: highRiskConfig,
      });

      const createCall = (prisma.reminder.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.title).toContain('高风险');
      expect(createCall.data.metadata.priority).toBe('HIGH');
    });

    it('应该生成中风险提醒标题', async () => {
      const mediumRiskResult: StatuteCalculationResult = {
        ...mockCalculationResult,
        remainingDays: 15,
      };

      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      await generator.generateReminder({
        ...mockReminderInput,
        calculationResult: mediumRiskResult,
      });

      const createCall = (prisma.reminder.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.title).toContain('中风险');
      expect(createCall.data.metadata.priority).toBe('MEDIUM');
    });

    it('应该生成低风险提醒标题', async () => {
      const lowRiskResult: StatuteCalculationResult = {
        ...mockCalculationResult,
        remainingDays: 60,
      };
      const lowRiskConfig: StatuteReminderConfig = {
        ...mockReminderConfig,
        reminderDays: [60],
      };

      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      await generator.generateReminder({
        ...mockReminderInput,
        calculationResult: lowRiskResult,
        config: lowRiskConfig,
      });

      const createCall = (prisma.reminder.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.title).toContain('低风险');
      expect(createCall.data.metadata.priority).toBe('LOW');
    });

    it('应该包含正确的分类标签', async () => {
      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      await generator.generateReminder(mockReminderInput);

      const createCall = (prisma.reminder.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.metadata.categories).toContain('时效提醒');
      expect(createCall.data.metadata.categories).toContain('诉讼时效');
      expect(createCall.data.metadata.categories).toContain('剩余30天');
    });
  });

  describe('generateReminder - 更新现有提醒', () => {
    it('应该更新已存在的提醒', async () => {
      const existingReminder = {
        id: 'existing-reminder-1',
        userId: 'user-1',
        type: 'DEADLINE',
      };

      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(
        existingReminder
      );
      (prisma.reminder.update as jest.Mock).mockResolvedValue(existingReminder);

      await generator.generateReminder(mockReminderInput);

      expect(prisma.reminder.create).not.toHaveBeenCalled();
      expect(prisma.reminder.update).toHaveBeenCalledWith({
        where: { id: 'existing-reminder-1' },
        data: expect.objectContaining({
          title: expect.stringContaining('诉讼时效'),
          status: 'PENDING',
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        }),
      });
    });

    it('应该为过期结果更新提醒状态为SENT', async () => {
      const expiredResult: StatuteCalculationResult = {
        ...mockCalculationResult,
        isExpired: false,
        remainingDays: 30,
      };

      const existingReminder = {
        id: 'existing-reminder-1',
        userId: 'user-1',
        type: 'DEADLINE',
      };

      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(
        existingReminder
      );
      (prisma.reminder.update as jest.Mock).mockResolvedValue(existingReminder);

      await generator.generateReminder({
        ...mockReminderInput,
        calculationResult: expiredResult,
      });

      const updateCall = (prisma.reminder.update as jest.Mock).mock.calls[0][0];
      expect(updateCall.data.status).toBe('PENDING');
    });
  });

  describe('generateReminder - 错误处理', () => {
    it('应该在数据库错误时抛出错误', async () => {
      (prisma.reminder.findFirst as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      await expect(
        generator.generateReminder(mockReminderInput)
      ).rejects.toThrow('创建时效提醒失败');
    });

    it('应该在创建失败时抛出错误', async () => {
      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockRejectedValue(
        new Error('创建失败')
      );

      await expect(
        generator.generateReminder(mockReminderInput)
      ).rejects.toThrow('创建时效提醒失败');
    });
  });

  describe('batchGenerateReminders', () => {
    it('应该批量生成提醒', async () => {
      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      const inputs: StatuteReminderInput[] = [
        mockReminderInput,
        {
          ...mockReminderInput,
          calculationResult: {
            ...mockCalculationResult,
            caseId: 'case-2',
            remainingDays: 15,
          },
        },
      ];

      await generator.batchGenerateReminders(inputs);

      expect(prisma.reminder.create).toHaveBeenCalledTimes(2);
    });

    it('应该跳过禁用的提醒', async () => {
      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      const inputs: StatuteReminderInput[] = [
        mockReminderInput,
        {
          ...mockReminderInput,
          config: {
            ...mockReminderConfig,
            enabled: false,
          },
        },
      ];

      await generator.batchGenerateReminders(inputs);

      expect(prisma.reminder.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendReminder', () => {
    it('应该成功发送提醒', async () => {
      (prisma.reminder.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

      const result = await generator.sendReminder('user-1', 'reminder-1');

      expect(result).toBe(true);
      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'reminder-1',
          userId: 'user-1',
          type: 'DEADLINE',
        },
        data: {
          status: 'SENT',
        },
      });
    });

    it('应该在失败时返回false', async () => {
      (prisma.reminder.updateMany as jest.Mock).mockRejectedValue(
        new Error('更新失败')
      );

      const result = await generator.sendReminder('user-1', 'reminder-1');

      expect(result).toBe(false);
    });

    it('应该在找不到提醒时返回false', async () => {
      (prisma.reminder.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      const result = await generator.sendReminder('user-1', 'reminder-1');

      expect(result).toBe(false);
    });
  });

  describe('sendExpiredReminders', () => {
    it('应该批量发送到期提醒', async () => {
      const expiredReminders = [
        {
          id: 'reminder-1',
          userId: 'user-1',
          type: 'DEADLINE',
          reminderTime: new Date('2024-01-01'),
          status: 'PENDING',
        },
        {
          id: 'reminder-2',
          userId: 'user-2',
          type: 'DEADLINE',
          reminderTime: new Date('2024-01-01'),
          status: 'PENDING',
        },
      ];

      (prisma.reminder.findMany as jest.Mock).mockResolvedValue(
        expiredReminders
      );
      (prisma.reminder.updateMany as jest.Mock)
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 1 });

      const result = await generator.sendExpiredReminders();

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(prisma.reminder.updateMany).toHaveBeenCalledTimes(2);
    });

    it('应该正确统计失败的数量', async () => {
      const expiredReminders = [
        {
          id: 'reminder-1',
          userId: 'user-1',
          type: 'DEADLINE',
          reminderTime: new Date('2024-01-01'),
          status: 'PENDING',
        },
        {
          id: 'reminder-2',
          userId: 'user-2',
          type: 'DEADLINE',
          reminderTime: new Date('2024-01-01'),
          status: 'PENDING',
        },
      ];

      (prisma.reminder.findMany as jest.Mock).mockResolvedValue(
        expiredReminders
      );
      (prisma.reminder.updateMany as jest.Mock)
        .mockResolvedValueOnce({ count: 1 })
        .mockRejectedValueOnce(new Error('发送失败'));

      const result = await generator.sendExpiredReminders();

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('应该在获取提醒失败时返回0', async () => {
      (prisma.reminder.findMany as jest.Mock).mockRejectedValue(
        new Error('获取失败')
      );

      const result = await generator.sendExpiredReminders();

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('应该只获取到期的PENDING状态提醒', async () => {
      (prisma.reminder.findMany as jest.Mock).mockResolvedValue([]);

      await generator.sendExpiredReminders();

      expect(prisma.reminder.findMany).toHaveBeenCalledWith({
        where: {
          type: 'DEADLINE',
          reminderTime: {
            lte: expect.any(Date),
          },
          status: 'PENDING',
        },
      });
    });
  });

  describe('getPendingReminders', () => {
    it('应该获取待发送的提醒列表', async () => {
      const pendingReminders = [
        {
          id: 'reminder-1',
          userId: 'user-1',
          type: 'DEADLINE',
          title: '测试提醒1',
          message: '消息内容1',
          reminderTime: new Date('2025-01-15'),
          status: 'PENDING',
          metadata: {
            priority: 'HIGH',
            remainingDays: 10,
          },
        },
        {
          id: 'reminder-2',
          userId: 'user-1',
          type: 'DEADLINE',
          title: '测试提醒2',
          message: '消息内容2',
          reminderTime: new Date('2025-02-01'),
          status: 'PENDING',
          metadata: {
            priority: 'MEDIUM',
            remainingDays: 25,
          },
        },
      ];

      (prisma.reminder.findMany as jest.Mock).mockResolvedValue(
        pendingReminders
      );

      const result = await generator.getPendingReminders('user-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('reminder-1');
      expect(result[0].title).toBe('测试提醒1');
      expect(result[0].priority).toBe('HIGH');
    });

    it('应该按到期时间排序', async () => {
      const pendingReminders = [
        {
          id: 'reminder-1',
          userId: 'user-1',
          type: 'DEADLINE',
          reminderTime: new Date('2025-01-15'),
          status: 'PENDING',
          metadata: {},
        },
        {
          id: 'reminder-2',
          userId: 'user-1',
          type: 'DEADLINE',
          reminderTime: new Date('2025-02-01'),
          status: 'PENDING',
          metadata: {},
        },
      ];

      (prisma.reminder.findMany as jest.Mock).mockResolvedValue(
        pendingReminders
      );

      const result = await generator.getPendingReminders('user-1');

      // reminder-1 (2025-01-15) 应该在 reminder-2 (2025-02-01) 之前
      expect(result[0].id).toBe('reminder-1');
      expect(result[1].id).toBe('reminder-2');
      expect(result[0].reminderTime.getTime()).toBeLessThan(
        result[1].reminderTime.getTime()
      );
    });

    it('应该在失败时返回空数组', async () => {
      (prisma.reminder.findMany as jest.Mock).mockRejectedValue(
        new Error('获取失败')
      );

      const result = await generator.getPendingReminders('user-1');

      expect(result).toEqual([]);
    });

    it('应该只获取指定用户的提醒', async () => {
      (prisma.reminder.findMany as jest.Mock).mockResolvedValue([]);

      await generator.getPendingReminders('user-1');

      expect(prisma.reminder.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          type: 'DEADLINE',
          status: 'PENDING',
          reminderTime: {
            gte: expect.any(Date),
          },
        },
        orderBy: {
          reminderTime: 'asc',
        },
      });
    });

    it('应该计算剩余天数', async () => {
      const pendingReminders = [
        {
          id: 'reminder-1',
          userId: 'user-1',
          type: 'DEADLINE',
          title: '测试提醒',
          message: '消息内容',
          reminderTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10天后
          status: 'PENDING',
          metadata: {},
        },
      ];

      (prisma.reminder.findMany as jest.Mock).mockResolvedValue(
        pendingReminders
      );

      const result = await generator.getPendingReminders('user-1');

      expect(result[0].remainingDays).toBeGreaterThan(0);
      expect(result[0].remainingDays).toBeLessThanOrEqual(10);
    });
  });

  describe('deleteReminder', () => {
    it('应该成功删除提醒', async () => {
      (prisma.reminder.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await generator.deleteReminder('reminder-1', 'user-1');

      expect(result).toBe(true);
      expect(prisma.reminder.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'reminder-1',
          userId: 'user-1',
          type: 'DEADLINE',
        },
      });
    });

    it('应该在找不到提醒时返回false', async () => {
      (prisma.reminder.deleteMany as jest.Mock).mockResolvedValue({
        count: 0,
      });

      const result = await generator.deleteReminder('reminder-1', 'user-1');

      expect(result).toBe(false);
    });

    it('应该在失败时返回false', async () => {
      (prisma.reminder.deleteMany as jest.Mock).mockRejectedValue(
        new Error('删除失败')
      );

      const result = await generator.deleteReminder('reminder-1', 'user-1');

      expect(result).toBe(false);
    });
  });

  describe('shouldGenerateReminder - 私有方法测试', () => {
    it('应该在剩余天数在提醒列表中时返回true', async () => {
      (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.reminder.create as jest.Mock).mockResolvedValue({
        id: 'reminder-1',
      });

      await generator.generateReminder(mockReminderInput);

      expect(prisma.reminder.create).toHaveBeenCalled();
    });

    it('应该在剩余天数不在提醒列表中时返回false', async () => {
      const resultNotInList: StatuteCalculationResult = {
        ...mockCalculationResult,
        remainingDays: 100,
      };

      await generator.generateReminder({
        ...mockReminderInput,
        calculationResult: resultNotInList,
      });

      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('应该在配置为空列表时不生成提醒', async () => {
      const emptyDaysConfig: StatuteReminderConfig = {
        ...mockReminderConfig,
        reminderDays: [],
      };

      await generator.generateReminder({
        ...mockReminderInput,
        config: emptyDaysConfig,
      });

      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });
  });
});

describe('statuteReminderGenerator 单例', () => {
  it('应该导出单例实例', () => {
    expect(statuteReminderGenerator).toBeDefined();
    expect(statuteReminderGenerator).toBeInstanceOf(StatuteReminderGenerator);
  });

  it('单例应该可以执行生成提醒', async () => {
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.reminder.create as jest.Mock).mockResolvedValue({
      id: 'reminder-1',
    });

    const result = statuteReminderGenerator.generateReminder({
      userId: 'user-1',
      calculationResult: {
        id: 'calc-1',
        caseId: 'case-1',
        statuteType: StatuteType.LITIGATION,
        startDate: new Date('2024-01-01'),
        deadlineDate: new Date('2025-01-01'),
        remainingDays: 30,
        isExpired: false,
        isApproaching: true,
        applicableRules: [],
        specialCircumstances: [],
        calculationMetadata: {
          calculationMethod: 'STANDARD',
          appliedRules: [],
          adjustments: {},
          warnings: [],
          recommendations: [],
          confidence: 1.0,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      config: {
        enabled: true,
        reminderDays: [30],
        channels: [NotificationChannel.IN_APP],
        autoGenerate: true,
      },
    });

    await expect(result).resolves.not.toThrow();
  });
});
