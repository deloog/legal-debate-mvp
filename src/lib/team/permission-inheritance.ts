/**
 * 团队权限继承管理
 * 实现团队角色到系统权限的映射和继承
 */

import { prisma } from '@/lib/db/prisma';
import { TeamRole } from '@prisma/client';
import {
  CASE_PERMISSIONS,
  DEBATE_PERMISSIONS,
  DOCUMENT_PERMISSIONS,
  TEAM_PERMISSIONS,
} from '@/types/permission';

// =============================================================================
// 团队角色权限映射配置
// =============================================================================

/**
 * 团队角色到系统权限的映射
 * 每个团队角色映射到一组系统权限
 */
const TEAM_ROLE_PERMISSION_MAP: Record<TeamRole, string[]> = {
  [TeamRole.ADMIN]: [
    // 团队管理权限
    TEAM_PERMISSIONS.MANAGE,
    TEAM_PERMISSIONS.UPDATE,
    TEAM_PERMISSIONS.READ,
    TEAM_PERMISSIONS.MEMBER_ADD,
    TEAM_PERMISSIONS.MEMBER_REMOVE,
    TEAM_PERMISSIONS.MEMBER_MANAGE,
    // 案件管理权限（团队内）
    CASE_PERMISSIONS.CREATE,
    CASE_PERMISSIONS.READ,
    CASE_PERMISSIONS.UPDATE,
    CASE_PERMISSIONS.DELETE,
    CASE_PERMISSIONS.MANAGE,
    // 辩论管理权限
    DEBATE_PERMISSIONS.CREATE,
    DEBATE_PERMISSIONS.READ,
    DEBATE_PERMISSIONS.UPDATE,
    DEBATE_PERMISSIONS.DELETE,
    // 文档管理权限
    DOCUMENT_PERMISSIONS.CREATE,
    DOCUMENT_PERMISSIONS.READ,
    DOCUMENT_PERMISSIONS.UPDATE,
    DOCUMENT_PERMISSIONS.DELETE,
  ],
  [TeamRole.LAWYER]: [
    // 团队基本权限
    TEAM_PERMISSIONS.READ,
    // 案件管理权限
    CASE_PERMISSIONS.CREATE,
    CASE_PERMISSIONS.READ,
    CASE_PERMISSIONS.UPDATE,
    // 辩论管理权限
    DEBATE_PERMISSIONS.CREATE,
    DEBATE_PERMISSIONS.READ,
    DEBATE_PERMISSIONS.UPDATE,
    // 文档管理权限
    DOCUMENT_PERMISSIONS.CREATE,
    DOCUMENT_PERMISSIONS.READ,
    DOCUMENT_PERMISSIONS.UPDATE,
  ],
  [TeamRole.PARALEGAL]: [
    // 团队基本权限
    TEAM_PERMISSIONS.READ,
    // 案件管理权限（只读）
    CASE_PERMISSIONS.READ,
    // 辩论管理权限（只读）
    DEBATE_PERMISSIONS.READ,
    // 文档管理权限（只读）
    DOCUMENT_PERMISSIONS.READ,
  ],
  [TeamRole.OTHER]: [
    // 团队基本权限（只读）
    TEAM_PERMISSIONS.READ,
    // 案件管理权限（只读）
    CASE_PERMISSIONS.READ,
    // 辩论管理权限（只读）
    DEBATE_PERMISSIONS.READ,
    // 文档管理权限（只读）
    DOCUMENT_PERMISSIONS.READ,
  ],
};

// =============================================================================
// 权限缓存配置
// =============================================================================

/**
 * 权限缓存Map
 * 用于缓存用户的团队权限，避免重复查询
 */
const permissionCache = new Map<
  string,
  { permissions: string[]; expiresAt: number }
>();

/**
 * 缓存过期时间（毫秒）
 * 默认5分钟
 */
const CACHE_TTL = 5 * 60 * 1000;

// =============================================================================
// 权限继承函数
// =============================================================================

/**
 * 获取团队角色的默认权限
 * @param role 团队角色
 * @returns 权限列表
 */
export function getTeamRolePermissions(role: TeamRole): string[] {
  return TEAM_ROLE_PERMISSION_MAP[role] || [];
}

/**
 * 获取用户在指定团队中的权限
 * @param userId 用户ID
 * @param teamId 团队ID
 * @returns 权限列表
 */
export async function getUserTeamPermissions(
  userId: string,
  teamId: string
): Promise<string[]> {
  try {
    // 获取用户在团队中的成员身份
    const teamMember = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      select: {
        role: true,
        status: true,
        metadata: true,
      },
    });

    if (!teamMember || teamMember.status !== 'ACTIVE') {
      return [];
    }

    // 获取团队角色的默认权限
    const rolePermissions = getTeamRolePermissions(teamMember.role as TeamRole);

    // 检查是否有自定义权限覆盖
    const metadata = teamMember.metadata as Record<string, unknown> | null;
    const customPermissions = metadata?.customPermissions as
      | string[]
      | undefined;

    if (customPermissions && customPermissions.length > 0) {
      // 合并角色权限和自定义权限
      return [...new Set([...rolePermissions, ...customPermissions])];
    }

    return rolePermissions;
  } catch (error) {
    console.error('获取用户团队权限时出错:', error);
    return [];
  }
}

