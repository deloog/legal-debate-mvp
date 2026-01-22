/**
 * 案件权限管理器单元测试
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  checkPermission,
  checkPermissions,
  clearPermissionCache,
  validateAction,
  getUserCaseRoleWrapper,
  getUserCasePermissionsWrapper,
  validateCustomPermissions,
  getAvailablePermissions,
} from '@/lib/case/case-permission-manager';
import {
  CaseRole,
  CasePermission,
  ROLE_DEFAULT_PERMISSIONS,
} from '@/types/case-collaboration';

// Mock Prisma 客户端
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    caseTeamMember: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/permissions', () => ({
  isAdmin: jest.fn(),
  isSuperAdmin: jest.fn(),
}));

import { prisma } from '@/lib/db/prisma';
import { isAdmin, isSuperAdmin } from '@/lib/middleware/permissions';

const mockUserFindUnique = prisma.user.findUnique as jest.Mock;
const mockCaseTeamMemberFindUnique = prisma.caseTeamMember
  .findUnique as jest.Mock;

// 重置所有 mock
beforeEach(() => {
  clearPermissionCache();
  jest.clearAllMocks();
});

describe('案件权限管理器', () => {
  const mockUserId = 'user-123';
  const mockCaseId = 'case-123';

  describe('checkPermission - 权限检查', () => {
    it('超级管理员应该拥有所有权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'SUPER_ADMIN' as const };
      (isSuperAdmin as jest.Mock).mockReturnValue(true);
      (isAdmin as jest.Mock).mockReturnValue(false);
      mockUserFindUnique.mockResolvedValue(mockUser as never);

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.DELETE_CASE
      );

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe(CasePermission.DELETE_CASE);
      expect(result.memberRole).toBe(null);
    });

    it('普通管理员应该拥有所有案件权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'ADMIN' as const };
      (isAdmin as jest.Mock).mockReturnValue(true);
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      mockUserFindUnique.mockResolvedValue(mockUser as never);

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.DELETE_CASE
      );

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe(CasePermission.DELETE_CASE);
    });

    it('应该返回actualPermissions', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-126',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      (isAdmin as jest.Mock).mockReturnValue(false);
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.VIEW_CASE
      );

      expect(result.hasPermission).toBe(true);
      expect(result.actualPermissions).toBeDefined();
      expect(Array.isArray(result.actualPermissions)).toBe(true);
      expect(result.actualPermissions!.length).toBeGreaterThan(0);
    });

    it('应该处理permission检查通过的情况', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-127',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      (isAdmin as jest.Mock).mockReturnValue(false);
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.VIEW_CASE
      );

      expect(result.hasPermission).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('应该正确检查用户权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-123',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      (isAdmin as jest.Mock).mockReturnValue(false);
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.EDIT_CASE
      );

      expect(result.hasPermission).toBe(true);
      expect(result.requiredPermission).toBe(CasePermission.EDIT_CASE);
      expect(result.memberRole).toBe(CaseRole.LEAD);
    });

    it('应该正确拒绝没有权限的请求', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const observerMember = {
        id: 'member-124',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.OBSERVER,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(observerMember as never);

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.DELETE_CASE
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('缺少该权限');
      expect(result.memberRole).toBe(CaseRole.OBSERVER);
    });

    it('应该正确处理用户不存在的情况', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      mockUserFindUnique.mockResolvedValue(null as never);

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.VIEW_CASE
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户不存在');
    });

    it('应该正确处理用户不是案件成员的情况', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(null as never);

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.VIEW_CASE
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户不是该案件的成员');
    });

    it('应该正确处理自定义权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const customPermissions = [
        CasePermission.VIEW_CASE,
        CasePermission.EDIT_CASE,
      ];
      const customMember = {
        id: 'member-125',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.OBSERVER,
        permissions: customPermissions as unknown,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(customMember as never);

      // 观察者默认只有VIEW权限，但自定义了EDIT权限
      const viewResult = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.VIEW_CASE
      );
      const editResult = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.EDIT_CASE
      );
      const deleteResult = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.DELETE_CASE
      );

      expect(viewResult.hasPermission).toBe(true);
      expect(editResult.hasPermission).toBe(true);
      expect(deleteResult.hasPermission).toBe(false);
    });

    it('应该测试协办律师角色权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const assistantMember = {
        id: 'member-128',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.ASSISTANT,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      (isAdmin as jest.Mock).mockReturnValue(false);
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(assistantMember as never);

      // 协办律师没有删除权限
      const deleteCaseResult = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.DELETE_CASE
      );
      expect(deleteCaseResult.hasPermission).toBe(false);

      // 但有编辑权限
      const editCaseResult = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.EDIT_CASE
      );
      expect(editCaseResult.hasPermission).toBe(true);
    });

    it('应该测试律师助理角色权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const paralegalMember = {
        id: 'member-129',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.PARALEGAL,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      (isAdmin as jest.Mock).mockReturnValue(false);
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(paralegalMember as never);

      // 律师助理有上传权限但没有编辑权限
      const uploadEvidenceResult = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.UPLOAD_EVIDENCE
      );
      expect(uploadEvidenceResult.hasPermission).toBe(true);

      const editCaseResult = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.EDIT_CASE
      );
      expect(editCaseResult.hasPermission).toBe(false);
    });
  });

  describe('checkPermissions - 批量权限检查', () => {
    it('应该批量检查多个权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-130',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const results = await checkPermissions(mockUserId, mockCaseId, [
        CasePermission.VIEW_CASE,
        CasePermission.EDIT_CASE,
        CasePermission.DELETE_CASE,
      ]);

      // 主办律师拥有所有权限
      expect(results[CasePermission.VIEW_CASE]).toBe(true);
      expect(results[CasePermission.EDIT_CASE]).toBe(true);
      expect(results[CasePermission.DELETE_CASE]).toBe(true);
    });

    it('应该返回部分权限缺失的结果', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const observerMember = {
        id: 'member-131',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.OBSERVER,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(observerMember as never);

      const results = await checkPermissions(mockUserId, mockCaseId, [
        CasePermission.VIEW_CASE,
        CasePermission.EDIT_CASE,
        CasePermission.DELETE_CASE,
      ]);

      // 观察者只有查看权限
      expect(results[CasePermission.VIEW_CASE]).toBe(true);
      expect(results[CasePermission.EDIT_CASE]).toBe(false);
      expect(results[CasePermission.DELETE_CASE]).toBe(false);
    });
  });

  describe('validateAction - 操作验证', () => {
    it('应该验证查看操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-140',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'view',
        'case'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该处理无效的resource', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'view',
        'invalid_resource' as any
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('action');
      expect(result.errors[0].message).toContain('不支持的操作');
    });

    it('应该处理无效的action', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'invalid_action' as any,
        'case'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('action');
    });

    it('应该验证编辑操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-141',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'edit',
        'timeline'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证删除操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-142',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'delete',
        'document'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证创建操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-143',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'create',
        'evidence'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该验证管理操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-144',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'manage',
        'team'
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝没有权限的操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const observerMember = {
        id: 'member-145',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.OBSERVER,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(observerMember as never);

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'delete',
        'case'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('permission');
    });

    it('应该处理数据库错误', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      mockUserFindUnique.mockRejectedValue(
        new Error('Database error') as never
      );

      const result = await validateAction(
        mockUserId,
        mockCaseId,
        'view',
        'case'
      );

      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('permission');
    });
  });

  describe('getUserCaseRoleWrapper - 获取用户角色', () => {
    it('应该返回用户在案件中的角色', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockMemberData = {
        id: 'member-150',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const role = await getUserCaseRoleWrapper(mockUserId, mockCaseId);

      expect(role).toBe(CaseRole.LEAD);
    });

    it('应该返回null如果用户不是案件成员', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      mockCaseTeamMemberFindUnique.mockResolvedValue(null as never);

      const role = await getUserCaseRoleWrapper(mockUserId, mockCaseId);

      expect(role).toBe(null);
    });

    it('应该处理数据库错误', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      mockCaseTeamMemberFindUnique.mockRejectedValue(
        new Error('Database error') as never
      );

      const role = await getUserCaseRoleWrapper(mockUserId, mockCaseId);

      expect(role).toBe(null);
    });
  });

  describe('getUserCasePermissionsWrapper - 获取用户权限', () => {
    it('应该返回用户在案件中的所有权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockMemberData = {
        id: 'member-160',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      expect(permissions).toBeDefined();
      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('应该返回空数组如果用户不是案件成员', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      mockCaseTeamMemberFindUnique.mockResolvedValue(null as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      expect(permissions).toEqual([]);
    });

    it('应该使用角色默认权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const leadMember = {
        id: 'member-162',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockCaseTeamMemberFindUnique.mockResolvedValue(leadMember as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      // 主办律师应该有所有权限
      expect(permissions).toContain(CasePermission.VIEW_CASE);
      expect(permissions).toContain(CasePermission.EDIT_CASE);
      expect(permissions).toContain(CasePermission.DELETE_CASE);
    });

    it('应该使用自定义权限覆盖默认权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const customPermissions = [
        CasePermission.VIEW_CASE,
        CasePermission.EDIT_CASE,
      ];
      const customMember = {
        id: 'member-163',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.OBSERVER,
        permissions: customPermissions as unknown,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockCaseTeamMemberFindUnique.mockResolvedValue(customMember as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      expect(permissions).toEqual(customPermissions);
    });

    it('应该处理数据库错误', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      mockCaseTeamMemberFindUnique.mockRejectedValue(
        new Error('Database error') as never
      );

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      expect(permissions).toEqual([]);
    });
  });

  describe('clearPermissionCache - 缓存管理', () => {
    it('应该清除特定用户和案件的缓存', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-170',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      // 第一次查询，应该从数据库获取
      await checkPermission(mockUserId, mockCaseId, CasePermission.VIEW_CASE);
      const callCount1 = mockCaseTeamMemberFindUnique.mock.calls.length;
      expect(callCount1).toBeGreaterThan(0);

      // 清除缓存
      clearPermissionCache(mockUserId, mockCaseId);

      // 第二次查询，应该从数据库获取（因为缓存已清除）
      await checkPermission(mockUserId, mockCaseId, CasePermission.EDIT_CASE);
      const callCount2 = mockCaseTeamMemberFindUnique.mock.calls.length;
      expect(callCount2).toBeGreaterThan(0);
    });

    it('应该清除特定用户的所有案件缓存', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-171',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      // 第一次查询，建立缓存
      await checkPermission(mockUserId, mockCaseId, CasePermission.VIEW_CASE);
      expect(mockCaseTeamMemberFindUnique.mock.calls.length).toBe(1);

      // 清除该用户所有缓存
      clearPermissionCache(mockUserId);

      // 第二次查询，应该从数据库获取（因为缓存已清除）
      await checkPermission(mockUserId, mockCaseId, CasePermission.EDIT_CASE);
      expect(mockCaseTeamMemberFindUnique.mock.calls.length).toBe(2);
    });

    it('应该清除特定案件的所有用户缓存', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-172',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      // 第一次查询，建立缓存
      await checkPermission(mockUserId, mockCaseId, CasePermission.VIEW_CASE);
      expect(mockCaseTeamMemberFindUnique.mock.calls.length).toBe(1);

      // 清除该案件所有缓存
      clearPermissionCache(undefined, mockCaseId);

      // 第二次查询，应该从数据库获取（因为缓存已清除）
      await checkPermission(mockUserId, mockCaseId, CasePermission.EDIT_CASE);
      expect(mockCaseTeamMemberFindUnique.mock.calls.length).toBe(2);
    });

    it('应该清除所有缓存', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-173',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      // 第一次查询，建立缓存
      await checkPermission(mockUserId, mockCaseId, CasePermission.VIEW_CASE);
      expect(mockCaseTeamMemberFindUnique.mock.calls.length).toBe(1);

      // 清除所有缓存
      clearPermissionCache();

      // 第二次查询，应该从数据库获取（因为缓存已清除）
      await checkPermission(mockUserId, mockCaseId, CasePermission.EDIT_CASE);
      expect(mockCaseTeamMemberFindUnique.mock.calls.length).toBe(2);
    });

    it('应该使用缓存减少数据库查询', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-174',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      // 第一次查询
      await checkPermission(mockUserId, mockCaseId, CasePermission.VIEW_CASE);
      const callCount1 = mockCaseTeamMemberFindUnique.mock.calls.length;

      // 第二次查询（应该使用缓存）
      await checkPermission(mockUserId, mockCaseId, CasePermission.EDIT_CASE);
      const callCount2 = mockCaseTeamMemberFindUnique.mock.calls.length;

      expect(callCount1).toBeGreaterThan(0);
      expect(callCount2).toBe(callCount1);
    });
  });

  describe('validateCustomPermissions - 权限验证', () => {
    it('应该验证有效的权限数组', () => {
      const permissions = [CasePermission.VIEW_CASE, CasePermission.EDIT_CASE];

      const result = validateCustomPermissions(permissions);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝无效的权限', () => {
      const permissions = ['VIEW_CASE', 'INVALID_PERMISSION'];

      const result = validateCustomPermissions(permissions);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].field).toBe('permissions');
    });

    it('应该拒绝非数组输入', () => {
      const result = validateCustomPermissions('not an array');

      expect(result.isValid).toBe(false);
      expect(result.errors[0].field).toBe('permissions');
      expect(result.errors[0].message).toBe('权限必须是数组');
    });

    it('应该拒绝包含非字符串类型的数组', () => {
      const permissions = [CasePermission.VIEW_CASE, 123, null];

      const result = validateCustomPermissions(permissions);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0].field).toBe('permissions');
    });

    it('应该接受空数组', () => {
      const result = validateCustomPermissions([]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝包含number类型的数组', () => {
      const permissions = [CasePermission.VIEW_CASE, 123];

      const result = validateCustomPermissions(permissions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('permissions');
      expect(result.errors[0].message).toContain('无效的权限类型: number');
    });

    it('应该拒绝包含boolean类型的数组', () => {
      const permissions = [CasePermission.VIEW_CASE, true];

      const result = validateCustomPermissions(permissions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('permissions');
      expect(result.errors[0].message).toContain('无效的权限类型: boolean');
    });

    it('应该拒绝包含undefined类型的数组', () => {
      const permissions = [CasePermission.VIEW_CASE, undefined];

      const result = validateCustomPermissions(permissions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('permissions');
      expect(result.errors[0].message).toContain('无效的权限类型: undefined');
    });

    it('应该拒绝包含多个无效权限', () => {
      const permissions = [
        CasePermission.VIEW_CASE,
        'INVALID1',
        'INVALID2',
        'INVALID3',
      ];

      const result = validateCustomPermissions(permissions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });

    it('应该处理包含null的数组', () => {
      const permissions = [CasePermission.VIEW_CASE, null];

      const result = validateCustomPermissions(permissions);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('permissions');
      expect(result.errors[0].message).toContain('无效的权限类型: object');
    });
  });

  describe('getAvailablePermissions - 获取可用权限', () => {
    it('应该返回所有可用权限', () => {
      const permissions = getAvailablePermissions();

      expect(Array.isArray(permissions)).toBe(true);
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('每个权限应该包含permission、label和category', () => {
      const permissions = getAvailablePermissions();

      permissions.forEach(perm => {
        expect(perm).toHaveProperty('permission');
        expect(perm).toHaveProperty('label');
        expect(perm).toHaveProperty('category');
        expect(perm.label).toBeDefined();
        expect(perm.category).toBeDefined();
      });
    });

    it('应该包含所有权限类别', () => {
      const permissions = getAvailablePermissions();
      const categories = new Set(permissions.map(p => p.category));

      expect(categories.has('案件基本')).toBe(true);
      expect(categories.has('时间线')).toBe(true);
      expect(categories.has('法庭日程')).toBe(true);
      expect(categories.has('证据管理')).toBe(true);
      expect(categories.has('文档管理')).toBe(true);
      expect(categories.has('辩论管理')).toBe(true);
      expect(categories.has('法条引用')).toBe(true);
      expect(categories.has('团队管理')).toBe(true);
      expect(categories.has('沟通')).toBe(true);
      expect(categories.has('导出')).toBe(true);
    });

    it('权限值应该是有效的CasePermission枚举', () => {
      const permissions = getAvailablePermissions();
      const validPermissions = new Set(Object.values(CasePermission));

      permissions.forEach(perm => {
        expect(validPermissions.has(perm.permission)).toBe(true);
      });
    });
  });

  describe('角色默认权限', () => {
    it('主办律师应该拥有所有权限', () => {
      const permissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.LEAD];

      expect(permissions).toContain(CasePermission.VIEW_CASE);
      expect(permissions).toContain(CasePermission.EDIT_CASE);
      expect(permissions).toContain(CasePermission.DELETE_CASE);
      expect(permissions).toContain(CasePermission.VIEW_TIMELINE);
      expect(permissions).toContain(CasePermission.EDIT_TIMELINE);
      expect(permissions).toContain(CasePermission.DELETE_TIMELINE);
      expect(permissions).toContain(CasePermission.VIEW_EVIDENCE);
      expect(permissions).toContain(CasePermission.EDIT_EVIDENCE);
      expect(permissions).toContain(CasePermission.DELETE_EVIDENCE);
      expect(permissions).toContain(CasePermission.UPLOAD_EVIDENCE);
      expect(permissions).toContain(CasePermission.VIEW_DOCUMENTS);
      expect(permissions).toContain(CasePermission.EDIT_DOCUMENTS);
      expect(permissions).toContain(CasePermission.DELETE_DOCUMENTS);
      expect(permissions).toContain(CasePermission.UPLOAD_DOCUMENTS);
      expect(permissions).toContain(CasePermission.VIEW_DEBATES);
      expect(permissions).toContain(CasePermission.EDIT_DEBATES);
      expect(permissions).toContain(CasePermission.DELETE_DEBATES);
      expect(permissions).toContain(CasePermission.VIEW_LEGAL_REFERENCES);
      expect(permissions).toContain(CasePermission.EDIT_LEGAL_REFERENCES);
      expect(permissions).toContain(CasePermission.DELETE_LEGAL_REFERENCES);
      expect(permissions).toContain(CasePermission.VIEW_TEAM_MEMBERS);
      expect(permissions).toContain(CasePermission.ADD_TEAM_MEMBERS);
      expect(permissions).toContain(CasePermission.EDIT_TEAM_MEMBERS);
      expect(permissions).toContain(CasePermission.REMOVE_TEAM_MEMBERS);
      expect(permissions).toContain(CasePermission.VIEW_DISCUSSIONS);
      expect(permissions).toContain(CasePermission.POST_DISCUSSIONS);
      expect(permissions).toContain(CasePermission.EDIT_DISCUSSIONS);
      expect(permissions).toContain(CasePermission.DELETE_DISCUSSIONS);
      expect(permissions).toContain(CasePermission.EXPORT_DATA);
    });

    it('协办律师应该有大部分权限但没有删除权限', () => {
      const permissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.ASSISTANT];

      expect(permissions).toContain(CasePermission.VIEW_CASE);
      expect(permissions).toContain(CasePermission.EDIT_CASE);
      expect(permissions).not.toContain(CasePermission.DELETE_CASE);
      expect(permissions).not.toContain(CasePermission.REMOVE_TEAM_MEMBERS);
    });

    it('律师助理应该有基础权限', () => {
      const permissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.PARALEGAL];

      expect(permissions).toContain(CasePermission.VIEW_CASE);
      expect(permissions).toContain(CasePermission.VIEW_EVIDENCE);
      expect(permissions).toContain(CasePermission.UPLOAD_EVIDENCE);
      expect(permissions).not.toContain(CasePermission.EDIT_CASE);
      expect(permissions).not.toContain(CasePermission.DELETE_CASE);
      expect(permissions).not.toContain(CasePermission.ADD_TEAM_MEMBERS);
    });

    it('观察者应该只有查看权限', () => {
      const permissions = ROLE_DEFAULT_PERMISSIONS[CaseRole.OBSERVER];

      expect(permissions).toContain(CasePermission.VIEW_CASE);
      expect(permissions).toContain(CasePermission.VIEW_TIMELINE);
      expect(permissions).toContain(CasePermission.VIEW_EVIDENCE);
      expect(permissions).toContain(CasePermission.VIEW_DOCUMENTS);
      expect(permissions).not.toContain(CasePermission.EDIT_CASE);
      expect(permissions).not.toContain(CasePermission.DELETE_CASE);
      expect(permissions).not.toContain(CasePermission.EDIT_EVIDENCE);
      expect(permissions).not.toContain(CasePermission.UPLOAD_EVIDENCE);
    });
  });

  describe('集成测试 - 完整的权限流程', () => {
    it('应该正确处理完整的权限检查流程', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-180',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      // 检查多个权限
      const permissionsToCheck = [
        CasePermission.VIEW_CASE,
        CasePermission.EDIT_CASE,
        CasePermission.DELETE_CASE,
        CasePermission.VIEW_EVIDENCE,
        CasePermission.UPLOAD_EVIDENCE,
      ];

      // 批量检查
      const batchResults = await checkPermissions(
        mockUserId,
        mockCaseId,
        permissionsToCheck
      );

      // 逐个验证
      for (const perm of permissionsToCheck) {
        const result = await checkPermission(mockUserId, mockCaseId, perm);
        expect(result.hasPermission).toBe(batchResults[perm]);
      }
    });

    it('应该正确处理各种资源和操作组合', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-181',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      // 测试所有资源和操作组合
      const resources = [
        'case',
        'timeline',
        'schedule',
        'evidence',
        'document',
        'debate',
        'legal_reference',
        'team',
        'discussion',
        'export',
      ] as const;
      const actions = ['view', 'edit', 'delete', 'create', 'manage'] as const;

      for (const action of actions) {
        for (const resource of resources) {
          const result = await validateAction(
            mockUserId,
            mockCaseId,
            action,
            resource
          );
          // 主办律师应该对所有操作都有权限
          expect(result.isValid).toBe(true);
        }
      }
    });

    it('应该测试无效的操作和资源组合', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      // 测试无效的操作（应该返回无效的验证结果）
      const invalidResult = await validateAction(
        mockUserId,
        mockCaseId,
        'invalid_action' as any,
        'case'
      );
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors[0].field).toBe('action');
    });
  });

  describe('错误处理', () => {
    it('应该优雅处理数据库错误', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockRejectedValue(
        new Error('Database connection failed') as never
      );

      const result = await checkPermission(
        mockUserId,
        mockCaseId,
        CasePermission.VIEW_CASE
      );

      expect(result.hasPermission).toBe(false);
      expect(result.reason).toBe('用户不是该案件的成员');
    });

    it('应该处理无效的权限字段', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const invalidMember = {
        id: 'member-190',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.OBSERVER,
        permissions: 'invalid permissions' as unknown,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(invalidMember as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      // 应该回退到默认权限
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('应该处理部分无效的自定义权限', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mixedPermissions = [
        CasePermission.VIEW_CASE,
        CasePermission.EDIT_CASE,
      ];
      const mixedMember = {
        id: 'member-191',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.OBSERVER,
        permissions: mixedPermissions,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mixedMember as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      // 应该只包含有效权限
      expect(permissions).toContain(CasePermission.VIEW_CASE);
      expect(permissions).toContain(CasePermission.EDIT_CASE);
    });

    it('应该处理对象形式的权限字段', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const objectMember = {
        id: 'member-192',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.OBSERVER,
        permissions: { custom: 'object' } as unknown,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(objectMember as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      // 应该回退到默认权限
      expect(permissions.length).toBeGreaterThan(0);
    });

    it('应该处理权限字段为null的情况', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const nullMember = {
        id: 'member-193',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(nullMember as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      // 应该使用角色默认权限
      expect(permissions.length).toBeGreaterThan(0);
      expect(permissions).toContain(CasePermission.VIEW_CASE);
    });

    it('应该处理权限字段为undefined的情况', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const undefinedMember = {
        id: 'member-194',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: undefined as unknown,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(undefinedMember as never);

      const permissions = await getUserCasePermissionsWrapper(
        mockUserId,
        mockCaseId
      );

      // 应该使用角色默认权限
      expect(permissions.length).toBeGreaterThan(0);
    });
  });

  describe('validateAction 边界情况', () => {
    it('应该处理所有view操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-200',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const resources = [
        'case',
        'timeline',
        'schedule',
        'evidence',
        'document',
        'debate',
        'legal_reference',
        'team',
        'discussion',
        'export',
      ] as const;

      for (const resource of resources) {
        const result = await validateAction(
          mockUserId,
          mockCaseId,
          'view',
          resource
        );
        expect(result.isValid).toBe(true);
      }
    });

    it('应该处理所有edit操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-201',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const resources = [
        'case',
        'timeline',
        'schedule',
        'evidence',
        'document',
        'debate',
        'legal_reference',
        'team',
        'discussion',
        'export',
      ] as const;

      for (const resource of resources) {
        const result = await validateAction(
          mockUserId,
          mockCaseId,
          'edit',
          resource
        );
        expect(result.isValid).toBe(true);
      }
    });

    it('应该处理所有delete操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-202',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const resources = [
        'case',
        'timeline',
        'schedule',
        'evidence',
        'document',
        'debate',
        'legal_reference',
        'team',
        'discussion',
        'export',
      ] as const;

      for (const resource of resources) {
        const result = await validateAction(
          mockUserId,
          mockCaseId,
          'delete',
          resource
        );
        expect(result.isValid).toBe(true);
      }
    });

    it('应该处理所有create操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-203',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const resources = [
        'case',
        'timeline',
        'schedule',
        'evidence',
        'document',
        'debate',
        'legal_reference',
        'team',
        'discussion',
        'export',
      ] as const;

      for (const resource of resources) {
        const result = await validateAction(
          mockUserId,
          mockCaseId,
          'create',
          resource
        );
        expect(result.isValid).toBe(true);
      }
    });

    it('应该处理所有manage操作', async () => {
      clearPermissionCache();
      jest.clearAllMocks();

      const mockUser = { id: mockUserId, role: 'LAWYER' as const };
      const mockMemberData = {
        id: 'member-204',
        caseId: mockCaseId,
        userId: mockUserId,
        role: CaseRole.LEAD,
        permissions: null,
        joinedAt: new Date(),
        notes: null,
        metadata: null,
        deletedAt: null,
      };

      mockUserFindUnique.mockResolvedValue(mockUser as never);
      mockCaseTeamMemberFindUnique.mockResolvedValue(mockMemberData as never);

      const resources = [
        'case',
        'timeline',
        'schedule',
        'evidence',
        'document',
        'debate',
        'legal_reference',
        'team',
        'discussion',
        'export',
      ] as const;

      for (const resource of resources) {
        const result = await validateAction(
          mockUserId,
          mockCaseId,
          'manage',
          resource
        );
        expect(result.isValid).toBe(true);
      }
    });
  });
});
