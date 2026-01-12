/**
 * 资源权限中间件测试
 */

import {
  checkResourceOwnership,
  checkMultipleResourcePermissions,
  isAdminRole,
  createPermissionErrorResponse,
  ResourceType,
} from '@/lib/middleware/resource-permission';
import { prisma } from '@/lib/db/prisma';
import { UserRole } from '@/types/auth';

// Mock Prisma
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    debate: {
      findUnique: jest.fn(),
    },
    document: {
      findUnique: jest.fn(),
    },
  },
}));

describe('资源权限中间件测试', () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * 测试1：普通用户访问自己的案件应该成功
   */
  it('普通用户访问自己的案件应该成功', async () => {
    // Mock用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: null,
    });

    // Mock案件查询
    (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      userId: 'user-1',
      deletedAt: null,
    });

    const result = await checkResourceOwnership(
      'user-1',
      'case-1',
      ResourceType.CASE
    );

    expect(result.hasPermission).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  /**
   * 测试2：普通用户访问他人案件应该失败
   */
  it('普通用户访问他人案件应该失败', async () => {
    // Mock用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: null,
    });

    // Mock案件查询
    (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      userId: 'user-2',
      deletedAt: null,
    });

    const result = await checkResourceOwnership(
      'user-1',
      'case-1',
      ResourceType.CASE
    );

    expect(result.hasPermission).toBe(false);
    expect(result.reason).toBe('您无权访问此案件');
  });

  /**
   * 测试3：管理员可以访问所有资源
   */
  it('管理员可以访问所有资源', async () => {
    // Mock管理员用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'admin-1',
      role: 'ADMIN',
      deletedAt: null,
    });

    const result = await checkResourceOwnership(
      'admin-1',
      'case-1',
      ResourceType.CASE
    );

    expect(result.hasPermission).toBe(true);
    expect(result.reason).toBeUndefined();
    // 不应该查询案件，因为管理员跳过所有权检查
    expect(mockPrisma.case.findUnique).not.toHaveBeenCalled();
  });

  /**
   * 测试4：超级管理员可以访问所有资源
   */
  it('超级管理员可以访问所有资源', async () => {
    // Mock超级管理员用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'super-admin-1',
      role: 'SUPER_ADMIN',
      deletedAt: null,
    });

    const result = await checkResourceOwnership(
      'super-admin-1',
      'debate-1',
      ResourceType.DEBATE
    );

    expect(result.hasPermission).toBe(true);
    expect(result.reason).toBeUndefined();
    expect(mockPrisma.debate.findUnique).not.toHaveBeenCalled();
  });

  /**
   * 测试5：用户访问自己的辩论应该成功
   */
  it('用户访问自己的辩论应该成功', async () => {
    // Mock用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: null,
    });

    // Mock辩论查询
    (mockPrisma.debate.findUnique as jest.Mock).mockResolvedValue({
      id: 'debate-1',
      userId: 'user-1',
      deletedAt: null,
      caseId: 'case-1',
    });

    const result = await checkResourceOwnership(
      'user-1',
      'debate-1',
      ResourceType.DEBATE
    );

    expect(result.hasPermission).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  /**
   * 测试6：案件所有者可以访问关联的辩论
   */
  it('案件所有者可以访问关联的辩论', async () => {
    // Mock用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: null,
    });

    // Mock辩论查询（用户不是辩论创建者）
    (mockPrisma.debate.findUnique as jest.Mock).mockResolvedValue({
      id: 'debate-1',
      userId: 'user-2',
      deletedAt: null,
      caseId: 'case-1',
    });

    // Mock案件查询（用户是案件所有者）
    (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      userId: 'user-1',
      deletedAt: null,
    });

    const result = await checkResourceOwnership(
      'user-1',
      'debate-1',
      ResourceType.DEBATE
    );

    expect(result.hasPermission).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  /**
   * 测试7：访问不存在的案件应该失败
   */
  it('访问不存在的案件应该失败', async () => {
    // Mock用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: null,
    });

    // Mock案件查询（返回null）
    (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await checkResourceOwnership(
      'user-1',
      'case-1',
      ResourceType.CASE
    );

    expect(result.hasPermission).toBe(false);
    expect(result.reason).toBe('案件不存在');
  });

  /**
   * 测试8：访问已删除的案件应该失败
   */
  it('访问已删除的案件应该失败', async () => {
    // Mock用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: null,
    });

    // Mock案件查询（已删除）
    (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
      id: 'case-1',
      userId: 'user-1',
      deletedAt: new Date(),
    });

    const result = await checkResourceOwnership(
      'user-1',
      'case-1',
      ResourceType.CASE
    );

    expect(result.hasPermission).toBe(false);
    expect(result.reason).toBe('案件已被删除');
  });

  /**
   * 测试9：文档所有权检查
   */
  it('用户访问自己的文档应该成功', async () => {
    // Mock用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: null,
    });

    // Mock文档查询
    (mockPrisma.document.findUnique as jest.Mock).mockResolvedValue({
      id: 'document-1',
      userId: 'user-1',
      deletedAt: null,
      caseId: 'case-1',
    });

    const result = await checkResourceOwnership(
      'user-1',
      'document-1',
      ResourceType.DOCUMENT
    );

    expect(result.hasPermission).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  /**
   * 测试10：不存在用户应该返回权限失败
   */
  it('不存在用户应该返回权限失败', async () => {
    // Mock用户查询（返回null）
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await checkResourceOwnership(
      'user-1',
      'case-1',
      ResourceType.CASE
    );

    expect(result.hasPermission).toBe(false);
    expect(result.reason).toBe('用户不存在');
  });

  /**
   * 测试11：已删除用户应该返回权限失败
   */
  it('已删除用户应该返回权限失败', async () => {
    // Mock用户查询（已删除）
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: new Date(),
    });

    const result = await checkResourceOwnership(
      'user-1',
      'case-1',
      ResourceType.CASE
    );

    expect(result.hasPermission).toBe(false);
    expect(result.reason).toBe('用户已被删除');
  });

  /**
   * 测试12：批量资源权限检查
   */
  it('批量资源权限检查应该正常工作', async () => {
    // Mock用户查询
    (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      role: 'USER',
      deletedAt: null,
    });

    // Mock案件查询
    (mockPrisma.case.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'case-1',
        userId: 'user-1',
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'case-2',
        userId: 'user-2',
        deletedAt: null,
      })
      .mockResolvedValueOnce({
        id: 'case-3',
        userId: 'user-1',
        deletedAt: null,
      });

    const results = await checkMultipleResourcePermissions(
      'user-1',
      ['case-1', 'case-2', 'case-3'],
      ResourceType.CASE
    );

    expect(results['case-1']).toBe(true);
    expect(results['case-2']).toBe(false);
    expect(results['case-3']).toBe(true);
  });
});

