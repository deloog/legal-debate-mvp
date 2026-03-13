/**
 * 案件权限管理器
 * 用于案件级权限控制，基于团队成员角色和自定义权限
 */

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';
import { isAdmin, isSuperAdmin } from '@/lib/middleware/permissions';
import {
  CasePermission,
  CaseRole,
  ROLE_DEFAULT_PERMISSIONS,
} from '@/types/case-collaboration';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 权限检查结果
 */
export interface CasePermissionCheckResult {
  hasPermission: boolean;
  reason?: string;
  requiredPermission: CasePermission;
  actualPermissions?: CasePermission[];
  memberRole?: CaseRole;
}

/**
 * 权限验证结果
 */
export interface CasePermissionValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * 批量权限检查结果
 */
export interface BatchPermissionCheckResult {
  [permission: string]: boolean;
}

// =============================================================================
// 权限缓存
// =============================================================================

/**
 * 权限缓存接口
 */
interface PermissionCache {
  userId: string;
  caseId: string;
  permissions: CasePermission[];
  role: CaseRole | null;
  cacheTime: Date;
  expiresAt: Date;
}

// 内存缓存，5分钟过期
const permissionCache = new Map<string, PermissionCache>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟（毫秒）

/**
 * 获取缓存键
 */
function getCacheKey(userId: string, caseId: string): string {
  return `${userId}:${caseId}`;
}

/**
 * 清理过期缓存
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of permissionCache.entries()) {
    if (entry.expiresAt.getTime() < now) {
      permissionCache.delete(key);
    }
  }
}

/**
 * 从缓存获取权限
 */
function getCachedPermissions(
  userId: string,
  caseId: string
): PermissionCache | null {
  cleanExpiredCache();
  const key = getCacheKey(userId, caseId);
  return permissionCache.get(key) || null;
}

/**
 * 设置缓存
 */
function setCachedPermissions(
  userId: string,
  caseId: string,
  permissions: CasePermission[],
  role: CaseRole | null
): void {
  const key = getCacheKey(userId, caseId);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL);

  permissionCache.set(key, {
    userId,
    caseId,
    permissions,
    role,
    cacheTime: now,
    expiresAt,
  });
}

/**
 * 清除缓存
 */
export function clearPermissionCache(userId?: string, caseId?: string): void {
  if (userId && caseId) {
    permissionCache.delete(getCacheKey(userId, caseId));
  } else if (userId) {
    // 清除用户所有案件缓存
    for (const key of permissionCache.keys()) {
      if (key.startsWith(userId + ':')) {
        permissionCache.delete(key);
      }
    }
  } else if (caseId) {
    // 清除特定案件所有用户缓存
    for (const key of permissionCache.keys()) {
      if (key.endsWith(':' + caseId)) {
        permissionCache.delete(key);
      }
    }
  } else {
    // 清除所有缓存
    permissionCache.clear();
  }
}

// =============================================================================
// 权限检查核心函数
// =============================================================================

/**
 * 获取用户在案件中的角色
 */
async function getUserCaseRole(
  userId: string,
  caseId: string
): Promise<CaseRole | null> {
  const { role } = await getUserCasePermissionsAndRole(userId, caseId);
  return role;
}

/**
 * 获取用户在案件中的所有权限
 */
async function getUserCasePermissions(
  userId: string,
  caseId: string
): Promise<CasePermission[]> {
  const { permissions } = await getUserCasePermissionsAndRole(userId, caseId);
  return permissions;
}

/**
 * 获取用户在案件中的权限和角色（带缓存）
 */
async function getUserCasePermissionsAndRole(
  userId: string,
  caseId: string
): Promise<{ permissions: CasePermission[]; role: CaseRole | null }> {
  // 检查缓存
  const cached = getCachedPermissions(userId, caseId);
  if (cached) {
    return {
      permissions: cached.permissions,
      role: cached.role,
    };
  }

  try {
    const member = await prisma.caseTeamMember.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId,
        },
        deletedAt: null,
      },
      select: {
        role: true,
        permissions: true,
      },
    });

    if (!member) {
      // 缓存空结果，避免重复查询
      setCachedPermissions(userId, caseId, [], null);
      return { permissions: [], role: null };
    }

    const role = (member?.role as CaseRole) || null;

    // 从permissions字段获取自定义权限
    const customPermissions = member.permissions as unknown;
    let permissions: CasePermission[] = [];

    if (Array.isArray(customPermissions)) {
      // 验证每个权限是否有效
      for (const perm of customPermissions) {
        if (Object.values(CasePermission).includes(perm as CasePermission)) {
          permissions.push(perm as CasePermission);
        }
      }
    }

    // 如果没有自定义权限或自定义权限为空，使用角色默认权限
    if (permissions.length === 0 && role) {
      permissions = ROLE_DEFAULT_PERMISSIONS[role] || [];
    }

    // 缓存结果（包含角色信息）
    setCachedPermissions(userId, caseId, permissions, role);

    return { permissions, role };
  } catch (error) {
    logger.error('获取用户案件权限时出错:', error);
    return { permissions: [], role: null };
  }
}

