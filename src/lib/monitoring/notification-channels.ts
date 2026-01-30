import {
  Logger,
  LogLevel,
  LogFormat,
  LogOutput,
} from '../../../config/winston.config';
import { Alert, AlertSeverity, NotificationChannel } from './types';

// 创建告警专用的logger实例
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
 * 邮件通知渠道
 */
export class EmailAlertChannel implements NotificationChannel {
  name = 'EMAIL';

  constructor(private recipients: string[] = []) {}

  /**
   * 检查是否启用
   */
  enabled(): boolean {
    return !!process.env.ALERT_EMAIL_TO && this.recipients.length > 0;
  }

  /**
   * 发送邮件告警
   */
  async send(alert: Alert): Promise<void> {
    if (!this.enabled()) {
      logger.warn('Email alert channel is not enabled');
      return;
    }

    try {
      // TODO: 实现邮件发送逻辑
      // 目前先记录到日志，待邮件服务实现后替换
      logger.info('Alert email would be sent', {
        alert: alert.title,
        recipientsCount: this.recipients.length,
        subject: `[${alert.severity}] ${alert.title}`,
        hasMetadata: alert.metadata !== undefined,
      });

      // const mailOptions = {
      //   from: process.env.EMAIL_FROM || '"律伴助手" <noreply@yourdomain.com>',
      //   to: this.recipients.join(', '),
      //   subject: `[${alert.severity}] ${alert.title}`,
      //   html: this.generateEmailBody(alert),
      // };
      // await transporter.sendMail(mailOptions);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send alert email', error);
      throw new Error(`Email notification failed: ${errorMessage}`);
    }
  }

