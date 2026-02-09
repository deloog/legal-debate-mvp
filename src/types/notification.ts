/**
 * 通知类型定义
 * 集中定义通知相关的类型
 */

/**
 * 通知类型
 */
export type NotificationType =
  | 'SYSTEM'
  | 'CASE'
  | 'TASK'
  | 'DEADLINE'
  | 'DOCUMENT'
  | 'PAYMENT'
  | 'MESSAGE';

/**
 * 通知类型常量（运行时可用）
 */
export const NotificationTypeValues = {
  SYSTEM: 'SYSTEM',
  CASE: 'CASE',
  TASK: 'TASK',
  DEADLINE: 'DEADLINE',
  DOCUMENT: 'DOCUMENT',
  PAYMENT: 'PAYMENT',
  MESSAGE: 'MESSAGE',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const NotificationType = NotificationTypeValues;

/**
 * 通知渠道
 */
export type NotificationChannel =
  | 'IN_APP'
  | 'EMAIL'
  | 'SMS'
  | 'PUSH'
  | 'WEBHOOK';

/**
 * 通知渠道常量（运行时可用）
 */
export const NotificationChannelValues = {
  IN_APP: 'IN_APP',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  PUSH: 'PUSH',
  WEBHOOK: 'WEBHOOK',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const NotificationChannel = NotificationChannelValues;

/**
 * 提醒类型
 */
export type ReminderType =
  | 'CASE_DEADLINE'
  | 'TASK_DUE'
  | 'HEARING_DATE'
  | 'PAYMENT_DUE'
  | 'FOLLOW_UP'
  | 'CUSTOM'
  | 'COURT_SCHEDULE';

/**
 * 提醒类型常量（运行时可用）
 */
export const ReminderTypeValues = {
  CASE_DEADLINE: 'CASE_DEADLINE',
  TASK_DUE: 'TASK_DUE',
  HEARING_DATE: 'HEARING_DATE',
  PAYMENT_DUE: 'PAYMENT_DUE',
  FOLLOW_UP: 'FOLLOW_UP',
  CUSTOM: 'CUSTOM',
  COURT_SCHEDULE: 'COURT_SCHEDULE',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const ReminderType = ReminderTypeValues;

/**
 * 提醒状态
 */
export type ReminderStatus = 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED' | 'READ' | 'DISMISSED';

/**
 * 提醒状态常量（运行时可用）
 */
export const ReminderStatusValues = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  CANCELLED: 'CANCELLED',
  FAILED: 'FAILED',
  READ: 'READ',
  DISMISSED: 'DISMISSED',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const ReminderStatus = ReminderStatusValues;

/**
 * 提醒详情
 */
export interface Reminder {
  id: string;
  userId: string;
  type: ReminderType;
  title: string;
  content: string;
  scheduledAt: Date;
  channel: NotificationChannel;
  status: ReminderStatus;
  sentAt: Date | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  // 兼容旧代码的别名
  reminderTime?: Date;
  message?: string;
  channels?: NotificationChannel[];
  relatedType?: string;
  relatedId?: string;
}

/**
 * 创建提醒输入
 */
export interface CreateReminderInput {
  userId?: string;
  type: ReminderType;
  title: string;
  content?: string;
  message?: string; // 兼容旧代码
  scheduledAt: Date;
  reminderTime?: Date; // 兼容旧代码
  channel?: NotificationChannel;
  channels?: NotificationChannel[];
  relatedType?: string; // 关联类型
  relatedId?: string; // 关联ID
  metadata?: Record<string, unknown>;
}

/**
 * 更新提醒输入
 */
export interface UpdateReminderInput {
  title?: string;
  content?: string;
  scheduledAt?: Date;
  channel?: NotificationChannel;
  status?: ReminderStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 提醒列表查询参数
 */
export interface ReminderQueryParams {
  userId?: string;
  page?: string;
  pageSize?: string;
  limit?: string; // 兼容旧代码
  type?: ReminderType;
  status?: ReminderStatus;
  channel?: NotificationChannel;
  startDate?: string;
  endDate?: string;
  startTime?: string; // 兼容旧代码
  endTime?: string; // 兼容旧代码
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 提醒列表响应
 */
export interface ReminderListResponse {
  reminders: Reminder[];
  total?: number; // 总数
  page?: number; // 当前页
  limit?: number; // 每页数量
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 短信发送选项
 */
export interface SMSSendOptions {
  to: string;
  content: string;
  templateId?: string;
  templateCode?: string; // 兼容旧代码
  templateParams?: Record<string, string>;
}

/**
 * 短信发送结果
 */
export interface SMSSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  devMessage?: string; // 开发环境消息
}

/**
 * 短信提供商
 */
export type SMSProvider = 'ALIYUN' | 'TENCENT' | 'TEMPLATE' | 'CONSOLE';

/**
 * 短信提供商常量（运行时可用）
 */
export const SMSProviderValues = {
  ALIYUN: 'ALIYUN',
  TENCENT: 'TENCENT',
  TEMPLATE: 'TEMPLATE',
  CONSOLE: 'CONSOLE',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const SMSProvider = SMSProviderValues;

/**
 * 提醒偏好设置
 */
export interface ReminderPreferences {
  channels: NotificationChannel[];
  quietHours: {
    start: string;
    end: string;
  } | null;
  disabledTypes: ReminderType[];
  // 新增字段（可选，用于更细粒度的控制）
  courtSchedule?: {
    enabled: boolean;
    channels: NotificationChannel[];
    advanceDays: number | number[]; // 支持单个值或数组
    hoursBefore?: number[]; // 兼容旧代码
  };
  deadline?: {
    enabled: boolean;
    channels: NotificationChannel[];
    advanceDays: number[];
    daysBefore?: number[]; // 兼容旧代码
  };
  followUp?: {
    enabled: boolean;
    channels: NotificationChannel[];
    autoRemind: boolean;
    hoursBefore?: number[]; // 兼容旧代码
  };
  task?: {
    enabled: boolean;
    channels: NotificationChannel[];
    priorities: string[];
    hoursBefore?: number[]; // 兼容旧代码
  };
}

// Email 相关类型
/**
 * 邮件发送选项
 */
export interface EmailSendOptions {
  to: string | string[];
  subject: string;
  content: string;
  html?: string;
  text?: string; // 纯文本内容
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    contentType?: string;
  }>;
}

/**
 * 邮件发送结果
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  devMessage?: string; // 开发环境消息
}

/**
 * 邮件模板
 */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  htmlContent?: string; // HTML 内容
  textContent?: string; // 纯文本内容
  variables: string[];
}

/**
 * 通知发送结果
 */
export interface NotificationSendResult {
  success: boolean;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
  errors?: string[]; // 多个错误
}

/**
 * 通知详情
 */
export interface NotificationDetail {
  id: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  link: string | null;
  linkType: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * 通知列表响应
 */
export interface NotificationListResponse {
  notifications: NotificationDetail[];
  unreadCount: number;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 通知查询参数
 */
export interface NotificationQueryParams {
  page?: string;
  pageSize?: string;
  type?: string;
  read?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 标记已读请求
 */
export interface MarkReadRequest {
  notificationIds?: string[];
}

/**
 * 批量操作请求
 */
export interface BatchActionRequest {
  action: 'read' | 'unread' | 'delete';
  notificationIds: string[];
}
