/**
 * Alertmanager告警规则验证测试
 *
 * 测试告警规则配置文件的正确性
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  AlertSeverity,
  AlertCategory,
  validateAlertExpression,
  validateAlertLabels,
  PREDEFINED_ALERT_RULES,
  PREDEFINED_ALERT_GROUPS,
  PREDEFINED_RECEIVERS,
  type AlertRule,
  type AlertRuleGroup,
  type AlertmanagerConfig,
} from '@/types/alertmanager';

describe('Alertmanager告警规则配置测试', () => {
  const RULES_FILE_PATH = path.join(
    process.cwd(),
    'config',
    'alertmanager',
    'alert-rules.yml'
  );

  let rules: Record<string, unknown>;

  beforeAll(() => {
    // 读取告警规则文件
    const fileContent = fs.readFileSync(RULES_FILE_PATH, 'utf-8');
    rules = yaml.load(fileContent) as Record<string, unknown>;
  });

  describe('文件格式验证', () => {
    test('应该是一个有效的YAML文件', () => {
      expect(rules).toBeDefined();
      expect(typeof rules).toBe('object');
    });

    test('应该包含groups数组', () => {
      const groups = rules.groups as AlertRuleGroup[];
      expect(Array.isArray(groups)).toBe(true);
      expect(groups.length).toBeGreaterThan(0);
    });
  });

  describe('告警规则组验证', () => {
    test('应该包含所有预定义的告警组', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const groupNames = groups.map(g => g.name);

      expect(groupNames).toContain(PREDEFINED_ALERT_GROUPS.API_PERFORMANCE);
      expect(groupNames).toContain(
        PREDEFINED_ALERT_GROUPS.DATABASE_PERFORMANCE
      );
      expect(groupNames).toContain(PREDEFINED_ALERT_GROUPS.AI_SERVICE);
      expect(groupNames).toContain(PREDEFINED_ALERT_GROUPS.SYSTEM_RESOURCE);
      expect(groupNames).toContain(PREDEFINED_ALERT_GROUPS.CACHE);
      expect(groupNames).toContain(PREDEFINED_ALERT_GROUPS.APPLICATION_HEALTH);
      expect(groupNames).toContain(PREDEFINED_ALERT_GROUPS.BUSINESS_METRICS);
    });

    test('每个告警组应该有name和rules字段', () => {
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        expect(group.name).toBeDefined();
        expect(typeof group.name).toBe('string');
        expect(Array.isArray(group.rules)).toBe(true);
        expect(group.rules.length).toBeGreaterThan(0);
      }
    });

    test('每个告警组应该有interval配置', () => {
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        expect(group.interval).toBeDefined();
        expect(typeof group.interval).toBe('string');
      }
    });
  });

  describe('API性能告警规则验证', () => {
    test('应该包含HighAPIErrorRate规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const apiGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.API_PERFORMANCE
      );

      expect(apiGroup).toBeDefined();
      const rule = apiGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.HIGH_API_ERROR_RATE
      );

      expect(rule).toBeDefined();
      expect(rule?.expr).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.CRITICAL);
      expect(rule?.labels?.category).toBe(AlertCategory.API);
    });

    test('应该包含SlowAPIResponseTime规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const apiGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.API_PERFORMANCE
      );

      const rule = apiGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.SLOW_API_RESPONSE_TIME
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.WARNING);
    });

    test('应该包含APITrafficDrop规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const apiGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.API_PERFORMANCE
      );

      const rule = apiGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.API_TRAFFIC_DROP
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.WARNING);
    });
  });

  describe('数据库性能告警规则验证', () => {
    test('应该包含HighDatabaseConnectionPoolUsage规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const dbGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.DATABASE_PERFORMANCE
      );

      const rule = dbGroup?.rules.find(
        r =>
          r.alert === PREDEFINED_ALERT_RULES.HIGH_DATABASE_CONNECTION_POOL_USAGE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.WARNING);
      expect(rule?.labels?.category).toBe(AlertCategory.DATABASE);
    });

    test('应该包含TooManySlowQueries规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const dbGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.DATABASE_PERFORMANCE
      );

      const rule = dbGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.TOO_MANY_SLOW_QUERIES
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.category).toBe(AlertCategory.DATABASE);
    });

    test('应该包含DatabaseConnectionErrors规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const dbGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.DATABASE_PERFORMANCE
      );

      const rule = dbGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.DATABASE_CONNECTION_ERRORS
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('AI服务告警规则验证', () => {
    test('应该包含HighAIServiceErrorRate规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const aiGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.AI_SERVICE
      );

      const rule = aiGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.HIGH_AI_SERVICE_ERROR_RATE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.CRITICAL);
      expect(rule?.labels?.category).toBe(AlertCategory.AI);
    });

    test('应该包含SlowAIServiceResponse规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const aiGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.AI_SERVICE
      );

      const rule = aiGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.SLOW_AI_SERVICE_RESPONSE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.WARNING);
    });

    test('应该包含AIServiceRateLimit规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const aiGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.AI_SERVICE
      );

      const rule = aiGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.AI_SERVICE_RATE_LIMIT
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.category).toBe(AlertCategory.AI);
    });
  });

  describe('系统资源告警规则验证', () => {
    test('应该包含HighMemoryUsage规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const sysGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.SYSTEM_RESOURCE
      );

      const rule = sysGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.HIGH_MEMORY_USAGE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.category).toBe(AlertCategory.SYSTEM);
    });

    test('应该包含HighCPUUsage规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const sysGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.SYSTEM_RESOURCE
      );

      const rule = sysGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.HIGH_CPU_USAGE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.category).toBe(AlertCategory.SYSTEM);
    });

    test('应该包含HighDiskUsage规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const sysGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.SYSTEM_RESOURCE
      );

      const rule = sysGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.HIGH_DISK_USAGE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('缓存告警规则验证', () => {
    test('应该包含HighRedisConnectionUsage规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const cacheGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.CACHE
      );

      const rule = cacheGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.HIGH_REDIS_CONNECTION_USAGE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.category).toBe(AlertCategory.CACHE);
    });

    test('应该包含LowCacheHitRate规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const cacheGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.CACHE
      );

      const rule = cacheGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.LOW_CACHE_HIT_RATE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.category).toBe(AlertCategory.CACHE);
    });
  });

  describe('应用健康告警规则验证', () => {
    test('应该包含ApplicationInstanceUnhealthy规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const appGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.APPLICATION_HEALTH
      );

      const rule = appGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.APPLICATION_INSTANCE_UNHEALTHY
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.CRITICAL);
    });

    test('应该包含FatalErrorLogs规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const appGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.APPLICATION_HEALTH
      );

      const rule = appGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.FATAL_ERROR_LOGS
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('商业指标告警规则验证', () => {
    test('应该包含HighPaymentFailureRate规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const businessGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.BUSINESS_METRICS
      );

      const rule = businessGroup?.rules.find(
        r => r.alert === PREDEFINED_ALERT_RULES.HIGH_PAYMENT_FAILURE_RATE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.CRITICAL);
      expect(rule?.labels?.category).toBe(AlertCategory.BUSINESS);
    });

    test('应该包含HighDebateGenerationFailureRate规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const businessGroup = groups.find(
        g => g.name === PREDEFINED_ALERT_GROUPS.BUSINESS_METRICS
      );

      const rule = businessGroup?.rules.find(
        r =>
          r.alert === PREDEFINED_ALERT_RULES.HIGH_DEBATE_GENERATION_FAILURE_RATE
      );

      expect(rule).toBeDefined();
      expect(rule?.labels?.severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('PromQL表达式验证', () => {
    test('所有规则的表达式应该有效', () => {
      const groups = rules.groups as AlertRuleGroup[];
      let allValid = true;
      const invalidRules: string[] = [];

      for (const group of groups) {
        for (const rule of group.rules) {
          if (!validateAlertExpression(rule.expr)) {
            allValid = false;
            invalidRules.push(rule.alert);
          }
        }
      }

      expect(allValid).toBe(true);
      expect(invalidRules).toHaveLength(0);
    });

    test('应用级规则应该包含legal_debate_前缀', () => {
      // 只检查应用级指标规则，系统监控规则（node_*）使用通用指标名是正常的
      const appGroups = [
        'api_performance_alerts',
        'database_performance_alerts',
      ];
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        if (!appGroups.includes(group.name)) continue;
        for (const rule of group.rules) {
          expect(rule.expr).toMatch(/legal_debate_/);
        }
      }
    });
  });

  describe('告警标签验证', () => {
    test('所有规则应该有severity标签', () => {
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        for (const rule of group.rules) {
          expect(rule.labels?.severity).toBeDefined();
          expect(
            Object.values(AlertSeverity).includes(rule.labels?.severity)
          ).toBe(true);
        }
      }
    });

    test('所有规则应该有category标签', () => {
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        for (const rule of group.rules) {
          expect(rule.labels?.category).toBeDefined();
          expect(
            Object.values(AlertCategory).includes(rule.labels?.category)
          ).toBe(true);
        }
      }
    });

    test('所有规则应该有summary注解', () => {
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        for (const rule of group.rules) {
          expect(rule.annotations?.summary).toBeDefined();
          expect(typeof rule.annotations?.summary).toBe('string');
        }
      }
    });

    test('所有规则应该有description注解', () => {
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        for (const rule of group.rules) {
          expect(rule.annotations?.description).toBeDefined();
          expect(typeof rule.annotations?.description).toBe('string');
        }
      }
    });
  });

  describe('告警持续时间验证', () => {
    test('所有规则应该有for配置', () => {
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        for (const rule of group.rules) {
          expect(rule.for).toBeDefined();
          expect(typeof rule.for).toBe('string');
        }
      }
    });

    test('for配置应该是有效的时间格式', () => {
      const groups = rules.groups as AlertRuleGroup[];
      const timePattern = /^\d+[smhd]$/;

      for (const group of groups) {
        for (const rule of group.rules) {
          expect(rule.for).toMatch(timePattern);
        }
      }
    });
  });

  describe('dashboard链接验证', () => {
    test('有dashboard注解的规则应使用有效的URL格式', () => {
      // 不要求所有规则都有dashboard，但有dashboard的规则需要有效的HTTP URL
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        for (const rule of group.rules) {
          if (rule.annotations?.dashboard !== undefined) {
            expect(rule.annotations.dashboard).toMatch(/^http/);
          }
        }
      }
    });
  });

  describe('告警严重程度分布验证', () => {
    test('应该包含critical级别告警', () => {
      const groups = rules.groups as AlertRuleGroup[];
      let hasCritical = false;

      for (const group of groups) {
        for (const rule of group.rules) {
          if (rule.labels?.severity === AlertSeverity.CRITICAL) {
            hasCritical = true;
            break;
          }
        }
        if (hasCritical) {
          break;
        }
      }

      expect(hasCritical).toBe(true);
    });

    test('应该包含warning级别告警', () => {
      const groups = rules.groups as AlertRuleGroup[];
      let hasWarning = false;

      for (const group of groups) {
        for (const rule of group.rules) {
          if (rule.labels?.severity === AlertSeverity.WARNING) {
            hasWarning = true;
            break;
          }
        }
        if (hasWarning) {
          break;
        }
      }

      expect(hasWarning).toBe(true);
    });
  });

  describe('validateAlertExpression函数测试', () => {
    test('应该验证有效的PromQL表达式', () => {
      expect(validateAlertExpression('sum(rate(metric[5m]))')).toBe(true);
      expect(
        validateAlertExpression(
          'histogram_quantile(0.95, sum(rate(metric_bucket[5m])))'
        )
      ).toBe(true);
      expect(validateAlertExpression('avg(rate(metric[5m]))')).toBe(true);
    });

    test('应该拒绝无效的表达式', () => {
      expect(validateAlertExpression('')).toBe(false);
      expect(validateAlertExpression('   ')).toBe(false);
      expect(validateAlertExpression('invalid expression')).toBe(false);
    });
  });

  describe('validateAlertLabels函数测试', () => {
    test('应该验证有效的标签', () => {
      const validLabels = {
        alertname: 'TestAlert',
        severity: AlertSeverity.CRITICAL,
        category: AlertCategory.API,
        instance: 'localhost',
      };

      const errors = validateAlertLabels(validLabels);
      expect(errors).toHaveLength(0);
    });

    test('应该拒绝缺少alertname的标签', () => {
      const invalidLabels = {
        severity: AlertSeverity.CRITICAL,
        category: AlertCategory.API,
      } as never;

      const errors = validateAlertLabels(invalidLabels);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('alertname');
    });

    test('应该拒绝缺少severity的标签', () => {
      const invalidLabels = {
        alertname: 'TestAlert',
        category: AlertCategory.API,
      } as never;

      const errors = validateAlertLabels(invalidLabels);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('severity');
    });

    test('应该拒绝缺少category的标签', () => {
      const invalidLabels = {
        alertname: 'TestAlert',
        severity: AlertSeverity.CRITICAL,
      } as never;

      const errors = validateAlertLabels(invalidLabels);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].message).toContain('category');
    });
  });

  describe('统计验证', () => {
    test('应该统计所有告警规则数量', () => {
      const groups = rules.groups as AlertRuleGroup[];
      let totalRules = 0;

      for (const group of groups) {
        totalRules += group.rules.length;
      }

      expect(totalRules).toBeGreaterThan(0);
      expect(totalRules).toBeLessThanOrEqual(30);
    });

    test('每个告警组应该有至少2个规则', () => {
      const groups = rules.groups as AlertRuleGroup[];
      for (const group of groups) {
        expect(group.rules.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
