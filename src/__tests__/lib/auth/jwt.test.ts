/**
 * JWT 工具函数测试
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  generateToken,
  verifyToken,
  decodeToken,
  extractTokenFromHeader,
} from '@/lib/auth/jwt';
import type { JwtPayload } from '@/types/auth';

// 设置测试环境变量
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-jwt-tests';
  process.env.JWT_EXPIRES_IN = '1d';
});

describe('JWT 工具函数', () => {
  describe('generateToken', () => {
    it('应该生成有效的 JWT token', () => {
      const payload: JwtPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
      };

      const token = generateToken(payload);

      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
      expect(token.split('.')).toHaveLength(3); // JWT 有三部分
    });

    it('应该支持自定义过期时间', () => {
      const payload: JwtPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
      };

      const token1 = generateToken(payload, '1h');
      const token2 = generateToken(payload, '1d');

      expect(typeof token1).toBe('string');
      expect(typeof token2).toBe('string');
      // 不同的过期时间应该产生不同的 token（因为 exp 不同）
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyToken', () => {
    it('应该验证有效的 token', () => {
      const payload: JwtPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
      };

      const token = generateToken(payload);
      const result = verifyToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).not.toBeNull();
      expect(result.payload?.userId).toBe(payload.userId);
      expect(result.payload?.email).toBe(payload.email);
      expect(result.payload?.role).toBe(payload.role);
      expect(result.error).toBeNull();
    });

    it('应该拒绝无效的 token', () => {
      const invalidToken = 'invalid-token-string';
      const result = verifyToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeNull();
      expect(result.error).toBe('INVALID_TOKEN');
    });

    it('应该拒绝格式错误的 token', () => {
      const malformedToken = 'header.payload'; // 缺少签名
      const result = verifyToken(malformedToken);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeNull();
      expect(result.error).toBe('INVALID_TOKEN');
    });
  });

  describe('decodeToken', () => {
    it('应该解码有效的 token（不验证签名）', () => {
      const payload: JwtPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
      };

      const token = generateToken(payload);
      const decoded = decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe(payload.userId);
      expect(decoded?.email).toBe(payload.email);
      expect(decoded?.role).toBe(payload.role);
    });

    it('应该解码无效的 token（不验证签名）', () => {
      const invalidToken = 'invalid.token.here';
      const decoded = decodeToken(invalidToken);

      expect(decoded).toBeNull();
    });

    it('应该解码被篡改的 token（不验证签名）', () => {
      const payload: JwtPayload = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'USER',
      };

      const token = generateToken(payload);
      // 篡改 token
      const tamperedToken = token.substring(0, token.length - 5) + 'abcde';
      const decoded = decodeToken(tamperedToken);

      // decodeToken 不验证签名，所以可能解码出内容
      expect(decoded).not.toBeNull();
    });
  });

  describe('extractTokenFromHeader', () => {
    it('应该从 Authorization header 中提取 Bearer token', () => {
      const token = 'test-token-here';
      const authHeader = `Bearer ${token}`;

      const extracted = extractTokenFromHeader(authHeader);

      expect(extracted).toBe(token);
    });

    it('应该处理没有 Bearer 前缀的 header', () => {
      const authHeader = 'just-a-token';

      const extracted = extractTokenFromHeader(authHeader);

      expect(extracted).toBeNull();
    });

    it('应该处理 null header', () => {
      const extracted = extractTokenFromHeader(null);

      expect(extracted).toBeNull();
    });

    it('应该处理空字符串 header', () => {
      const extracted = extractTokenFromHeader('');

      expect(extracted).toBeNull();
    });

    it('应该处理格式错误的 header（只有 Bearer）', () => {
      const authHeader = 'Bearer';

      const extracted = extractTokenFromHeader(authHeader);

      expect(extracted).toBeNull();
    });

    it('应该处理有多个空格的 header', () => {
      const authHeader = `Bearer   test-token`;

      const extracted = extractTokenFromHeader(authHeader);

      // 多个空格会返回空字符串（不符合 Bearer 格式）
      expect(extracted).toBeNull();
    });
  });
});
