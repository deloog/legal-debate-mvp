/**
 * 权限控制增强模块
 *
 * 提供细粒度的权限控制和验证
 */

import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { logger } from '@/lib/logger';

// 权限枚举
export enum Permission {
  // 案件管理
  CASE_VIEW = 'case:view',
  CASE_CREATE = 'case:create',
  CASE_EDIT = 'case:edit',
  CASE_DELETE = 'case:delete',
  CASE_EXPORT = 'case:export',

  // 合同管理
  CONTRACT_VIEW = 'contract:view',
  CONTRACT_CREATE = 'contract:create',
  CONTRACT_EDIT = 'contract:edit',
  CONTRACT_DELETE = 'contract:delete',
  CONTRACT_SIGN = 'contract:sign',

  // 辩论系统
  DEBATE_VIEW = 'debate:view',
  DEBATE_CREATE = 'debate:create',
  DEBATE_EDIT = 'debate:edit',
  DEBATE_DELETE = 'debate:delete',

  // 知识图谱管理
  GRAPH_VIEW = 'graph:view',
  GRAPH_EDIT = 'graph:edit',
  GRAPH_VERIFY = 'graph:verify',
  GRAPH_DELETE = 'graph:delete',

  // 法条管理
  LAW_ARTICLE_VIEW = 'law_article:view',
  LAW_ARTICLE_IMPORT = 'law_article:import',
  LAW_ARTICLE_EDIT = 'law_article:edit',
  LAW_ARTICLE_DELETE = 'law_article:delete',

  // 用户管理
  USER_VIEW = 'user:view',
  USER_CREATE = 'user:create',
  USER_EDIT = 'user:edit',
  USER_DELETE = 'user:delete',
  USER_MANAGE_ROLES = 'user:manage_roles',

  // 系统管理
  ADMIN_VIEW = 'admin:view',
  ADMIN_EDIT = 'admin:edit',
  ADMIN_SYSTEM_CONFIG = 'admin:system_config',
  ADMIN_VIEW_LOGS = 'admin:view_logs',

  // 数据导入导出
  DATA_IMPORT = 'data:import',
  DATA_EXPORT = 'data:export',
  DATA_BACKUP = 'data:backup',
  DATA_RESTORE = 'data:restore',

  // 反馈管理
  FEEDBACK_VIEW = 'feedback:view',
  FEEDBACK_MANAGE = 'feedback:manage',

  // 统计分析
  STATS_VIEW = 'stats:view',
  STATS_EXPORT = 'stats:export',
}

// 角色权限映射
export const RolePermissions: Record<string, Permission[]> = {
  // 超级管理员 - 拥有所有权限
  ADMIN: Object.values(Permission),

  // 管理员 - 大部分管理权限
  MANAGER: [
    // 案件
    Permission.CASE_VIEW,
    Permission.CASE_CREATE,
    Permission.CASE_EDIT,
    Permission.CASE_DELETE,
    Permission.CASE_EXPORT,
    // 合同
    Permission.CONTRACT_VIEW,
    Permission.CONTRACT_CREATE,
    Permission.CONTRACT_EDIT,
    Permission.CONTRACT_DELETE,
    Permission.CONTRACT_SIGN,
    // 辩论
    Permission.DEBATE_VIEW,
    Permission.DEBATE_CREATE,
    Permission.DEBATE_EDIT,
    Permission.DEBATE_DELETE,
    // 知识图谱
    Permission.GRAPH_VIEW,
    Permission.GRAPH_EDIT,
    Permission.GRAPH_VERIFY,
    // 法条
    Permission.LAW_ARTICLE_VIEW,
    Permission.LAW_ARTICLE_IMPORT,
    Permission.LAW_ARTICLE_EDIT,
    // 用户
    Permission.USER_VIEW,
    Permission.USER_EDIT,
    // 反馈
    Permission.FEEDBACK_VIEW,
    Permission.FEEDBACK_MANAGE,
    // 统计
    Permission.STATS_VIEW,
    Permission.STATS_EXPORT,
  ],

  // 律师 - 专业用户权限
  LAWYER: [
    // 案件
    Permission.CASE_VIEW,
    Permission.CASE_CREATE,
    Permission.CASE_EDIT,
    Permission.CASE_EXPORT,
    // 合同
    Permission.CONTRACT_VIEW,
    Permission.CONTRACT_CREATE,
    Permission.CONTRACT_EDIT,
    Permission.CONTRACT_SIGN,
    // 辩论
    Permission.DEBATE_VIEW,
    Permission.DEBATE_CREATE,
    Permission.DEBATE_EDIT,
    // 知识图谱
    Permission.GRAPH_VIEW,
    // 法条
    Permission.LAW_ARTICLE_VIEW,
    // 反馈
    Permission.FEEDBACK_VIEW,
    // 统计
    Permission.STATS_VIEW,
  ],

  // 普通用户 - 基础权限
  USER: [
    // 案件
    Permission.CASE_VIEW,
    Permission.CASE_CREATE,
    // 合同
    Permission.CONTRACT_VIEW,
    Permission.CONTRACT_CREATE,
    // 辩论
    Permission.DEBATE_VIEW,
    Permission.DEBATE_CREATE,
    // 知识图谱
    Permission.GRAPH_VIEW,
    // 法条
    Permission.LAW_ARTICLE_VIEW,
  ],

  // 访客 - 只读权限
  GUEST: [
    Permission.CASE_VIEW,
    Permission.CONTRACT_VIEW,
    Permission.DEBATE_VIEW,
    Permission.GRAPH_VIEW,
    Permission.LAW_ARTICLE_VIEW,
  ],
};

/**
 * 检查用户是否拥有指定权限
 */
