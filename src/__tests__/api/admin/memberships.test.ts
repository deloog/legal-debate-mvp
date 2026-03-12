/**
 * 会员管理API安全测试
 * 测试权限控制、输入验证等安全机制
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock Prisma
const mockPrisma = {
  userMembership: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  membershipTier: {
    findUnique: jest.fn(),
  },
  membershipHistory: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
};

jest.mock('@/lib/db/prisma', () => ({
  prisma: mockPrisma,
}));

// Mock 认证和权限
const mockGetAuthUser = jest.fn();
const mockValidatePermissions = jest.fn();

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: mockGetAuthUser,
}));

jest.mock('@/lib/middleware/permission-check', () => ({
  validatePermissions: mockValidatePermissions,
}));

// Mock 审计日志
const mockLogMembershipChange = jest.fn();

jest.mock('@/lib/membership/audit-logger', () => ({
  logMembershipChange: mockLogMembershipChange,
  logAuditEvent: jest.fn(),
}));

import { GET as GETMemberships } from '@/app/api/admin/memberships/route';
import { GET as GETMembership, PATCH } from '@/app/api/admin/memberships/[id]/route';

describe('Membership API Security Tests', () => {
  const adminUser = { userId: 'admin-123', role: 'ADMIN' };
  const regularUser = { userId: 'user-123', role: 'USER' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createMockRequest(url: string, options: { method?: string; body?: object; headers?: Record<string, string> } = {}): NextRequest {
    return new NextRequest(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  describe('GET /api/admin/memberships', () => {
    it('should reject unauthenticated requests', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/admin/memberships');
      const response = await GETMemberships(request);

      expect(response.status).toBe(401);
    });

    it('should reject requests without membership:read permission', async () => {
      mockGetAuthUser.mockResolvedValue(regularUser);
      mockValidatePermissions.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      );

      const request = createMockRequest('http://localhost:3000/api/admin/memberships');
      const response = await GETMemberships(request);

      expect(response.status).toBe(403);
    });

    it('should allow admin to list memberships', async () => {
      mockGetAuthUser.mockResolvedValue(adminUser);
      mockValidatePermissions.mockResolvedValue(null);
      mockPrisma.userMembership.findMany.mockResolvedValue([]);
      mockPrisma.userMembership.count.mockResolvedValue(0);

      const request = createMockRequest('http://localhost:3000/api/admin/memberships');
      const response = await GETMemberships(request);

      expect(response.status).toBe(200);
      expect(mockValidatePermissions).toHaveBeenCalledWith(expect.anything(), 'membership:read');
    });
  });

  describe('PATCH /api/admin/memberships/[id]', () => {
    it('should reject unauthenticated requests', async () => {
      mockGetAuthUser.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/admin/memberships/m-123', {
        method: 'PATCH',
        body: { status: 'SUSPENDED' },
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'm-123' }) });

      expect(response.status).toBe(401);
    });

    it('should reject requests without membership:write permission', async () => {
      mockGetAuthUser.mockResolvedValue(regularUser);
      mockValidatePermissions.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
      );

      const request = createMockRequest('http://localhost:3000/api/admin/memberships/m-123', {
        method: 'PATCH',
        body: { status: 'SUSPENDED' },
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'm-123' }) });

      expect(response.status).toBe(403);
    });

    it('should validate status enum values', async () => {
      mockGetAuthUser.mockResolvedValue(adminUser);
      mockValidatePermissions.mockResolvedValue(null);
      mockPrisma.userMembership.findUnique.mockResolvedValue({
        id: 'm-123',
        status: 'ACTIVE',
        tier: { tier: 'BASIC' },
      });

      const request = createMockRequest('http://localhost:3000/api/admin/memberships/m-123', {
        method: 'PATCH',
        body: { status: 'INVALID_STATUS' },
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'm-123' }) });

      expect(response.status).toBe(400);
    });

    it('should validate tierId exists', async () => {
      mockGetAuthUser.mockResolvedValue(adminUser);
      mockValidatePermissions.mockResolvedValue(null);
      mockPrisma.userMembership.findUnique.mockResolvedValue({
        id: 'm-123',
        status: 'ACTIVE',
        tierId: 'tier-1',
        tier: { tier: 'BASIC' },
      });
      mockPrisma.membershipTier.findUnique.mockResolvedValue(null);

      const request = createMockRequest('http://localhost:3000/api/admin/memberships/m-123', {
        method: 'PATCH',
        body: { tierId: 'non-existent-tier' },
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'm-123' }) });

      expect(response.status).toBe(400);
    });

    it('should record audit log on update', async () => {
      mockGetAuthUser.mockResolvedValue(adminUser);
      mockValidatePermissions.mockResolvedValue(null);
      mockPrisma.userMembership.findUnique.mockResolvedValue({
        id: 'm-123',
        status: 'ACTIVE',
        tierId: 'tier-1',
        tier: { tier: 'BASIC', name: 'Basic' },
        userId: 'user-456',
      });
      mockPrisma.userMembership.update.mockResolvedValue({
        id: 'm-123',
        status: 'SUSPENDED',
        tier: { tier: 'BASIC', name: 'Basic' },
        user: { email: 'test@test.com', name: 'Test', username: 'test' },
      });

      const request = createMockRequest('http://localhost:3000/api/admin/memberships/m-123', {
        method: 'PATCH',
        body: { status: 'SUSPENDED' },
      });
      const response = await PATCH(request, { params: Promise.resolve({ id: 'm-123' }) });

      expect(response.status).toBe(200);
      // 审计日志应在更新后被调用
      expect(mockLogMembershipChange).toHaveBeenCalled();
    });
  });
});
