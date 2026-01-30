import { prisma } from '@/lib/db/prisma';
import {
  Logger,
  LogLevel,
  LogFormat,
  LogOutput,
} from '../../../config/winston.config';
import { getMetricsCollector } from './metrics-collector';
import { createNotificationChannels } from './notification-channels';
import {
  Alert,
  AlertRule,
  AlertSeverity,
  AlertStatus,
  AlertCheckResult,
  NotificationChannel,
} from './types';

// 创建告警管理器专用的logger实例
const logger = new Logger({
  level: LogLevel.INFO,
  format: LogFormat.JSON,
  output: LogOutput.CONSOLE,
  console: {
    enabled: true,
    colorize: true,
    timestamp: false,
  },
  file: {
    enabled: true,
    directory: './logs',
    filename: 'alerts.log',
    maxSize: 1048576,
    maxFiles: 5,
    compress: true,
  },
  environment: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  sanitize: {
    enabled: true,
    sensitiveKeys: [],
  },
  performance: {
    async: false,
    bufferSize: 100,
    flushInterval: 5000,
  },
});

/**
 * 告警管理器类
 */
export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private channels: NotificationChannel[] = [];
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private alertHistory: Map<string, number> = new Map(); // 记录告警触发次数
  private lastCheckTime: Date | null = null;
  private isChecking = false;

  /**
   * 构造函数
   */
  constructor(checkInterval: number = 60 * 1000) {
    this.initializeDefaultRules();
    this.initializeChannels();
    this.startChecking(checkInterval);
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultRules(): void {
    // API错误率告警
    this.addRule({
      id: 'api-error-rate',
      name: 'API错误率过高',
      metric: 'apiErrorRate',
      threshold: 5, // 5%
      duration: 5 * 60 * 1000, // 5分钟
      severity: AlertSeverity.HIGH,
      action: async () => {
        const metrics = await getMetricsCollector().collectSystemMetrics();
        await this.sendAlert({
          title: 'API错误率过高',
          message: `当前API错误率为${metrics.apiErrorRate.toFixed(2)}%，超过阈值5%`,
          severity: AlertSeverity.HIGH,
          metadata: {
            currentValue: metrics.apiErrorRate,
            threshold: 5,
            metric: 'apiErrorRate',
          },
        });
      },
    });

    // API响应时间告警
    this.addRule({
      id: 'api-response-time',
      name: 'API响应时间过长',
      metric: 'apiResponseTimeP95',
      threshold: 2000, // 2秒
      duration: 3 * 60 * 1000, // 3分钟
      severity: AlertSeverity.MEDIUM,
      action: async () => {
        const metrics = await getMetricsCollector().collectSystemMetrics();
        await this.sendAlert({
          title: 'API响应时间过长',
          message: `当前P95响应时间为${metrics.apiResponseTimeP95.toFixed(0)}ms，超过阈值2000ms`,
          severity: AlertSeverity.MEDIUM,
          metadata: {
            currentValue: metrics.apiResponseTimeP95,
            threshold: 2000,
            metric: 'apiResponseTimeP95',
          },
        });
      },
    });

    // 数据库连接告警
    this.addRule({
      id: 'database-connection',
      name: '数据库连接失败',
      metric: 'databaseConnectionFailed',
      threshold: 10, // 10次失败
      duration: 1 * 60 * 1000, // 1分钟
      severity: AlertSeverity.CRITICAL,
      action: async () => {
        const metrics = await getMetricsCollector().collectSystemMetrics();
        await this.sendAlert({
          title: '数据库连接失败',
          message: `最近1分钟数据库连接失败${metrics.databaseConnectionFailed}次，超过阈值10次`,
          severity: AlertSeverity.CRITICAL,
          metadata: {
            currentValue: metrics.databaseConnectionFailed,
            threshold: 10,
            metric: 'databaseConnectionFailed',
          },
        });
      },
    });

    // AI服务错误率告警
    this.addRule({
      id: 'ai-service-error',
      name: 'AI服务错误率过高',
      metric: 'aiServiceErrorRate',
      threshold: 10, // 10%
      duration: 5 * 60 * 1000, // 5分钟
      severity: AlertSeverity.HIGH,
      action: async () => {
        const metrics = await getMetricsCollector().collectSystemMetrics();
        await this.sendAlert({
          title: 'AI服务错误率过高',
          message: `当前AI服务错误率为${metrics.aiServiceErrorRate.toFixed(2)}%，超过阈值10%`,
          severity: AlertSeverity.HIGH,
          metadata: {
            currentValue: metrics.aiServiceErrorRate,
            threshold: 10,
            metric: 'aiServiceErrorRate',
          },
        });
      },
    });

    // 磁盘空间告警
    this.addRule({
      id: 'disk-usage',
      name: '磁盘空间不足',
      metric: 'diskUsagePercent',
      threshold: 85, // 85%
      duration: 10 * 60 * 1000, // 10分钟
      severity: AlertSeverity.MEDIUM,
      action: async () => {
        const metrics = await getMetricsCollector().collectSystemMetrics();
        await this.sendAlert({
          title: '磁盘空间不足',
          message: `当前磁盘使用率为${metrics.diskUsagePercent.toFixed(1)}%，超过阈值85%`,
          severity: AlertSeverity.MEDIUM,
          metadata: {
            currentValue: metrics.diskUsagePercent,
            threshold: 85,
            metric: 'diskUsagePercent',
          },
        });
      },
    });
  }

  /**
   * 初始化通知渠道
   */
  private initializeChannels(): void {
    this.channels = createNotificationChannels();
  }

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Added alert rule: ${rule.name}`, {
      ruleId: rule.id,
      metric: rule.metric,
      threshold: rule.threshold,
      severity: rule.severity,
    });
  }

  /**
   * 移除告警规则
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    logger.info(`Removed alert rule: ${ruleId}`);
  }

  /**
   * 获取告警规则
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * 获取所有告警规则
   */
  getAllRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 开始定时检查
   */
  startChecking(interval: number = 60 * 1000): void {
    if (this.checkTimer !== null) {
      this.stopChecking();
    }

    this.checkTimer = setInterval(() => {
      void this.checkAlerts();
    }, interval);

    logger.info(`Started alert checking with interval: ${interval}ms`);
  }

  /**
   * 停止定时检查
   */
  stopChecking(): void {
    if (this.checkTimer !== null) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
      logger.info('Stopped alert checking');
    }
  }

  /**
   * 检查所有告警
   */
  async checkAlerts(): Promise<AlertCheckResult[]> {
    if (this.isChecking) {
      logger.warn('Alert checking is already in progress');
      return [];
    }

    this.isChecking = true;
    this.lastCheckTime = new Date();

    try {
      const results: AlertCheckResult[] = [];

      for (const rule of Array.from(this.rules.values())) {
        const result = await this.checkRule(rule);
        results.push(result);

        if (result.triggered) {
          // 触发告警
          await rule.action();

          // 记录到数据库
          await this.recordAlert(rule, result);
        }
      }

      return results;
    } catch (error) {
      logger.error('Failed to check alerts', error);
      return [];
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * 检查单个规则
   */
  private async checkRule(rule: AlertRule): Promise<AlertCheckResult> {
    try {
      const metricValue = await getMetricsCollector().getMetric(rule.metric);
      const triggered = metricValue > rule.threshold;

      return {
        ruleId: rule.id,
        ruleName: rule.name,
        currentValue: metricValue,
        threshold: rule.threshold,
        severity: rule.severity,
        triggered,
        reason: triggered
          ? `${rule.metric}(${metricValue}) > ${rule.threshold}`
          : undefined,
      };
    } catch {
      return {
        ruleId: rule.id,
        ruleName: rule.name,
        currentValue: 0,
        threshold: rule.threshold,
        severity: rule.severity,
        triggered: false,
        reason: 'Failed to get metric value',
      };
    }
  }

  /**
   * 发送告警通知
   */
  private async sendAlert(alert: Alert): Promise<void> {
    logger.info(`Sending alert: ${alert.title}`, {
      severity: alert.severity,
      message: alert.message,
    });

    const results = await Promise.allSettled(
      this.channels.map(channel =>
        channel.send(alert).catch(error => {
          throw error;
        })
      )
    );

    // 记录发送结果
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          `Failed to send alert via ${this.channels[index].name}`,
          result.reason
        );
      }
    });
  }

  /**
   * 记录告警到数据库
   */
  private async recordAlert(
    rule: AlertRule,
    result: AlertCheckResult
  ): Promise<void> {
    try {
      await prisma.alert.create({
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          status: AlertStatus.TRIGGERED,
          message: result.reason || '',
          errorLogId: '',
          errorType: 'UNKNOWN_ERROR',
          errorMessage: '',
          notificationHistory: [],
          triggeredAt: new Date(),
          acknowledgedAt: null,
          resolvedAt: null,
          details: {
            ruleId: rule.id,
            ruleName: rule.name,
            currentValue: result.currentValue,
            threshold: result.threshold,
            severity: result.severity,
            triggered: result.triggered,
            reason: result.reason,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to record alert to database', error);
    }
  }

  /**
   * 获取告警统计
   */
  async getAlertStats(): Promise<{
    totalAlerts: number;
    triggeredAlerts: number;
    acknowledgedAlerts: number;
    resolvedAlerts: number;
    bySeverity: Record<string, number>;
  }> {
    try {
      const alerts = await prisma.alert.findMany({
        orderBy: { triggeredAt: 'desc' },
        take: 1000,
      });

      const triggeredAlerts = alerts.filter(
        a => a.status === AlertStatus.TRIGGERED
      ).length;
      const acknowledgedAlerts = alerts.filter(
        a => a.status === AlertStatus.ACKNOWLEDGED
      ).length;
      const resolvedAlerts = alerts.filter(
        a => a.status === AlertStatus.RESOLVED
      ).length;

      const bySeverity: Record<string, number> = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
      };

      for (const alert of alerts) {
        const severity = alert.severity;
        if (severity in bySeverity) {
          bySeverity[severity]++;
        }
      }

      return {
        totalAlerts: alerts.length,
        triggeredAlerts,
        acknowledgedAlerts,
        resolvedAlerts,
        bySeverity,
      };
    } catch (error) {
      logger.error('Failed to get alert stats', error);
      return {
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
      };
    }
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      await prisma.alert.update({
        where: { alertId },
        data: {
          status: AlertStatus.ACKNOWLEDGED,
          acknowledgedAt: new Date(),
        },
      });
      return true;
    } catch (error) {
      logger.error(`Failed to acknowledge alert ${alertId}`, error);
      return false;
    }
  }

  /**
   * 解决告警
   */
  async resolveAlert(alertId: string): Promise<boolean> {
    try {
      await prisma.alert.update({
        where: { alertId },
        data: {
          status: AlertStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
      return true;
    } catch (error) {
      logger.error(`Failed to resolve alert ${alertId}`, error);
      return false;
    }
  }

  /**
   * 清理旧告警
   */
  async cleanupOldAlerts(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await prisma.alert.deleteMany({
        where: {
          triggeredAt: {
            lt: cutoffDate,
          },
          status: AlertStatus.RESOLVED,
        },
      });

      logger.info(`Cleaned up ${result.count} old alerts`);
    } catch (error) {
      logger.error('Failed to cleanup old alerts', error);
    }
  }

  /**
   * 手动触发告警检查
   */
  async manualCheck(): Promise<AlertCheckResult[]> {
    return this.checkAlerts();
  }

  /**
   * 获取最后检查时间
   */
  getLastCheckTime(): Date | null {
    return this.lastCheckTime;
  }

  /**
   * 销毁告警管理器
   */
  destroy(): void {
    this.stopChecking();
    this.rules.clear();
    this.channels = [];
    this.alertHistory.clear();
    logger.info('Alert manager destroyed');
  }
}

/**
 * 单例实例
 */
let managerInstance: AlertManager | null = null;

/**
 * 获取告警管理器实例
 */
export function getAlertManager(): AlertManager {
  if (!managerInstance) {
    managerInstance = new AlertManager();
  }
  return managerInstance;
}

/**
 * 重置告警管理器实例（用于测试）
 */
export function resetAlertManager(): void {
  if (managerInstance) {
    managerInstance.destroy();
    managerInstance = null;
  }
}

/**
 * 便捷函数：手动触发告警检查
 */
export async function checkAlerts(): Promise<AlertCheckResult[]> {
  return getAlertManager().manualCheck();
}

/**
 * 便捷函数：添加告警规则
 */
export function addAlertRule(rule: AlertRule): void {
  getAlertManager().addRule(rule);
}

/**
 * 便捷函数：获取告警统计
 */
export async function getAlertStats(): Promise<{
  totalAlerts: number;
  triggeredAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  bySeverity: Record<string, number>;
}> {
  return getAlertManager().getAlertStats();
}
