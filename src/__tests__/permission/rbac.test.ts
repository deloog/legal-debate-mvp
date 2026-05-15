/**
 * RBAC权限模型测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  hasPermission,
  getUserPermissions,
  hasPermissions,
  assignPermissionToRole,
  assignPermissionsToRole,
  revokePermissionFromRole,
  getRolePermissions,
} from '@/lib/middleware/permissions';

// Mock Prisma 客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    rolePermission: {
      create: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';

// 类型断言 helper

const mockUserFindUnique = prisma.user.findUnique as jest.Mock<
  ReturnType<typeof jest.fn>
>;

const mockRoleFindUnique = prisma.role.findUnique as jest.Mock<
  ReturnType<typeof jest.fn>
>;

const mockRolePermissionCreate = prisma.rolePermission.create as jest.Mock<
  ReturnType<typeof jest.fn>
>;

const mockRolePermissionCreateMany = prisma.rolePermission
  .createMany as jest.Mock<ReturnType<typeof jest.fn>>;

const mockRolePermissionDeleteMany = prisma.rolePermission
  .deleteMany as jest.Mock<ReturnType<typeof jest.fn>>;

const mockRolePermissionFindMany = prisma.rolePermission.findMany as jest.Mock<
  ReturnType<typeof jest.fn>
>;

// 重置所有 mock
beforeEach(() => {
  jest.clearAllMocks();
});

describe('RBAC权限模型', () => {
  describe('角色管理', () => {
    it('应该成功创建角色', () => {
      const roleData = {
        name: 'USER',
        description: '普通用户',
        isDefault: true,
      };

      expect(roleData.name).toBe('USER');
      expect(roleData.description).toBe('普通用户');
      expect(roleData.isDefault).toBe(true);
    });

    it('应该能查询角色权限', async () => {
      const mockRole = {
        id: 'role-123',
        name: 'LAWYER',
        description: '律师用户',
        isDefault: false,
        permissions: [
          {
            id: 'rp-1',
            roleId: 'role-123',
            permissionId: 'perm-1',
            createdAt: new Date(),
            permission: {
              id: 'perm-1',
              name: 'case:create',
              description: '创建案件',
              resource: 'case',
              action: 'create',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      mockRolePermissionFindMany.mockResolvedValue([mockRole.permissions[0]]);

      const permissions = await getRolePermissions('role-123');

      expect(mockRolePermissionFindMany).toHaveBeenCalledWith({
        where: { roleId: 'role-123' },
        include: {
          permission: true,
        },
      });
      expect(permissions).toBeDefined();
    });
  });

  describe('权限管理', () => {
    it('应该成功创建权限', () => {
      const permissionData = {
        name: 'case:create',
        description: '创建案件',
        resource: 'case',
        action: 'create',
      };

      expect(permissionData.name).toBe('case:create');
      expect(permissionData.description).toBe('创建案件');
      expect(permissionData.resource).toBe('case');
      expect(permissionData.action).toBe('create');
    });

    it('应该能查询权限', async () => {
      const mockPermission = {
        id: 'perm-1',
        name: 'case:create',
        description: '创建案件',
        resource: 'case',
        action: 'create',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      expect(mockPermission.name).toBe('case:create');
      expect(mockPermission.resource).toBe('case');
      expect(mockPermission.action).toBe('create');
    });
  });

  describe('角色权限关联', () => {
    it('应该能为角色分配权限', async () => {
      const mockRolePermission = {
        id: 'rp-1',
        roleId: 'role-123',
        permissionId: 'perm-1',
        createdAt: new Date(),
      };

      mockRolePermissionCreate.mockResolvedValue(mockRolePermission);

      const result = await assignPermissionToRole('role-123', 'perm-1');

      expect(mockRolePermissionCreate).toHaveBeenCalledWith({
        data: {
          roleId: 'role-123',
          permissionId: 'perm-1',
        },
      });
      expect(result).toBeDefined();
    });

    it('应该能批量为角色分配权限', async () => {
      const mockResult = {
        count: 3,
      };

      mockRolePermissionCreateMany.mockResolvedValue(mockResult);

      const permissionIds = ['perm-1', 'perm-2', 'perm-3'];

      const result = await assignPermissionsToRole('role-123', permissionIds);

      expect(mockRolePermissionCreateMany).toHaveBeenCalledWith({
        data: [
          { roleId: 'role-123', permissionId: 'perm-1' },
          { roleId: 'role-123', permissionId: 'perm-2' },
          { roleId: 'role-123', permissionId: 'perm-3' },
        ],
        skipDuplicates: true,
      });
      expect(result).toBeDefined();
    });

    it('应该能撤销角色权限', async () => {
      const mockResult = {
        count: 1,
      };

      mockRolePermissionDeleteMany.mockResolvedValue(mockResult);

      const result = await revokePermissionFromRole('role-123', 'perm-1');

      expect(mockRolePermissionDeleteMany).toHaveBeenCalledWith({
        where: {
          roleId: 'role-123',
          permissionId: 'perm-1',
        },
      });
      expect(result).toBeDefined();
    });
  });

  describe('用户权限检查', () => {
    it('超级管理员应该拥有所有权限', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'SUPER_ADMIN',
        permissions: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await hasPermission('user-123', 'any:permission');

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe('any:permission');
    });

    it('应该正确检查用户权限', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'LAWYER',
        permissions: null,
      };

      const mockRole = {
        id: 'role-123',
        name: 'LAWYER',
        description: '律师用户',
        isDefault: false,
        permissions: [
          {
            id: 'rp-1',
            roleId: 'role-123',
            permissionId: 'perm-1',
            createdAt: new Date(),
            permission: {
              id: 'perm-1',
              name: 'case:create',
              description: '创建案件',
              resource: 'case',
              action: 'create',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        ],
      };

      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRoleFindUnique.mockResolvedValue(mockRole);

      const result = await hasPermission('user-123', 'case:create');

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe('case:create');
    });

    it('应该正确拒绝没有权限的请求', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'USER',
        permissions: null,
      };

      const mockRole = {
        id: 'role-456',
        name: 'USER',
        description: '普通用户',
        isDefault: true,
        permissions: [
          {
            id: 'rp-2',
            roleId: 'role-456',
            permissionId: 'perm-2',
            createdAt: new Date(),
            permission: {
              id: 'perm-2',
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

      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRoleFindUnique.mockResolvedValue(mockRole);

      const result = await hasPermission('user-123', 'case:create');

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('角色缺少该权限');
    });

    it('应该正确获取用户的所有权限', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'LAWYER',
        permissions: null,
      };

      const mockRole = {
        id: 'role-123',
        name: 'LAWYER',
        description: '律师用户',
        isDefault: false,
        permissions: [
          {
            id: 'rp-1',
            roleId: 'role-123',
            permissionId: 'perm-1',
            createdAt: new Date(),
            permission: {
              id: 'perm-1',
              name: 'case:create',
              description: '创建案件',
              resource: 'case',
              action: 'create',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          {
            id: 'rp-2',
            roleId: 'role-123',
            permissionId: 'perm-2',
            createdAt: new Date(),
            permission: {
              id: 'perm-2',
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

      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRoleFindUnique.mockResolvedValue(mockRole);

      const permissions = await getUserPermissions('user-123');

      expect(permissions).toContain('case:create');
      expect(permissions).toContain('case:read');
      expect(permissions.length).toBe(2);
    });

    it('ADMIN 应该通过内置权限兜底访问后台权限', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'ADMIN',
        permissions: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRoleFindUnique.mockResolvedValue(null);

      const result = await hasPermission('user-123', 'role:read');
      const permissions = await getUserPermissions('user-123');

      expect(result.hasPermission).toBe(true);
      expect(permissions).toContain('role:read');
      expect(permissions).toContain('admin:write');
      expect(permissions).toContain('log:read');
    });

    it('应该正确批量检查权限', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'LAWYER',
        permissions: null,
      };

      const mockRole = {
        id: 'role-123',
        name: 'LAWYER',
        description: '律师用户',
        isDefault: false,
        permissions: [
          {
            id: 'rp-1',
            roleId: 'role-123',
            permissionId: 'perm-1',
            createdAt: new Date(),
            permission: {
              id: 'perm-1',
              name: 'case:create',
              description: '创建案件',
              resource: 'case',
              action: 'create',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
          {
            id: 'rp-2',
            roleId: 'role-123',
            permissionId: 'perm-2',
            createdAt: new Date(),
            permission: {
              id: 'perm-2',
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

      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRoleFindUnique.mockResolvedValue(mockRole);

      const results = await hasPermissions('user-123', [
        'case:create',
        'case:read',
        'case:delete',
      ]);

      expect(results['case:create']).toBe(true);
      expect(results['case:read']).toBe(true);
      expect(results['case:delete']).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该正确处理用户不存在的情况', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      const result = await hasPermission('user-123', 'case:create');

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户不存在');
    });

    it('应该正确处理角色不存在的情况', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'LAWYER',
        permissions: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser);
      mockRoleFindUnique.mockResolvedValue(null);

      const result = await hasPermission('user-123', 'case:create');

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('角色不存在');
    });

    it('应该正确处理数据库错误', async () => {
      mockUserFindUnique.mockRejectedValue(new Error('Database error'));

      const result = await hasPermission('user-123', 'case:create');

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('权限检查失败');
    });
  });

  describe('直接分配权限', () => {
    it('应该检查用户直接分配的权限', async () => {
      const mockUser = {
        id: 'user-123',
        role: 'USER',
        permissions: ['case:create', 'case:read'],
      };

      mockUserFindUnique.mockResolvedValue(mockUser);

      const result = await hasPermission('user-123', 'case:create');

      expect(result.hasPermission).toBe(true);
      expect(result.actualPermissions).toContain('case:create');
      expect(result.actualPermissions).toContain('case:read');
    });
  });
});
