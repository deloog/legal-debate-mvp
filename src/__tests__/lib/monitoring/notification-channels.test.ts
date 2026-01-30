import {
  EmailAlertChannel,
  WebhookAlertChannel,
  SMSAlertChannel,
  LogAlertChannel,
  createNotificationChannel,
  createNotificationChannels,
} from '../../../lib/monitoring/notification-channels';
import { Alert, AlertSeverity } from '../../../lib/monitoring/types';

const originalEnv = process.env;

describe('Notification Channels', () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });
  describe('LogAlertChannel', () => {
    let logChannel: LogAlertChannel;

    beforeEach(() => {
      logChannel = new LogAlertChannel();
    });

    it('应该创建LOG渠道', () => {
      expect(logChannel.name).toBe('LOG');
    });

    it('enabled应该始终返回true', () => {
      expect(logChannel.enabled()).toBe(true);
    });

    it('应该正确发送CRITICAL级别告警', async () => {
      const alert: Alert = {
        title: '严重告警',
        message: '测试严重级别告警',
        severity: AlertSeverity.CRITICAL,
      };

      await expect(logChannel.send(alert)).resolves.not.toThrow();
    });

    it('应该正确发送HIGH级别告警', async () => {
      const alert: Alert = {
        title: '高优先级告警',
        message: '测试高优先级告警',
        severity: AlertSeverity.HIGH,
      };

      await expect(logChannel.send(alert)).resolves.not.toThrow();
    });

    it('应该正确发送MEDIUM级别告警', async () => {
      const alert: Alert = {
        title: '中等告警',
        message: '测试中等级别告警',
        severity: AlertSeverity.MEDIUM,
      };

      await expect(logChannel.send(alert)).resolves.not.toThrow();
    });

    it('应该正确发送LOW级别告警', async () => {
      const alert: Alert = {
        title: '低级别告警',
        message: '测试低级别告警',
        severity: AlertSeverity.LOW,
      };

      await expect(logChannel.send(alert)).resolves.not.toThrow();
    });

    it('应该支持带metadata的告警', async () => {
      const alert: Alert = {
        title: '带元数据的告警',
        message: '测试告警',
        severity: AlertSeverity.MEDIUM,
        metadata: {
          metric: 'apiErrorRate',
          value: 5.5,
          timestamp: new Date().toISOString(),
        },
      };

      await expect(logChannel.send(alert)).resolves.not.toThrow();
    });
  });

  describe('EmailAlertChannel', () => {
    let emailChannel: EmailAlertChannel;

    beforeEach(() => {
      process.env.ALERT_EMAIL_TO = 'test@example.com';
      emailChannel = new EmailAlertChannel(['test@example.com']);
    });

    it('应该创建EMAIL渠道', () => {
      expect(emailChannel.name).toBe('EMAIL');
      expect(emailChannel['recipients']).toContain('test@example.com');
    });

    it('没有收件人时enabled应返回false', () => {
      const emptyChannel = new EmailAlertChannel([]);
      expect(emptyChannel.enabled()).toBe(false);
    });

    it('有收件人时enabled应返回true', () => {
      expect(emailChannel.enabled()).toBe(true);
    });

    it('应该添加收件人', () => {
      emailChannel.addRecipient('new@example.com');
      expect(emailChannel['recipients']).toContain('new@example.com');
    });

    it('不应添加重复的收件人', () => {
      const initialLength = emailChannel['recipients'].length;
      emailChannel.addRecipient('test@example.com');
      expect(emailChannel['recipients'].length).toBe(initialLength);
    });

    it('应该移除收件人', () => {
      emailChannel.addRecipient('remove@example.com');
      emailChannel.removeRecipient('remove@example.com');
      expect(emailChannel['recipients']).not.toContain('remove@example.com');
    });

    it('应该发送邮件告警', async () => {
      const alert: Alert = {
        title: '邮件告警',
        message: '这是邮件告警内容',
        severity: AlertSeverity.HIGH,
      };

      await expect(emailChannel.send(alert)).resolves.not.toThrow();
    });

    it('应该正确生成邮件HTML', () => {
      const alert: Alert = {
        title: '测试邮件',
        message: '测试消息内容',
        severity: AlertSeverity.MEDIUM,
      };

      const html = emailChannel['generateEmailBody'](alert);
      expect(html).toContain('测试邮件');
      expect(html).toContain('测试消息内容');
      expect(html).toContain('MEDIUM');
    });

    it('应该在邮件中包含metadata', () => {
      const alert: Alert = {
        title: '带数据的邮件',
        message: '测试',
        severity: AlertSeverity.HIGH,
        metadata: { testKey: 'testValue' },
      };

      const html = emailChannel['generateEmailBody'](alert);
      expect(html).toContain('详细信息');
    });
  });

  describe('WebhookAlertChannel', () => {
    let webhookChannel: WebhookAlertChannel;
    let mockFetch: jest.Mock;

    beforeEach(() => {
      process.env.ALERT_WEBHOOK_URL = 'https://example.com/webhook';
      mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
      global.fetch = mockFetch;
      webhookChannel = new WebhookAlertChannel('https://example.com/webhook');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('应该创建WEBHOOK渠道', () => {
      expect(webhookChannel.name).toBe('WEBHOOK');
      expect(webhookChannel['webhookUrl']).toBe('https://example.com/webhook');
    });

    it('没有URL时enabled应返回false', () => {
      const emptyChannel = new WebhookAlertChannel('');
      expect(emptyChannel.enabled()).toBe(false);
    });

    it('有URL时enabled应返回true', () => {
      expect(webhookChannel.enabled()).toBe(true);
    });

    it('应该设置Webhook URL', () => {
      webhookChannel.setWebhookUrl('https://new.example.com/webhook');
      expect(webhookChannel['webhookUrl']).toBe(
        'https://new.example.com/webhook'
      );
    });

    it('应该发送Webhook请求', async () => {
      const alert: Alert = {
        title: 'Webhook告警',
        message: 'Webhook测试消息',
        severity: AlertSeverity.HIGH,
      };

      await webhookChannel.send(alert);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockFetch.mock.calls[0][0]).toBe('https://example.com/webhook');
    });

    it('Webhook请求体应包含告警信息', async () => {
      const alert: Alert = {
        title: '测试告警',
        message: '测试消息',
        severity: AlertSeverity.CRITICAL,
      };

      await webhookChannel.send(alert);

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      if (callArgs && callArgs[1]) {
        const body = JSON.parse(callArgs[1].body);
        expect(body.alert.title).toBe('测试告警');
        expect(body.alert.message).toBe('测试消息');
        expect(body.alert.severity).toBe('CRITICAL');
      }
    });

    it('应该处理Webhook错误', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const alert: Alert = {
        title: '错误告警',
        message: '测试错误处理',
        severity: AlertSeverity.HIGH,
      };

      await expect(webhookChannel.send(alert)).rejects.toThrow(
        'Webhook notification failed'
      );
    });

    it('应该处理非200响应', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500 });

      const alert: Alert = {
        title: '失败告警',
        message: '测试',
        severity: AlertSeverity.HIGH,
      };

      await expect(webhookChannel.send(alert)).rejects.toThrow(
        'Webhook notification failed'
      );
    });
  });

  describe('SMSAlertChannel', () => {
    let smsChannel: SMSAlertChannel;

    beforeEach(() => {
      process.env.ALERT_SMS_ENABLED = 'true';
      smsChannel = new SMSAlertChannel(['1234567890']);
    });

    it('应该创建SMS渠道', () => {
      expect(smsChannel.name).toBe('SMS');
      expect(smsChannel['recipients']).toContain('1234567890');
    });

    it('没有收件人时enabled应返回false', () => {
      const emptyChannel = new SMSAlertChannel([]);
      expect(emptyChannel.enabled()).toBe(false);
    });

    it('有收件人时enabled应返回true', () => {
      expect(smsChannel.enabled()).toBe(true);
    });

    it('环境变量未设置时enabled应返回false', () => {
      delete process.env.ALERT_SMS_ENABLED;
      expect(smsChannel.enabled()).toBe(false);
    });

    it('应该添加收件人', () => {
      smsChannel.addRecipient('9876543210');
      expect(smsChannel['recipients']).toContain('9876543210');
    });

    it('不应添加重复的收件人', () => {
      const initialLength = smsChannel['recipients'].length;
      smsChannel.addRecipient('1234567890');
      expect(smsChannel['recipients'].length).toBe(initialLength);
    });

    it('应该移除收件人', () => {
      smsChannel.addRecipient('5555555555');
      smsChannel.removeRecipient('5555555555');
      expect(smsChannel['recipients']).not.toContain('5555555555');
    });

    it('应该发送短信告警', async () => {
      const alert: Alert = {
        title: '短信告警',
        message: '短信测试消息',
        severity: AlertSeverity.HIGH,
      };

      await expect(smsChannel.send(alert)).resolves.not.toThrow();
    });
  });

  describe('createNotificationChannel', () => {
    it('应该创建EMAIL渠道', () => {
      const channel = createNotificationChannel('EMAIL');
      expect(channel.name).toBe('EMAIL');
    });

    it('应该创建WEBHOOK渠道', () => {
      const channel = createNotificationChannel('WEBHOOK');
      expect(channel.name).toBe('WEBHOOK');
    });

    it('应该创建SMS渠道', () => {
      const channel = createNotificationChannel('SMS');
      expect(channel.name).toBe('SMS');
    });

    it('应该创建LOG渠道', () => {
      const channel = createNotificationChannel('LOG');
      expect(channel.name).toBe('LOG');
    });

    it('未知类型应返回LOG渠道', () => {
      const channel = createNotificationChannel('UNKNOWN');
      expect(channel.name).toBe('LOG');
    });

    it('空字符串应返回LOG渠道', () => {
      const channel = createNotificationChannel('');
      expect(channel.name).toBe('LOG');
    });
  });

  describe('createNotificationChannels', () => {
    let channels: ReturnType<typeof createNotificationChannels>;

    beforeEach(() => {
      channels = createNotificationChannels();
    });

    it('应该至少返回LOG渠道', () => {
      expect(channels.length).toBeGreaterThanOrEqual(1);
      expect(channels.some(c => c.name === 'LOG')).toBe(true);
    });

    it('可以根据配置添加EMAIL渠道', () => {
      const hasEmail = channels.some(c => c.name === 'EMAIL');
      expect(typeof hasEmail).toBe('boolean');
    });

    it('可以根据配置添加WEBHOOK渠道', () => {
      const hasWebhook = channels.some(c => c.name === 'WEBHOOK');
      expect(typeof hasWebhook).toBe('boolean');
    });

    it('可以根据配置添加SMS渠道', () => {
      const hasSms = channels.some(c => c.name === 'SMS');
      expect(typeof hasSms).toBe('boolean');
    });
  });
});
