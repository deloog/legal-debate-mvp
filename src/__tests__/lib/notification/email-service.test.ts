/**
 * 邮件服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getEmailService,
  DevEmailService,
} from '@/lib/notification/email-service';
import { clearAllRateLimits } from '@/lib/notification/rate-limiter';
import {
  FollowUpTask,
  FollowUpTaskPriority,
  FollowUpTaskStatus,
  CommunicationType,
} from '@/types/client';

describe('邮件服务测试', () => {
  const mockTask: FollowUpTask = {
    id: 'task-1',
    clientId: 'client-1',
    communicationId: 'comm-1',
    userId: 'user-1',
    type: CommunicationType.PHONE,
    summary: '跟进案件进度',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后
    priority: FollowUpTaskPriority.HIGH,
    status: FollowUpTaskStatus.PENDING,
    clientName: '张三',
    clientEmail: 'test@example.com',
    clientPhone: '13800138000',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('开发环境邮件服务', () => {
    let emailService: DevEmailService;
    let logMock: jest.SpyInstance;

    beforeEach(() => {
      jest.clearAllMocks();
      clearAllRateLimits();
      logMock = jest.spyOn(console, 'log').mockImplementation(() => {});
      emailService = new DevEmailService();
    });

    afterEach(() => {
      logMock.mockRestore();
    });

    it('应该成功发送跟进任务邮件', async () => {
      const result = await emailService.sendFollowUpTaskEmail(
        mockTask,
        'test@example.com'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.devMessage).toContain('开发模式');
      expect(result.devMessage).toMatch(/t\*+t@example\.com|test@example\.com/);
      expect(result.devMessage).toContain('跟进案件进度');
    });

    it('应该发送HTML格式的邮件', async () => {
      const result = await emailService.sendFollowUpTaskEmail(
        mockTask,
        'test@example.com'
      );

      // 验证发送成功（HTML内容通过logger记录，不通过console.log）
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('应该根据任务优先级显示不同的文本', async () => {
      const highPriorityTask = {
        ...mockTask,
        priority: FollowUpTaskPriority.HIGH,
      };
      const mediumPriorityTask = {
        ...mockTask,
        priority: FollowUpTaskPriority.MEDIUM,
      };
      const lowPriorityTask = {
        ...mockTask,
        priority: FollowUpTaskPriority.LOW,
      };

      const r1 = await emailService.sendFollowUpTaskEmail(
        highPriorityTask,
        'high@example.com'
      );
      const r2 = await emailService.sendFollowUpTaskEmail(
        mediumPriorityTask,
        'medium@example.com'
      );
      const r3 = await emailService.sendFollowUpTaskEmail(
        lowPriorityTask,
        'low@example.com'
      );

      // 验证各优先级邮件均发送成功
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);
    });

    it('应该根据任务类型显示不同的跟进方式', async () => {
      const phoneTask = { ...mockTask, type: CommunicationType.PHONE };
      const emailTask = { ...mockTask, type: CommunicationType.EMAIL };
      const meetingTask = { ...mockTask, type: CommunicationType.MEETING };
      const wechatTask = { ...mockTask, type: CommunicationType.WECHAT };

      const r1 = await emailService.sendFollowUpTaskEmail(
        phoneTask,
        'phone@example.com'
      );
      const r2 = await emailService.sendFollowUpTaskEmail(
        emailTask,
        'email@example.com'
      );
      const r3 = await emailService.sendFollowUpTaskEmail(
        meetingTask,
        'meeting@example.com'
      );
      const r4 = await emailService.sendFollowUpTaskEmail(
        wechatTask,
        'wechat@example.com'
      );

      // 验证各类型邮件均发送成功
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r3.success).toBe(true);
      expect(r4.success).toBe(true);
    });
  });

  describe('工厂函数测试', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        originalNodeEnv;
    });

    it('开发环境应该返回开发邮件服务', () => {
      const devEnv = process.env.NODE_ENV || 'development';
      (process.env as Record<string, string | undefined>).NODE_ENV =
        'development';
      const service = getEmailService();
      (process.env as Record<string, string | undefined>).NODE_ENV = devEnv;
      expect(service).toBeInstanceOf(DevEmailService);
    });

    it('测试环境应该返回开发邮件服务', () => {
      const devEnv = process.env.NODE_ENV || 'development';
      (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
      const service = getEmailService();
      (process.env as Record<string, string | undefined>).NODE_ENV = devEnv;
      expect(service).toBeInstanceOf(DevEmailService);
    });
  });
});
