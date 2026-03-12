/**
 * Alert Manager
 *
 * 告警管理器
 * 负责监控错误日志，根据规则触发告警，发送通知
 */

import { ErrorLog, ErrorType, ErrorSeverity } from './types';
import { logger } from '@/lib/logger';

/**
 * 告警状态枚举
 */
export enum AlertStatus {
  TRIGGERED = 'TRIGGERED', // 已触发
  ACKNOWLEDGED = 'ACKNOWLEDGED', // 已确认
  RESOLVED = 'RESOLVED', // 已解决
}

/**
 * 告警严重程度
 */
export enum AlertSeverity {
  CRITICAL = 'CRITICAL', // 严重告警
  HIGH = 'HIGH', // 高级告警
  MEDIUM = 'MEDIUM', // 中级告警
  LOW = 'LOW', // 低级告警
}

/**
 * 告警渠道
 */
export enum AlertChannel {
  LOG = 'LOG', // 日志
  EMAIL = 'EMAIL', // 邮件
  WEBHOOK = 'WEBHOOK', // Webhook
  SMS = 'SMS', // 短信
}

/**
 * 告警规则
 */
export interface AlertRule {
  ruleId: string;
  name: string;
  description: string;
  enabled: boolean;
  priority: number; // 优先级，数字越大优先级越高

  // 触发条件
  conditions: AlertCondition[];

  // 通知配置
  channels: AlertChannel[];
  channelsConfig: Map<AlertChannel, Record<string, unknown>>;

  // 阈值配置
  threshold?: {
    timeWindow: number; // 时间窗口（毫秒）
    count: number; // 触发次数
  };

  // 冷却时间
  cooldownPeriod: number; // 冷却时间（毫秒）

  // 创建时间
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 告警条件
 */
export interface AlertCondition {
  errorType?: ErrorType;
  severity?: ErrorSeverity;
  agentName?: string;
  operation?: string;
}

/**
 * 告警记录
 */
export interface Alert {
  alertId: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;

  // 关联的错误日志
  errorLogId: string;
  errorType: ErrorType;
  errorMessage: string;

  // 告警内容
  message: string;
  details?: Record<string, unknown>;

  // 通知历史
  notificationHistory: NotificationRecord[];

  // 处理信息
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;

  // 时间戳
  triggeredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 通知记录
 */
export interface NotificationRecord {
  channelId: AlertChannel;
  success: boolean;
  sentAt: Date;
  errorMessage?: string;
  retryCount: number;
}

/**
 * 告警统计
 */
export interface AlertStatistics {
  totalAlerts: number;
  triggeredAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;

  // 按严重程度统计
  bySeverity: Map<AlertSeverity, number>;

  // 按规则统计
  byRule: Map<string, number>;

  // 按时间统计
  byTime: Map<string, number>;

  // 通知成功率
  notificationSuccessRate: number;
}

/**
 * 告警管理器
 */
export class AlertManager {
  private rules: Map<string, AlertRule>;
  private alertHistory: Map<string, Alert[]>;
  private lastTriggerTime: Map<string, number>;
  private errorCounts: Map<string, { count: number; firstSeen: number }>;

  constructor() {
    this.rules = new Map();
    this.alertHistory = new Map();
    this.lastTriggerTime = new Map();
    this.errorCounts = new Map();
    this.initializeDefaultRules();
  }