// =============================================================================
// 公共API
// =============================================================================

/**
 * 检查用户对案件的指定权限
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @param permission 需要检查的权限
 * @returns 权限检查结果
 */
export async function checkPermission(
  userId: string,
  caseId: string,
  permission: CasePermission
): Promise<CasePermissionCheckResult> {
  try {
    // 首先检查用户基本信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) {
      return {
        hasPermission: false,
        reason: '用户不存在',
        requiredPermission: permission,
      };
    }

    // 超级管理员拥有所有权限
    if (isSuperAdmin(user.role)) {
      return {
        hasPermission: true,
        requiredPermission: permission,
        memberRole: null,
      };
    }

    // 系统管理员拥有所有案件权限
    if (isAdmin(user.role)) {
      return {
        hasPermission: true,
        requiredPermission: permission,
        memberRole: null,
      };
    }

    // 获取用户的所有案件权限
    const permissions = await getUserCasePermissions(userId, caseId);

    // 如果权限为空数组，说明用户不是案件成员
    if (permissions.length === 0) {
      return {
        hasPermission: false,
        reason: '用户不是该案件的成员',
        requiredPermission: permission,
      };
    }

    const memberRole = await getUserCaseRole(userId, caseId);

    return {
      hasPermission: permissions.includes(permission),
      reason: permissions.includes(permission) ? undefined : '缺少该权限',
      requiredPermission: permission,
      actualPermissions: permissions,
      memberRole: memberRole ?? undefined,
    };
  } catch (error) {
    logger.error('检查案件权限时出错:', error);
    return {
      hasPermission: false,
      reason: '权限检查失败',
      requiredPermission: permission,
    };
  }
}

/**
 * 批量检查多个权限
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @param permissions 需要检查的权限列表
 * @returns 权限检查结果映射
 */
export async function checkPermissions(
  userId: string,
  caseId: string,
  permissions: CasePermission[]
): Promise<BatchPermissionCheckResult> {
  const results: BatchPermissionCheckResult = {};

  // 先获取一次所有权限，避免重复查询
  const userPermissions = await getUserCasePermissions(userId, caseId);

  for (const permission of permissions) {
    results[permission] = userPermissions.includes(permission);
  }

  return results;
}

/**
 * 验证用户是否可以执行操作
 * 基于权限检查，提供更友好的错误消息
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @param action 操作类型
 * @returns 验证结果
 */
export async function validateAction(
  userId: string,
  caseId: string,
  action: 'view' | 'edit' | 'delete' | 'create' | 'manage',
  resource:
    | 'case'
    | 'timeline'
    | 'schedule'
    | 'evidence'
    | 'document'
    | 'debate'
    | 'legal_reference'
    | 'team'
    | 'discussion'
    | 'export'
): Promise<CasePermissionValidationResult> {
  try {
    // 根据操作和资源确定需要的权限
    const permission = getRequiredPermission(action, resource);

    if (!permission) {
      return {
        isValid: false,
        errors: [
          {
            field: 'action',
            message: `不支持的操作: ${action} on ${resource}`,
          },
        ],
      };
    }

    // 检查权限
    const result = await checkPermission(userId, caseId, permission);

    if (result.hasPermission) {
      return { isValid: true, errors: [] };
    }

    return {
      isValid: false,
      errors: [
        {
          field: 'permission',
          message: result.reason || '权限不足',
        },
      ],
    };
  } catch (error) {
    logger.error('验证操作权限时出错:', error);
    return {
      isValid: false,
      errors: [
        {
          field: 'system',
          message: '权限验证失败',
        },
      ],
    };
  }
}

/**
 * 根据操作和资源获取需要的权限
 */
