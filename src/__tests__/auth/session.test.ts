/**
 * 会话管理功能测试
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  jest,
} from '@jest/globals';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from '@/lib/auth/jwt';
import {
  cleanupExpiredSessions,
  cleanupUserSessions,
  getExpiredSessionsCount,
  getActiveSessionsCount,
  executeSessionCleanup,
} from '@/lib/cron/cleanup-sessions';
import type { JwtPayload } from '@/types/auth';

// Mock Prisma 客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    session: {
      deleteMany: jest
        .fn()
        .mockImplementation(() => Promise.resolve({ count: 0 })),
      count: jest.fn().mockImplementation(() => Promise.resolve(0)),
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(null)),
      update: jest.fn().mockImplementation(() => Promise.resolve(null)),
    },
    user: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(null)),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// 类型断言 helper

const mockDeleteMany = prisma.session.deleteMany as jest.Mock<any>;

const mockCount = prisma.session.count as jest.Mock<any>;

// 设置测试环境变量
beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-key-for-session-tests';
});

// 重置所有 mock
beforeEach(() => {
  jest.clearAllMocks();
});

describe('会话管理功能测试', () => {
  describe('Token刷新功能', () => {
    it('应该生成有效的访问令牌', () => {
      const payload: JwtPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'USER',
      };

      const accessToken = generateAccessToken(payload);

      expect(typeof accessToken).toBe('string');
      expect(accessToken.length).toBeGreaterThan(0);

      // 验证令牌
      const result = verifyToken(accessToken);
      expect(result.valid).toBe(true);
      expect(result.payload).not.toBeNull();
      expect(result.payload?.userId).toBe(payload.userId);
    });

    it('应该生成有效的刷新令牌', () => {
      const payload: JwtPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'USER',
      };

      const refreshToken = generateRefreshToken(payload);

      expect(typeof refreshToken).toBe('string');
      expect(refreshToken.length).toBeGreaterThan(0);

      // 验证令牌
      const result = verifyToken(refreshToken);
      expect(result.valid).toBe(true);
      expect(result.payload).not.toBeNull();
      expect(result.payload?.userId).toBe(payload.userId);
    });

    it('访问令牌和刷新令牌应该不同', () => {
      const payload: JwtPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'USER',
      };

      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);

      // 两种令牌应该不同（因为过期时间不同）
      expect(accessToken).not.toBe(refreshToken);
    });
  });

  describe('会话清理功能', () => {
    it('应该成功清理过期会话', async () => {
      mockDeleteMany.mockResolvedValue({
        count: 5,
      });

      const count = await cleanupExpiredSessions();

      expect(count).toBe(5);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: {
          expires: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('应该清理指定用户的所有会话', async () => {
      const userId = 'user-123';
      mockDeleteMany.mockResolvedValue({
        count: 3,
      });

      const count = await cleanupUserSessions(userId);

      expect(count).toBe(3);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });

    it('应该获取过期会话数量', async () => {
      mockCount.mockResolvedValue(10);

      const count = await getExpiredSessionsCount();

      expect(count).toBe(10);
      expect(mockCount).toHaveBeenCalledWith({
        where: {
          expires: {
            lt: expect.any(Date),
          },
        },
      });
    });

    it('应该获取活跃会话数量', async () => {
      mockCount.mockResolvedValue(25);

      const count = await getActiveSessionsCount();

      expect(count).toBe(25);
      expect(mockCount).toHaveBeenCalledWith({
        where: {
          expires: {
            gt: expect.any(Date),
          },
        },
      });
    });

    it('应该正确执行完整的会话清理流程', async () => {
      // Mock 各个函数的返回值
      mockDeleteMany.mockResolvedValue({ count: 5 });
      mockCount
        .mockResolvedValueOnce(0) // getExpiredSessionsCount after cleanup
        .mockResolvedValueOnce(20); // getActiveSessionsCount

      const result = await executeSessionCleanup();

      expect(result).toEqual({
        expiredCount: 5,
        remainingExpiredCount: 0,
        activeCount: 20,
      });

      expect(mockDeleteMany).toHaveBeenCalled();
      expect(mockCount).toHaveBeenCalledTimes(2);
    });

    it('应该处理清理过期会话时的错误', async () => {
      mockDeleteMany.mockRejectedValue(new Error('Database error'));

      await expect(cleanupExpiredSessions()).rejects.toThrow(
        '清理过期会话失败'
      );
    });

    it('应该处理获取过期会话数量时的错误', async () => {
      mockCount.mockRejectedValue(new Error('Database error'));

      const count = await getExpiredSessionsCount();

      // 发生错误时应该返回0而不是抛出异常
      expect(count).toBe(0);
    });
  });

  describe('令牌验证功能', () => {
    it('应该正确验证有效的令牌', () => {
      const payload: JwtPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'USER',
      };

      const token = generateAccessToken(payload);
      const result = verifyToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).not.toBeNull();
      expect(result.payload?.userId).toBe(payload.userId);
      expect(result.payload?.email).toBe(payload.email);
      expect(result.payload?.role).toBe(payload.role);
    });

    it('应该拒绝无效的令牌', () => {
      const invalidToken = 'invalid.token.string';
      const result = verifyToken(invalidToken);

      expect(result.valid).toBe(false);
      expect(result.payload).toBeNull();
      expect(result.error).toBe('INVALID_TOKEN');
    });
  });
});
