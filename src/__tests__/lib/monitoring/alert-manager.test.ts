import {
  AlertManager,
  getAlertManager,
  resetAlertManager,
  checkAlerts,
  addAlertRule,
  getAlertStats,
} from '../../../lib/monitoring/alert-manager';
import {
  AlertRule,
  AlertSeverity,
  AlertStatus,
} from '../../../lib/monitoring/types';
import { getMetricsCollector } from '../../../lib/monitoring/metrics-collector';
import { prisma } from '@/lib/db/prisma';

jest.mock('../../../lib/monitoring/metrics-collector');
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    alert: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('Alert Manager', () => {
  let manager: AlertManager;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetAlertManager();
  });

  describe('初始化', () => {
    beforeEach(() => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        collectSystemMetrics: async () => ({
          apiErrorRate: 2,
          apiResponseTimeP95: 1000,
          databaseConnectionFailed: 0,
          aiServiceErrorRate: 1,
          diskUsagePercent: 50,
        }),
        getMetric: async (metric: string) => {
          const metrics: Record<string, number> = {
            apiErrorRate: 2,
            apiResponseTimeP95: 1000,
            databaseConnectionFailed: 0,
            aiServiceErrorRate: 1,
            diskUsagePercent: 50,
          };
          return metrics[metric] || 0;
        },
      });
      manager = getAlertManager();
    });

    it('应该创建告警管理器实例', () => {
      expect(manager).toBeInstanceOf(AlertManager);
    });

    it('应该初始化默认告警规则', () => {
      const rules = manager.getAllRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('默认规则应该包含API错误率告警', () => {
      const rule = manager.getRule('api-error-rate');
      expect(rule).toBeDefined();
      expect(rule?.metric).toBe('apiErrorRate');
      expect(rule?.threshold).toBe(5);
    });

    it('默认规则应该包含API响应时间告警', () => {
      const rule = manager.getRule('api-response-time');
      expect(rule).toBeDefined();
      expect(rule?.metric).toBe('apiResponseTimeP95');
      expect(rule?.threshold).toBe(2000);
    });

    it('默认规则应该包含数据库连接告警', () => {
      const rule = manager.getRule('database-connection');
      expect(rule).toBeDefined();
      expect(rule?.metric).toBe('databaseConnectionFailed');
      expect(rule?.threshold).toBe(10);
    });

    it('默认规则应该包含AI服务错误率告警', () => {
      const rule = manager.getRule('ai-service-error');
      expect(rule).toBeDefined();
      expect(rule?.metric).toBe('aiServiceErrorRate');
      expect(rule?.threshold).toBe(10);
    });

    it('默认规则应该包含磁盘空间告警', () => {
      const rule = manager.getRule('disk-usage');
      expect(rule).toBeDefined();
      expect(rule?.metric).toBe('diskUsagePercent');
      expect(rule?.threshold).toBe(85);
    });
  });

  describe('添加和移除规则', () => {
    beforeEach(() => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        collectSystemMetrics: async () => ({
          apiErrorRate: 2,
          apiResponseTimeP95: 1000,
          databaseConnectionFailed: 0,
          aiServiceErrorRate: 1,
          diskUsagePercent: 50,
        }),
        getMetric: async (metric: string) => {
          const metrics: Record<string, number> = {
            apiErrorRate: 2,
            apiResponseTimeP95: 1000,
            databaseConnectionFailed: 0,
            aiServiceErrorRate: 1,
            diskUsagePercent: 50,
          };
          return metrics[metric] || 0;
        },
      });
      manager = getAlertManager();
    });

    it('应该添加新的告警规则', () => {
      const newRule: AlertRule = {
        id: 'test-rule',
        name: '测试规则',
        metric: 'apiErrorRate',
        threshold: 10,
        duration: 60000,
        severity: AlertSeverity.MEDIUM,
        action: async () => {},
      };

      manager.addRule(newRule);
      const rule = manager.getRule('test-rule');
      expect(rule).toBeDefined();
      expect(rule?.id).toBe('test-rule');
    });

    it('应该移除告警规则', () => {
      const newRule: AlertRule = {
        id: 'removable-rule',
        name: '可移除规则',
        metric: 'apiErrorRate',
        threshold: 10,
        duration: 60000,
        severity: AlertSeverity.MEDIUM,
        action: async () => {},
      };

      manager.addRule(newRule);
      expect(manager.getRule('removable-rule')).toBeDefined();

      manager.removeRule('removable-rule');
      expect(manager.getRule('removable-rule')).toBeUndefined();
    });

    it('应该获取所有规则', () => {
      const rules = manager.getAllRules();
      expect(rules).toBeInstanceOf(Array);
      expect(rules.length).toBeGreaterThan(0);
    });
  });

  describe('告警检查', () => {
    beforeEach(() => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        collectSystemMetrics: async () => ({
          apiErrorRate: 2,
          apiResponseTimeP95: 1000,
          databaseConnectionFailed: 0,
          aiServiceErrorRate: 1,
          diskUsagePercent: 50,
        }),
        getMetric: async (metric: string) => {
          const metrics: Record<string, number> = {
            apiErrorRate: 2,
            apiResponseTimeP95: 1000,
            databaseConnectionFailed: 0,
            aiServiceErrorRate: 1,
            diskUsagePercent: 50,
          };
          return metrics[metric] || 0;
        },
      });
      manager = getAlertManager();
    });

    it('应该执行告警检查', async () => {
      const results = await manager.checkAlerts();
      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
    });

    it('应该正确检查未触发告警', async () => {
      const results = await manager.checkAlerts();
      const allNotTriggered = results.every(r => !r.triggered);
      expect(allNotTriggered).toBe(true);
    });

    it('应该正确识别触发告警', async () => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        collectSystemMetrics: async () => ({
          apiErrorRate: 10,
          apiResponseTimeP95: 1000,
          databaseConnectionFailed: 0,
          aiServiceErrorRate: 1,
          diskUsagePercent: 50,
        }),
        getMetric: async (metric: string) => {
          const metrics: Record<string, number> = {
            apiErrorRate: 10,
            apiResponseTimeP95: 1000,
            databaseConnectionFailed: 0,
            aiServiceErrorRate: 1,
            diskUsagePercent: 50,
          };
          return metrics[metric] || 0;
        },
      });
      const testManager = getAlertManager();

      const results = await testManager.checkAlerts();
      const triggeredResults = results.filter(r => r.triggered);
      expect(triggeredResults.length).toBeGreaterThan(0);
    });

    it('应该防止并发检查', async () => {
      (getMetricsCollector as jest.Mock).mockReturnValue({
        getMetric: async () => 0,
      });
      const testManager = new AlertManager(60000);

      const promise1 = testManager.checkAlerts();
      const promise2 = testManager.checkAlerts();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // 第二个检查应该返回空数组
      expect(result1.length).toBeGreaterThan(0);
      expect(result2.length).toBe(0);

      testManager.destroy();
    });

    it('应该更新最后检查时间', async () => {
      const beforeCheck = manager.getLastCheckTime();
      await manager.checkAlerts();
      const afterCheck = manager.getLastCheckTime();

      expect(beforeCheck).toBeNull();
      expect(afterCheck).toBeInstanceOf(Date);
    });
  });

  describe('单例模式', () => {
    beforeEach(() => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        collectSystemMetrics: async () => ({
          apiErrorRate: 2,
          apiResponseTimeP95: 1000,
          databaseConnectionFailed: 0,
          aiServiceErrorRate: 1,
          diskUsagePercent: 50,
        }),
        getMetric: async (metric: string) => {
          const metrics: Record<string, number> = {
            apiErrorRate: 2,
            apiResponseTimeP95: 1000,
            databaseConnectionFailed: 0,
            aiServiceErrorRate: 1,
            diskUsagePercent: 50,
          };
          return metrics[metric] || 0;
        },
      });
      manager = getAlertManager();
    });

    it('应该返回相同的实例', () => {
      const instance1 = getAlertManager();
      const instance2 = getAlertManager();

      expect(instance1).toBe(instance2);
    });

    it('应该支持重置实例', () => {
      const instance1 = getAlertManager();
      resetAlertManager();
      const instance2 = getAlertManager();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('定时检查', () => {
    it('应该启动定时检查', () => {
      jest.useFakeTimers();
      const newManager = new AlertManager(10000);
      const checkSpy = jest.spyOn(newManager, 'checkAlerts');

      jest.advanceTimersByTime(10000);
      jest.advanceTimersByTime(10000);

      expect(checkSpy).toHaveBeenCalledTimes(2);

      newManager.destroy();
      jest.useRealTimers();
    });

    it('应该停止定时检查', () => {
      jest.useFakeTimers();
      const newManager = new AlertManager(5000);
      const checkSpy = jest.spyOn(newManager, 'checkAlerts');

      jest.advanceTimersByTime(5000);
      expect(checkSpy).toHaveBeenCalledTimes(1);

      newManager.stopChecking();
      jest.advanceTimersByTime(5000);
      expect(checkSpy).toHaveBeenCalledTimes(1);

      newManager.destroy();
      jest.useRealTimers();
    });

    it('重新启动应该清除旧定时器', () => {
      jest.useFakeTimers();
      const newManager = new AlertManager(5000);
      const checkSpy = jest.spyOn(newManager, 'checkAlerts');
      newManager.startChecking(10000);

      jest.advanceTimersByTime(5000);
      expect(checkSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5000);
      expect(checkSpy).toHaveBeenCalledTimes(1);

      newManager.destroy();
      jest.useRealTimers();
    });
  });

  describe('销毁', () => {
    beforeEach(() => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        collectSystemMetrics: async () => ({
          apiErrorRate: 2,
          apiResponseTimeP95: 1000,
          databaseConnectionFailed: 0,
          aiServiceErrorRate: 1,
          diskUsagePercent: 50,
        }),
        getMetric: async (metric: string) => {
          const metrics: Record<string, number> = {
            apiErrorRate: 2,
            apiResponseTimeP95: 1000,
            databaseConnectionFailed: 0,
            aiServiceErrorRate: 1,
            diskUsagePercent: 50,
          };
          return metrics[metric] || 0;
        },
      });
    });

    it('应该停止定时检查', () => {
      jest.useFakeTimers();
      const newManager = new AlertManager(5000);
      const checkSpy = jest.spyOn(newManager, 'checkAlerts');

      newManager.destroy();
      jest.advanceTimersByTime(5000);

      expect(checkSpy).not.toHaveBeenCalled();

      jest.useRealTimers();
    });

    it('应该清除所有规则', () => {
      const newManager = new AlertManager(60000);
      const initialCount = newManager.getAllRules().length;
      expect(initialCount).toBeGreaterThan(0);

      newManager.destroy();

      const finalCount = newManager.getAllRules().length;
      expect(finalCount).toBe(0);
    });
  });

  describe('手动检查', () => {
    beforeEach(() => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        collectSystemMetrics: async () => ({
          apiErrorRate: 2,
          apiResponseTimeP95: 1000,
          databaseConnectionFailed: 0,
          aiServiceErrorRate: 1,
          diskUsagePercent: 50,
        }),
        getMetric: async () => 0,
      });
      manager = getAlertManager();
    });

    it('manualCheck应该执行告警检查', async () => {
      (getMetricsCollector as jest.Mock).mockReturnValue({
        getMetric: async () => 0,
      });

      const results = await manager.manualCheck();
      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('告警操作', () => {
    beforeEach(() => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        collectSystemMetrics: async () => ({
          apiErrorRate: 2,
          apiResponseTimeP95: 1000,
          databaseConnectionFailed: 0,
          aiServiceErrorRate: 1,
          diskUsagePercent: 50,
        }),
        getMetric: async (metric: string) => {
          const metrics: Record<string, number> = {
            apiErrorRate: 2,
            apiResponseTimeP95: 1000,
            databaseConnectionFailed: 0,
            aiServiceErrorRate: 1,
            diskUsagePercent: 50,
          };
          return metrics[metric] || 0;
        },
      });
      manager = getAlertManager();
    });

    it('getAlertStats应该返回告警统计', async () => {
      const mockAlerts = [
        {
          status: AlertStatus.TRIGGERED,
          severity: AlertSeverity.HIGH,
        },
        {
          status: AlertStatus.ACKNOWLEDGED,
          severity: AlertSeverity.MEDIUM,
        },
        {
          status: AlertStatus.RESOLVED,
          severity: AlertSeverity.LOW,
        },
      ];

      (prisma.alert.findMany as jest.Mock).mockResolvedValue(mockAlerts);

      const stats = await manager.getAlertStats();

      expect(stats).toEqual({
        totalAlerts: 3,
        triggeredAlerts: 1,
        acknowledgedAlerts: 1,
        resolvedAlerts: 1,
        bySeverity: {
          CRITICAL: 0,
          HIGH: 1,
          MEDIUM: 1,
          LOW: 1,
        },
      });
    });

    it('getAlertStats应该处理数据库错误', async () => {
      (prisma.alert.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const stats = await manager.getAlertStats();

      expect(stats).toEqual({
        totalAlerts: 0,
        triggeredAlerts: 0,
        acknowledgedAlerts: 0,
        resolvedAlerts: 0,
        bySeverity: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
        },
      });
    });

    it('acknowledgeAlert应该确认告警', async () => {
      (prisma.alert.update as jest.Mock).mockResolvedValue({
        status: AlertStatus.ACKNOWLEDGED,
      });

      const result = await manager.acknowledgeAlert('test-alert-id');

      expect(result).toBe(true);
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { alertId: 'test-alert-id' },
        data: {
          status: AlertStatus.ACKNOWLEDGED,
          acknowledgedAt: expect.any(Date),
        },
      });
    });

    it('acknowledgeAlert应该处理数据库错误', async () => {
      (prisma.alert.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await manager.acknowledgeAlert('test-alert-id');

      expect(result).toBe(false);
    });

    it('resolveAlert应该解决告警', async () => {
      (prisma.alert.update as jest.Mock).mockResolvedValue({
        status: AlertStatus.RESOLVED,
      });

      const result = await manager.resolveAlert('test-alert-id');

      expect(result).toBe(true);
      expect(prisma.alert.update).toHaveBeenCalledWith({
        where: { alertId: 'test-alert-id' },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: expect.any(Date),
        },
      });
    });

    it('resolveAlert应该处理数据库错误', async () => {
      (prisma.alert.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await manager.resolveAlert('test-alert-id');

      expect(result).toBe(false);
    });

    it('cleanupOldAlerts应该清理旧告警', async () => {
      (prisma.alert.deleteMany as jest.Mock).mockResolvedValue({ count: 10 });

      await manager.cleanupOldAlerts(30);

      expect(prisma.alert.deleteMany).toHaveBeenCalledWith({
        where: {
          triggeredAt: { lt: expect.any(Date) },
          status: AlertStatus.RESOLVED,
        },
      });
    });

    it('cleanupOldAlerts应该处理数据库错误', async () => {
      (prisma.alert.deleteMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(manager.cleanupOldAlerts(30)).resolves.not.toThrow();
    });
  });

  describe('错误处理', () => {
    it('checkRule应该处理获取指标失败', async () => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        getMetric: async () => {
          throw new Error('Failed to get metric');
        },
      });
      manager = getAlertManager();

      const rule: AlertRule = {
        id: 'test-error-rule',
        name: '测试错误规则',
        metric: 'unknownMetric',
        threshold: 10,
        duration: 60000,
        severity: AlertSeverity.MEDIUM,
        action: async () => {},
      };

      manager.addRule(rule);

      const results = await manager.checkAlerts();
      const errorResult = results.find(r => r.ruleId === 'test-error-rule');

      expect(errorResult).toBeDefined();
      expect(errorResult?.triggered).toBe(false);
      expect(errorResult?.reason).toBe('Failed to get metric value');
    });
  });

  describe('全局便捷函数', () => {
    beforeEach(() => {
      resetAlertManager();
      (getMetricsCollector as jest.Mock).mockReturnValue({
        getMetric: async () => 0,
      });
    });

    it('checkAlerts应该使用单例', async () => {
      const results = await checkAlerts();
      expect(results).toBeInstanceOf(Array);
    });

    it('addAlertRule应该使用单例', () => {
      const newRule: AlertRule = {
        id: 'convenience-rule',
        name: '便捷规则',
        metric: 'apiErrorRate',
        threshold: 10,
        duration: 60000,
        severity: AlertSeverity.MEDIUM,
        action: async () => {},
      };

      addAlertRule(newRule);
      const rule = getAlertManager().getRule('convenience-rule');
      expect(rule).toBeDefined();
    });

    it('getAlertStats应该使用单例', async () => {
      (prisma.alert.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await getAlertStats();

      expect(stats).toEqual({
        totalAlerts: 0,
        triggeredAlerts: 0,
        acknowledgedAlerts: 0,
        resolvedAlerts: 0,
        bySeverity: {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
        },
      });
    });
  });
});
