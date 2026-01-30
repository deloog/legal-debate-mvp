import {
  Alert,
  AlertRule,
  AlertCheckResult,
  NotificationChannel,
  AlertSeverity,
  AlertStatus,
  SystemMetrics,
} from '../../../lib/monitoring/types';

describe('Monitoring Types', () => {
  describe('Alert Interface', () => {
    it('应该创建有效的Alert对象', () => {
      const alert: Alert = {
        title: '测试告警',
        message: '这是一个测试告警消息',
        severity: AlertSeverity.HIGH,
        metadata: {
          metric: 'apiErrorRate',
          value: 10.5,
        },
      };

      expect(alert.title).toBe('测试告警');
      expect(alert.message).toBe('这是一个测试告警消息');
      expect(alert.severity).toBe(AlertSeverity.HIGH);
      expect(alert.metadata).toBeDefined();
      expect(alert.metadata?.metric).toBe('apiErrorRate');
    });

    it('应该创建没有metadata的Alert对象', () => {
      const alert: Alert = {
        title: '简单告警',
        message: '简单告警消息',
        severity: AlertSeverity.LOW,
      };

      expect(alert.title).toBe('简单告警');
      expect(alert.message).toBe('简单告警消息');
      expect(alert.severity).toBe(AlertSeverity.LOW);
      expect(alert.metadata).toBeUndefined();
    });

    it('应该支持所有严重级别', () => {
      const severities: AlertSeverity[] = [
        AlertSeverity.CRITICAL,
        AlertSeverity.HIGH,
        AlertSeverity.MEDIUM,
        AlertSeverity.LOW,
      ];

      severities.forEach(severity => {
        const alert: Alert = {
          title: '测试',
          message: '测试消息',
          severity,
        };
        expect(alert.severity).toBe(severity);
      });
    });
  });

  describe('AlertRule Interface', () => {
    it('应该创建有效的AlertRule对象', () => {
      const rule: AlertRule = {
        id: 'test-rule-1',
        name: '测试规则',
        metric: 'apiErrorRate',
        threshold: 5,
        duration: 60000,
        severity: AlertSeverity.HIGH,
        action: async () => {
          // 测试action
        },
      };

      expect(rule.id).toBe('test-rule-1');
      expect(rule.name).toBe('测试规则');
      expect(rule.metric).toBe('apiErrorRate');
      expect(rule.threshold).toBe(5);
      expect(rule.duration).toBe(60000);
      expect(rule.severity).toBe(AlertSeverity.HIGH);
      expect(rule.action).toBeDefined();
    });

    it('action应该是异步函数', async () => {
      let actionCalled = false;

      const rule: AlertRule = {
        id: 'test-rule-2',
        name: '异步规则',
        metric: 'apiErrorRate',
        threshold: 5,
        duration: 60000,
        severity: AlertSeverity.HIGH,
        action: async () => {
          actionCalled = true;
        },
      };

      await rule.action();
      expect(actionCalled).toBe(true);
    });
  });

  describe('AlertCheckResult Interface', () => {
    it('应该创建未触发的检查结果', () => {
      const result: AlertCheckResult = {
        ruleId: 'rule-1',
        ruleName: '测试规则',
        currentValue: 3,
        threshold: 5,
        severity: AlertSeverity.MEDIUM,
        triggered: false,
      };

      expect(result.ruleId).toBe('rule-1');
      expect(result.ruleName).toBe('测试规则');
      expect(result.currentValue).toBe(3);
      expect(result.threshold).toBe(5);
      expect(result.triggered).toBe(false);
      expect(result.reason).toBeUndefined();
    });

    it('应该创建已触发的检查结果', () => {
      const result: AlertCheckResult = {
        ruleId: 'rule-2',
        ruleName: '告警规则',
        currentValue: 10,
        threshold: 5,
        severity: AlertSeverity.HIGH,
        triggered: true,
        reason: 'apiErrorRate(10) > 5',
      };

      expect(result.ruleId).toBe('rule-2');
      expect(result.ruleName).toBe('告警规则');
      expect(result.currentValue).toBe(10);
      expect(result.threshold).toBe(5);
      expect(result.triggered).toBe(true);
      expect(result.reason).toBe('apiErrorRate(10) > 5');
    });
  });

  describe('SystemMetrics Interface', () => {
    it('应该创建完整的SystemMetrics对象', () => {
      const metrics: SystemMetrics = {
        apiErrorRate: 2.5,
        apiResponseTimeP95: 1500,
        databaseConnectionFailed: 0,
        aiServiceErrorRate: 1.2,
        diskUsagePercent: 60.5,
      };

      expect(metrics.apiErrorRate).toBe(2.5);
      expect(metrics.apiResponseTimeP95).toBe(1500);
      expect(metrics.databaseConnectionFailed).toBe(0);
      expect(metrics.aiServiceErrorRate).toBe(1.2);
      expect(metrics.diskUsagePercent).toBe(60.5);
    });

    it('应该支持零值指标', () => {
      const metrics: SystemMetrics = {
        apiErrorRate: 0,
        apiResponseTimeP95: 0,
        databaseConnectionFailed: 0,
        aiServiceErrorRate: 0,
        diskUsagePercent: 0,
      };

      Object.values(metrics).forEach(value => {
        expect(value).toBe(0);
      });
    });

    it('应该支持高值指标', () => {
      const metrics: SystemMetrics = {
        apiErrorRate: 100,
        apiResponseTimeP95: 10000,
        databaseConnectionFailed: 1000,
        aiServiceErrorRate: 100,
        diskUsagePercent: 100,
      };

      expect(metrics.apiErrorRate).toBe(100);
      expect(metrics.apiResponseTimeP95).toBe(10000);
      expect(metrics.databaseConnectionFailed).toBe(1000);
      expect(metrics.aiServiceErrorRate).toBe(100);
      expect(metrics.diskUsagePercent).toBe(100);
    });
  });

  describe('AlertSeverity Enum', () => {
    it('应该包含所有严重级别', () => {
      const expectedSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
      const actualSeverities = Object.values(AlertSeverity);

      expect(actualSeverities).toEqual(
        expect.arrayContaining(expectedSeverities)
      );
      expect(actualSeverities).toHaveLength(expectedSeverities.length);
    });

    it('应该支持严重级别比较', () => {
      expect(AlertSeverity.CRITICAL).not.toBe(AlertSeverity.HIGH);
      expect(AlertSeverity.HIGH).not.toBe(AlertSeverity.MEDIUM);
      expect(AlertSeverity.MEDIUM).not.toBe(AlertSeverity.LOW);
    });
  });

  describe('AlertStatus Enum', () => {
    it('应该包含所有状态', () => {
      const expectedStatuses = ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED'];
      const actualStatuses = Object.values(AlertStatus);

      expect(actualStatuses).toEqual(expect.arrayContaining(expectedStatuses));
      expect(actualStatuses).toHaveLength(expectedStatuses.length);
    });

    it('应该支持状态比较', () => {
      expect(AlertStatus.TRIGGERED).not.toBe(AlertStatus.ACKNOWLEDGED);
      expect(AlertStatus.ACKNOWLEDGED).not.toBe(AlertStatus.RESOLVED);
    });
  });

  describe('NotificationChannel Interface', () => {
    it('应该定义name属性', () => {
      const channel: NotificationChannel = {
        name: 'TEST',
        enabled: () => true,
        send: async () => {},
      };

      expect(channel.name).toBe('TEST');
    });

    it('enabled方法应该返回布尔值', () => {
      const enabledChannel: NotificationChannel = {
        name: 'ENABLED',
        enabled: () => true,
        send: async () => {},
      };

      const disabledChannel: NotificationChannel = {
        name: 'DISABLED',
        enabled: () => false,
        send: async () => {},
      };

      expect(enabledChannel.enabled()).toBe(true);
      expect(disabledChannel.enabled()).toBe(false);
    });

    it('send方法应该是异步的', async () => {
      let sent = false;

      const channel: NotificationChannel = {
        name: 'TEST',
        enabled: () => true,
        send: async () => {
          sent = true;
        },
      };

      const alert: Alert = {
        title: '测试',
        message: '测试消息',
        severity: AlertSeverity.LOW,
      };

      await channel.send(alert);
      expect(sent).toBe(true);
    });

    it('应该支持不同的通知渠道', () => {
      const channels: NotificationChannel[] = [
        {
          name: 'EMAIL',
          enabled: () => true,
          send: async () => {},
        },
        {
          name: 'WEBHOOK',
          enabled: () => true,
          send: async () => {},
        },
        {
          name: 'SMS',
          enabled: () => false,
          send: async () => {},
        },
        {
          name: 'LOG',
          enabled: () => true,
          send: async () => {},
        },
      ];

      expect(channels).toHaveLength(4);
      expect(channels[0].name).toBe('EMAIL');
      expect(channels[1].name).toBe('WEBHOOK');
      expect(channels[2].name).toBe('SMS');
      expect(channels[3].name).toBe('LOG');
    });
  });

  describe('类型兼容性', () => {
    it('Alert应该可以作为参数传递给NotificationChannel.send', async () => {
      const channel: NotificationChannel = {
        name: 'TEST',
        enabled: () => true,
        send: async (alert: Alert) => {
          expect(alert).toBeDefined();
          expect(alert.title).toBe('测试');
          expect(alert.message).toBe('消息');
          expect(alert.severity).toBe(AlertSeverity.MEDIUM);
        },
      };

      const alert: Alert = {
        title: '测试',
        message: '消息',
        severity: AlertSeverity.MEDIUM,
      };

      await channel.send(alert);
    });

    it('AlertRule.action应该可以访问完整上下文', async () => {
      const mockAction = jest.fn();

      const rule: AlertRule = {
        id: 'test',
        name: '测试规则',
        metric: 'apiErrorRate',
        threshold: 5,
        duration: 60000,
        severity: AlertSeverity.HIGH,
        action: mockAction,
      };

      await rule.action();
      expect(mockAction).toHaveBeenCalled();
    });
  });
});