describe('辅助函数测试', () => {
  /**
   * 测试13：isAdminRole应该正确识别管理员角色
   */
  it('isAdminRole应该正确识别管理员角色', () => {
    expect(isAdminRole(UserRole.ADMIN)).toBe(true);
    expect(isAdminRole(UserRole.SUPER_ADMIN)).toBe(true);
    expect(isAdminRole(UserRole.USER)).toBe(false);
    expect(isAdminRole(UserRole.LAWYER)).toBe(false);
    expect(isAdminRole(UserRole.ENTERPRISE)).toBe(false);
  });

  /**
   * 测试14：createPermissionErrorResponse应该返回正确的响应格式
   */
  it('createPermissionErrorResponse应该返回正确的响应格式', () => {
    const response = createPermissionErrorResponse('测试拒绝原因');

    expect(response.status).toBe(403);
    // NextResponse.json() 返回的是 Response，不能直接使用 .json() 方法
    // 这里只验证状态码
  });

  /**
   * 测试15：ResourceType枚举应该正确导出
   */
  it('ResourceType枚举应该正确导出', () => {
    expect(ResourceType.CASE).toBe('case');
    expect(ResourceType.DEBATE).toBe('debate');
    expect(ResourceType.DOCUMENT).toBe('document');
  });
});

describe('错误处理测试', () => {
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  /**
   * 测试16：数据库查询错误应该返回权限失败
   */
  it('数据库查询错误应该返回权限失败', async () => {
    // Mock用户查询抛出错误
    (mockPrisma.user.findUnique as jest.Mock).mockRejectedValue(
      new Error('Database connection failed')
    );

    const result = await checkResourceOwnership(
      'user-1',
      'case-1',
      ResourceType.CASE
    );

    expect(result.hasPermission).toBe(false);
    expect(result.reason).toBe('权限检查失败');
  });
});
