/**
 * 验证工具函数测试
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateEmail,
  validateUsername,
  validateRegisterRequest,
  validateLoginRequest,
  sanitizeInput,
} from '@/lib/auth/validation';

describe('验证工具函数', () => {
  describe('validateEmail', () => {
    it('应该接受有效的邮箱', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user123@example.co.uk',
      ];

      validEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('应该拒绝无效的邮箱', () => {
      const invalidEmails = [
        'invalid',
        'invalid@',
        '@example.com',
        'user@.com',
        'user@',
        'user@.com',
        'user@@example.com',
      ];

      invalidEmails.forEach(email => {
        const result = validateEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('邮箱格式不正确');
      });
    });
  });

  describe('validateUsername', () => {
    it('应该接受有效的用户名', () => {
      const validUsernames = [
        'testuser',
        'test_user',
        'test123',
        '用户名',
        '测试用户123',
        'TestUser',
      ];

      validUsernames.forEach(username => {
        const result = validateUsername(username);
        expect(result.valid).toBe(true);
        expect(result.error).toBeNull();
      });
    });

    it('应该拒绝太短的用户名', () => {
      const result = validateUsername('a');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2-20位');
    });

    it('应该拒绝太长的用户名', () => {
      const result = validateUsername('a'.repeat(21));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2-20位');
    });

    it('应该拒绝包含特殊字符的用户名', () => {
      const invalidUsernames = [
        'test-user',
        'test@user',
        'test!user',
        'test.user',
      ];

      invalidUsernames.forEach(username => {
        const result = validateUsername(username);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('只能包含');
      });
    });
  });

  describe('validateRegisterRequest', () => {
    it('应该接受有效的注册请求', () => {
      const result = validateRegisterRequest(
        'test@example.com',
        'password123',
        'testuser'
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的邮箱', () => {
      const result = validateRegisterRequest(
        'invalid',
        'password123',
        'testuser'
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('邮箱格式不正确');
    });

    it('应该拒绝无效的密码', () => {
      const result = validateRegisterRequest(
        'test@example.com',
        '123',
        'testuser'
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该拒绝无效的用户名', () => {
      const result = validateRegisterRequest(
        'test@example.com',
        'password123',
        'a'
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('应该接受不带用户名的注册请求', () => {
      const result = validateRegisterRequest('test@example.com', 'password123');

      expect(result.valid).toBe(true);
    });

    it('应该返回所有验证错误', () => {
      const result = validateRegisterRequest('invalid', '123', 'a');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('validateLoginRequest', () => {
    it('应该接受有效的登录请求', () => {
      const result = validateLoginRequest('test@example.com', 'password123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的邮箱', () => {
      const result = validateLoginRequest('invalid', 'password123');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('邮箱格式不正确');
    });

    it('应该拒绝空密码', () => {
      const result = validateLoginRequest('test@example.com', '');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码不能为空');
    });

    it('应该拒绝只有空格的密码', () => {
      const result = validateLoginRequest('test@example.com', '   ');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码不能为空');
    });

    it('应该返回所有验证错误', () => {
      const result = validateLoginRequest('invalid', '');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(2);
    });
  });

  describe('sanitizeInput', () => {
    it('应该移除 HTML 标签', () => {
      const input = "<script>alert('xss')</script>test";
      const result = sanitizeInput(input);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).toBe("scriptalert('xss')/scripttest");
    });

    it('应该移除前后空格', () => {
      const input = '  test  ';
      const result = sanitizeInput(input);

      expect(result).toBe('test');
    });

    it('应该处理空字符串', () => {
      const input = '';
      const result = sanitizeInput(input);

      expect(result).toBe('');
    });

    it('应该处理只有空格的字符串', () => {
      const input = '   ';
      const result = sanitizeInput(input);

      expect(result).toBe('');
    });

    it('应该处理只有标签的输入', () => {
      const input = '<div></div>';
      const result = sanitizeInput(input);

      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
    });
  });
});
