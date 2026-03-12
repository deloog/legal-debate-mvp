/**
 * 权限检查中间件测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  checkPermissions,
  requirePermission,
  isValidPermissionName,
  PermissionCheckMode,
} from '@/lib/middleware/permission-check';
import type { NextRequest } from 'next/server';

// Mock Prisma 客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

// 类型断言 helper

const mockUserFindUnique = prisma.user.findUnique as jest.Mock<any>;

const mockRoleFindUnique = prisma.role.findUnique as jest.Mock<any>;

// 重置所有 mock
beforeEach(() => {
  jest.clearAllMocks();
});

describe('权限检查中间件', () => {
  describe('checkPermissions', () => {
    it('应该通过超级管理员的权限检查', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'SUPER_ADMIN',
        permissions: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await checkPermissions('user-123', ['case:create']);

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe('case:create');
    });

    it('应该正确检查用户权限（ALL模式）', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'USER',
        permissions: null,
      };

      const mockRole = {
        id: 'role-123',
        name: 'USER',
        description: '普通用户',
        isDefault: true,
        permissions: [
          {
            id: 'rp-1',
            roleId: 'role-123',
            permissionId: 'perm-1',
            createdAt: new Date(),
            permission: {
              id: 'perm-1',
              name: 'case:read',
              description: '查看案件',
              resource: 'case',
              action: 'read',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      mockUserFindUnique.mockResolvedValueOnce(mockUser);
      mockRoleFindUnique.mockResolvedValueOnce(mockRole);

      const result = await checkPermissions('user-123', ['case:read']);

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe('case:read');
    });

    it('应该拒绝没有权限的请求（ALL模式）', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'USER',
        permissions: null,
      };

      const mockRole = {
        id: 'role-123',
        name: 'USER',
        description: '普通用户',
        isDefault: true,
        permissions: [
          {
            id: 'rp-1',
            roleId: 'role-123',
            permissionId: 'perm-1',
            createdAt: new Date(),
            permission: {
              id: 'perm-1',
              name: 'case:read',
              description: '查看案件',
              resource: 'case',
              action: 'read',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      mockUserFindUnique.mockResolvedValueOnce(mockUser);
      mockRoleFindUnique.mockResolvedValueOnce(mockRole);

      const result = await checkPermissions('user-123', ['case:create']);

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('角色缺少该权限');
    });

    it('应该支持ANY模式（满足任意一个权限）', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'USER',
        permissions: null,
      };

      const mockRole = {
        id: 'role-123',
        name: 'USER',
        description: '普通用户',
        isDefault: true,
        permissions: [
          {
            id: 'rp-1',
            roleId: 'role-123',
            permissionId: 'perm-1',
            createdAt: new Date(),
            permission: {
              id: 'perm-1',
              name: 'case:read',
              description: '查看案件',
              resource: 'case',
              action: 'read',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      mockUserFindUnique.mockResolvedValueOnce(mockUser);
      mockRoleFindUnique.mockResolvedValueOnce(mockRole);

      const result = await checkPermissions(
        'user-123',
        ['case:create', 'case:read'],
        {
          mode: PermissionCheckMode.ANY,
        }
      );

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe('case:read');
    });
  });

  describe('requirePermission 中间件', () => {
    it('应该返回null表示有权限', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'SUPER_ADMIN',
        permissions: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      const middleware = requirePermission('case:create');
      const request = {} as unknown as NextRequest;
      const result = await middleware(request, 'user-123');

      expect(result).toBeNull();
    });

    it('应该返回403响应当无权限', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'USER',
        permissions: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      const middleware = requirePermission('case:create');
      const request = {} as unknown as NextRequest;
      const result = await middleware(request, 'user-123');

      expect(result).not.toBeNull();
      // result 是 Response 对象
      const jsonResponse = JSON.parse(
        JSON.stringify(await (result as unknown as Response).json())
      );
      expect(jsonResponse.error).toBe('权限不足');
    });
  });

  describe('辅助函数', () => {
    it('应该验证有效的权限名称', () => {
      expect(isValidPermissionName('case:create')).toBe(true);
      expect(isValidPermissionName('user:read')).toBe(true);
      expect(isValidPermissionName('debate:update')).toBe(true);
    });

    it('应该拒绝无效的权限名称', () => {
      expect(isValidPermissionName('invalid')).toBe(false);
      expect(isValidPermissionName('Case:Create')).toBe(false);
      expect(isValidPermissionName('case:create:extra')).toBe(false);
      expect(isValidPermissionName('')).toBe(false);
    });
  });
});
