/**
 * 密码工具函数测试
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  generateRandomPassword,
} from '@/lib/auth/password';

// 设置测试环境变量
beforeAll(() => {
  process.env.BCRYPT_SALT_ROUNDS = '10';
});

describe('密码工具函数', () => {
  describe('hashPassword', () => {
    it('应该成功哈希密码', async () => {
      const password = 'testPassword123';
      const hashed = await hashPassword(password);

      expect(typeof hashed).toBe('string');
      expect(hashed.length).toBeGreaterThan(50);
      expect(hashed.startsWith('$2b$')).toBe(true); // bcrypt 哈希以 $2b$ 开头
    });

    it('相同的密码应该产生不同的哈希值', async () => {
      const password = 'testPassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2); // bcrypt 使用随机盐
    });

    it('应该处理空密码', async () => {
      const password = '';
      const hashed = await hashPassword(password);

      expect(typeof hashed).toBe('string');
    });
  });

  describe('verifyPassword', () => {
    it('应该验证正确的密码', async () => {
      const password = 'testPassword123';
      const hashed = await hashPassword(password);
      const isValid = await verifyPassword(password, hashed);

      expect(isValid).toBe(true);
    });

    it('应该拒绝错误的密码', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword456';
      const hashed = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hashed);

      expect(isValid).toBe(false);
    });

    it('应该处理空密码', async () => {
      const password = 'testPassword123';
      const hashed = await hashPassword(password);
      const isValid = await verifyPassword('', hashed);

      expect(isValid).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('应该接受有效的密码', () => {
      const password = 'testPassword123';
      const result = validatePassword(password);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝少于6位的密码', () => {
      const password = 'test1';
      const result = validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码长度必须至少6位');
    });

    it('应该拒绝只有字母的密码', () => {
      const password = 'testPassword';
      const result = validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含数字');
    });

    it('应该拒绝只有数字的密码', () => {
      const password = '123456';
      const result = validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含字母');
    });

    it('应该拒绝长度不足的密码', () => {
      const password = 't1';
      const result = validatePassword(password);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors).toContain('密码长度必须至少6位');
    });

    it('应该接受混合大小写字母和数字的密码', () => {
      const password = 'TestPass123';
      const result = validatePassword(password);

      expect(result.valid).toBe(true);
    });

    it('应该接受包含特殊字符的密码', () => {
      const password = 'Test@Pass123';
      const result = validatePassword(password);

      expect(result.valid).toBe(true);
    });
  });

  describe('generateRandomPassword', () => {
    it('应该生成默认长度的密码', () => {
      const password = generateRandomPassword();

      expect(typeof password).toBe('string');
      expect(password.length).toBe(12);
    });

    it('应该生成指定长度的密码', () => {
      const password = generateRandomPassword(16);

      expect(password.length).toBe(16);
    });

    it('应该生成不同的密码', () => {
      const password1 = generateRandomPassword();
      const password2 = generateRandomPassword();

      expect(password1).not.toBe(password2);
    });

    it('生成的密码应该包含字母', () => {
      const password = generateRandomPassword();
      const hasLetter = /[a-zA-Z]/.test(password);

      expect(hasLetter).toBe(true);
    });

    it('生成的密码应该包含数字', () => {
      const password = generateRandomPassword();
      const hasNumber = /[0-9]/.test(password);

      expect(hasNumber).toBe(true);
    });

    it('生成的密码应该包含特殊字符', () => {
      const password = generateRandomPassword();
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password);

      expect(hasSpecial).toBe(true);
    });

    it('应该生成长度为8的密码', () => {
      const password = generateRandomPassword(8);

      expect(password.length).toBe(8);
    });

    it('应该生成长度为20的密码', () => {
      const password = generateRandomPassword(20);

      expect(password.length).toBe(20);
    });
  });
});
