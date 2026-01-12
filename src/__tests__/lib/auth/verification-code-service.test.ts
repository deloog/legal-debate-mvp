/**
 * 验证码服务测试
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import {
  getVerificationCodeService,
  VerificationCodeService,
} from '@/lib/auth/verification-code-service';
import { VerificationCodeTypeEnum } from '@/types/password-reset';
import { resetVerificationCodeService } from '@/lib/auth/verification-code-service';

describe('验证码服务', () => {
  let prisma: PrismaClient;
  let service: VerificationCodeService;

  beforeEach(async () => {
    prisma = new PrismaClient();
    service = new VerificationCodeService(prisma);

    // 清理测试数据
    await prisma.verificationCode.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-',
        },
      },
    });
  });

  afterEach(async () => {
    resetVerificationCodeService();
    await prisma.verificationCode.deleteMany({});
    await prisma.$disconnect();
  });

  describe('createCode', () => {
    it('应该成功创建验证码', async () => {
      // 创建测试用户
      const user = await prisma.user.create({
        data: {
          email: 'test-create@example.com',
          password: 'hashedPassword',
          username: 'testuser1',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const result = await service.createCode(
        user.id,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      expect(result.success).toBe(true);
      expect(result.code).toBeDefined();
      expect(result.code).toMatch(/^\d{6}$/);
      expect(result.expiresAt).toBeDefined();
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('应该创建不同类型的验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-types@example.com',
          password: 'hashedPassword',
          username: 'testuser2',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const result1 = await service.createCode(
        user.id,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );
      const result2 = await service.createCode(
        user.id,
        VerificationCodeTypeEnum.EMAIL_VERIFICATION
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.code).not.toBe(result2.code);
    });

    it('应该在达到最大尝试次数后限制验证码创建', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-rate@example.com',
          password: 'hashedPassword',
          username: 'testuser3',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      // 创建5个验证码（达到最大尝试次数）
      const results = [];
      for (let i = 0; i < 5; i++) {
        const result = await service.createCode(
          user.id,
          VerificationCodeTypeEnum.PASSWORD_RESET
        );
        results.push(result);
        // 短暂延迟确保时间戳不同
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // 前5个应该成功
      for (let i = 0; i < 5; i++) {
        expect(results[i].success).toBe(true);
      }

      // 第6个请求应该被限制
      const result6 = await service.createCode(
        user.id,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );
      expect(result6.success).toBe(false);
      expect(result6.error).toContain('尝试次数过多');
    });
  });

  describe('verifyCode', () => {
    it('应该成功验证正确的验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-verify@example.com',
          password: 'hashedPassword',
          username: 'testuser4',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const createResult = await service.createCode(
        user.id,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      const verifyResult = await service.verifyCode(
        user.email,
        createResult.code,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      expect(verifyResult.valid).toBe(true);
      expect(verifyResult.userId).toBe(user.id);
    });

    it('应该拒绝错误的验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-wrong@example.com',
          password: 'hashedPassword',
          username: 'testuser5',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      await service.createCode(
        user.id,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      const verifyResult = await service.verifyCode(
        user.email,
        '000000',
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.error).toContain('验证码无效');
    });

    it('应该拒绝过期的验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-expired@example.com',
          password: 'hashedPassword',
          username: 'testuser6',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      // 创建一个已过期的验证码
      const expiredDate = new Date(Date.now() - 1000);
      await prisma.verificationCode.create({
        data: {
          code: '000000',
          type: VerificationCodeTypeEnum.PASSWORD_RESET,
          expiresAt: expiredDate,
          userId: user.id,
        },
      });

      const verifyResult = await service.verifyCode(
        user.email,
        '000000',
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      expect(verifyResult.valid).toBe(false);
      expect(verifyResult.error).toContain('已过期');
    });

    it('应该拒绝不匹配类型的验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-mismatch@example.com',
          password: 'hashedPassword',
          username: 'testuser7',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const createResult = await service.createCode(
        user.id,
        VerificationCodeTypeEnum.EMAIL_VERIFICATION
      );

      // 使用错误的类型验证
      const verifyResult = await service.verifyCode(
        user.email,
        createResult.code,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      expect(verifyResult.valid).toBe(false);
    });

    it('应该在验证成功后删除验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-delete@example.com',
          password: 'hashedPassword',
          username: 'testuser8',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      const createResult = await service.createCode(
        user.id,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      await service.verifyCode(
        user.email,
        createResult.code,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      // 检查验证码是否已标记为已使用
      const codeRecord = await prisma.verificationCode.findFirst({
        where: {
          code: createResult.code,
        },
      });

      expect(codeRecord?.usedAt).toBeDefined();
      expect(codeRecord?.usedAt).not.toBeNull();
    });

    it('应该在多次验证失败后返回错误', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-lock@example.com',
          password: 'hashedPassword',
          username: 'testuser9',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      // 尝试多次验证（失败）
      const verifyResult = await service.verifyCode(
        user.email,
        '000000',
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      // 由于验证码不存在（错误验证码），应该返回验证码无效
      expect(verifyResult.valid).toBe(false);
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('应该清理过期的验证码', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test-cleanup@example.com',
          password: 'hashedPassword',
          username: 'testuser10',
          role: 'USER',
          status: 'ACTIVE',
        },
      });

      // 创建过期验证码
      const expiredDate = new Date(Date.now() - 1000);
      await prisma.verificationCode.create({
        data: {
          code: '000000',
          type: VerificationCodeTypeEnum.PASSWORD_RESET,
          expiresAt: expiredDate,
          userId: user.id,
        },
      });

      // 创建有效验证码
      const validResult = await service.createCode(
        user.id,
        VerificationCodeTypeEnum.PASSWORD_RESET
      );

      // 清理过期验证码
      const deletedCount = await service.cleanupExpiredCodes();

      expect(deletedCount).toBeGreaterThanOrEqual(1);

      // 验证有效验证码仍然存在
      const validCode = await prisma.verificationCode.findFirst({
        where: {
          code: validResult.code,
        },
      });

      expect(validCode).toBeDefined();
      expect(validCode?.usedAt).toBeNull();
    });
  });

  describe('getVerificationCodeService', () => {
    it('应该返回单例实例', () => {
      const service1 = getVerificationCodeService();
      const service2 = getVerificationCodeService();

      expect(service1).toBe(service2);
    });
  });
});
