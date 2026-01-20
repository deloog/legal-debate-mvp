/**
 * 邮件服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getEmailService,
  DevEmailService,
} from '@/lib/notification/email-service';
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
      expect(result.devMessage).toContain('test@example.com');
      expect(result.devMessage).toContain('跟进案件进度');
    });

    it('应该发送HTML格式的邮件', async () => {
      await emailService.sendFollowUpTaskEmail(mockTask, 'test@example.com');

      const logCalls = (console.log as jest.Mock).mock.calls;
      const logContent = logCalls.map(call => call.join(' ')).join('\n');

      expect(logContent).toContain('<!DOCTYPE html>');
      expect(logContent).toContain('<html>');
      expect(logContent).toContain('跟进任务提醒');
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

      await emailService.sendFollowUpTaskEmail(
        highPriorityTask,
        'test@example.com'
      );
      await emailService.sendFollowUpTaskEmail(
        mediumPriorityTask,
        'test@example.com'
      );
      await emailService.sendFollowUpTaskEmail(
        lowPriorityTask,
        'test@example.com'
      );

      const logCalls = (console.log as jest.Mock).mock.calls;
      const logContent = logCalls.map(call => call.join(' ')).join('\n');

      expect(logContent).toContain('高优先级');
      expect(logContent).toContain('中优先级');
      expect(logContent).toContain('低优先级');
    });

    it('应该根据任务类型显示不同的跟进方式', async () => {
      const phoneTask = { ...mockTask, type: CommunicationType.PHONE };
      const emailTask = { ...mockTask, type: CommunicationType.EMAIL };
      const meetingTask = { ...mockTask, type: CommunicationType.MEETING };
      const wechatTask = { ...mockTask, type: CommunicationType.WECHAT };

      await emailService.sendFollowUpTaskEmail(phoneTask, 'test@example.com');
      await emailService.sendFollowUpTaskEmail(emailTask, 'test@example.com');
      await emailService.sendFollowUpTaskEmail(meetingTask, 'test@example.com');
      await emailService.sendFollowUpTaskEmail(wechatTask, 'test@example.com');

      const logCalls = (console.log as jest.Mock).mock.calls;
      const logContent = logCalls.map(call => call.join(' ')).join('\n');

      expect(logContent).toContain('电话');
      expect(logContent).toContain('邮件');
      expect(logContent).toContain('面谈');
      expect(logContent).toContain('微信');
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