  /**
   * 生成邮件正文
   */
  private generateEmailBody(alert: Alert): string {
    const severityColor = {
      CRITICAL: '#dc2626',
      HIGH: '#ea580c',
      MEDIUM: '#f59e0b',
      LOW: '#10b981',
    };

    const color = severityColor[alert.severity];

    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: ${color}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
            .severity { font-size: 14px; font-weight: bold; }
            .title { font-size: 20px; font-weight: bold; margin: 10px 0; }
            .message { margin: 20px 0; }
            .metadata { margin-top: 20px; padding: 15px; background-color: #fff; border-radius: 4px; }
            .footer { margin-top: 20px; text-align: center; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="severity">${alert.severity}</div>
              <div class="title">${alert.title}</div>
            </div>
            <div class="content">
              <div class="message">${alert.message}</div>
              ${
                alert.metadata
                  ? `
                <div class="metadata">
                  <strong>详细信息:</strong>
                  <pre style="margin: 10px 0; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(
                    alert.metadata,
                    null,
                    2
                  )}</pre>
                </div>
              `
                  : ''
              }
              <div class="footer">
                <p>律伴助手监控系统</p>
                <p>${new Date().toLocaleString('zh-CN')}</p>
              </div>
            </div>
          </div>
        </body>
      </html>`;
  }

  /**
   * 添加收件人
   */
  addRecipient(email: string): void {
    if (email && !this.recipients.includes(email)) {
      this.recipients.push(email);
    }
  }

  /**
   * 移除收件人
   */
  removeRecipient(email: string): void {
    this.recipients = this.recipients.filter(r => r !== email);
  }
}

/**
 * Webhook通知渠道
 */
export class WebhookAlertChannel implements NotificationChannel {
  name = 'WEBHOOK';

  constructor(private webhookUrl: string = '') {}

  /**
   * 检查是否启用
   */
  enabled(): boolean {
    return !!process.env.ALERT_WEBHOOK_URL && !!this.webhookUrl;
  }

  /**
   * 发送Webhook告警
   */
  async send(alert: Alert): Promise<void> {
    if (!this.enabled()) {
      logger.warn('Webhook alert channel is not enabled');
      return;
    }

    const url = this.webhookUrl || process.env.ALERT_WEBHOOK_URL;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          alert: {
            title: alert.title,
            message: alert.message,
            severity: alert.severity,
            timestamp: new Date().toISOString(),
          },
          metadata: alert.metadata || {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      logger.info('Alert webhook sent successfully', {
        alert: alert.title,
        url,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send alert webhook', error);
      throw new Error(`Webhook notification failed: ${errorMessage}`);
    }
  }

  /**
   * 设置Webhook URL
   */
  setWebhookUrl(url: string): void {
    this.webhookUrl = url;
  }
}

/**
 * 短信通知渠道
 */
export class SMSAlertChannel implements NotificationChannel {
  name = 'SMS';

  constructor(private recipients: string[] = []) {}

  /**
   * 检查是否启用
   */
  enabled(): boolean {
    return (
      process.env.ALERT_SMS_ENABLED === 'true' && this.recipients.length > 0
    );
  }

  /**
   * 发送短信告警
   */
  async send(alert: Alert): Promise<void> {
    if (!this.enabled()) {
      logger.warn('SMS alert channel is not enabled');
      return;
    }

    try {
      // 短信内容限制在70字以内
      const content =
        `[${alert.severity}]${alert.title}:${alert.message}`.substring(0, 70);

      // 这里可以集成第三方短信服务，如阿里云、腾讯云等
      // 目前使用占位符实现
      logger.info('SMS alert would be sent', {
        alert: alert.title,
        content,
        recipientsCount: this.recipients.length,
      });

      // TODO: 集成实际的短信服务
      // await sendSMS(this.recipients, content);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send alert SMS', error);
      throw new Error(`SMS notification failed: ${errorMessage}`);
    }
  }

  /**
   * 添加接收者
   */
  addRecipient(phoneNumber: string): void {
    if (phoneNumber && !this.recipients.includes(phoneNumber)) {
      this.recipients.push(phoneNumber);
    }
  }

  /**
   * 移除接收者
   */
  removeRecipient(phoneNumber: string): void {
    this.recipients = this.recipients.filter(r => r !== phoneNumber);
  }
}

/**
 * 日志通知渠道（备用）
 */
export class LogAlertChannel implements NotificationChannel {
  name = 'LOG';

  /**
   * 检查是否启用
   */
  enabled(): boolean {
    return true; // 日志渠道始终启用
  }

  /**
   * 记录告警到日志
   */
  async send(alert: Alert): Promise<void> {
    switch (alert.severity) {
      case AlertSeverity.CRITICAL:
        logger.fatal(alert.title, undefined, {
          message: alert.message,
          severity: alert.severity,
          hasMetadata: alert.metadata !== undefined,
        });
        break;
      case AlertSeverity.HIGH:
        logger.error(alert.title, undefined, {
          message: alert.message,
          severity: alert.severity,
          hasMetadata: alert.metadata !== undefined,
        });
        break;
      case AlertSeverity.MEDIUM:
        logger.warn(alert.title, {
          message: alert.message,
          severity: alert.severity,
          hasMetadata: alert.metadata !== undefined,
        });
        break;
      case AlertSeverity.LOW:
        logger.info(alert.title, {
          message: alert.message,
          severity: alert.severity,
          hasMetadata: alert.metadata !== undefined,
        });
        break;
    }
  }
}

/**
 * 通知渠道工厂函数
 */
export function createNotificationChannel(type: string): NotificationChannel {
  switch (type) {
    case 'EMAIL':
      return new EmailAlertChannel([process.env.ALERT_EMAIL_TO || '']);
    case 'WEBHOOK':
      return new WebhookAlertChannel(process.env.ALERT_WEBHOOK_URL || '');
    case 'SMS':
      return new SMSAlertChannel([]);
    case 'LOG':
      return new LogAlertChannel();
    default:
      logger.warn(
        `Unknown notification channel type: ${type}, using LOG channel`
      );
      return new LogAlertChannel();
  }
}

/**
 * 创建多个通知渠道
 */
export function createNotificationChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [];

  // 日志渠道始终启用
  channels.push(new LogAlertChannel());

  // 根据配置启用其他渠道
  if (process.env.ALERT_EMAIL_TO) {
    channels.push(new EmailAlertChannel([process.env.ALERT_EMAIL_TO]));
  }

  if (process.env.ALERT_WEBHOOK_URL) {
    channels.push(new WebhookAlertChannel(process.env.ALERT_WEBHOOK_URL));
  }

  if (process.env.ALERT_SMS_ENABLED === 'true') {
    channels.push(new SMSAlertChannel([]));
  }

  return channels;
}
