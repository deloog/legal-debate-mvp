/**
 * Alertmanager配置验证测试
 *
 * 测试Alertmanager配置文件的正确性
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  PREDEFINED_ALERT_RULES,
  PREDEFINED_ALERT_GROUPS,
  PREDEFINED_RECEIVERS,
  getSeverityColor,
  getSeverityIcon,
  type AlertmanagerConfig,
  type ReceiverConfig,
  type RouteConfig,
} from '@/types/alertmanager';

describe('Alertmanager配置测试', () => {
  const CONFIG_FILE_PATH = path.join(
    process.cwd(),
    'config',
    'alertmanager',
    'alertmanager.yml'
  );

  let config: Record<string, unknown>;

  beforeAll(() => {
    // 读取Alertmanager配置文件
    const fileContent = fs.readFileSync(CONFIG_FILE_PATH, 'utf-8');
    config = yaml.load(fileContent) as Record<string, unknown>;
  });

  describe('文件格式验证', () => {
    test('应该是一个有效的YAML文件', () => {
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    test('应该包含全局配置', () => {
      expect(config.global).toBeDefined();
      expect(typeof config.global).toBe('object');
    });

    test('应该包含路由配置', () => {
      expect(config.route).toBeDefined();
      expect(typeof config.route).toBe('object');
    });

    test('应该包含接收器配置', () => {
      expect(config.receivers).toBeDefined();
      const receivers = config.receivers as unknown;
      expect(Array.isArray(receivers)).toBe(true);
      expect((receivers as unknown[]).length).toBeGreaterThan(0);
    });
  });

  describe('全局配置验证', () => {
    test('应该包含SMTP配置', () => {
      const globalConfig = config.global as Record<string, unknown>;
      expect(globalConfig.smtp_smarthost).toBeDefined();
      expect(globalConfig.smtp_from).toBeDefined();
    });

    test('应该包含resolve_timeout配置', () => {
      const globalConfig = config.global as Record<string, unknown>;
      expect(globalConfig.resolve_timeout).toBeDefined();
      expect(typeof globalConfig.resolve_timeout).toBe('string');
    });
  });

  describe('路由配置验证', () => {
    test('应该有默认接收器', () => {
      const route = config.route as RouteConfig;
      expect(route.receiver).toBeDefined();
      expect(route.receiver).toBe(PREDEFINED_RECEIVERS.DEFAULT);
    });

    test('应该有分组配置', () => {
      const route = config.route as RouteConfig;
      expect(Array.isArray(route.group_by)).toBe(true);
      expect(route.group_by).toContain('alertname');
      expect(route.group_by).toContain('severity');
      expect(route.group_by).toContain('category');
    });

    test('应该有子路由配置', () => {
      const route = config.route as RouteConfig;
      expect(Array.isArray(route.routes)).toBe(true);
      expect(route.routes?.length).toBeGreaterThan(0);
    });
  });

  describe('接收器配置验证', () => {
    test('应该包含所有预定义的接收器', () => {
      const receivers = config.receivers as ReceiverConfig[];
      const receiverNames = receivers.map(r => r.name);

      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.DEFAULT);
      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.CRITICAL);
      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.API);
      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.DATABASE);
      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.AI);
      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.SYSTEM);
      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.CACHE);
      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.APPLICATION);
      expect(receiverNames).toContain(PREDEFINED_RECEIVERS.BUSINESS);
    });

    test('每个接收器应该有name字段', () => {
      const receivers = config.receivers as ReceiverConfig[];
      for (const receiver of receivers) {
        expect(receiver.name).toBeDefined();
        expect(typeof receiver.name).toBe('string');
      }
    });

    test('严重告警接收器应该有email配置', () => {
      const receivers = config.receivers as ReceiverConfig[];
      const criticalReceiver = receivers.find(
        r => r.name === PREDEFINED_RECEIVERS.CRITICAL
      );

      expect(criticalReceiver).toBeDefined();
      expect(Array.isArray(criticalReceiver?.email_configs)).toBe(true);
      expect(criticalReceiver?.email_configs?.length).toBeGreaterThan(0);
    });

    test('严重告警接收器应该有webhook配置', () => {
      const receivers = config.receivers as ReceiverConfig[];
      const criticalReceiver = receivers.find(
        r => r.name === PREDEFINED_RECEIVERS.CRITICAL
      );

      expect(criticalReceiver).toBeDefined();
      expect(Array.isArray(criticalReceiver?.webhook_configs)).toBe(true);
      expect(criticalReceiver?.webhook_configs?.length).toBeGreaterThan(0);
    });
  });

  describe('子路由验证', () => {
    test('严重告警应该路由到critical-receiver', () => {
      const route = config.route as RouteConfig;
      const criticalRoute = route.routes?.find(r => {
        const match = r.match as Record<string, unknown>;
        return match?.severity === 'critical';
      });

      expect(criticalRoute).toBeDefined();
      expect(criticalRoute?.receiver).toBe(PREDEFINED_RECEIVERS.CRITICAL);
    });

    test('API告警应该路由到api-receiver', () => {
      const route = config.route as RouteConfig;
      const apiRoute = route.routes?.find(r => {
        const match = r.match as Record<string, unknown>;
        return match?.category === 'api';
      });

      expect(apiRoute).toBeDefined();
      expect(apiRoute?.receiver).toBe(PREDEFINED_RECEIVERS.API);
    });

    test('数据库告警应该路由到database-receiver', () => {
      const route = config.route as RouteConfig;
      const dbRoute = route.routes?.find(r => {
        const match = r.match as Record<string, unknown>;
        return match?.category === 'database';
      });

      expect(dbRoute).toBeDefined();
      expect(dbRoute?.receiver).toBe(PREDEFINED_RECEIVERS.DATABASE);
    });

    test('AI服务告警应该路由到ai-receiver', () => {
      const route = config.route as RouteConfig;
      const aiRoute = route.routes?.find(r => {
        const match = r.match as Record<string, unknown>;
        return match?.category === 'ai';
      });

      expect(aiRoute).toBeDefined();
      expect(aiRoute?.receiver).toBe(PREDEFINED_RECEIVERS.AI);
    });

    test('系统资源告警应该路由到system-receiver', () => {
      const route = config.route as RouteConfig;
      const sysRoute = route.routes?.find(r => {
        const match = r.match as Record<string, unknown>;
        return match?.category === 'system';
      });

      expect(sysRoute).toBeDefined();
      expect(sysRoute?.receiver).toBe(PREDEFINED_RECEIVERS.SYSTEM);
    });

    test('缓存告警应该路由到cache-receiver', () => {
      const route = config.route as RouteConfig;
      const cacheRoute = route.routes?.find(r => {
        const match = r.match as Record<string, unknown>;
        return match?.category === 'cache';
      });

      expect(cacheRoute).toBeDefined();
      expect(cacheRoute?.receiver).toBe(PREDEFINED_RECEIVERS.CACHE);
    });

    test('应用健康告警应该路由到application-receiver', () => {
      const route = config.route as RouteConfig;
      const appRoute = route.routes?.find(r => {
        const match = r.match as Record<string, unknown>;
        return match?.category === 'application';
      });

      expect(appRoute).toBeDefined();
      expect(appRoute?.receiver).toBe(PREDEFINED_RECEIVERS.APPLICATION);
    });

    test('商业指标告警应该路由到business-receiver', () => {
      const route = config.route as RouteConfig;
      const businessRoute = route.routes?.find(r => {
        const match = r.match as Record<string, unknown>;
        return match?.category === 'business';
      });

      expect(businessRoute).toBeDefined();
      expect(businessRoute?.receiver).toBe(PREDEFINED_RECEIVERS.BUSINESS);
    });
  });

  describe('抑制规则验证', () => {
    test('应该包含抑制规则', () => {
      const inhibitRules = config.inhibit_rules as unknown[];
      expect(Array.isArray(inhibitRules)).toBe(true);
      expect(inhibitRules.length).toBeGreaterThan(0);
    });

    test('应该有critical抑制warning的规则', () => {
      const inhibitRules = config.inhibit_rules as Record<string, unknown>[];
      const criticalRule = inhibitRules.find(rule => {
        const sourceMatch = rule.source_match as Record<string, unknown>;
        return sourceMatch?.severity === 'critical';
      });

      expect(criticalRule).toBeDefined();
      const targetMatchRe = criticalRule?.target_match_re as Record<
        string,
        string
      >;
      expect(targetMatchRe?.severity).toMatch(/warning|info/);
    });
  });

  describe('模板配置验证', () => {
    test('应该包含模板路径配置', () => {
      const templates = config.templates as unknown[];
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toContain('templates');
    });
  });

  describe('时间间隔验证', () => {
    test('应该包含工作时间间隔', () => {
      const timeIntervals = config.time_intervals as unknown[];
      expect(Array.isArray(timeIntervals)).toBe(true);
      expect(timeIntervals.length).toBeGreaterThan(0);

      const workingHours = timeIntervals.find(ti => {
        const interval = ti as Record<string, unknown>;
        return interval?.name === 'working_hours';
      });

      expect(workingHours).toBeDefined();
    });

    test('应该包含非工作时间间隔', () => {
      const timeIntervals = config.time_intervals as unknown[];
      const offHours = timeIntervals.find(ti => {
        const interval = ti as Record<string, unknown>;
        return interval?.name === 'off_hours';
      });

      expect(offHours).toBeDefined();
    });

    test('应该包含节假日间隔', () => {
      const timeIntervals = config.time_intervals as unknown[];
      const holidays = timeIntervals.find(ti => {
        const interval = ti as Record<string, unknown>;
        return interval?.name === 'holidays';
      });

      expect(holidays).toBeDefined();
    });
  });

  describe('getSeverityColor函数测试', () => {
    test('应该返回critical的颜色', () => {
      const color = getSeverityColor('critical' as never);
      expect(color).toBe('#dc3545');
    });

    test('应该返回warning的颜色', () => {
      const color = getSeverityColor('warning' as never);
      expect(color).toBe('#ffc107');
    });

    test('应该返回info的颜色', () => {
      const color = getSeverityColor('info' as never);
      expect(color).toBe('#17a2b8');
    });

    test('应该返回默认的颜色', () => {
      const color = getSeverityColor('unknown' as never);
      expect(color).toBe('#6c757d');
    });
  });

  describe('getSeverityIcon函数测试', () => {
    test('应该返回critical的图标', () => {
      const icon = getSeverityIcon('critical' as never);
      expect(icon).toBe('🔴');
    });

    test('应该返回warning的图标', () => {
      const icon = getSeverityIcon('warning' as never);
      expect(icon).toBe('🟡');
    });

    test('应该返回info的图标', () => {
      const icon = getSeverityIcon('info' as never);
      expect(icon).toBe('🔵');
    });

    test('应该返回默认的图标', () => {
      const icon = getSeverityIcon('unknown' as never);
      expect(icon).toBe('⚪');
    });
  });

  describe('邮件配置验证', () => {
    test('所有接收器应该有email配置', () => {
      const receivers = config.receivers as ReceiverConfig[];
      for (const receiver of receivers) {
        expect(receiver.email_configs).toBeDefined();
        expect(Array.isArray(receiver.email_configs)).toBe(true);
      }
    });

    test('邮件配置应该有to字段', () => {
      const receivers = config.receivers as ReceiverConfig[];
      for (const receiver of receivers) {
        for (const emailConfig of receiver.email_configs || []) {
          expect(emailConfig.to).toBeDefined();
          expect(typeof emailConfig.to).toBe('string');
        }
      }
    });

    test('邮件配置应该有headers字段', () => {
      const receivers = config.receivers as ReceiverConfig[];
      for (const receiver of receivers) {
        for (const emailConfig of receiver.email_configs || []) {
          expect(emailConfig.headers).toBeDefined();
          expect(typeof emailConfig.headers).toBe('object');
        }
      }
    });
  });

  describe('Webhook配置验证', () => {
    test('严重告警接收器应该有webhook配置', () => {
      const receivers = config.receivers as ReceiverConfig[];
      const criticalReceiver = receivers.find(
        r => r.name === PREDEFINED_RECEIVERS.CRITICAL
      );

      expect(criticalReceiver).toBeDefined();
      expect(Array.isArray(criticalReceiver?.webhook_configs)).toBe(true);
      expect(criticalReceiver?.webhook_configs?.length).toBeGreaterThan(0);
    });

    test('webhook配置应该有send_resolved字段', () => {
      const receivers = config.receivers as ReceiverConfig[];
      const criticalReceiver = receivers.find(
        r => r.name === PREDEFINED_RECEIVERS.CRITICAL
      );

      const webhookConfig = criticalReceiver?.webhook_configs?.[0];
      expect(webhookConfig?.send_resolved).toBeDefined();
    });
  });
});
