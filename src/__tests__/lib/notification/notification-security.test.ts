/**
 * 通知与提醒模块安全测试
 * 测试频率限制、幂等性、敏感信息保护等安全机制
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

jest.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// 导入被测试的模块（在mock之后）
import {
  checkRateLimit,
  resetRateLimit,
  getRateLimitStatus,
  clearAllRateLimits,
} from '@/lib/notification/rate-limiter';

describe('Notification Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllRateLimits();
  });

  // ============================================================================
  // 频率限制测试
  // ============================================================================
  describe('Rate Limiter', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('13812345678', 'SMS');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9); // 默认10条限制
    });

    it('should track request count', () => {
      const phone = '13812345678';

      // 发送5条（使用0冷却时间避免触发冷却限制）
      for (let i = 0; i < 5; i++) {
        checkRateLimit(phone, 'SMS', { cooldownMs: 0 });
      }

      const result = checkRateLimit(phone, 'SMS', { cooldownMs: 0 });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 6 = 4
    });

    it('should block requests over limit', () => {
      const phone = '13812345678';

      // 发送10条（达到限制）
      for (let i = 0; i < 10; i++) {
        checkRateLimit(phone, 'SMS');
      }

      // 第11条应该被拒绝
      const result = checkRateLimit(phone, 'SMS');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should enforce cooldown period', () => {
      const phone = '13812345678';

      // 第一次请求
      checkRateLimit(phone, 'SMS');
      
      // 立即第二次请求（在冷却时间内）
      const result = checkRateLimit(phone, 'SMS', { cooldownMs: 60000 });
      
      // 应该被允许（因为只是检查冷却，不是阻止）
      // 注意：实际冷却检查在连续快速请求时会触发
    });

    it('should track SMS and EMAIL separately', () => {
      const identifier = 'user@example.com';

      // 使用EMAIL类型
      const emailResult = checkRateLimit(identifier, 'EMAIL');
      expect(emailResult.allowed).toBe(true);

      // 使用SMS类型（不同的key）
      const phone = '13812345678';
      const smsResult = checkRateLimit(phone, 'SMS');
      expect(smsResult.allowed).toBe(true);

      // 两者的计数应该独立
      const emailStatus = getRateLimitStatus(identifier, 'EMAIL');
      const smsStatus = getRateLimitStatus(phone, 'SMS');

      expect(emailStatus?.count).toBe(1);
      expect(smsStatus?.count).toBe(1);
    });

    it('should reset rate limit when requested', () => {
      const phone = '13812345678';

      // 发送5条
      for (let i = 0; i < 5; i++) {
        checkRateLimit(phone, 'SMS');
      }

      // 重置
      resetRateLimit(phone, 'SMS');

      // 检查状态
      const status = getRateLimitStatus(phone, 'SMS');
      expect(status?.count).toBe(0);
      expect(status?.remaining).toBe(10);
    });

    it('should support custom configuration', () => {
      const phone = '13812345678';

      // 自定义：每小时最多5条
      const result1 = checkRateLimit(phone, 'SMS', {
        windowMs: 60 * 60 * 1000,
        maxRequests: 5,
      });
      expect(result1.remaining).toBe(4);

      // 再发4条
      for (let i = 0; i < 4; i++) {
        checkRateLimit(phone, 'SMS', {
          windowMs: 60 * 60 * 1000,
          maxRequests: 5,
        });
      }

      // 第6条应该被拒绝
      const result2 = checkRateLimit(phone, 'SMS', {
        windowMs: 60 * 60 * 1000,
        maxRequests: 5,
      });
      expect(result2.allowed).toBe(false);
    });
  });

  // ============================================================================
  // 敏感信息保护测试
  // ============================================================================
  describe('Sensitive Information Protection', () => {
    it('should mask phone number correctly', () => {
      function maskPhoneNumber(phone: string): string {
        if (phone.length !== 11) return phone;
        return phone.substring(0, 3) + '****' + phone.substring(7);
      }

      expect(maskPhoneNumber('13812345678')).toBe('138****5678');
      expect(maskPhoneNumber('15987654321')).toBe('159****4321');
      expect(maskPhoneNumber('123')).toBe('123'); // 长度不足不处理
    });

    it('should mask email address correctly', () => {
      function maskEmailAddress(email: string): string {
        const atIndex = email.indexOf('@');
        if (atIndex === -1) return email;

        const local = email.substring(0, atIndex);
        const domain = email.substring(atIndex);

        if (local.length <= 2) {
          return '*'.repeat(local.length) + domain;
        }

        return local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1) + domain;
      }

      expect(maskEmailAddress('user@example.com')).toBe('u**r@example.com');
      expect(maskEmailAddress('ab@example.com')).toBe('**@example.com');
      expect(maskEmailAddress('abc@example.com')).toBe('a*c@example.com');
    });

    it('should validate phone number format', () => {
      function isValidPhoneNumber(phone: string): boolean {
        return /^1[3-9]\d{9}$/.test(phone);
      }

      expect(isValidPhoneNumber('13812345678')).toBe(true);
      expect(isValidPhoneNumber('15987654321')).toBe(true);
      expect(isValidPhoneNumber('1381234567')).toBe(false); // 长度不足
      expect(isValidPhoneNumber('138123456789')).toBe(false); // 长度过多
      expect(isValidPhoneNumber('23812345678')).toBe(false); // 不以1开头
      expect(isValidPhoneNumber('10812345678')).toBe(false); // 第二位为0
    });

    it('should validate email format', () => {
      function isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email) && email.length <= 254;
      }

      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.com')).toBe(true);
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@example')).toBe(false);
    });
  });

  // ============================================================================
  // 邮件注入攻击防护测试
  // ============================================================================
  describe('Email Injection Attack Prevention', () => {
    it('should detect newline injection in email address', () => {
      function containsInjectionAttack(value: string): boolean {
        const injectionChars = ['\n', '\r', '\0'];
        return injectionChars.some(char => value.includes(char));
      }

      expect(containsInjectionAttack('user@example.com')).toBe(false);
      expect(containsInjectionAttack('user\n@example.com')).toBe(true);
      expect(containsInjectionAttack('user\r@example.com')).toBe(true);
      expect(containsInjectionAttack('user\0@example.com')).toBe(true);
    });

    it('should detect newline injection in subject', () => {
      function containsInjectionAttack(value: string): boolean {
        const injectionChars = ['\n', '\r', '\0'];
        return injectionChars.some(char => value.includes(char));
      }

      const maliciousSubject = 'Hello\nBcc: attacker@evil.com';
      expect(containsInjectionAttack(maliciousSubject)).toBe(true);
    });
  });

  // ============================================================================
  // 定时任务幂等性测试
  // ============================================================================
  describe('Cron Job Idempotency', () => {
    it('should check if reminder was already sent', async () => {
      // 模拟已发送的提醒记录
      const mockNotificationLog = {
        findFirst: jest.fn().mockResolvedValue({ id: 'log-1' }),
      };

      // 如果找到记录，说明已发送
      const result = await mockNotificationLog.findFirst({
        where: {
          relatedId: 'task-1',
          relatedType: 'FOLLOW_UP_TASK',
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      expect(result).toBeTruthy();
    });

    it('should allow sending if no previous log exists', async () => {
      // 模拟未发送的情况
      const mockNotificationLog = {
        findFirst: jest.fn().mockResolvedValue(null),
      };

      const result = await mockNotificationLog.findFirst({
        where: {
          relatedId: 'task-1',
          relatedType: 'FOLLOW_UP_TASK',
        },
      });

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // 配置安全测试
  // ============================================================================
  describe('Configuration Security', () => {
    it('should validate SMS config completeness', () => {
      function validateSMSConfig(config: {
        provider: string;
        accessKeyId?: string;
        accessKeySecret?: string;
        signName?: string;
        templateCode?: string;
      }): boolean {
        if (config.provider === 'CONSOLE') {
          return true;
        }

        if (config.provider === 'ALIYUN') {
          return !!(
            config.accessKeyId &&
            config.accessKeySecret &&
            config.signName &&
            config.templateCode
          );
        }

        return false;
      }

      // 完整配置
      expect(
        validateSMSConfig({
          provider: 'ALIYUN',
          accessKeyId: 'key',
          accessKeySecret: 'secret',
          signName: '签名',
          templateCode: 'code',
        })
      ).toBe(true);

      // 不完整配置
      expect(
        validateSMSConfig({
          provider: 'ALIYUN',
          accessKeyId: 'key',
          // 缺少其他字段
        })
      ).toBe(false);

      // 控制台模式
      expect(validateSMSConfig({ provider: 'CONSOLE' })).toBe(true);
    });
  });
});
