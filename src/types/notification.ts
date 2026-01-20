// 通知相关类型定义

/**
 * 通知类型枚举
 */
export enum NotificationType {
  FOLLOW_UP_TASK = 'FOLLOW_UP_TASK', // 跟进任务提醒
  COURT_SCHEDULE = 'COURT_SCHEDULE', // 法庭日程提醒
  DEADLINE = 'DEADLINE', // 截止日期提醒
  CUSTOM = 'CUSTOM', // 自定义提醒
}

/**
 * 通知渠道枚举
 */
export enum NotificationChannel {
  IN_APP = 'IN_APP', // 站内提醒
  EMAIL = 'EMAIL', // 邮件提醒
  SMS = 'SMS', // 短信提醒
}

/**
 * 通知状态枚举
 */
export enum NotificationStatus {
  PENDING = 'PENDING', // 待发送
  SENT = 'SENT', // 已发送
  FAILED = 'FAILED', // 发送失败
}

/**
 * 邮件发送选项接口
 */
export interface EmailSendOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
}

/**
 * 邮件附件接口
 */
export interface EmailAttachment {
  filename: string;
  content: string | Buffer;
  contentType?: string;
}

/**
 * 邮件发送结果接口
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  devMessage?: string;
}

/**
 * 邮件模板接口
 */
export interface EmailTemplate {
  subject: string;
  textContent: string;
  htmlContent?: string;
}

/**
 * 短信发送选项接口
 */
export interface SMSSendOptions {
  to: string;
  content: string;
  templateCode?: string;
  templateParams?: Record<string, string>;
}

/**
 * 短信发送结果接口
 */
export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  devMessage?: string;
}

/**
 * 通用通知接口
 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  channels: NotificationChannel[];
  status: NotificationStatus;
  sentAt?: Date;
  relatedType?: string;
  relatedId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 通知发送结果接口
 */
export interface NotificationSendResult {
  success: boolean;
  channels: NotificationChannel[];
  errors?: Record<NotificationChannel, string>;
}

/**
 * 通知配置接口
 */
export interface NotificationConfig {
  enabled: boolean;
  channels: NotificationChannel[];
  emailConfig?: EmailConfig;
  smsConfig?: SMSConfig;
}

/**
 * 邮件配置接口
 */
export interface EmailConfig {
  from?: string;
  fromName?: string;
  replyTo?: string;
}

/**
 * 短信配置接口
 */
export interface SMSConfig {
  accessKeyId?: string;
  accessKeySecret?: string;
  signName?: string;
  templateCode?: string;
}

/**
 * 通知队列项接口
 */
export interface NotificationQueueItem {
  id: string;
  notification: Notification;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: Date;
}

/**
 * 通知统计接口
 */
export interface NotificationStatistics {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  byChannel: Record<NotificationChannel, number>;
  byType: Record<NotificationType, number>;
}
