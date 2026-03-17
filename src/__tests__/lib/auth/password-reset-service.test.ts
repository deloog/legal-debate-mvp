/**
 * 密码重置服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  getPasswordResetService,
  PasswordResetService,
  resetPasswordResetService,
  validatePasswordComplexity,
} from '@/lib/auth/password-reset-service';
import {
  PasswordResetErrorCode,
  VerificationCodeTypeEnum,
} from '@/types/password-reset';
import { resetVerificationCodeService } from '@/lib/auth/verification-code-service';

describe('密码重置服务', () => {
  let prisma: PrismaClient;
  let service: PasswordResetService;

  // 共享一个 PrismaClient，避免每个测试创建新连接导致连接池耗尽
  beforeAll(async () => {
    prisma = new PrismaClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
    resetVerificationCodeService();
    resetPasswordResetService();
  });

  beforeEach(async () => {
    // 清理测试数据
    await prisma.verificationCode.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-',
        },
      },
    });

    // 重置单例，并用共享 prisma 重新初始化，避免内部再创建额外连接
    resetVerificationCodeService();

    const {
      getVerificationCodeService,
    } = require('@/lib/auth/verification-code-service');
    getVerificationCodeService(prisma);

    resetPasswordResetService();
    service = new PasswordResetService(prisma);
  });

  afterEach(async () => {
    await prisma.verificationCode.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-',
        },
      },
    });
  });

  describe('validatePasswordComplexity', () => {
    it('应该接受符合复杂度要求的密码', () => {
      const result = validatePasswordComplexity('TestPass123');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝太短的密码', () => {
      const result = validatePasswordComplexity('Test1');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码长度至少 8 个字符');
    });

    it('应该拒绝缺少小写字母的密码', () => {
      const result = validatePasswordComplexity('TEST1234');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个小写字母');
    });

    it('应该拒绝缺少大写字母的密码', () => {
      const result = validatePasswordComplexity('test1234');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个大写字母');
    });

    it('应该拒绝缺少数字的密码', () => {
      const result = validatePasswordComplexity('TestPassword');

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码必须包含至少一个数字');
    });

    it('应该拒绝太长的密码', () => {
      const result = validatePasswordComplexity('a'.repeat(200));

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('密码长度不能超过 128 个字符');
    });

    it('应该返回多个错误当密码有多项问题时', () => {
      const result = validatePasswordComplexity('test');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('forgotPassword', () => {
    it('应该为存在的用户发送验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-forgot@example.com',
          password: await bcrypt.hash('oldPassword123', 10),
          username: 'testuser1',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const result = await service.forgotPassword({ email: user.email });

      expect(result.success).toBe(true);
      expect(result.message).toContain('验证码');
      expect(result.data).toBeDefined();
      expect(result.data?.expiresAt).toBeInstanceOf(Date);
    });

    it('应该对不存在的用户返回成功（防止邮箱枚举）', async () => {
      const result = await service.forgotPassword({
        email: 'nonexistent@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('如果该邮箱已注册');
    });

    it('应该拒绝无效的邮箱格式', async () => {
      const result = await service.forgotPassword({ email: 'invalid-email' });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PasswordResetErrorCode.INVALID_EMAIL);
    });

    it('应该为活跃用户发送验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-active@example.com',
          password: await bcrypt.hash('oldPassword123', 10),
          username: 'testuser2',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const result = await service.forgotPassword({ email: user.email });

      expect(result.success).toBe(true);
      expect(result.message).toContain('已发送');
    });

    it('应该对暂停用户返回成功（防止邮箱枚举）', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-suspended@example.com',
          password: await bcrypt.hash('oldPassword123', 10),
          username: 'testuser3',
          role: 'USER',
          status: 'SUSPENDED',
        },
      });

      const result = await service.forgotPassword({ email: user.email });

      expect(result.success).toBe(true);
    });
  });

  describe('resetPassword', () => {
    it('应该使用有效的验证码重置密码', async () => {
      const oldPassword = 'oldPassword123';
      const newPassword = 'NewPassword456';

      const user = await prisma.user.create({
        data: {
          email: 'test-reset@example.com',
          password: await bcrypt.hash(oldPassword, 10),
          username: 'testuser4',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      // 创建验证码
      const verificationCode = await prisma.verificationCode.create({
        data: {
          code: '123456',
          type: VerificationCodeTypeEnum.PASSWORD_RESET,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          userId: user.id,
        },
      });

      // 重置密码
      const result = await service.resetPassword({
        email: user.email,
        code: verificationCode.code,
        newPassword,
        confirmPassword: newPassword,
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('成功');

      // 验证密码已更改
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(updatedUser?.password).not.toBe(user.password);

      // 验证新密码可用
      if (updatedUser?.password) {
        const isValid = await bcrypt.compare(newPassword, updatedUser.password);
        expect(isValid).toBe(true);
      }
    });

    it('应该拒绝不匹配的确认密码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-mismatch@example.com',
          password: await bcrypt.hash('oldPassword123', 10),
          username: 'testuser5',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const result = await service.resetPassword({
        email: user.email,
        code: '123456',
        newPassword: 'NewPassword456',
        confirmPassword: 'DifferentPassword789',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PasswordResetErrorCode.PASSWORD_MISMATCH);
    });

    it('应该拒绝不符合复杂度要求的密码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-complexity@example.com',
          password: await bcrypt.hash('oldPassword123', 10),
          username: 'testuser6',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      // 使用一个长度符合但缺少大写字母和数字的密码
      const result = await service.resetPassword({
        email: user.email,
        code: '123456',
        newPassword: 'lowercase',
        confirmPassword: 'lowercase',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PasswordResetErrorCode.INVALID_PASSWORD);
    });

    it('应该拒绝无效的验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-invalid-code@example.com',
          password: await bcrypt.hash('oldPassword123', 10),
          username: 'testuser7',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const result = await service.resetPassword({
        email: user.email,
        code: '000000',
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PasswordResetErrorCode.INVALID_CODE);
    });

    it('应该拒绝过期的验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-expired-code@example.com',
          password: await bcrypt.hash('oldPassword123', 10),
          username: 'testuser8',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      // 创建过期验证码
      await prisma.verificationCode.create({
        data: {
          code: '123456',
          type: VerificationCodeTypeEnum.PASSWORD_RESET,
          expiresAt: new Date(Date.now() - 1000),
          userId: user.id,
        },
      });

      const result = await service.resetPassword({
        email: user.email,
        code: '123456',
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PasswordResetErrorCode.INVALID_CODE);
    });

    it('应该拒绝无效的邮箱格式', async () => {
      const result = await service.resetPassword({
        email: 'invalid-email',
        code: '123456',
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PasswordResetErrorCode.INVALID_EMAIL);
    });

    it('应该拒绝无效的验证码格式', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-code-format@example.com',
          password: await bcrypt.hash('oldPassword123', 10),
          username: 'testuser9',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const result = await service.resetPassword({
        email: user.email,
        code: 'abc123',
        newPassword: 'NewPassword456',
        confirmPassword: 'NewPassword456',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PasswordResetErrorCode.INVALID_EMAIL);
    });
  });

  describe('getPasswordResetService', () => {
    it('应该返回单例实例', () => {
      const service1 = getPasswordResetService();
      const service2 = getPasswordResetService();

      expect(service1).toBe(service2);
    });
  });
});
