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
 * 短信服务提供商枚举
 */
export enum SMSProvider {
  CONSOLE = 'console', // 控制台输出（开发环境）
  ALIYUN = 'aliyun', // 阿里云短信
  TENCENT = 'tencent', // 腾讯云短信
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

/**
 * 提醒类型枚举（与Prisma schema保持一致）
 */
export enum ReminderType {
  COURT_SCHEDULE = 'COURT_SCHEDULE', // 法庭提醒
  DEADLINE = 'DEADLINE', // 截止日期提醒
  FOLLOW_UP = 'FOLLOW_UP', // 跟进提醒
  CUSTOM = 'CUSTOM', // 自定义提醒
}

/**
 * 提醒状态枚举（与Prisma schema保持一致）
 */
export enum ReminderStatus {
  PENDING = 'PENDING', // 待发送
  SENT = 'SENT', // 已发送
  READ = 'READ', // 已读
  DISMISSED = 'DISMISSED', // 已忽略
}

/**
 * 提醒接口（与Prisma schema保持一致）
 */
export interface Reminder {
  id: string;
  userId: string;
  type: ReminderType;
  title: string;
  message: string | null;
  reminderTime: Date;
  channels: string[];
  status: ReminderStatus;
  relatedType: string | null;
  relatedId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建提醒输入接口
 */
export interface CreateReminderInput {
  userId: string;
  type: ReminderType;
  title: string;
  message?: string;
  reminderTime: Date;
  channels: NotificationChannel[];
  relatedType?: string;
  relatedId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 更新提醒输入接口
 */
export interface UpdateReminderInput {
  title?: string;
  message?: string;
  reminderTime?: Date;
  channels?: NotificationChannel[];
  status?: ReminderStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 提醒查询参数接口
 */
export interface ReminderQueryParams {
  userId: string;
  type?: ReminderType;
  status?: ReminderStatus;
  startTime?: Date;
  endTime?: Date;
  page?: number;
  limit?: number;
}

/**
 * 提醒列表响应接口
 */
export interface ReminderListResponse {
  reminders: Reminder[];
  total: number;
  page: number;
  limit: number;
}

/**
 * 法庭日程提醒配置接口
 */
export interface CourtScheduleReminderConfig {
  enabled: boolean;
  hoursBefore: number[]; // 提前提醒时间（小时），例如 [24, 1] 表示提前24小时和1小时
  channels: NotificationChannel[];
}

/**
 * 截止日期提醒配置接口
 */
export interface DeadlineReminderConfig {
  enabled: boolean;
  daysBefore: number[]; // 提前提醒时间（天），例如 [7, 3, 1]
  channels: NotificationChannel[];
}

/**
 * 跟进提醒配置接口
 */
export interface FollowUpReminderConfig {
  enabled: boolean;
  hoursBefore: number[];
  channels: NotificationChannel[];
}

/**
 * 提醒配置接口
 */
export interface ReminderPreferences {
  courtSchedule: CourtScheduleReminderConfig;
  deadline: DeadlineReminderConfig;
  followUp: FollowUpReminderConfig;
}
