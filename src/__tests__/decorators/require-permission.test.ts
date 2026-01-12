/**
 * 权限装饰器测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  RequirePermission,
  RequireAnyPermission,
  RequireAllPermissions,
  PermissionChecker,
  createPermissionChecker,
} from '@/lib/decorators/require-permission';

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUserFindUnique = prisma.user.findUnique as jest.Mock<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockRoleFindUnique = prisma.role.findUnique as jest.Mock<any>;

// 重置所有 mock
beforeEach(() => {
  jest.clearAllMocks();
});

describe('RequirePermission', () => {
  it('应该创建装饰器函数', () => {
    const decorator = RequirePermission('case:create');

    // 验证装饰器类型
    expect(typeof decorator).toBe('function');
  });

  it('应该支持skip选项', () => {
    const decorator = RequirePermission('case:create', { skip: true });

    // 验证装饰器类型
    expect(typeof decorator).toBe('function');
  });
});

describe('RequireAnyPermission', () => {
  it('应该创建任意权限装饰器', () => {
    const decorator = RequireAnyPermission(['case:create', 'case:read']);

    // 验证装饰器类型
    expect(typeof decorator).toBe('function');
  });
});

describe('RequireAllPermissions', () => {
  it('应该创建所有权限装饰器', () => {
    const decorator = RequireAllPermissions(['case:read', 'case:create']);

    // 验证装饰器类型
    expect(typeof decorator).toBe('function');
  });
});

describe('PermissionChecker', () => {
  it('应该支持链式API', async () => {
    const mockUser = {
      id: 'user-123',
      role: 'SUPER_ADMIN',
      permissions: null,
    };

    mockUserFindUnique.mockResolvedValue(mockUser);

    const checker = new PermissionChecker();
    const result = await checker
      .permission('case:create')
      .permission('case:read')
      .check('user-123');

    expect(result.hasPermission).toBe(true);
  });

  it('应该支持批量添加权限', async () => {
    const mockUser = {
      id: 'user-123',
      role: 'SUPER_ADMIN',
      permissions: null,
    };

    mockUserFindUnique.mockResolvedValue(mockUser);

    const checker = new PermissionChecker();
    const result = await checker
      .addPermissions(['case:create', 'case:read'])
      .check('user-123');

    expect(result.hasPermission).toBe(true);
  });

  it('应该支持any模式', async () => {
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

    const checker = new PermissionChecker();
    const result = await checker
      .addPermissions(['case:create', 'case:read'])
      .any()
      .check('user-123');

    expect(result.hasPermission).toBe(true);
  });

  it('应该支持跳过检查', async () => {
    const checker = new PermissionChecker();
    const result = await checker
      .permission('case:create')
      .skipCheck()
      .check('user-123');

    expect(result.hasPermission).toBe(true);
  });

  it('应该创建装饰器', () => {
    const checker = new PermissionChecker();
    const decorator = checker.permission('case:create').asDecorator();

    // 验证装饰器类型
    expect(typeof decorator).toBe('function');
  });
});

describe('createPermissionChecker', () => {
  it('应该创建权限检查器', async () => {
    const mockUser = {
      id: 'user-123',
      role: 'SUPER_ADMIN',
      permissions: null,
    };

    mockUserFindUnique.mockResolvedValue(mockUser);

    const checker = createPermissionChecker(['case:create']);
    const result = await checker.check('user-123');

    expect(result.hasPermission).toBe(true);
  });

  it('应该创建空的权限检查器', async () => {
    const checker = createPermissionChecker();
    const result = await checker.check('user-123');

    expect(result.hasPermission).toBe(true);
  });
});
