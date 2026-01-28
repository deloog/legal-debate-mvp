/**
 * AI配额管理系统单元测试
 */

import { jest } from '@jest/globals';

// Mock prisma before importing
const mockFindMany = jest.fn().mockImplementation(() => []);
const mockCreate = jest.fn().mockImplementation(() => ({}));
const mockAggregate = jest.fn().mockImplementation(() => []);

const mockPrisma = {
  aIInteraction: {
    findMany: mockFindMany,
    create: mockCreate,
    aggregate: mockAggregate,
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '@/lib/db/prisma';
import {
  getUserQuotaConfig,
  checkAIQuota,
  recordAIUsage,
  getUserQuotaUsage,
  hasUnlimitedQuota,
  calculateQuotaPercentage,
  getQuotaStatusMessage,
} from '@/lib/ai/quota';

describe('AI配额管理系统', () => {
  function clearAllMocks() {
    jest.clearAllMocks();
  }

  beforeEach(() => {
    clearAllMocks();
  });

  afterEach(() => {
    clearAllMocks();
  });

  describe('getUserQuotaConfig', () => {
    it('应该返回FREE用户配额配置', () => {
      const config = getUserQuotaConfig('FREE');
      expect(config).toEqual({
        dailyLimit: 10,
        monthlyLimit: 100,
        perRequestLimit: 1000,
      });
    });

    it('应该返回BASIC用户配额配置', () => {
      const config = getUserQuotaConfig('BASIC');
      expect(config).toEqual({
        dailyLimit: 50,
        monthlyLimit: 1000,
        perRequestLimit: 2000,
      });
    });

    it('应该返回PROFESSIONAL用户配额配置', () => {
      const config = getUserQuotaConfig('PROFESSIONAL');
      expect(config).toEqual({
        dailyLimit: 200,
        monthlyLimit: 5000,
        perRequestLimit: 4000,
      });
    });

    it('应该返回ENTERPRISE用户配额配置', () => {
      const config = getUserQuotaConfig('ENTERPRISE');
      expect(config).toEqual({
        dailyLimit: 500,
        monthlyLimit: 10000,
        perRequestLimit: 8000,
      });
    });

    it('应该返回ADMIN用户配额配置（无限制）', () => {
      const config = getUserQuotaConfig('ADMIN');
      expect(config).toEqual({
        dailyLimit: -1,
        monthlyLimit: -1,
        perRequestLimit: -1,
      });
    });

    it('应该返回SUPER_ADMIN用户配额配置（无限制）', () => {
      const config = getUserQuotaConfig('SUPER_ADMIN');
      expect(config).toEqual({
        dailyLimit: -1,
        monthlyLimit: -1,
        perRequestLimit: -1,
      });
    });

    it('应该返回LAWYER用户配额配置', () => {
      const config = getUserQuotaConfig('LAWYER');
      expect(config).toEqual({
        dailyLimit: 100,
        monthlyLimit: 2000,
        perRequestLimit: 3000,
      });
    });

    it('应该为未知角色返回FREE配置', () => {
      const config = getUserQuotaConfig('UNKNOWN_ROLE');
      expect(config).toEqual({
        dailyLimit: 10,
        monthlyLimit: 100,
        perRequestLimit: 1000,
      });
    });
  });

  describe('checkAIQuota', () => {
    it('应该允许管理员使用（无配额限制）', async () => {
      const result = await checkAIQuota('user-1', 'ADMIN');
      expect(result).toEqual({
        allowed: true,
        reason: '管理员无配额限制',
      });
    });

    it('应该允许SUPER_ADMIN使用（无配额限制）', async () => {
      const result = await checkAIQuota('user-2', 'SUPER_ADMIN');
      expect(result).toEqual({
        allowed: true,
        reason: '管理员无配额限制',
      });
    });

    it('应该拒绝单次请求超过限制', async () => {
      const result = await checkAIQuota('user-3', 'FREE', 2000);
      expect(result).toEqual({
        allowed: false,
        reason: '单次请求超过限制（1000 tokens）',
      });
    });

    it('应该允许配额充足的用户', async () => {
      mockFindMany.mockResolvedValue([] as unknown as never);

      const result = await checkAIQuota('user-4', 'FREE');
      expect(result.allowed).toBe(true);
      expect(result.dailyUsed).toBe(0);
      expect(result.remaining).toBe(10);
      expect(result.dailyLimit).toBe(10);
    });

    it('应该拒绝每日配额已用完的用户', async () => {
      mockFindMany.mockResolvedValue([
        { id: '1' },
        { id: '2' },
        { id: '3' },
        { id: '4' },
        { id: '5' },
        { id: '6' },
        { id: '7' },
        { id: '8' },
        { id: '9' },
        { id: '10' },
      ] as unknown as never);

      const result = await checkAIQuota('user-5', 'FREE');
      expect(result).toEqual({
        allowed: false,
        reason: '今日配额已用完（10次）',
        remaining: 0,
        dailyUsed: 10,
        dailyLimit: 10,
      });
    });

    it('应该拒绝每月配额已用完的用户', async () => {
      // 创建1000条模拟记录表示本月配额已用完
      const monthlyRecords = Array.from({ length: 1000 }, (_, i) => ({
        id: `month-${i}`,
      }));

      mockFindMany
        .mockResolvedValueOnce([] as unknown as never) // 今日使用量为0
        .mockResolvedValueOnce(monthlyRecords as unknown as never); // 模拟本月已用完

      const result = await checkAIQuota('user-6', 'BASIC', 0);
      expect(result).toEqual({
        allowed: false,
        reason: '本月配额已用完（1000次）',
        remaining: 0,
        dailyUsed: 0,
        dailyLimit: 50,
        monthlyUsed: 1000,
        monthlyLimit: 1000,
      });
    });

    it('应该正确计算剩余配额', async () => {
      mockFindMany.mockResolvedValue([
        { id: '1' },
        { id: '2' },
        { id: '3' },
      ] as unknown as never);

      const result = await checkAIQuota('user-7', 'BASIC');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(47);
      expect(result.dailyUsed).toBe(3);
    });

    it('应该在数据库错误时返回不允许', async () => {
      mockFindMany.mockRejectedValue(
        new Error('Database error') as unknown as never
      );

      const result = await checkAIQuota('user-8', 'FREE');
      expect(result).toEqual({
        allowed: false,
        reason: '配额检查失败，请稍后重试',
      });
    });
  });

  describe('recordAIUsage', () => {
    it('应该成功记录AI使用', async () => {
      mockCreate.mockResolvedValue({
        id: 'interaction-1',
      } as unknown as never);

      await expect(
        recordAIUsage({
          userId: 'user-1',
          type: 'test',
          provider: 'test-provider',
          tokensUsed: 100,
          duration: 1000,
          success: true,
        })
      ).resolves.not.toThrow();

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          type: 'test',
          provider: 'test-provider',
          model: undefined,
          userId: 'user-1',
          request: {
            userId: 'user-1',
            timestamp: expect.any(String),
          },
          response: {},
          tokensUsed: 100,
          duration: 1000,
          success: true,
          error: undefined,
        },
      });
    });

    it('应该记录失败的AI使用', async () => {
      mockCreate.mockResolvedValue({
        id: 'interaction-2',
      } as unknown as never);

      await expect(
        recordAIUsage({
          userId: 'user-2',
          type: 'test',
          provider: 'test-provider',
          tokensUsed: 0,
          duration: 1000,
          success: false,
          error: 'Test error',
        })
      ).resolves.not.toThrow();
    });

    it('应该在数据库错误时不抛出异常', async () => {
      mockCreate.mockRejectedValue(
        new Error('Database error') as unknown as never
      );

      await expect(
        recordAIUsage({
          userId: 'user-3',
          type: 'test',
          provider: 'test-provider',
          tokensUsed: 100,
          duration: 1000,
          success: true,
        })
      ).resolves.not.toThrow();
    });
  });

  describe('getUserQuotaUsage', () => {
    it('应该返回管理员无限制配额', async () => {
      const result = await getUserQuotaUsage('user-1', 'ADMIN');
      expect(result).toEqual({
        daily: { used: 0, limit: -1, remaining: -1 },
        monthly: { used: 0, limit: -1, remaining: -1 },
      });
    });

    it('应该正确计算用户配额使用情况', async () => {
      mockFindMany.mockResolvedValue([
        { id: '1' },
        { id: '2' },
        { id: '3' },
      ] as unknown as never);

      const result = await getUserQuotaUsage('user-2', 'FREE');
      expect(result.daily).toEqual({
        used: 3,
        limit: 10,
        remaining: 7,
      });
    });

    it('应该在数据库错误时抛出异常', async () => {
      mockFindMany.mockRejectedValue(
        new Error('Database error') as unknown as never
      );

      await expect(getUserQuotaUsage('user-3', 'FREE')).rejects.toThrow(
        '获取配额使用情况失败'
      );
    });
  });

  describe('hasUnlimitedQuota', () => {
    it('应该返回管理员有无限配额', () => {
      expect(hasUnlimitedQuota('ADMIN')).toBe(true);
    });

    it('应该返回SUPER_ADMIN有无限配额', () => {
      expect(hasUnlimitedQuota('SUPER_ADMIN')).toBe(true);
    });

    it('应该返回普通用户没有无限配额', () => {
      expect(hasUnlimitedQuota('FREE')).toBe(false);
      expect(hasUnlimitedQuota('BASIC')).toBe(false);
      expect(hasUnlimitedQuota('PROFESSIONAL')).toBe(false);
    });
  });

  describe('calculateQuotaPercentage', () => {
    it('应该正确计算使用百分比', () => {
      expect(calculateQuotaPercentage(5, 10)).toBe(50);
      expect(calculateQuotaPercentage(3, 10)).toBe(30);
      expect(calculateQuotaPercentage(10, 10)).toBe(100);
    });

    it('应该在limit为0时返回0', () => {
      expect(calculateQuotaPercentage(5, 0)).toBe(0);
    });

    it('应该在limit为负数时返回0', () => {
      expect(calculateQuotaPercentage(5, -1)).toBe(0);
    });

    it('应该限制百分比不超过100', () => {
      expect(calculateQuotaPercentage(15, 10)).toBe(100);
      expect(calculateQuotaPercentage(100, 10)).toBe(100);
    });
  });

  describe('getQuotaStatusMessage', () => {
    it('应该返回low状态（<50%）', () => {
      expect(getQuotaStatusMessage(0)).toBe('low');
      expect(getQuotaStatusMessage(25)).toBe('low');
      expect(getQuotaStatusMessage(49)).toBe('low');
    });

    it('应该返回medium状态（50-79%）', () => {
      expect(getQuotaStatusMessage(50)).toBe('medium');
      expect(getQuotaStatusMessage(65)).toBe('medium');
      expect(getQuotaStatusMessage(79)).toBe('medium');
    });

    it('应该返回high状态（80-99%）', () => {
      expect(getQuotaStatusMessage(80)).toBe('high');
      expect(getQuotaStatusMessage(90)).toBe('high');
      expect(getQuotaStatusMessage(99)).toBe('high');
    });

    it('应该返回exceeded状态（>=100%）', () => {
      expect(getQuotaStatusMessage(100)).toBe('exceeded');
      expect(getQuotaStatusMessage(150)).toBe('exceeded');
    });
  });
});
