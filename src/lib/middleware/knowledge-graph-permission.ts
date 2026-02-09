/**
 * 知识图谱权限控制中间件
 * 用于管理知识图谱相关操作的权限验证和审核日志记录
 */

import { prisma } from '@/lib/db';
import { UserRole, ActionLogType, ActionLogCategory } from '@prisma/client';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 知识图谱操作类型
 */
export enum KnowledgeGraphAction {
  VIEW_RELATIONS = 'view_relations', // 查看关系列表
  VIEW_STATS = 'view_stats', // 查看统计数据
  VERIFY_RELATION = 'verify_relation', // 审核关系
  BATCH_VERIFY = 'batch_verify', // 批量审核
  EXPORT_DATA = 'export_data', // 导出数据
  MANAGE_RELATIONS = 'manage_relations', // 管理关系
}

/**
 * 知识图谱资源类型
 */
export enum KnowledgeGraphResource {
  RELATION = 'law_article_relation', // 法条关系
  STATS = 'knowledge_graph_stats', // 统计数据
  GRAPH = 'knowledge_graph', // 知识图谱
}

/**
 * 权限检查结果
 */
export interface KnowledgeGraphPermissionResult {
  hasPermission: boolean;
  reason?: string;
  userRole?: UserRole;
}

/**
 * 审核日志参数
 */
export interface LogKnowledgeGraphActionParams {
  userId: string;
  action: KnowledgeGraphAction;
  resource: KnowledgeGraphResource;
  resourceId?: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

// =============================================================================
// 权限检查函数
// =============================================================================

/**
 * 检查用户是否有知识图谱操作权限
 * @param userId 用户ID
 * @param action 操作类型
 * @param resource 资源类型
 * @returns 权限检查结果
 */
export async function checkKnowledgeGraphPermission(
  userId: string,
  action: KnowledgeGraphAction,
  resource: KnowledgeGraphResource
): Promise<KnowledgeGraphPermissionResult> {
  try {
    // 检查用户是否存在
    if (!userId || userId.trim() === '') {
      return {
        hasPermission: false,
        reason: '用户不存在',
      };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true },
    });

    if (!user) {
      return {
        hasPermission: false,
        reason: '用户不存在',
      };
    }

    if (user.deletedAt) {
      return {
        hasPermission: false,
        reason: '用户已被删除',
      };
    }

    // 检查操作权限
    const hasPermission = checkActionPermission(user.role, action);

    if (!hasPermission) {
      return {
        hasPermission: false,
        reason: '需要管理员权限',
        userRole: user.role,
      };
    }

    return {
      hasPermission: true,
      userRole: user.role,
    };
  } catch (error) {
    console.error('检查知识图谱权限时出错:', error);
    return {
      hasPermission: false,
      reason: '权限检查失败',
    };
  }
}

/**
 * 检查用户角色是否有执行指定操作的权限
 * @param userRole 用户角色
 * @param action 操作类型
 * @returns 是否有权限
 */
function checkActionPermission(
  userRole: UserRole,
  action: KnowledgeGraphAction
): boolean {
  // 超级管理员和管理员拥有所有权限
  if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
    return true;
  }

  // 普通用户只能查看数据
  const readOnlyActions = [
    KnowledgeGraphAction.VIEW_RELATIONS,
    KnowledgeGraphAction.VIEW_STATS,
  ];

  return readOnlyActions.includes(action);
}

// =============================================================================
// 审核日志记录函数
// =============================================================================

/**
 * 记录知识图谱操作日志
 * @param params 日志参数
 */
export async function logKnowledgeGraphAction(
  params: LogKnowledgeGraphActionParams
): Promise<void> {
  const {
    userId,
    action,
    resource,
    resourceId,
    description,
    ipAddress,
    userAgent,
    metadata,
  } = params;

  try {
    // 映射操作类型到 ActionLogType
    const actionType = mapActionToLogType(action);

    // 创建日志记录
    await prisma.actionLog.create({
      data: {
        userId,
        actionType,
        actionCategory: ActionLogCategory.ADMIN,
        description,
        resourceType: resource,
        resourceId: resourceId || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  } catch (error) {
    console.error('记录知识图谱操作日志失败:', error);
    throw new Error('记录操作日志失败');
  }
}

/**
 * 映射知识图谱操作到 ActionLogType
 * @param action 知识图谱操作
 * @returns ActionLogType
 */
function mapActionToLogType(action: KnowledgeGraphAction): ActionLogType {
  const mapping: Record<KnowledgeGraphAction, ActionLogType> = {
    [KnowledgeGraphAction.VIEW_RELATIONS]: ActionLogType.UNKNOWN,
    [KnowledgeGraphAction.VIEW_STATS]: ActionLogType.UNKNOWN,
    [KnowledgeGraphAction.VERIFY_RELATION]: ActionLogType.UNKNOWN,
    [KnowledgeGraphAction.BATCH_VERIFY]: ActionLogType.UNKNOWN,
    [KnowledgeGraphAction.EXPORT_DATA]: ActionLogType.EXPORT_DATA,
    [KnowledgeGraphAction.MANAGE_RELATIONS]: ActionLogType.UNKNOWN,
  };

  return mapping[action] || ActionLogType.UNKNOWN;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 检查用户是否为管理员
 * @param userId 用户ID
 * @returns 是否为管理员
 */
export async function isKnowledgeGraphAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return false;
    }

    return user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN;
  } catch (error) {
    console.error('检查管理员权限时出错:', error);
    return false;
  }
}

/**
 * 批量检查多个用户的权限
 * @param userIds 用户ID列表
 * @param action 操作类型
 * @param resource 资源类型
 * @returns 权限检查结果映射
 */
export async function checkMultipleUsersPermission(
  userIds: string[],
  action: KnowledgeGraphAction,
  resource: KnowledgeGraphResource
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const userId of userIds) {
    const result = await checkKnowledgeGraphPermission(
      userId,
      action,
      resource
    );
    results[userId] = result.hasPermission;
  }

  return results;
}
