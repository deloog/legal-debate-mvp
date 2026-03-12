/**
 * 使用量限制检查安全测试
 * 测试配额绕过防护等安全机制
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma
const mockPrisma = {
  userMembership: {
    findFirst: jest.fn(),
  },
  usageRecord: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  membershipTier: {
    findUnique: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock 认证
const mockGetAuthUser = jest.fn();

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: mockGetAuthUser,
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
  },
}));

import {
  enforceUsageLimit,
  checkUsageLimitForRequest,
  checkAndRecordUsage,
  validateUsageLimit,
} from '@/lib/middleware/check-usage-limit';

describe('Usage Limit Security Tests', () => {
  const testUser = { userId: 'user-123', role: 'USER' };
  const otherUser = { userId: 'user-456', role: 'USER' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createMockRequest(): NextRequest {
    return new NextRequest('http://localhost:3000/api/test', {
      headers: {
        Authorization: 'Bearer test-token',
      },
    });
  }

  describe('enforceUsageLimit - 配额绕过防护', () => {
    it('should always get userId from request, not from external parameter', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 10 }],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const request = createMockRequest();
      const middleware = enforceUsageLimit('CASE_CREATED', 1, false);

      // 中间件只接受 request 参数，不接受 userId 参数
      const result = await middleware(request);

      // 验证 getAuthUser 被调用，而不是使用外部传入的 userId
      expect(mockGetAuthUser).toHaveBeenCalledWith(request);
      expect(result).toBeNull(); // 检查通过返回 null
    });

    it('should reject when user is not authenticated', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = createMockRequest();
      const middleware = enforceUsageLimit('CASE_CREATED', 1, false);
      const result = await middleware(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(401);
    });

    it('should block usage when limit exceeded', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 5 }],
        },
      });
      // 已使用 5 次，达到限制
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 1 },
        { usageType: 'CASE_CREATED', quantity: 1 },
        { usageType: 'CASE_CREATED', quantity: 1 },
        { usageType: 'CASE_CREATED', quantity: 1 },
        { usageType: 'CASE_CREATED', quantity: 1 },
      ]);

      const request = createMockRequest();
      const middleware = enforceUsageLimit('CASE_CREATED', 1, false);
      const result = await middleware(request);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });

    it('should allow usage when within limit', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 10 }],
        },
      });
      // 已使用 3 次，未达限制
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 1 },
        { usageType: 'CASE_CREATED', quantity: 1 },
        { usageType: 'CASE_CREATED', quantity: 1 },
      ]);

      const request = createMockRequest();
      const middleware = enforceUsageLimit('CASE_CREATED', 1, false);
      const result = await middleware(request);

      expect(result).toBeNull();
    });

    it('should allow unlimited usage when limit is null', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [
            { limitType: 'MAX_CASES', limitValue: null }, // 无限制
          ],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const request = createMockRequest();
      const middleware = enforceUsageLimit('CASE_CREATED', 1, false);
      const result = await middleware(request);

      expect(result).toBeNull();
    });

    it('should auto-record usage when recordAfterCheck is true', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 10 }],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);
      mockPrisma.usageRecord.create.mockResolvedValue({ id: 'ur-123' });

      const request = createMockRequest();
      const middleware = enforceUsageLimit('CASE_CREATED', 1, true);
      await middleware(request);

      expect(mockPrisma.usageRecord.create).toHaveBeenCalled();
    });
  });

  describe('checkUsageLimitForRequest', () => {
    it('should return not allowed when user not authenticated', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = createMockRequest();
      const result = await checkUsageLimitForRequest(request, 'CASE_CREATED');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('未认证');
    });

    it('should return usage stats when within limit', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 10 }],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 3 },
      ]);

      const request = createMockRequest();
      // 不传递quantity时默认使用1，remaining计算的是扣除本次用量后的剩余
      const result = await checkUsageLimitForRequest(request, 'CASE_CREATED');

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(3);
      expect(result.limit).toBe(10);
      // remaining = limit - (currentUsage + quantity) = 10 - (3 + 1) = 6
      expect(result.remaining).toBe(6);
    });

    it('should return exceeded when usage over limit', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 5 }],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 5 },
      ]);

      const request = createMockRequest();
      const result = await checkUsageLimitForRequest(request, 'CASE_CREATED');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('使用量已超过限制');
    });
  });

  describe('checkAndRecordUsage', () => {
    it('should record usage after successful check', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 10 }],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);
      mockPrisma.usageRecord.create.mockResolvedValue({ id: 'ur-123' });

      const request = createMockRequest();
      const result = await checkAndRecordUsage(
        request,
        'CASE_CREATED',
        1,
        'case-123',
        'Case'
      );

      expect(result).toBeNull();
      expect(mockPrisma.usageRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: testUser.userId,
            usageType: 'CASE_CREATED',
            quantity: 1,
            resourceId: 'case-123',
            resourceType: 'Case',
          }),
        })
      );
    });

    it('should return error response when limit exceeded', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 1 }],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([
        { usageType: 'CASE_CREATED', quantity: 1 },
      ]);

      const request = createMockRequest();
      const result = await checkAndRecordUsage(request, 'CASE_CREATED');

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });
  });

  describe('validateUsageLimit', () => {
    it('should return null when within limit', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 10 }],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const request = createMockRequest();
      const result = await validateUsageLimit(request, 'CASE_CREATED');

      expect(result).toBeNull();
    });

    it('should return 429 response when limit exceeded', async () => {
      mockGetAuthUser.mockResolvedValue(testUser);
      mockPrisma.userMembership.findFirst.mockResolvedValue({
        id: 'm-123',
        tier: {
          tierLimits: [{ limitType: 'MAX_CASES', limitValue: 0 }],
        },
      });
      mockPrisma.usageRecord.findMany.mockResolvedValue([]);

      const request = createMockRequest();
      const result = await validateUsageLimit(request, 'CASE_CREATED', 1);

      expect(result).not.toBeNull();
      expect(result?.status).toBe(429);
    });
  });
});
