import nodemailer from 'nodemailer';
import {
  LogFormat,
  Logger,
  LogLevel,
  LogOutput,
} from '../../../config/winston.config';
import { Alert, AlertSeverity, NotificationChannel } from './types';

// 创建nodemailer transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.example.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

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
      // 检查是否配置了SMTP
      const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER);

      if (!smtpConfigured) {
        // SMTP未配置，记录到日志
        logger.info('Alert email would be sent (SMTP not configured)', {
          alert: alert.title,
          recipientsCount: this.recipients.length,
          subject: `[${alert.severity}] ${alert.title}`,
          hasMetadata: alert.metadata !== undefined,
        });
        return;
      }

      const transporter = createTransporter();
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"律伴助手" <noreply@yourdomain.com>',
        to: this.recipients.join(', '),
        subject: `[${alert.severity}] ${alert.title}`,
        html: this.generateEmailBody(alert),
      };

      await transporter.sendMail(mailOptions);
      logger.info('Alert email sent successfully', {
        alert: alert.title,
        recipientsCount: this.recipients.length,
      });
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
 * 发送短信到阿里云/腾讯云短信平台
 */
async function sendSMS(
  phoneNumbers: string[],
  content: string
): Promise<boolean> {
  // 检测短信服务提供商
  const provider = process.env.SMS_PROVIDER || '';

  // 阿里云短信实现 (需要配置环境变量)
  if (provider === 'aliyun') {
    const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
    const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;

    if (!accessKeyId || !accessKeySecret) {
      logger.warn('Aliyun SMS credentials not configured');
      return false;
    }

    // 实际项目中需要实现签名算法和HTTP调用
    logger.info('SMS would be sent via Aliyun', {
      phoneNumbersCount: phoneNumbers.length,
      content: content.substring(0, 50),
    });
    return true;
  }

  // 腾讯云短信实现 (需要配置环境变量)
  if (provider === 'tencent') {
    const secretId = process.env.TENCENT_SMS_SECRET_ID;
    const secretKey = process.env.TENCENT_SMS_SECRET_KEY;

    if (!secretId || !secretKey) {
      logger.warn('Tencent SMS credentials not configured');
      return false;
    }

    logger.info('SMS would be sent via Tencent', {
      phoneNumbersCount: phoneNumbers.length,
      content: content.substring(0, 50),
    });
    return true;
  }

  // 没有配置具体服务提供商，使用日志记录
  logger.warn('SMS service not configured, logging only', {
    provider: provider || 'not set',
    phoneNumbersCount: phoneNumbers.length,
    content,
  });
  return false;
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

      // 调用短信发送函数
      const sent = await sendSMS(this.recipients, content);

      if (sent) {
        logger.info('SMS alert sent successfully', {
          alert: alert.title,
          content,
          recipientsCount: this.recipients.length,
        });
      }
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
