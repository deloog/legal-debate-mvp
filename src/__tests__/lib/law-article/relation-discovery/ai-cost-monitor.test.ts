/**
 * AI成本监控器测试
 *
 * 测试覆盖：
 * 1. 成本跟踪功能
 * 2. 请求计数功能
 * 3. 限制检查
 * 4. 每日重置
 * 5. 统计信息
 */

import { AICostMonitor } from '@/lib/law-article/relation-discovery/ai-cost-monitor';
import { AI_DETECTOR_CONFIG } from '@/lib/law-article/relation-discovery/ai-detector-config';

describe('AICostMonitor', () => {
  beforeEach(() => {
    // 重置监控器状态
    AICostMonitor.reset();
  });

  describe('trackCall', () => {
    it('应该成功跟踪API调用', async () => {
      const result = await AICostMonitor.trackCall(0.05);

      expect(result).toBe(true);

      const stats = AICostMonitor.getStats();
      expect(stats.dailyRequestCount).toBe(1);
      expect(stats.dailyCost).toBe(0.05);
    });

    it('应该累计多次调用', async () => {
      await AICostMonitor.trackCall(0.05);
      await AICostMonitor.trackCall(0.03);
      await AICostMonitor.trackCall(0.02);

      const stats = AICostMonitor.getStats();
      expect(stats.dailyRequestCount).toBe(3);
      expect(stats.dailyCost).toBe(0.1);
    });

    it('应该在达到请求限制时拒绝调用', async () => {
      // 模拟达到限制
      for (let i = 0; i < AI_DETECTOR_CONFIG.maxDailyRequests; i++) {
        await AICostMonitor.trackCall(0.01);
      }

      // Mock console.warn
      const consoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      // 尝试再次调用
      const result = await AICostMonitor.trackCall(0.01);

      expect(result).toBe(false);
      expect(consoleWarn).toHaveBeenCalledWith('达到每日API调用限制');

      // 清理
      consoleWarn.mockRestore();
    });

    it('应该在达到成本限制时拒绝调用', async () => {
      // 模拟接近成本限制
      await AICostMonitor.trackCall(AI_DETECTOR_CONFIG.maxCostPerDay - 1);

      // Mock console.warn
      const consoleWarn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => {});

      // 尝试添加超过限制的成本
      const result = await AICostMonitor.trackCall(2);

      expect(result).toBe(false);
      expect(consoleWarn).toHaveBeenCalledWith('达到每日成本预算');

      // 清理
      consoleWarn.mockRestore();
    });

    it('应该在24小时后自动重置', async () => {
      // 添加一些调用
      await AICostMonitor.trackCall(10);
      await AICostMonitor.trackCall(5);

      const statsBefore = AICostMonitor.getStats();
      expect(statsBefore.dailyRequestCount).toBe(2);
      expect(statsBefore.dailyCost).toBe(15);

      // 模拟24小时后
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 25 * 60 * 60 * 1000);

      // 再次调用
      await AICostMonitor.trackCall(1);

      const statsAfter = AICostMonitor.getStats();
      expect(statsAfter.dailyRequestCount).toBe(1); // 重置后只有1次
      expect(statsAfter.dailyCost).toBe(1); // 重置后只有1美元

      // 恢复
      Date.now = originalNow;
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', async () => {
      await AICostMonitor.trackCall(5);
      await AICostMonitor.trackCall(3);

      const stats = AICostMonitor.getStats();

      expect(stats.dailyRequestCount).toBe(2);
      expect(stats.dailyCost).toBe(8);
      expect(stats.remainingRequests).toBe(
        AI_DETECTOR_CONFIG.maxDailyRequests - 2
      );
      expect(stats.remainingBudget).toBe(AI_DETECTOR_CONFIG.maxCostPerDay - 8);
      expect(stats.lastReset).toBeLessThanOrEqual(Date.now());
    });

    it('应该在初始状态返回零值', () => {
      const stats = AICostMonitor.getStats();

      expect(stats.dailyRequestCount).toBe(0);
      expect(stats.dailyCost).toBe(0);
      expect(stats.remainingRequests).toBe(AI_DETECTOR_CONFIG.maxDailyRequests);
      expect(stats.remainingBudget).toBe(AI_DETECTOR_CONFIG.maxCostPerDay);
    });
  });

  describe('reset', () => {
    it('应该重置所有计数器', async () => {
      // 添加一些调用
      await AICostMonitor.trackCall(10);
      await AICostMonitor.trackCall(5);

      const statsBefore = AICostMonitor.getStats();
      expect(statsBefore.dailyRequestCount).toBe(2);
      expect(statsBefore.dailyCost).toBe(15);

      // 重置
      AICostMonitor.reset();

      const statsAfter = AICostMonitor.getStats();
      expect(statsAfter.dailyRequestCount).toBe(0);
      expect(statsAfter.dailyCost).toBe(0);
      expect(statsAfter.remainingRequests).toBe(
        AI_DETECTOR_CONFIG.maxDailyRequests
      );
      expect(statsAfter.remainingBudget).toBe(AI_DETECTOR_CONFIG.maxCostPerDay);
    });
  });

  describe('addCost', () => {
    it('应该手动添加成本', () => {
      AICostMonitor.addCost(5);
      AICostMonitor.addCost(3);

      const stats = AICostMonitor.getStats();
      expect(stats.dailyCost).toBe(8);
    });
  });

  describe('addRequestCount', () => {
    it('应该手动添加请求计数', () => {
      AICostMonitor.addRequestCount(5);
      AICostMonitor.addRequestCount(3);

      const stats = AICostMonitor.getStats();
      expect(stats.dailyRequestCount).toBe(8);
    });
  });

  describe('canMakeCall', () => {
    it('应该在限制内返回true', () => {
      const result = AICostMonitor.canMakeCall(1);
      expect(result).toBe(true);
    });

    it('应该在达到请求限制时返回false', () => {
      // 模拟达到限制
      AICostMonitor.addRequestCount(AI_DETECTOR_CONFIG.maxDailyRequests);

      const result = AICostMonitor.canMakeCall(1);
      expect(result).toBe(false);
    });

    it('应该在达到成本限制时返回false', () => {
      // 模拟接近成本限制
      AICostMonitor.addCost(AI_DETECTOR_CONFIG.maxCostPerDay - 1);

      const result = AICostMonitor.canMakeCall(2);
      expect(result).toBe(false);
    });

    it('应该在24小时后返回true', () => {
      // 模拟达到限制
      AICostMonitor.addRequestCount(AI_DETECTOR_CONFIG.maxDailyRequests);
      AICostMonitor.addCost(AI_DETECTOR_CONFIG.maxCostPerDay);

      // 模拟24小时后
      const originalNow = Date.now;
      Date.now = jest.fn(() => originalNow() + 25 * 60 * 60 * 1000);

      const result = AICostMonitor.canMakeCall(1);
      expect(result).toBe(true);

      // 恢复
      Date.now = originalNow;
    });

    it('应该不更新计数器', () => {
      const statsBefore = AICostMonitor.getStats();

      AICostMonitor.canMakeCall(5);

      const statsAfter = AICostMonitor.getStats();
      expect(statsAfter.dailyRequestCount).toBe(statsBefore.dailyRequestCount);
      expect(statsAfter.dailyCost).toBe(statsBefore.dailyCost);
    });
  });

  describe('边界情况', () => {
    it('应该处理零成本调用', async () => {
      const result = await AICostMonitor.trackCall(0);

      expect(result).toBe(true);

      const stats = AICostMonitor.getStats();
      expect(stats.dailyRequestCount).toBe(1);
      expect(stats.dailyCost).toBe(0);
    });

    it('应该处理负数成本（不应该发生，但要处理）', async () => {
      await AICostMonitor.trackCall(10);

      const statsBefore = AICostMonitor.getStats();
      expect(statsBefore.dailyCost).toBe(10);

      // 添加负数成本
      AICostMonitor.addCost(-5);

      const statsAfter = AICostMonitor.getStats();
      expect(statsAfter.dailyCost).toBe(5);
    });

    it('应该处理非常大的成本值', async () => {
      const result = await AICostMonitor.trackCall(1000000);

      expect(result).toBe(false); // 应该被拒绝
    });

    it('应该处理并发调用', async () => {
      // 并发调用
      const promises = Array.from({ length: 10 }, () =>
        AICostMonitor.trackCall(1)
      );

      const results = await Promise.all(promises);

      // 所有调用都应该成功
      expect(results.every(r => r === true)).toBe(true);

      const stats = AICostMonitor.getStats();
      expect(stats.dailyRequestCount).toBe(10);
      expect(stats.dailyCost).toBe(10);
    });
  });

  describe('性能测试', () => {
    it('应该快速处理大量调用', async () => {
      const startTime = Date.now();

      // 1000次调用
      for (let i = 0; i < 1000; i++) {
        await AICostMonitor.trackCall(0.01);
      }

      const duration = Date.now() - startTime;

      // 应该在100ms内完成
      expect(duration).toBeLessThan(100);
    });
  });
});
