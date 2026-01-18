/**
 * Alertmanager类型定义
 *
 * 定义Alertmanager告警规则和配置的TypeScript类型
 * 用于类型检查和验证
 */

/**
 * 告警严重程度
 */
export enum AlertSeverity {
  CRITICAL = 'critical',
  WARNING = 'warning',
  INFO = 'info',
}

/**
 * 告警类别
 */
export enum AlertCategory {
  API = 'api',
  DATABASE = 'database',
  AI = 'ai',
  SYSTEM = 'system',
  CACHE = 'cache',
  APPLICATION = 'application',
  BUSINESS = 'business',
}

/**
 * 告警标签
 */
export interface AlertLabels {
  alertname: string;
  severity: AlertSeverity;
  category: AlertCategory;
  instance?: string;
  job?: string;
  [key: string]: string;
}

/**
 * 告警注解
 */
export interface AlertAnnotations {
  summary: string;
  description: string;
  dashboard?: string;
  runbook_url?: string;
  [key: string]: string;
}

/**
 * 告警
 */
export interface Alert {
  fingerprint: string;
  status: AlertStatus;
  labels: AlertLabels;
  annotations: AlertAnnotations;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
}

/**
 * 告警状态
 */
export enum AlertStatus {
  FIRING = 'firing',
  RESOLVED = 'resolved',
}

/**
 * 告警分组
 */
export interface AlertGroup {
  receiver: string;
  status: AlertStatus;
  alerts: Alert[];
  groupLabels: AlertLabels;
  groupKey: string;
  externalURL: string;
}

/**
 * 告警规则表达式
 */
export interface AlertRuleExpr {
  expr: string;
  for?: string;
  labels?: AlertLabels;
  annotations?: AlertAnnotations;
}

/**
 * 告警规则
 */
export interface AlertRule {
  alert: string;
  expr: string;
  for?: string;
  labels?: AlertLabels;
  annotations?: AlertAnnotations;
}

/**
 * 告警规则组
 */
export interface AlertRuleGroup {
  name: string;
  interval?: string;
  rules: AlertRule[];
}

/**
 * Alertmanager配置
 */
export interface AlertmanagerConfig {
  global: GlobalConfig;
  route: RouteConfig;
  inhibit_rules?: InhibitRule[];
  receivers: ReceiverConfig[];
  templates?: string[];
  webhook_configs?: WebhookConfig[];
  time_intervals?: TimeInterval[];
}

/**
 * 全局配置
 */
export interface GlobalConfig {
  resolve_timeout?: string;
  smtp_smarthost?: string;
  smtp_from?: string;
  smtp_auth_username?: string;
  smtp_auth_password?: string;
  smtp_require_tls?: boolean;
  smtp_hello?: string;
}

/**
 * 路由配置
 */
export interface RouteConfig {
  receiver: string;
  group_by?: string[];
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
  routes?: RouteConfig[];
  match?: Partial<AlertLabels>;
  match_re?: Partial<Record<keyof AlertLabels, string>>;
}

/**
 * 抑制规则
 */
export interface InhibitRule {
  source_match?: Partial<AlertLabels>;
  source_match_re?: Partial<Record<keyof AlertLabels, string>>;
  target_match?: Partial<AlertLabels>;
  target_match_re?: Partial<Record<keyof AlertLabels, string>>;
  equal?: (keyof AlertLabels)[];
}

/**
 * 接收器配置
 */
export interface ReceiverConfig {
  name: string;
  email_configs?: EmailConfig[];
  webhook_configs?: WebhookConfig[];
  slack_configs?: SlackConfig[];
  wechat_configs?: WechatConfig[];
  dingtalk_configs?: DingtalkConfig[];
}

/**
 * 邮件配置
 */
export interface EmailConfig {
  to: string;
  from?: string;
  subject?: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
}

/**
 * Webhook配置
 */
export interface WebhookConfig {
  url: string;
  send_resolved?: boolean;
  http_config?: HttpConfig;
  max_alerts?: number;
}

/**
 * HTTP配置
 */
export interface HttpConfig {
  bearer_token?: string;
  basic_auth?: BasicAuth;
  tls_config?: TlsConfig;
}

/**
 * 基础认证
 */
export interface BasicAuth {
  username: string;
  password: string;
}

/**
 * TLS配置
 */
export interface TlsConfig {
  insecure_skip_verify?: boolean;
  cert_file?: string;
  key_file?: string;
  ca_file?: string;
}

/**
 * Slack配置
 */
export interface SlackConfig {
  api_url: string;
  channel?: string;
  username?: string;
  icon_url?: string;
  link_names?: boolean;
  send_resolved?: boolean;
  title?: string;
  title_link?: string;
  text?: string;
  color?: string;
  footer?: string;
}

/**
 * 企业微信配置
 */
export interface WechatConfig {
  corp_id: string;
  api_secret: string;
  agent_id: string;
  api_url?: string;
  to_party?: string;
  to_user?: string;
  to_tag?: string;
  message?: string;
  message_type?: string;
  title?: string;
  send_resolved?: boolean;
}

/**
 * 钉钉配置
 */
export interface DingtalkConfig {
  url: string;
  message_type?: string;
  message?: string;
  send_resolved?: boolean;
}

/**
 * 时间间隔
 */
export interface TimeInterval {
  name: string;
  time_intervals: TimeSpec[];
}

/**
 * 时间规格
 */
export interface TimeSpec {
  times?: TimeRange[];
  weekdays?: string[];
  days_of_month?: string[];
  months?: string[];
  years?: number[];
  location?: string;
}

/**
 * 时间范围
 */
export interface TimeRange {
  start_time: string;
  end_time: string;
}

/**
 * 告警规则验证结果
 */
export interface AlertRuleValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  rulesCount: number;
  groupsCount: number;
}