function getRequiredPermission(
  action: string,
  resource: string
): CasePermission | null {
  const permissionMap: Record<string, Record<string, CasePermission>> = {
    view: {
      case: CasePermission.VIEW_CASE,
      timeline: CasePermission.VIEW_TIMELINE,
      schedule: CasePermission.VIEW_SCHEDULES,
      evidence: CasePermission.VIEW_EVIDENCE,
      document: CasePermission.VIEW_DOCUMENTS,
      debate: CasePermission.VIEW_DEBATES,
      legal_reference: CasePermission.VIEW_LEGAL_REFERENCES,
      team: CasePermission.VIEW_TEAM_MEMBERS,
      discussion: CasePermission.VIEW_DISCUSSIONS,
      export: CasePermission.EXPORT_DATA,
    },
    edit: {
      case: CasePermission.EDIT_CASE,
      timeline: CasePermission.EDIT_TIMELINE,
      schedule: CasePermission.EDIT_SCHEDULES,
      evidence: CasePermission.EDIT_EVIDENCE,
      document: CasePermission.EDIT_DOCUMENTS,
      debate: CasePermission.EDIT_DEBATES,
      legal_reference: CasePermission.EDIT_LEGAL_REFERENCES,
      team: CasePermission.EDIT_TEAM_MEMBERS,
      discussion: CasePermission.EDIT_DISCUSSIONS,
      export: CasePermission.EXPORT_DATA,
    },
    delete: {
      case: CasePermission.DELETE_CASE,
      timeline: CasePermission.DELETE_TIMELINE,
      schedule: CasePermission.DELETE_SCHEDULES,
      evidence: CasePermission.DELETE_EVIDENCE,
      document: CasePermission.DELETE_DOCUMENTS,
      debate: CasePermission.DELETE_DEBATES,
      legal_reference: CasePermission.DELETE_LEGAL_REFERENCES,
      team: CasePermission.REMOVE_TEAM_MEMBERS,
      discussion: CasePermission.DELETE_DISCUSSIONS,
      export: CasePermission.EXPORT_DATA,
    },
    create: {
      case: CasePermission.EDIT_CASE,
      timeline: CasePermission.EDIT_TIMELINE,
      schedule: CasePermission.EDIT_SCHEDULES,
      evidence: CasePermission.UPLOAD_EVIDENCE,
      document: CasePermission.UPLOAD_DOCUMENTS,
      debate: CasePermission.EDIT_DEBATES,
      legal_reference: CasePermission.EDIT_LEGAL_REFERENCES,
      team: CasePermission.ADD_TEAM_MEMBERS,
      discussion: CasePermission.POST_DISCUSSIONS,
      export: CasePermission.EXPORT_DATA,
    },
    manage: {
      case: CasePermission.EDIT_CASE,
      timeline: CasePermission.EDIT_TIMELINE,
      schedule: CasePermission.EDIT_SCHEDULES,
      evidence: CasePermission.EDIT_EVIDENCE,
      document: CasePermission.EDIT_DOCUMENTS,
      debate: CasePermission.EDIT_DEBATES,
      legal_reference: CasePermission.EDIT_LEGAL_REFERENCES,
      team: CasePermission.EDIT_TEAM_MEMBERS,
      discussion: CasePermission.EDIT_DISCUSSIONS,
      export: CasePermission.EXPORT_DATA,
    },
  };

  return permissionMap[action]?.[resource] || null;
}

/**
 * 获取用户在案件中的角色
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @returns 案件角色或null
 */
export async function getUserCaseRoleWrapper(
  userId: string,
  caseId: string
): Promise<CaseRole | null> {
  return getUserCaseRole(userId, caseId);
}

/**
 * 获取用户在案件中的所有权限
 *
 * @param userId 用户ID
 * @param caseId 案件ID
 * @returns 权限列表
 */
export async function getUserCasePermissionsWrapper(
  userId: string,
  caseId: string
): Promise<CasePermission[]> {
  return getUserCasePermissions(userId, caseId);
}

/**
 * 验证自定义权限是否有效
 *
 * @param permissions 自定义权限列表
 * @returns 验证结果
 */
