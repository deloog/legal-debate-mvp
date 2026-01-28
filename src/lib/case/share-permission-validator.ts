/**
 * 案件共享权限验证
 * 实现案件共享的权限验证逻辑
 */

import { prisma } from '@/lib/db/prisma';
import { getUserTeamPermissions } from '@/lib/team/permission-inheritance';
import {
  CasePermission,
  CaseRole,
  getRoleDefaultPermissions,
} from '@/types/case-collaboration';
import { OwnerType } from '@prisma/client';

/**
 * 案件共享权限检查结果
 */
interface CaseSharePermissionResult {
  hasPermission: boolean;
  isOwner: boolean;
  role?: CaseRole;
  permissions?: CasePermission[];
  reason?: string;
}

/**
 * 案件访问权限检查结果
 */
interface CaseAccessPermissionResult {
  hasAccess: boolean;
  isOwner: boolean;
  role?: CaseRole;
  accessType?: 'owner' | 'team-member' | 'shared-team';
  permissions?: CasePermission[];
  reason?: string;
}

/**
 * 共享验证结果
 */
interface ShareValidationResult {
  isValid: boolean;
  canShare: boolean;
  errors: string[];
}

// =============================================================================
// 权限验证函数
// =============================================================================

/**
 * 检查用户是否有权限共享指定案件
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @returns 权限检查结果
 *
 * 规则：
 * 1. 案件所有者可以共享案件
 * 2. 非所有者无法共享案件
 */
export async function canShareCase(
  userId: string,
  caseId: string
): Promise<CaseSharePermissionResult> {
  try {
    // 查询案件信息
    const caseRecord = await prisma.case.findUnique({
      where: {
        id: caseId,
        deletedAt: null,
      },
      select: {
        userId: true,
        ownerType: true,
        sharedWithTeam: true,
      },
    });

    if (!caseRecord) {
      return {
        hasPermission: false,
        isOwner: false,
        reason: '案件不存在',
      };
    }

    // 检查是否是案件所有者
    const isOwner = caseRecord.userId === userId;

    if (!isOwner) {
      return {
        hasPermission: false,
        isOwner: false,
        reason: '只有案件所有者可以共享案件',
      };
    }

    // 所有者拥有所有权限
    return {
      hasPermission: true,
      isOwner: true,
    };
  } catch (error) {
    console.error('检查案件共享权限时出错:', error);
    return {
      hasPermission: false,
      isOwner: false,
      reason: '权限检查失败',
    };
  }
}

/**
 * 检查用户是否有权限访问共享案件
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @param permission 需要检查的权限（可选）
 * @returns 访问权限检查结果
 *
 * 规则：
 * 1. 案件所有者拥有完全访问权限
 * 2. 案件团队成员拥有其角色对应的权限
 * 3. 共享案件的团队成员拥有团队权限（如果sharedWithTeam=true）
 */
export async function canAccessSharedCase(
  userId: string,
  caseId: string,
  permission?: CasePermission
): Promise<CaseAccessPermissionResult> {
  try {
    // 查询案件信息
    const caseRecord = await prisma.case.findUnique({
      where: {
        id: caseId,
        deletedAt: null,
      },
      select: {
        userId: true,
        ownerType: true,
        sharedWithTeam: true,
      },
    });

    if (!caseRecord) {
      return {
        hasAccess: false,
        isOwner: false,
        reason: '案件不存在',
      };
    }

    // 规则1：检查是否是案件所有者
    if (caseRecord.userId === userId) {
      return {
        hasAccess: true,
        isOwner: true,
        accessType: 'owner',
        permissions: getRoleDefaultPermissions(CaseRole.LEAD),
      };
    }

    // 规则2：检查是否是案件团队成员
    const caseTeamMember = await prisma.caseTeamMember.findFirst({
      where: {
        caseId,
        userId,
        deletedAt: null,
      },
      select: {
        role: true,
        permissions: true,
      },
    });

    if (caseTeamMember) {
      const role = caseTeamMember.role as CaseRole;
      const metadata = caseTeamMember.permissions as Record<
        string,
        unknown
      > | null;

      // 获取权限列表
      let permissions: CasePermission[];
      if (metadata && Array.isArray(metadata.customPermissions)) {
        permissions = metadata.customPermissions as CasePermission[];
      } else {
        permissions = getRoleDefaultPermissions(role);
      }

      // 检查特定权限
      if (permission && !permissions.includes(permission)) {
        return {
          hasAccess: false,
          isOwner: false,
          reason: '缺少所需权限',
        };
      }

      return {
        hasAccess: true,
        isOwner: false,
        accessType: 'team-member',
        role,
        permissions,
      };
    }

    // 规则3：检查是否是团队成员且案件共享给团队
    if (caseRecord.sharedWithTeam && caseRecord.ownerType === OwnerType.USER) {
      // 查询用户所属的所有团队
      const userTeamMembers = await prisma.teamMember.findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        select: {
          teamId: true,
          role: true,
          metadata: true,
        },
      });

      if (userTeamMembers.length > 0) {
        // 获取用户的团队权限
        const teamPermissions: CasePermission[] = [];
        for (const teamMember of userTeamMembers) {
          const teamRolePermissions = await getUserTeamPermissions(
            userId,
            teamMember.teamId
          );

          // 将团队权限转换为案件权限
          const casePermissions =
            mapTeamPermissionsToCasePermissions(teamRolePermissions);
          teamPermissions.push(...casePermissions);
        }

        // 去重
        const uniquePermissions = [...new Set(teamPermissions)];

        // 检查特定权限
        if (permission && !uniquePermissions.includes(permission)) {
          return {
            hasAccess: false,
            isOwner: false,
            reason: '团队权限不足',
          };
        }

        return {
          hasAccess: true,
          isOwner: false,
          accessType: 'shared-team',
          permissions: uniquePermissions,
        };
      }
    }

    // 无权限访问
    return {
      hasAccess: false,
      isOwner: false,
      reason: '无权访问此案件',
    };
  } catch (error) {
    console.error('检查案件访问权限时出错:', error);
    return {
      hasAccess: false,
      isOwner: false,
      reason: '权限检查失败',
    };
  }
}

