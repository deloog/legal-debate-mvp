/**
 * 权限中间件
 */

import { prisma } from '@/lib/db/prisma';
import type { UserRole } from '@/types/auth';
import type { PermissionCheckResult } from '@/types/permission';

// =============================================================================
// 角色检查函数
// =============================================================================

/**
 * 检查用户角色是否匹配
 * @param userRole 用户角色
 * @param allowedRoles 允许的角色列表
 * @returns 是否有权限
 */
export function requireRole(
  userRole: string,
  allowedRoles: UserRole[]
): boolean {
  return allowedRoles.includes(userRole as UserRole);
}

/**
 * 检查用户是否为管理员
 * @param userRole 用户角色
 * @returns 是否为管理员
 */
export function isAdmin(userRole: string): boolean {
  return userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
}

/**
 * 检查用户是否为超级管理员
 * @param userRole 用户角色
 * @returns 是否为超级管理员
 */
export function isSuperAdmin(userRole: string): boolean {
  return userRole === 'SUPER_ADMIN';
}

// =============================================================================
// 权限检查函数
// =============================================================================

/**
 * 检查用户是否有指定权限
 * @param userId 用户ID
 * @param permissionName 权限名称（如 "case:create"）
 * @returns 权限检查结果
 */
export async function hasPermission(
  userId: string,
  permissionName: string
): Promise<PermissionCheckResult> {
  try {
    // 获取用户信息，包括用户角色
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, permissions: true },
    });

    if (!user) {
      return {
        hasPermission: false,
        reason: '用户不存在',
        requiredPermission: permissionName,
      };
    }

    // 超级管理员拥有所有权限
    if (user.role === 'SUPER_ADMIN') {
      return {
        hasPermission: true,
        requiredPermission: permissionName,
      };
    }

    // 检查用户是否通过permissions字段直接分配了权限
    const directPermissions = user.permissions as Array<string> | null;
    if (directPermissions && directPermissions.includes(permissionName)) {
      return {
        hasPermission: true,
        requiredPermission: permissionName,
        actualPermissions: directPermissions,
      };
    }

    // 获取角色的权限
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

    if (!role) {
      return {
        hasPermission: false,
        reason: '角色不存在',
        requiredPermission: permissionName,
      };
    }

    // 检查角色是否有该权限
    const hasRolePermission = role.permissions.some(
      rp => rp.permission?.name === permissionName
    );

    const allPermissions = role.permissions.map(rp => rp.permission?.name);

    return {
      hasPermission: hasRolePermission,
      reason: hasRolePermission ? undefined : '角色缺少该权限',
      requiredPermission: permissionName,
      actualPermissions: allPermissions.filter((p): p is string => !!p),
    };
  } catch (error) {
    console.error('检查权限时出错:', error);
    return {
      hasPermission: false,
      reason: '权限检查失败',
      requiredPermission: permissionName,
    };
  }
}

/**
 * 获取用户的所有权限
 * @param userId 用户ID
 * @returns 权限名称列表
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, permissions: true },
    });

    if (!user) {
      return [];
    }

    // 超级管理员拥有所有权限
    if (user.role === 'SUPER_ADMIN') {
      return ['*']; // "*" 表示所有权限
    }

    const permissions: string[] = [];

    // 添加直接分配的权限
    const directPermissions = user.permissions as Array<string> | null;
    if (directPermissions) {
      permissions.push(...directPermissions);
    }

    // 获取角色的权限
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
      permissions.push(...rolePermissions);
    }

    // 去重
    return Array.from(new Set(permissions));
  } catch (error) {
    console.error('获取用户权限时出错:', error);
    return [];
  }
}

/**
 * 批量检查多个权限
 * @param userId 用户ID
 * @param permissionNames 权限名称列表
 * @returns 权限检查结果映射
 */
export async function hasPermissions(
  userId: string,
  permissionNames: string[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  // 超级管理员拥有所有权限
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === 'SUPER_ADMIN') {
    permissionNames.forEach(name => {
      results[name] = true;
    });
    return results;
  }

  // 批量检查权限
  for (const permissionName of permissionNames) {
    const result = await hasPermission(userId, permissionName);
    results[permissionName] = result.hasPermission;
  }

  return results;
}

// =============================================================================
// 角色权限管理函数
// =============================================================================

/**
 * 为角色分配权限
 * @param roleId 角色ID
 * @param permissionId 权限ID
 * @returns 创建的角色权限关联
 */
export async function assignPermissionToRole(
  roleId: string,
  permissionId: string
): Promise<unknown> {
  try {
    return await prisma.rolePermission.create({
      data: {
        roleId,
        permissionId,
      },
    });
  } catch (error) {
    console.error('为角色分配权限时出错:', error);
    throw new Error('为角色分配权限失败');
  }
}

/**
 * 批量为角色分配权限
 * @param roleId 角色ID
 * @param permissionIds 权限ID列表
 * @returns 创建的角色权限关联列表
 */
export async function assignPermissionsToRole(
  roleId: string,
  permissionIds: string[]
): Promise<{ count: number }> {
  try {
    return await prisma.rolePermission.createMany({
      data: permissionIds.map(permissionId => ({
        roleId,
        permissionId,
      })),
      skipDuplicates: true,
    });
  } catch (error) {
    console.error('批量为角色分配权限时出错:', error);
    throw new Error('批量为角色分配权限失败');
  }
}

/**
 * 撤销角色的权限
 * @param roleId 角色ID
 * @param permissionId 权限ID
 * @returns 删除的角色权限关联
 */
export async function revokePermissionFromRole(
  roleId: string,
  permissionId: string
): Promise<unknown> {
  try {
    return await prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId,
      },
    });
  } catch (error) {
    console.error('撤销角色权限时出错:', error);
    throw new Error('撤销角色权限失败');
  }
}

/**
 * 获取角色的所有权限
 * @param roleId 角色ID
 * @returns 权限列表
 */
export async function getRolePermissions(roleId: string): Promise<unknown[]> {
  try {
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId },
      include: {
        permission: true,
      },
    });

    return rolePermissions.map(rp => rp.permission);
  } catch (error) {
    console.error('获取角色权限时出错:', error);
    return [];
  }
}