/**
 * 获取用户在所有团队中的权限
 * @param userId 用户ID
 * @returns 权限列表
 */
export async function getUserAllTeamPermissions(
  userId: string
): Promise<string[]> {
  try {
    // 检查缓存
    const cacheKey = `team:${userId}`;
    const cached = permissionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    // 获取用户的所有活跃团队成员身份
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      select: {
        role: true,
        metadata: true,
      },
    });

    if (teamMembers.length === 0) {
      return [];
    }

    // 合并所有团队的权限
    const allPermissions: string[] = [];
    for (const member of teamMembers) {
      const rolePermissions = getTeamRolePermissions(member.role);

      // 检查自定义权限覆盖
      const metadata = member.metadata as Record<string, unknown> | null;
      const customPermissions = metadata?.customPermissions as
        | string[]
        | undefined;

      if (customPermissions && customPermissions.length > 0) {
        allPermissions.push(...customPermissions);
      } else {
        allPermissions.push(...rolePermissions);
      }
    }

    // 去重
    const uniquePermissions = [...new Set(allPermissions)];

    // 缓存结果
    permissionCache.set(cacheKey, {
      permissions: uniquePermissions,
      expiresAt: Date.now() + CACHE_TTL,
    });

    return uniquePermissions;
  } catch (error) {
    console.error('获取用户所有团队权限时出错:', error);
    return [];
  }
}

/**
 * 清除用户权限缓存
 * @param userId 用户ID
 */
export function clearUserPermissionCache(userId: string): void {
  const cacheKey = `team:${userId}`;
  permissionCache.delete(cacheKey);
}

/**
 * 清除所有权限缓存
 */
export function clearAllPermissionCache(): void {
  permissionCache.clear();
}

/**
 * 设置团队成员的自定义权限
 * @param teamId 团队ID
 * @param userId 用户ID
 * @param permissions 自定义权限列表
 * @returns 是否设置成功
 */
export async function setTeamMemberCustomPermissions(
  teamId: string,
  userId: string,
  permissions: string[]
): Promise<boolean> {
  try {
    await prisma.teamMember.update({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      data: {
        metadata: {
          customPermissions: permissions,
        },
      },
    });

    // 清除缓存
    clearUserPermissionCache(userId);

    return true;
  } catch (error) {
    console.error('设置团队成员自定义权限时出错:', error);
    return false;
  }
}

/**
 * 检查用户在团队中是否有指定权限
 * @param userId 用户ID
 * @param teamId 团队ID
 * @param permission 权限名称
 * @returns 是否有权限
 */
export async function hasTeamPermission(
  userId: string,
  teamId: string,
  permission: string
): Promise<boolean> {
  const teamPermissions = await getUserTeamPermissions(userId, teamId);
  return teamPermissions.includes(permission);
}

/**
 * 检查用户在任一团队中是否有指定权限
 * @param userId 用户ID
 * @param permission 权限名称
 * @returns 是否有权限
 */
export async function hasAnyTeamPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const allTeamPermissions = await getUserAllTeamPermissions(userId);
  return allTeamPermissions.includes(permission);
}

/**
 * 获取用户的有效权限列表
 * 合并个人权限、团队权限和系统角色权限
 * @param userId 用户ID
 * @returns 完整的权限列表
 */
export async function getUserEffectivePermissions(
  userId: string
): Promise<string[]> {
  try {
    // 获取用户的直接权限
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        permissions: true,
      },
    });

    if (!user) {
      return [];
    }

    // 超级管理员拥有所有权限
    if (user.role === 'SUPER_ADMIN') {
      return ['*'];
    }

    const effectivePermissions: string[] = [];

    // 1. 添加个人直接分配的权限
    const directPermissions = user.permissions as Array<string> | null;
    if (directPermissions) {
      effectivePermissions.push(...directPermissions);
    }

    // 2. 添加团队权限
    const teamPermissions = await getUserAllTeamPermissions(userId);
    effectivePermissions.push(...teamPermissions);

    // 3. 添加系统角色权限（从数据库查询）
    const role = await prisma.role.findUnique({
      where: { name: user.role },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (role) {
      const rolePermissions = role.permissions
        .map(rp => rp.permission?.name)
        .filter((p): p is string => !!p);
      effectivePermissions.push(...rolePermissions);
    }

    // 去重并返回
    return [...new Set(effectivePermissions)];
  } catch (error) {
    console.error('获取用户有效权限时出错:', error);
    return [];
  }
}

// =============================================================================
// 导出
// =============================================================================
