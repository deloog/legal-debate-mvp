/**
 * 案件状态监听器单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { caseStatusMonitor } from '@/lib/case/case-status-monitor';
import { reminderGenerator } from '@/lib/notification/reminder-generator';
import { prisma } from '@/lib/db/prisma';
import { CaseStatusDeadlineConfig } from '@/types/case';

// Mock Prisma 客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    reminder: {
      count: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('@/lib/agent/security/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock reminderService
jest.mock('@/lib/notification/reminder-service', () => ({
  reminderService: {
    createReminders: jest.fn().mockResolvedValue({ count: 2 }),
  },
}));

// Import mocked module
import { reminderService } from '@/lib/notification/reminder-service';

describe('CaseStatusMonitor', () => {
  const mockCaseId = 'test-case-id';
  const mockUserId = 'test-user-id';

  const mockCaseData = {
    id: mockCaseId,
    userId: mockUserId,
    title: '测试案件',
    type: 'CIVIL',
    status: 'ACTIVE',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('findDeadlineConfig', () => {
    it('应该找到匹配的截止日期配置', () => {
      const config = caseStatusMonitor.findDeadlineConfig(
        'CIVIL',
        'DRAFT',
        'ACTIVE'
      );

      expect(config).not.toBeNull();
      expect(config?.caseType).toBe('CIVIL');
      expect(config?.fromStatus).toBe('DRAFT');
      expect(config?.toStatus).toBe('ACTIVE');
      expect(config?.deadlineDays).toBe(7);
    });

    it('应该在类型不匹配时返回null', () => {
      const config = caseStatusMonitor.findDeadlineConfig(
        'UNKNOWN',
        'DRAFT',
        'ACTIVE'
      );

      expect(config).toBeNull();
    });

    it('应该在状态不匹配时返回null', () => {
      const config = caseStatusMonitor.findDeadlineConfig(
        'CIVIL',
        'UNKNOWN',
        'ACTIVE'
      );

      expect(config).toBeNull();
    });

    it('应该找到刑事案件的配置', () => {
      const config = caseStatusMonitor.findDeadlineConfig(
        'CRIMINAL',
        'DRAFT',
        'ACTIVE'
      );

      expect(config).not.toBeNull();
      expect(config?.caseType).toBe('CRIMINAL');
      expect(config?.deadlineDays).toBe(5);
    });

    it('应该找到行政案件的配置', () => {
      const config = caseStatusMonitor.findDeadlineConfig(
        'ADMINISTRATIVE',
        'ACTIVE',
        'COMPLETED'
      );

      expect(config).not.toBeNull();
      expect(config?.caseType).toBe('ADMINISTRATIVE');
      expect(config?.deadlineDays).toBe(3);
    });
  });

  describe('onCaseStatusChange', () => {
    it('应该在案件状态变更时生成提醒', async () => {
      const mockFindUnique = prisma.case.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(mockCaseData);

      await caseStatusMonitor.onCaseStatusChange(mockCaseId, 'DRAFT', 'ACTIVE');

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: mockCaseId },
        select: {
          id: true,
          userId: true,
          title: true,
          type: true,
          status: true,
        },
      });
    });

    it('应该在案件不存在时跳过', async () => {
      const mockFindUnique = prisma.case.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(null);

      await caseStatusMonitor.onCaseStatusChange(
        'nonexistent-id',
        'DRAFT',
        'ACTIVE'
      );

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
    });

    it('应该在状态没有变化时跳过', async () => {
      const mockFindUnique = prisma.case.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue(mockCaseData);

      await caseStatusMonitor.onCaseStatusChange(
        mockCaseId,
        'ACTIVE',
        'ACTIVE'
      );

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
    });

    it('应该在没有匹配配置时跳过', async () => {
      const mockFindUnique = prisma.case.findUnique as jest.Mock;
      mockFindUnique.mockResolvedValue({
        ...mockCaseData,
        type: 'UNKNOWN',
      });

      await caseStatusMonitor.onCaseStatusChange(mockCaseId, 'DRAFT', 'ACTIVE');

      expect(mockFindUnique).toHaveBeenCalledTimes(1);
    });

    it('应该正确处理错误情况', async () => {
      const mockFindUnique = prisma.case.findUnique as jest.Mock;
      mockFindUnique.mockRejectedValue(new Error('数据库错误'));

      await expect(
        caseStatusMonitor.onCaseStatusChange(mockCaseId, 'DRAFT', 'ACTIVE')
      ).resolves.not.toThrow();
    });
  });

  describe('processAllPendingCases', () => {
    it('应该处理所有活动案件', async () => {
      const mockFindMany = prisma.case.findMany as jest.Mock;
      // Mock一个最近更新的案件（3天前更新）
      const recentCaseData = {
        ...mockCaseData,
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      };
      mockFindMany.mockResolvedValue([recentCaseData]);

      const result = await caseStatusMonitor.processAllPendingCases();

      expect(result).toBe(1);
      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          status: 'ACTIVE',
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          title: true,
          type: true,
          status: true,
          updatedAt: true,
        },
      });
    });

    it('应该正确处理空列表', async () => {
      const mockFindMany = prisma.case.findMany as jest.Mock;
      mockFindMany.mockResolvedValue([]);

      const result = await caseStatusMonitor.processAllPendingCases();

      expect(result).toBe(0);
    });

    it('应该正确处理错误情况', async () => {
      const mockFindMany = prisma.case.findMany as jest.Mock;
      mockFindMany.mockRejectedValue(new Error('数据库错误'));

      const result = await caseStatusMonitor.processAllPendingCases();

      expect(result).toBe(0);
    });
  });

  describe('getAllDeadlineConfigs', () => {
    it('应该返回所有默认截止日期配置', () => {
      const configs = caseStatusMonitor.getAllDeadlineConfigs();

      expect(configs).toBeDefined();
      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBeGreaterThan(0);

      // 验证配置结构
      configs.forEach((config: CaseStatusDeadlineConfig) => {
        expect(config).toHaveProperty('caseType');
        expect(config).toHaveProperty('fromStatus');
        expect(config).toHaveProperty('toStatus');
        expect(config).toHaveProperty('deadlineDays');
        expect(config).toHaveProperty('reminderDaysBefore');
        expect(config).toHaveProperty('description');
      });
    });
  });
});

describe('ReminderGenerator - Case Status Deadline', () => {
  const _mockUserId = 'test-user-id';
  const mockCaseId = 'test-case-id';
  const mockCaseTitle = '测试案件';
  const mockDeadline = new Date('2024-12-31T00:00:00Z');
  const _mockDescription = '从草稿转为活动状态后7天内需要提交正式材料';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateCaseStatusDeadlineReminders', () => {
    it('应该成功生成案件状态截止日期提醒', async () => {
      await reminderGenerator.generateCaseStatusDeadlineReminders(
        mockCaseId,
        mockDeadline,
        mockCaseTitle
      );

      expect(reminderService.createReminders).toHaveBeenCalledTimes(1);
    });

    it('应该生成正确数量的提醒', async () => {
      let reminderCount = 0;
      (reminderService.createReminders as jest.Mock).mockImplementation(
        inputs => {
          reminderCount = inputs.length;
          return Promise.resolve({ count: reminderCount });
        }
      );

      await reminderGenerator.generateCaseStatusDeadlineReminders(
        mockCaseId,
        mockDeadline,
        mockCaseTitle
      );

      // 验证生成了2个提醒（提前3天和1天）
      expect(reminderCount).toBe(2);
    });

    it('应该正确处理错误情况', async () => {
      (reminderService.createReminders as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      await expect(
        reminderGenerator.generateCaseStatusDeadlineReminders(
          mockCaseId,
          mockDeadline,
          mockCaseTitle
        )
      ).resolves.not.toThrow();
    });
  });
});