/**
 * 验证错误
 */
export interface ValidationError {
  ruleName: string;
  groupName: string;
  message: string;
  severity: 'error';
}

/**
 * 验证警告
 */
export interface ValidationWarning {
  ruleName: string;
  groupName: string;
  message: string;
  severity: 'warning';
}

/**
 * 预定义的告警规则
 */
export const PREDEFINED_ALERT_RULES = {
  // API性能告警
  HIGH_API_ERROR_RATE: 'HighAPIErrorRate',
  SLOW_API_RESPONSE_TIME: 'SlowAPIResponseTime',
  API_TRAFFIC_DROP: 'APITrafficDrop',

  // 数据库性能告警
  HIGH_DATABASE_CONNECTION_POOL_USAGE: 'HighDatabaseConnectionPoolUsage',
  TOO_MANY_SLOW_QUERIES: 'TooManySlowQueries',
  DATABASE_CONNECTION_ERRORS: 'DatabaseConnectionErrors',
  DATABASE_SIZE_TOO_LARGE: 'DatabaseSizeTooLarge',

  // AI服务告警
  HIGH_AI_SERVICE_ERROR_RATE: 'HighAIServiceErrorRate',
  SLOW_AI_SERVICE_RESPONSE: 'SlowAIServiceResponse',
  AI_SERVICE_RATE_LIMIT: 'AIServiceRateLimit',
  AI_SERVICE_TIMEOUT: 'AIServiceTimeout',

  // 系统资源告警
  HIGH_MEMORY_USAGE: 'HighMemoryUsage',
  HIGH_CPU_USAGE: 'HighCPUUsage',
  HIGH_DISK_USAGE: 'HighDiskUsage',
  HIGH_DISK_IO: 'HighDiskIO',

  // 缓存告警
  HIGH_REDIS_CONNECTION_USAGE: 'HighRedisConnectionUsage',
  HIGH_REDIS_MEMORY_USAGE: 'HighRedisMemoryUsage',
  LOW_CACHE_HIT_RATE: 'LowCacheHitRate',

  // 应用健康告警
  APPLICATION_INSTANCE_UNHEALTHY: 'ApplicationInstanceUnhealthy',
  TOO_MANY_ERROR_LOGS: 'TooManyErrorLogs',
  FATAL_ERROR_LOGS: 'FatalErrorLogs',

  // 商业指标告警
  HIGH_PAYMENT_FAILURE_RATE: 'HighPaymentFailureRate',
  ABNORMAL_USER_REGISTRATION: 'AbnormalUserRegistration',
  HIGH_DEBATE_GENERATION_FAILURE_RATE: 'HighDebateGenerationFailureRate',
} as const;

/**
 * 预定义的告警组
 */
export const PREDEFINED_ALERT_GROUPS = {
  API_PERFORMANCE: 'api_performance_alerts',
  DATABASE_PERFORMANCE: 'database_performance_alerts',
  AI_SERVICE: 'ai_service_alerts',
  SYSTEM_RESOURCE: 'system_resource_alerts',
  CACHE: 'cache_alerts',
  APPLICATION_HEALTH: 'application_health_alerts',
  BUSINESS_METRICS: 'business_metrics_alerts',
} as const;

/**
 * 预定义的接收器
 */
export const PREDEFINED_RECEIVERS = {
  DEFAULT: 'default-receiver',
  CRITICAL: 'critical-receiver',
  API: 'api-receiver',
  DATABASE: 'database-receiver',
  AI: 'ai-receiver',
  SYSTEM: 'system-receiver',
  CACHE: 'cache-receiver',
  APPLICATION: 'application-receiver',
  BUSINESS: 'business-receiver',
} as const;

/**
 * 获取告警严重程度对应的颜色
 */
export function getSeverityColor(severity: AlertSeverity): string {
  switch (severity) {
    case AlertSeverity.CRITICAL:
      return '#dc3545';
    case AlertSeverity.WARNING:
      return '#ffc107';
    case AlertSeverity.INFO:
      return '#17a2b8';
    default:
      return '#6c757d';
  }
}

/**
 * 获取告警严重程度对应的图标
 */
export function getSeverityIcon(severity: AlertSeverity): string {
  switch (severity) {
    case AlertSeverity.CRITICAL:
      return '🔴';
    case AlertSeverity.WARNING:
      return '🟡';
    case AlertSeverity.INFO:
      return '🔵';
    default:
      return '⚪';
  }
}

/**
 * 验证告警规则表达式
 */
export function validateAlertExpression(expr: string): boolean {
  try {
    // 简单的PromQL表达式验证
    if (!expr || expr.trim().length === 0) {
      return false;
    }

    // 检查基本的PromQL关键字
    const promQLKeywords = [
      'sum',
      'rate',
      'increase',
      'histogram_quantile',
      'avg',
      'max',
      'min',
      'count',
      'by',
      'without',
      'offset',
    ];

    // 检查是否包含至少一个关键字
    const hasKeyword = promQLKeywords.some(keyword =>
      expr.toLowerCase().includes(keyword)
    );

    return hasKeyword;
  } catch {
    return false;
  }
}

/**
 * 验证告警标签
 */
export function validateAlertLabels(labels: AlertLabels): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!labels.alertname || labels.alertname.trim().length === 0) {
    errors.push({
      ruleName: '',
      groupName: '',
      message: 'alertname不能为空',
      severity: 'error',
    });
  }

  if (!labels.severity) {
    errors.push({
      ruleName: '',
      groupName: '',
      message: 'severity不能为空',
      severity: 'error',
    });
  }

  if (!labels.category) {
    errors.push({
      ruleName: '',
      groupName: '',
      message: 'category不能为空',
      severity: 'error',
    });
  }

  return errors;
}
