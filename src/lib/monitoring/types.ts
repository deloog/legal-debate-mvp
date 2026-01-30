/**
 * 监控告警系统类型定义
 */

/**
 * 告警严重程度
 */
export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * 告警状态
 */
export enum AlertStatus {
  TRIGGERED = 'TRIGGERED',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

/**
 * 告警规则接口
 */
export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  threshold: number;
  duration: number;
  severity: AlertSeverity;
  action: () => Promise<void>;
}

/**
 * 告警消息接口
 */
export interface Alert {
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, unknown>;
}

/**
 * 指标数据接口
 */
export interface MetricData {
  metric: string;
  value: number;
  timestamp: Date;
}

/**
 * 通知渠道接口
 */
export interface NotificationChannel {
  name: string;
  send(alert: Alert): Promise<void>;
  enabled(): boolean;
}

/**
 * 通知历史记录
 */
export interface NotificationHistory {
  channel: string;
  sentAt: string;
  success: boolean;
  error?: string;
}

/**
 * 告警检查结果
 */
export interface AlertCheckResult {
  ruleId: string;
  ruleName: string;
  currentValue: number;
  threshold: number;
  severity: AlertSeverity;
  triggered: boolean;
  reason?: string;
}

/**
 * 系统指标
 */
export interface SystemMetrics {
  apiErrorRate: number;
  apiResponseTimeP95: number;
  databaseConnectionFailed: number;
  aiServiceErrorRate: number;
  diskUsagePercent: number;
}

/**
 * 告警统计
 */
export interface AlertStats {
  totalAlerts: number;
  triggeredAlerts: number;
  acknowledgedAlerts: number;
  resolvedAlerts: number;
  bySeverity: Record<AlertSeverity, number>;
  byTimeRange: Record<string, number>;
}
