/**
 * 团队权限继承功能测试
 */

import {
  clearAllPermissionCache,
  clearUserPermissionCache,
  getTeamRolePermissions,
  getUserAllTeamPermissions,
  getUserTeamPermissions,
  getUserEffectivePermissions,
  hasAnyTeamPermission,
  hasTeamPermission,
  setTeamMemberCustomPermissions,
} from '@/lib/team/permission-inheritance';
import { TeamRole } from '@prisma/client';
import { TEAM_PERMISSIONS, CASE_PERMISSIONS } from '@/types/permission';

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    teamMember: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '@/lib/db/prisma';

const prismaMock = prisma as unknown as {
  teamMember: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  user: {
    findUnique: jest.Mock;
  };
  role: {
    findUnique: jest.Mock;
  };
};

describe('团队权限继承', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllPermissionCache();
  });

  describe('getTeamRolePermissions', () => {
    it('应该返回团队管理员的完整权限', () => {
      const permissions = getTeamRolePermissions(TeamRole.ADMIN);
      expect(permissions).toContain(TEAM_PERMISSIONS.MANAGE);
      expect(permissions).toContain(TEAM_PERMISSIONS.MEMBER_ADD);
      expect(permissions).toContain(CASE_PERMISSIONS.CREATE);
      expect(permissions).toContain(CASE_PERMISSIONS.DELETE);
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('应该返回律师的权限', () => {
      const permissions = getTeamRolePermissions(TeamRole.LAWYER);
      expect(permissions).toContain(TEAM_PERMISSIONS.READ);
      expect(permissions).toContain(CASE_PERMISSIONS.CREATE);
      expect(permissions).toContain(CASE_PERMISSIONS.UPDATE);
      expect(permissions).not.toContain(TEAM_PERMISSIONS.MANAGE);
    });

    it('应该返回律师助理的只读权限', () => {
      const permissions = getTeamRolePermissions(TeamRole.PARALEGAL);
      expect(permissions).toContain(TEAM_PERMISSIONS.READ);
      expect(permissions).toContain(CASE_PERMISSIONS.READ);
      expect(permissions).not.toContain(CASE_PERMISSIONS.CREATE);
      expect(permissions).not.toContain(CASE_PERMISSIONS.UPDATE);
    });

    it('应该返回其他角色的只读权限', () => {
      const permissions = getTeamRolePermissions(TeamRole.OTHER);
      expect(permissions).toContain(TEAM_PERMISSIONS.READ);
      expect(permissions).toContain(CASE_PERMISSIONS.READ);
      expect(permissions).not.toContain(CASE_PERMISSIONS.CREATE);
    });

    it('对于未知角色应该返回空数组', () => {
      const permissions = getTeamRolePermissions('UNKNOWN' as TeamRole);
      expect(permissions).toEqual([]);
    });
  });

  describe('getUserTeamPermissions', () => {
    const mockUserId = 'user123';
    const mockTeamId = 'team123';

    it('应该返回活跃用户的团队权限', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({
        role: TeamRole.LAWYER,
        status: 'ACTIVE',
        metadata: null,
      });

      const permissions = await getUserTeamPermissions(mockUserId, mockTeamId);

      expect(permissions).toContain(CASE_PERMISSIONS.READ);
      expect(prismaMock.teamMember.findUnique).toHaveBeenCalledWith({
        where: {
          teamId_userId: { teamId: mockTeamId, userId: mockUserId },
        },
        select: { role: true, status: true, metadata: true },
      });
    });

    it('应该合并自定义权限', async () => {
      const customPermissions = [TEAM_PERMISSIONS.MANAGE];
      prismaMock.teamMember.findUnique.mockResolvedValue({
        role: TeamRole.LAWYER,
        status: 'ACTIVE',
        metadata: { customPermissions },
      });

      const permissions = await getUserTeamPermissions(mockUserId, mockTeamId);

      expect(permissions).toContain(TEAM_PERMISSIONS.READ);
      expect(permissions).toContain(TEAM_PERMISSIONS.MANAGE);
    });

    it('对于非活跃成员应该返回空数组', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({
        role: TeamRole.LAWYER,
        status: 'INACTIVE',
        metadata: null,
      });

      const permissions = await getUserTeamPermissions(mockUserId, mockTeamId);

      expect(permissions).toEqual([]);
    });

    it('对于不存在的成员应该返回空数组', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue(null);

      const permissions = await getUserTeamPermissions(mockUserId, mockTeamId);

      expect(permissions).toEqual([]);
    });

    it('应该在出错时返回空数组', async () => {
      prismaMock.teamMember.findUnique.mockRejectedValue(
        new Error('Database error')
      );

      const permissions = await getUserTeamPermissions(mockUserId, mockTeamId);

      expect(permissions).toEqual([]);
    });
  });

  describe('getUserAllTeamPermissions', () => {
    const mockUserId = 'user123';

    it('应该返回用户在所有团队中的权限', async () => {
      prismaMock.teamMember.findMany.mockResolvedValue([
        { role: TeamRole.ADMIN, metadata: null },
        { role: TeamRole.LAWYER, metadata: null },
      ]);

      const permissions = await getUserAllTeamPermissions(mockUserId);

      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions).toContain(TEAM_PERMISSIONS.MANAGE);
    });

    it('应该使用缓存', async () => {
      prismaMock.teamMember.findMany.mockResolvedValue([
        { role: TeamRole.LAWYER, metadata: null },
      ]);

      // 第一次调用
      await getUserAllTeamPermissions(mockUserId);
      // 第二次调用应该使用缓存
      await getUserAllTeamPermissions(mockUserId);

      expect(prismaMock.teamMember.findMany).toHaveBeenCalledTimes(1);
    });

    it('对于没有团队成员的用户应该返回空数组', async () => {
      prismaMock.teamMember.findMany.mockResolvedValue([]);

      const permissions = await getUserAllTeamPermissions(mockUserId);

      expect(permissions).toEqual([]);
    });

    it('应该在出错时返回空数组', async () => {
      prismaMock.teamMember.findMany.mockRejectedValue(
        new Error('Database error')
      );

      const permissions = await getUserAllTeamPermissions(mockUserId);

      expect(permissions).toEqual([]);
    });
  });

  describe('clearUserPermissionCache', () => {
    it('应该清除用户的权限缓存', async () => {
      prismaMock.teamMember.findMany.mockResolvedValue([
        { role: TeamRole.LAWYER, metadata: null },
      ]);

      // 首次获取权限，应该查询数据库
      await getUserAllTeamPermissions('user123');
      expect(prismaMock.teamMember.findMany).toHaveBeenCalledTimes(1);

      // 清除缓存
      clearUserPermissionCache('user123');

      // 再次获取权限，应该再次查询数据库
      await getUserAllTeamPermissions('user123');
      expect(prismaMock.teamMember.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearAllPermissionCache', () => {
    it('应该清除所有权限缓存', async () => {
      prismaMock.teamMember.findMany.mockResolvedValue([
        { role: TeamRole.LAWYER, metadata: null },
      ]);

      // 首次获取权限
      await getUserAllTeamPermissions('user123');
      expect(prismaMock.teamMember.findMany).toHaveBeenCalledTimes(1);

      // 清除所有缓存
      clearAllPermissionCache();

      // 再次获取权限
      await getUserAllTeamPermissions('user123');
      expect(prismaMock.teamMember.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('setTeamMemberCustomPermissions', () => {
    const mockTeamId = 'team123';
    const mockUserId = 'user123';

    it('应该成功设置自定义权限', async () => {
      prismaMock.teamMember.update.mockResolvedValue({});

      const result = await setTeamMemberCustomPermissions(
        mockTeamId,
        mockUserId,
        [TEAM_PERMISSIONS.MANAGE]
      );

      expect(result).toBe(true);
      expect(prismaMock.teamMember.update).toHaveBeenCalledWith({
        where: {
          teamId_userId: { teamId: mockTeamId, userId: mockUserId },
        },
        data: {
          metadata: { customPermissions: [TEAM_PERMISSIONS.MANAGE] },
        },
      });
    });

    it('应该在设置权限后清除缓存', async () => {
      prismaMock.teamMember.update.mockResolvedValue({});
      prismaMock.teamMember.findMany.mockResolvedValue([
        { role: TeamRole.LAWYER, metadata: null },
      ]);

      // 先获取权限并缓存
      await getUserAllTeamPermissions(mockUserId);

      // 设置自定义权限，应该清除缓存
      await setTeamMemberCustomPermissions(mockTeamId, mockUserId, [
        TEAM_PERMISSIONS.MANAGE,
      ]);

      // 再次获取权限，应该查询数据库
      await getUserAllTeamPermissions(mockUserId);
      expect(prismaMock.teamMember.findMany).toHaveBeenCalled();
    });

    it('应该在出错时返回false', async () => {
      prismaMock.teamMember.update.mockRejectedValue(
        new Error('Database error')
      );

      const result = await setTeamMemberCustomPermissions(
        mockTeamId,
        mockUserId,
        [TEAM_PERMISSIONS.MANAGE]
      );

      expect(result).toBe(false);
    });
  });

  describe('hasTeamPermission', () => {
    const mockUserId = 'user123';
    const mockTeamId = 'team123';

    it('应该返回用户是否有指定权限', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({
        role: TeamRole.ADMIN,
        status: 'ACTIVE',
        metadata: null,
      });

      const hasPermission = await hasTeamPermission(
        mockUserId,
        mockTeamId,
        CASE_PERMISSIONS.CREATE
      );

      expect(hasPermission).toBe(true);
    });

    it('对于没有权限的用户应该返回false', async () => {
      prismaMock.teamMember.findUnique.mockResolvedValue({
        role: TeamRole.PARALEGAL,
        status: 'ACTIVE',
        metadata: null,
      });

      const hasPermission = await hasTeamPermission(
        mockUserId,
        mockTeamId,
        CASE_PERMISSIONS.DELETE
      );

      expect(hasPermission).toBe(false);
    });
  });

  describe('hasAnyTeamPermission', () => {
    const mockUserId = 'user123';

    it('应该返回用户在任一团队中是否有指定权限', async () => {
      prismaMock.teamMember.findMany.mockResolvedValue([
        { role: TeamRole.ADMIN, metadata: null },
      ]);

      const hasPermission = await hasAnyTeamPermission(
        mockUserId,
        CASE_PERMISSIONS.CREATE
      );

      expect(hasPermission).toBe(true);
    });

    it('对于没有权限的用户应该返回false', async () => {
      prismaMock.teamMember.findMany.mockResolvedValue([]);

      const hasPermission = await hasAnyTeamPermission(
        mockUserId,
        CASE_PERMISSIONS.CREATE
      );

      expect(hasPermission).toBe(false);
    });
  });

  describe('getUserEffectivePermissions', () => {
    const mockUserId = 'user123';

    it('应该返回超级管理员的所有权限', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        role: 'SUPER_ADMIN',
        permissions: null,
      });

      const permissions = await getUserEffectivePermissions(mockUserId);

      expect(permissions).toEqual(['*']);
    });

    it('应该合并个人权限、团队权限和系统角色权限', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        role: 'USER',
        permissions: ['user:read'],
      });

      prismaMock.teamMember.findMany.mockResolvedValue([
        { role: TeamRole.LAWYER, metadata: null },
      ]);

      prismaMock.role.findUnique.mockResolvedValue({
        name: 'USER',
        permissions: [
          { permission: { name: 'case:read' } },
          { permission: { name: 'document:read' } },
        ],
      });

      const permissions = await getUserEffectivePermissions(mockUserId);

      expect(permissions).toContain('user:read');
      expect(permissions).toContain('case:read');
      expect(permissions).toContain('document:read');
    });

    it('对于不存在的用户应该返回空数组', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const permissions = await getUserEffectivePermissions(mockUserId);

      expect(permissions).toEqual([]);
    });

    it('应该在出错时返回空数组', async () => {
      prismaMock.user.findUnique.mockRejectedValue(new Error('Database error'));

      const permissions = await getUserEffectivePermissions(mockUserId);

      expect(permissions).toEqual([]);
    });

    it('应该去重权限列表', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        role: 'USER',
        permissions: ['user:read', 'case:read'],
      });

      prismaMock.teamMember.findMany.mockResolvedValue([
        { role: TeamRole.LAWYER, metadata: null },
      ]);

      prismaMock.role.findUnique.mockResolvedValue({
        name: 'USER',
        permissions: [
          { permission: { name: 'case:read' } },
          { permission: { name: 'document:read' } },
        ],
      });

      const permissions = await getUserEffectivePermissions(mockUserId);

      // case:read 出现在多个来源，但只应该出现一次
      const caseReadCount = permissions.filter(p => p === 'case:read').length;
      expect(caseReadCount).toBe(1);
    });
  });
});