/**
 * 获取用户对案件的完整权限列表
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @returns 权限列表
 */
export async function getCaseAccessPermissions(
  userId: string,
  caseId: string
): Promise<CasePermission[]> {
  const result = await canAccessSharedCase(userId, caseId);

  if (result.hasAccess && result.permissions) {
    return result.permissions;
  }

  return [];
}

/**
 * 验证共享案件请求
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @returns 验证结果
 */
export async function validateShareRequest(
  userId: string,
  caseId: string
): Promise<ShareValidationResult> {
  const errors: string[] = [];

  // 检查共享权限
  const sharePermission = await canShareCase(userId, caseId);
  if (!sharePermission.hasPermission) {
    errors.push(sharePermission.reason || '无权限共享案件');
  }

  // 检查案件是否需要团队验证
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId, deletedAt: null },
    select: { ownerType: true, sharedWithTeam: true },
  });

  if (caseRecord?.ownerType === OwnerType.TEAM) {
    // 如果案件属于团队，验证用户是否是团队成员
    const teamOwner = await prisma.case.findUnique({
      where: { id: caseId },
      select: { userId: true },
    });

    // 查询用户所属的团队
    const userTeamIds = await prisma.teamMember
      .findMany({
        where: {
          userId,
          status: 'ACTIVE',
        },
        select: { teamId: true },
      })
      .then(members => members.map(m => m.teamId));

    // 如果案件所有者是用户，则允许
    if (teamOwner?.userId === userId) {
      // 用户是案件所有者，继续
    } else if (!userTeamIds.includes(teamOwner?.userId || '')) {
      // 用户不拥有该案件且不是团队成员
      errors.push('您没有权限操作此团队案件');
    }
  }

  return {
    isValid: errors.length === 0,
    canShare: sharePermission.hasPermission,
    errors,
  };
}

/**
 * 检查用户是否可以取消共享案件
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @returns 是否可以取消共享
 */
export async function canUnshareCase(
  userId: string,
  caseId: string
): Promise<{ canUnshare: boolean; reason?: string }> {
  // 检查共享权限
  const sharePermission = await canShareCase(userId, caseId);

  if (!sharePermission.hasPermission) {
    return {
      canUnshare: false,
      reason: sharePermission.reason || '无权限操作',
    };
  }

  return {
    canUnshare: true,
  };
}

// =============================================================================
// 权限映射工具函数
// =============================================================================

/**
 * 将团队权限映射到案件权限
 *
 * @param teamPermissions 团队权限列表
 * @returns 案件权限列表
 */
function mapTeamPermissionsToCasePermissions(
  teamPermissions: string[]
): CasePermission[] {
  const teamToCaseMap: Record<string, CasePermission | undefined> = {
    TEAM_MANAGE: CasePermission.EDIT_CASE,
    TEAM_READ: CasePermission.VIEW_CASE,
    TEAM_MEMBER_ADD: CasePermission.ADD_TEAM_MEMBERS,
    TEAM_MEMBER_REMOVE: CasePermission.REMOVE_TEAM_MEMBERS,
    CASE_CREATE: CasePermission.EDIT_CASE,
    CASE_READ: CasePermission.VIEW_CASE,
    CASE_UPDATE: CasePermission.EDIT_CASE,
    CASE_DELETE: CasePermission.DELETE_CASE,
    DEBATE_CREATE: CasePermission.EDIT_DEBATES,
    DEBATE_READ: CasePermission.VIEW_DEBATES,
    DEBATE_UPDATE: CasePermission.EDIT_DEBATES,
    DEBATE_DELETE: CasePermission.DELETE_DEBATES,
    DOCUMENT_CREATE: CasePermission.UPLOAD_DOCUMENTS,
    DOCUMENT_READ: CasePermission.VIEW_DOCUMENTS,
    DOCUMENT_UPDATE: CasePermission.EDIT_DOCUMENTS,
    DOCUMENT_DELETE: CasePermission.DELETE_DOCUMENTS,
  };

  const casePermissions: CasePermission[] = [];

  for (const teamPerm of teamPermissions) {
    const casePerm = teamToCaseMap[teamPerm];
    if (casePerm) {
      casePermissions.push(casePerm);
    }
  }

  return casePermissions;
}

// =============================================================================
// 导出类型
// =============================================================================

export type {
  CaseAccessPermissionResult,
  CaseSharePermissionResult,
  ShareValidationResult,
};