  /**
   * 初始化默认告警规则
   */
  private initializeDefaultRules(): void {
    // 严重错误规则
    this.addRule({
      ruleId: 'CRITICAL_ERROR',
      name: '严重错误告警',
      description: '当出现CRITICAL级别错误时触发',
      enabled: true,
      priority: 100,
      conditions: [{ severity: ErrorSeverity.CRITICAL }],
      channels: [AlertChannel.LOG, AlertChannel.EMAIL],
      channelsConfig: new Map(),
      cooldownPeriod: 60000, // 1分钟
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 数据库连接错误规则
    this.addRule({
      ruleId: 'DATABASE_ERROR',
      name: '数据库连接错误告警',
      description: '当数据库连接错误时触发',
      enabled: true,
      priority: 90,
      conditions: [{ errorType: ErrorType.DATABASE_CONNECTION_ERROR }],
      channels: [AlertChannel.LOG, AlertChannel.WEBHOOK],
      channelsConfig: new Map(),
      threshold: { timeWindow: 300000, count: 3 }, // 5分钟内3次
      cooldownPeriod: 300000, // 5分钟
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // AI服务限流规则
    this.addRule({
      ruleId: 'AI_RATE_LIMIT',
      name: 'AI服务限流告警',
      description: '当AI服务限流时触发',
      enabled: true,
      priority: 80,
      conditions: [{ errorType: ErrorType.AI_RATE_LIMIT }],
      channels: [AlertChannel.LOG],
      channelsConfig: new Map(),
      threshold: { timeWindow: 60000, count: 5 }, // 1分钟内5次
      cooldownPeriod: 300000, // 5分钟
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // AI服务超时规则
    this.addRule({
      ruleId: 'AI_TIMEOUT',
      name: 'AI服务超时告警',
      description: '当AI服务超时时触发',
      enabled: true,
      priority: 70,
      conditions: [{ errorType: ErrorType.AI_TIMEOUT }],
      channels: [AlertChannel.LOG],
      channelsConfig: new Map(),
      threshold: { timeWindow: 300000, count: 10 }, // 5分钟内10次
      cooldownPeriod: 600000, // 10分钟
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Agent未找到错误规则
    this.addRule({
      ruleId: 'AGENT_NOT_FOUND',
      name: 'Agent未找到告警',
      description: '当Agent未找到时触发',
      enabled: true,
      priority: 95,
      conditions: [{ errorType: ErrorType.AGENT_NOT_FOUND }],
      channels: [AlertChannel.LOG, AlertChannel.EMAIL],
      channelsConfig: new Map(),
      cooldownPeriod: 60000, // 1分钟
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * 添加告警规则
   * @param rule 告警规则
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.ruleId, rule);
  }

  /**
   * 删除告警规则
   * @param ruleId 规则ID
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * 启用/禁用告警规则
   * @param ruleId 规则ID
   * @param enabled 是否启用
   */
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      rule.updatedAt = new Date();
    }
  }

  /**
   * 处理错误日志，触发告警
   * @param errorLog 错误日志
   * @returns 触发的告警列表
   */
  async processError(errorLog: ErrorLog): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    // 更新错误计数
    this.updateErrorCounts(errorLog);

    // 检查所有启用的规则
    for (const rule of this.rules.values()) {
      if (!rule.enabled) {
        continue;
      }

      if (this.shouldTriggerAlert(errorLog, rule)) {
        const alert = await this.createAlert(errorLog, rule);
        triggeredAlerts.push(alert);

        // 发送通知
        await this.sendNotifications(alert, rule.channels);

        // 记录告警历史
        this.recordAlert(alert);
      }
    }

    return triggeredAlerts;
  }

  /**
   * 判断是否应该触发告警
   * @param errorLog 错误日志
   * @param rule 告警规则
   * @returns 是否触发
   */
  private shouldTriggerAlert(errorLog: ErrorLog, rule: AlertRule): boolean {
    // 检查冷却时间
    if (this.isInCooldown(rule)) {
      return false;
    }

    // 检查条件匹配
    if (!this.matchesConditions(errorLog, rule.conditions)) {
      return false;
    }

    // 检查阈值
    if (rule.threshold) {
      const errorKey = this.getErrorKey(errorLog, rule);
      const counts = this.errorCounts.get(errorKey);
      if (!counts || counts.count < rule.threshold.count) {
        return false;
      }

      // 检查时间窗口
      const timeSinceFirstSeen = Date.now() - counts.firstSeen;
      if (timeSinceFirstSeen > rule.threshold.timeWindow) {
        // 超出时间窗口，重置计数
        this.errorCounts.delete(errorKey);
        return false;
      }
    }

    return true;
  }

  /**
   * 检查是否在冷却期
   * @param rule 告警规则
   * @returns 是否在冷却期
   */
  private isInCooldown(rule: AlertRule): boolean {
    const lastTriggered = this.lastTriggerTime.get(rule.ruleId);
    if (!lastTriggered) {
      return false;
    }

    const timeSinceLastTrigger = Date.now() - lastTriggered;
    return timeSinceLastTrigger < rule.cooldownPeriod;
  }

  /**
   * 检查条件是否匹配
   * @param errorLog 错误日志
   * @param conditions 条件列表
   * @returns 是否匹配
   */
  private matchesConditions(
    errorLog: ErrorLog,
    conditions: AlertCondition[]
  ): boolean {
    if (conditions.length === 0) {
      return true;
    }

    return conditions.some(condition => {
      if (condition.errorType && errorLog.errorType !== condition.errorType) {
        return false;
      }

      if (condition.severity && errorLog.severity !== condition.severity) {
        return false;
      }

      if (
        condition.agentName &&
        errorLog.context.agentName !== condition.agentName
      ) {
        return false;
      }

      if (
        condition.operation &&
        errorLog.context.operation !== condition.operation
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * 更新错误计数
   * @param errorLog 错误日志
   */
  private updateErrorCounts(errorLog: ErrorLog): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled || !rule.threshold) {
        continue;
      }

      if (this.matchesConditions(errorLog, rule.conditions)) {
        const errorKey = this.getErrorKey(errorLog, rule);
        const counts = this.errorCounts.get(errorKey);

        if (counts) {
          counts.count += 1;
        } else {
          this.errorCounts.set(errorKey, {
            count: 1,
            firstSeen: Date.now(),
          });
        }
      }
    }
  }

  /**
   * 获取错误键
   * @param errorLog 错误日志
   * @param rule 告警规则
   * @returns 错误键
   */
  private getErrorKey(errorLog: ErrorLog, rule: AlertRule): string {
    const condition = rule.conditions[0] || {};
    return JSON.stringify({
      errorType: condition.errorType || errorLog.errorType,
      severity: condition.severity || errorLog.severity,
      agentName: condition.agentName || errorLog.context.agentName,
    });
  }

  /**
   * 创建告警
   * @param errorLog 错误日志
   * @param rule 告警规则
   * @returns 告警对象
   */
  private async createAlert(
    errorLog: ErrorLog,
    rule: AlertRule
  ): Promise<Alert> {
    const severity = this.mapErrorSeverityToAlertSeverity(errorLog.severity);

    const alert: Alert = {
      alertId: this.generateAlertId(),
      ruleId: rule.ruleId,
      ruleName: rule.name,
      severity,
      status: AlertStatus.TRIGGERED,
      errorLogId: errorLog.id!,
      errorType: errorLog.errorType,
      errorMessage: errorLog.errorMessage,
      message: this.generateAlertMessage(errorLog, rule),
      notificationHistory: [],
      triggeredAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 保存到数据库
    await this.saveAlertToDatabase(alert);

    // 更新最后触发时间
    this.lastTriggerTime.set(rule.ruleId, Date.now());

    return alert;
  }

  /**
   * 生成告警ID
   * @returns 告警ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 映射错误严重程度到告警严重程度
   * @param errorSeverity 错误严重程度
   * @returns 告警严重程度
   */
  private mapErrorSeverityToAlertSeverity(
    errorSeverity: ErrorSeverity
  ): AlertSeverity {
    const mapping: Record<ErrorSeverity, AlertSeverity> = {
      [ErrorSeverity.CRITICAL]: AlertSeverity.CRITICAL,
      [ErrorSeverity.HIGH]: AlertSeverity.HIGH,
      [ErrorSeverity.MEDIUM]: AlertSeverity.MEDIUM,
      [ErrorSeverity.LOW]: AlertSeverity.LOW,
    };

    return mapping[errorSeverity] || AlertSeverity.MEDIUM;
  }

  /**
   * 生成告警消息
   * @param errorLog 错误日志
   * @param rule 告警规则
   * @returns 告警消息
   */
  private generateAlertMessage(errorLog: ErrorLog, rule: AlertRule): string {
    const agent = errorLog.context.agentName || 'Unknown';
    const operation = errorLog.context.operation || 'unknown';
    return `${rule.name}: Agent="${agent}", Operation="${operation}", Error="${errorLog.errorMessage}"`;
  }

  /**
   * 发送通知
   * @param alert 告警
   * @param channels 通知渠道列表
   */
  private async sendNotifications(
    alert: Alert,
    channels: AlertChannel[]
  ): Promise<void> {
    for (const channel of channels) {
      const record = await this.sendNotification(alert, channel);
      alert.notificationHistory.push(record);
    }
  }

  /**
   * 发送单个通知
   * @param alert 告警
   * @param channel 通知渠道
   * @returns 通知记录
   */
  private async sendNotification(
    alert: Alert,
    channel: AlertChannel
  ): Promise<NotificationRecord> {
    const record: NotificationRecord = {
      channelId: channel,
      success: false,
      sentAt: new Date(),
      retryCount: 0,
    };

    try {
      switch (channel) {
        case AlertChannel.LOG:
          this.sendLogNotification(alert);
          break;
        case AlertChannel.EMAIL:
          await this.sendEmailNotification(alert);
          break;
        case AlertChannel.WEBHOOK:
          await this.sendWebhookNotification(alert);
          break;
        default:
          logger.warn(`Unsupported alert channel: ${channel}`);
      }

      record.success = true;
    } catch (error) {
      record.errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        `Failed to send ${channel} notification:`,
        record.errorMessage
      );
    }

    return record;
  }

  /**
   * 发送日志通知
   * @param alert 告警
   */
  private sendLogNotification(alert: Alert): void {
    const logMessage = `[ALERT] ${alert.severity} | ${alert.message} | AlertID=${alert.alertId}`;
    switch (alert.severity) {
      case AlertSeverity.CRITICAL:
        logger.error(logMessage);
        break;
      case AlertSeverity.HIGH:
        logger.error(logMessage);
        break;
      case AlertSeverity.MEDIUM:
        logger.warn(logMessage);
        break;
      case AlertSeverity.LOW:
        logger.info(logMessage);
        break;
    }
  }

  /**
   * 发送邮件通知
   * @param alert 告警
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    const { getEmailService } = await import('@/lib/auth/email-service');
    const emailService = getEmailService();

    // 获取告警接收人邮箱（可从环境变量配置）
    const alertRecipient = process.env.ALERT_EMAIL_TO;
    if (!alertRecipient) {
      logger.warn('[AlertManager] ALERT_EMAIL_TO 未配置，跳过邮件通知');
      return;
    }

    const subject = `[告警] ${alert.severity} - ${alert.ruleName}`;
    const textContent = this.generateAlertEmailText(alert);
    const htmlContent = this.generateAlertEmailHtml(alert);

    // 检查邮件服务是否支持通用发送
    if (emailService.sendEmail) {
      const result = await emailService.sendEmail({
        to: alertRecipient,
        subject,
        text: textContent,
        html: htmlContent,
      });

      if (!result.success) {
        throw new Error(result.error || '邮件发送失败');
      }

      logger.info(
        `[AlertManager] 告警邮件已发送: ${alertRecipient}, AlertID=${alert.alertId}`
      );
    } else {
      logger.info(`[EMAIL] ${alert.message}`);
    }
  }

  /**
   * 生成告警邮件纯文本内容
   */
  private generateAlertEmailText(alert: Alert): string {
    return `
系统告警通知

告警级别: ${alert.severity}
规则名称: ${alert.ruleName}
告警ID: ${alert.alertId}

错误信息:
${alert.errorMessage}

详细信息:
${alert.message}

触发时间: ${alert.triggeredAt.toLocaleString('zh-CN')}

---
律伴助手 系统告警
    `.trim();
  }

  /**
   * 生成告警邮件 HTML 内容
   */
  private generateAlertEmailHtml(alert: Alert): string {
    const severityColor = {
      [AlertSeverity.CRITICAL]: '#dc3545',
      [AlertSeverity.HIGH]: '#fd7e14',
      [AlertSeverity.MEDIUM]: '#ffc107',
      [AlertSeverity.LOW]: '#17a2b8',
    }[alert.severity];

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>系统告警</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; border-left: 4px solid ${severityColor};">
    <h2 style="color: ${severityColor}; margin-top: 0;">⚠️ 系统告警通知</h2>

    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 0; font-weight: bold; width: 100px;">告警级别:</td>
        <td style="padding: 8px 0;"><span style="background: ${severityColor}; color: white; padding: 2px 8px; border-radius: 3px;">${alert.severity}</span></td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">规则名称:</td>
        <td style="padding: 8px 0;">${alert.ruleName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">告警ID:</td>
        <td style="padding: 8px 0; font-family: monospace;">${alert.alertId}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; font-weight: bold;">触发时间:</td>
        <td style="padding: 8px 0;">${alert.triggeredAt.toLocaleString('zh-CN')}</td>
      </tr>
    </table>

    <div style="background: #fff; padding: 15px; border-radius: 5px; margin-top: 15px;">
      <h4 style="margin-top: 0; color: #666;">错误信息</h4>
      <p style="margin: 0; color: #dc3545;">${alert.errorMessage}</p>
    </div>

    <div style="background: #fff; padding: 15px; border-radius: 5px; margin-top: 10px;">
      <h4 style="margin-top: 0; color: #666;">详细信息</h4>
      <p style="margin: 0;">${alert.message}</p>
    </div>
  </div>

  <p style="font-size: 12px; color: #999; margin-top: 20px; text-align: center;">
    律伴助手 系统告警服务
  </p>
</body>
</html>
    `.trim();
  }

  /**
   * 发送Webhook通知
   * @param alert 告警
   */
  private async sendWebhookNotification(alert: Alert): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.warn('ALERT_WEBHOOK_URL not configured');
      return;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alertId: alert.alertId,
        ruleName: alert.ruleName,
        severity: alert.severity,
        message: alert.message,
        errorType: alert.errorType,
        errorMessage: alert.errorMessage,
        triggeredAt: alert.triggeredAt,
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed with status ${response.status}`);
    }
  }

  /**
   * 保存告警到数据库
   * @param alert 告警
   */
  private async saveAlertToDatabase(alert: Alert): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db/prisma');
      await prisma.$transaction(async tx => {
        await tx.alert.create({
          data: {
            alertId: alert.alertId,
            ruleId: alert.ruleId,
            ruleName: alert.ruleName,
            severity: alert.severity as unknown as never,
            status: alert.status as unknown as never,
            errorLogId: alert.errorLogId,
            errorType: alert.errorType as unknown as never,
            errorMessage: alert.errorMessage,
            message: alert.message,
            details: alert.details as never,
            notificationHistory: alert.notificationHistory as never,
            acknowledgedBy: alert.acknowledgedBy,
            acknowledgedAt: alert.acknowledgedAt,
            resolvedAt: alert.resolvedAt,
            resolutionNotes: alert.resolutionNotes,
            triggeredAt: alert.triggeredAt,
            createdAt: alert.createdAt,
            updatedAt: alert.updatedAt,
          },
        });
      });
    } catch (error) {
      logger.error('Failed to save alert to database:', error);
      // 不抛出异常，避免告警保存失败影响主流程
    }
  }

  /**
   * 记录告警
   * @param alert 告警
   */
  private recordAlert(alert: Alert): void {
    const alerts = this.alertHistory.get(alert.ruleId) || [];
    alerts.push(alert);
    this.alertHistory.set(alert.ruleId, alerts);
  }

  /**
   * 获取告警列表
   * @param filters 过滤条件
   * @returns 告警列表
   */
  async getAlerts(filters?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    ruleId?: string;
    limit?: number;
  }): Promise<Alert[]> {
    const { prisma } = await import('@/lib/db/prisma');

    const where: Record<string, unknown> = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.severity) {
      where.severity = filters.severity;
    }

    if (filters?.ruleId) {
      where.ruleId = filters.ruleId;
    }

    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
      take: filters?.limit || 100,
    });

    return alerts as unknown as Alert[];
  }