export function hasPermission(
  userRole: string,
  permission: Permission
): boolean {
  const permissions = RolePermissions[userRole] || [];
  return permissions.includes(permission);
}

/**
 * 检查用户是否拥有任一权限
 */
export function hasAnyPermission(
  userRole: string,
  permissions: Permission[]
): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * 检查用户是否拥有所有权限
 */
export function hasAllPermissions(
  userRole: string,
  permissions: Permission[]
): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * 获取用户的所有权限
 */
export function getUserPermissions(userRole: string): Permission[] {
  return RolePermissions[userRole] || [];
}

/**
 * 权限检查中间件
 */
export function requirePermission(permission: Permission) {
  return async (req: NextRequest) => {
    try {
      // 从请求头获取token
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return Response.json(
          { success: false, error: '未提供认证令牌' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const decoded = await verifyToken(token);

      if (!decoded || !decoded.userId) {
        return Response.json(
          { success: false, error: '无效的认证令牌' },
          { status: 401 }
        );
      }

      // 检查权限
      const userRole = decoded.role || 'USER';
      if (!hasPermission(userRole, permission)) {
        return Response.json(
          {
            success: false,
            error: '权限不足',
            required: permission,
            userRole,
          },
          { status: 403 }
        );
      }

      // 权限检查通过，返回null表示继续处理
      return null;
    } catch (error) {
      logger.error('权限检查失败:', error);
      return Response.json(
        { success: false, error: '权限检查失败' },
        { status: 500 }
      );
    }
  };
}

/**
 * 多权限检查中间件（需要任一权限）
 */
export function requireAnyPermission(permissions: Permission[]) {
  return async (req: NextRequest) => {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return Response.json(
          { success: false, error: '未提供认证令牌' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const decoded = await verifyToken(token);

      if (!decoded || !decoded.userId) {
        return Response.json(
          { success: false, error: '无效的认证令牌' },
          { status: 401 }
        );
      }

      const userRole = decoded.role || 'USER';
      if (!hasAnyPermission(userRole, permissions)) {
        return Response.json(
          {
            success: false,
            error: '权限不足',
            required: permissions,
            userRole,
          },
          { status: 403 }
        );
      }

      return null;
    } catch (error) {
      logger.error('权限检查失败:', error);
      return Response.json(
        { success: false, error: '权限检查失败' },
        { status: 500 }
      );
    }
  };
}

/**
 * 多权限检查中间件（需要所有权限）
 */
export function requireAllPermissions(permissions: Permission[]) {
  return async (req: NextRequest) => {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return Response.json(
          { success: false, error: '未提供认证令牌' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const decoded = await verifyToken(token);

      if (!decoded || !decoded.userId) {
        return Response.json(
          { success: false, error: '无效的认证令牌' },
          { status: 401 }
        );
      }

      const userRole = decoded.role || 'USER';
      if (!hasAllPermissions(userRole, permissions)) {
        return Response.json(
          {
            success: false,
            error: '权限不足',
            required: permissions,
            userRole,
          },
          { status: 403 }
        );
      }

      return null;
    } catch (error) {
      logger.error('权限检查失败:', error);
      return Response.json(
        { success: false, error: '权限检查失败' },
        { status: 500 }
      );
    }
  };
}

/**
 * 资源所有权检查
 */
export async function checkResourceOwnership(
  userId: string,
  resourceType: 'case' | 'contract' | 'debate',
  resourceId: string
): Promise<boolean> {
  // 这里应该查询数据库检查资源所有权
  // 简化实现，实际应该根据resourceType查询对应的表
  try {
    const { prisma } = await import('@/lib/db/prisma');

    switch (resourceType) {
      case 'case': {
        const caseItem = await prisma.case.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return caseItem?.userId === userId;
      }
      case 'contract': {
        const contract = await prisma.contract.findUnique({
          where: { id: resourceId },
          select: { lawyerId: true },
        });
        return contract?.lawyerId === userId;
      }
      case 'debate': {
        const debate = await prisma.debate.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        });
        return debate?.userId === userId;
      }
      default:
        return false;
    }
  } catch (error) {
    logger.error('资源所有权检查失败:', error);
    return false;
  }
}

/**
 * 资源所有权或管理员权限检查
 */
export function requireOwnershipOrAdmin(
  resourceType: 'case' | 'contract' | 'debate',
  _resourceIdParam: string = 'id'
) {
  return async (req: NextRequest) => {
    try {
      const authHeader = req.headers.get('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return Response.json(
          { success: false, error: '未提供认证令牌' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      const decoded = await verifyToken(token);

      if (!decoded || !decoded.userId) {
        return Response.json(
          { success: false, error: '无效的认证令牌' },
          { status: 401 }
        );
      }

      const userRole = decoded.role || 'USER';

      // 管理员直接通过
      if (userRole === 'ADMIN' || userRole === 'MANAGER') {
        return null;
      }

      // 检查资源所有权
      const url = new URL(req.url);
      const resourceId = url.pathname
        .split('/')
        .find((_, i, arr) => arr[i - 1] === resourceType + 's');

      if (!resourceId) {
        return Response.json(
          { success: false, error: '无效的资源ID' },
          { status: 400 }
        );
      }

      const isOwner = await checkResourceOwnership(
        decoded.userId,
        resourceType,
        resourceId
      );

      if (!isOwner) {
        return Response.json(
          { success: false, error: '权限不足：您不是该资源的所有者' },
          { status: 403 }
        );
      }

      return null;
    } catch (error) {
      logger.error('权限检查失败:', error);
      return Response.json(
        { success: false, error: '权限检查失败' },
        { status: 500 }
      );
    }
  };
}