export function validateCustomPermissions(
  permissions: unknown
): CasePermissionValidationResult {
  const errors: Array<{ field: string; message: string }> = [];

  if (!Array.isArray(permissions)) {
    return {
      isValid: false,
      errors: [{ field: 'permissions', message: '权限必须是数组' }],
    };
  }

  const validPermissions = new Set<string>(Object.values(CasePermission));

  for (const perm of permissions) {
    if (typeof perm !== 'string') {
      errors.push({
        field: 'permissions',
        message: `无效的权限类型: ${typeof perm}`,
      });
      continue;
    }

    if (!validPermissions.has(perm)) {
      errors.push({ field: 'permissions', message: `无效的权限: ${perm}` });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * 获取可用的权限列表
 * 用于前端展示
 */
export function getAvailablePermissions(): Array<{
  permission: CasePermission;
  label: string;
  category: string;
}> {
  const permissionCategories: Array<{
    permission: CasePermission;
    label: string;
    category: string;
  }> = [
    // 案件基本权限
    {
      permission: CasePermission.VIEW_CASE,
      label: '查看案件',
      category: '案件基本',
    },
    {
      permission: CasePermission.EDIT_CASE,
      label: '编辑案件',
      category: '案件基本',
    },
    {
      permission: CasePermission.DELETE_CASE,
      label: '删除案件',
      category: '案件基本',
    },

    // 时间线权限
    {
      permission: CasePermission.VIEW_TIMELINE,
      label: '查看时间线',
      category: '时间线',
    },
    {
      permission: CasePermission.EDIT_TIMELINE,
      label: '编辑时间线',
      category: '时间线',
    },
    {
      permission: CasePermission.DELETE_TIMELINE,
      label: '删除时间线',
      category: '时间线',
    },

    // 法庭日程权限
    {
      permission: CasePermission.VIEW_SCHEDULES,
      label: '查看法庭日程',
      category: '法庭日程',
    },
    {
      permission: CasePermission.EDIT_SCHEDULES,
      label: '编辑法庭日程',
      category: '法庭日程',
    },
    {
      permission: CasePermission.DELETE_SCHEDULES,
      label: '删除法庭日程',
      category: '法庭日程',
    },

    // 证据管理权限
    {
      permission: CasePermission.VIEW_EVIDENCE,
      label: '查看证据',
      category: '证据管理',
    },
    {
      permission: CasePermission.EDIT_EVIDENCE,
      label: '编辑证据',
      category: '证据管理',
    },
    {
      permission: CasePermission.DELETE_EVIDENCE,
      label: '删除证据',
      category: '证据管理',
    },
    {
      permission: CasePermission.UPLOAD_EVIDENCE,
      label: '上传证据',
      category: '证据管理',
    },

    // 文档管理权限
    {
      permission: CasePermission.VIEW_DOCUMENTS,
      label: '查看文档',
      category: '文档管理',
    },
    {
      permission: CasePermission.EDIT_DOCUMENTS,
      label: '编辑文档',
      category: '文档管理',
    },
    {
      permission: CasePermission.DELETE_DOCUMENTS,
      label: '删除文档',
      category: '文档管理',
    },
    {
      permission: CasePermission.UPLOAD_DOCUMENTS,
      label: '上传文档',
      category: '文档管理',
    },

    // 辩论管理权限
    {
      permission: CasePermission.VIEW_DEBATES,
      label: '查看辩论',
      category: '辩论管理',
    },
    {
      permission: CasePermission.EDIT_DEBATES,
      label: '编辑辩论',
      category: '辩论管理',
    },
    {
      permission: CasePermission.DELETE_DEBATES,
      label: '删除辩论',
      category: '辩论管理',
    },

    // 法条引用权限
    {
      permission: CasePermission.VIEW_LEGAL_REFERENCES,
      label: '查看法条引用',
      category: '法条引用',
    },
    {
      permission: CasePermission.EDIT_LEGAL_REFERENCES,
      label: '编辑法条引用',
      category: '法条引用',
    },
    {
      permission: CasePermission.DELETE_LEGAL_REFERENCES,
      label: '删除法条引用',
      category: '法条引用',
    },

    // 团队管理权限
    {
      permission: CasePermission.VIEW_TEAM_MEMBERS,
      label: '查看团队成员',
      category: '团队管理',
    },
    {
      permission: CasePermission.ADD_TEAM_MEMBERS,
      label: '添加团队成员',
      category: '团队管理',
    },
    {
      permission: CasePermission.EDIT_TEAM_MEMBERS,
      label: '编辑团队成员',
      category: '团队管理',
    },
    {
      permission: CasePermission.REMOVE_TEAM_MEMBERS,
      label: '移除团队成员',
      category: '团队管理',
    },

    // 沟通权限
    {
      permission: CasePermission.VIEW_DISCUSSIONS,
      label: '查看讨论',
      category: '沟通',
    },
    {
      permission: CasePermission.POST_DISCUSSIONS,
      label: '发表讨论',
      category: '沟通',
    },
    {
      permission: CasePermission.EDIT_DISCUSSIONS,
      label: '编辑讨论',
      category: '沟通',
    },
    {
      permission: CasePermission.DELETE_DISCUSSIONS,
      label: '删除讨论',
      category: '沟通',
    },

    // 导出权限
    {
      permission: CasePermission.EXPORT_DATA,
      label: '导出数据',
      category: '导出',
    },
  ];

  return permissionCategories;
}