  /**
   * 确认告警
   * @param alertId 告警ID
   * @param acknowledgedBy 确认人
   */
  async acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): Promise<void> {
    const { prisma } = await import('@/lib/db/prisma');
    await prisma.alert.update({
      where: { alertId },
      data: {
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy,
        acknowledgedAt: new Date(),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 解决告警
   * @param alertId 告警ID
   * @param resolutionNotes 解决说明
   */
  async resolveAlert(alertId: string, resolutionNotes?: string): Promise<void> {
    const { prisma } = await import('@/lib/db/prisma');
    await prisma.alert.update({
      where: { alertId },
      data: {
        status: AlertStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNotes,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 获取告警统计
   * @returns 告警统计
   */
  async getStatistics(): Promise<AlertStatistics> {
    const alerts = await this.getAlerts();

    const totalAlerts = alerts.length;
    const triggeredAlerts = alerts.filter(
      a => a.status === AlertStatus.TRIGGERED
    ).length;
    const acknowledgedAlerts = alerts.filter(
      a => a.status === AlertStatus.ACKNOWLEDGED
    ).length;
    const resolvedAlerts = alerts.filter(
      a => a.status === AlertStatus.RESOLVED
    ).length;

    // 按严重程度统计
    const bySeverity = new Map<AlertSeverity, number>();
    for (const alert of alerts) {
      const count = bySeverity.get(alert.severity) || 0;
      bySeverity.set(alert.severity, count + 1);
    }

    // 按规则统计
    const byRule = new Map<string, number>();
    for (const alert of alerts) {
      const count = byRule.get(alert.ruleId) || 0;
      byRule.set(alert.ruleId, count + 1);
    }

    // 计算通知成功率
    const notificationSuccessRate =
      alerts.length > 0
        ? alerts.reduce(
            (sum, alert) =>
              sum +
              alert.notificationHistory.filter(r => r.success).length /
                alert.notificationHistory.length,
            0
          ) / alerts.length
        : 0;

    return {
      totalAlerts,
      triggeredAlerts,
      acknowledgedAlerts,
      resolvedAlerts,
      bySeverity,
      byRule,
      byTime: new Map(),
      notificationSuccessRate,
    };
  }

  /**
   * 清理过期的错误计数
   * @param maxAge 最大年龄（毫秒）
   */
  cleanupErrorCounts(maxAge: number = 3600000): void {
    const now = Date.now();
    for (const [key, counts] of this.errorCounts.entries()) {
      if (now - counts.firstSeen > maxAge) {
        this.errorCounts.delete(key);
      }
    }
  }
}

// 导出单例实例
export const alertManager = new AlertManager();
