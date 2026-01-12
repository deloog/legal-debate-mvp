/**
 * 资源权限中间件
 * 用于实现资源级权限控制（基于所有权的访问控制）
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import type { UserRole } from '@/types/auth';

// =============================================================================
// 资源类型枚举
// =============================================================================

/**
 * 资源类型
 */
export enum ResourceType {
  CASE = 'case',
  DEBATE = 'debate',
  DOCUMENT = 'document',
}

// =============================================================================
// 资源权限检查结果
// =============================================================================

/**
 * 资源权限检查结果
 */
export interface ResourcePermissionResult {
  hasPermission: boolean;
  reason?: string;
  resource?: unknown;
}

// =============================================================================
// 资源权限检查函数
// =============================================================================

/**
 * 检查用户是否拥有指定资源
 * @param userId 用户ID
 * @param resourceId 资源ID
 * @param resourceType 资源类型
 * @returns 权限检查结果
 */
export async function checkResourceOwnership(
  userId: string,
  resourceId: string,
  resourceType: ResourceType
): Promise<ResourcePermissionResult> {
  try {
    // 检查用户是否存在和角色
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

    // 管理员和超级管理员可以访问所有资源
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      return {
        hasPermission: true,
      };
    }

    // 根据资源类型检查所有权
    switch (resourceType) {
      case ResourceType.CASE:
        return await checkCaseOwnership(userId, resourceId);

      case ResourceType.DEBATE:
        return await checkDebateOwnership(userId, resourceId);

      case ResourceType.DOCUMENT:
        return await checkDocumentOwnership(userId, resourceId);

      default:
        return {
          hasPermission: false,
          reason: '不支持的资源类型',
        };
    }
  } catch (error) {
    console.error(`检查资源权限时出错: ${error}`);
    return {
      hasPermission: false,
      reason: '权限检查失败',
    };
  }
}

/**
 * 检查案件所有权
 * @param userId 用户ID
 * @param caseId 案件ID
 * @returns 权限检查结果
 */
async function checkCaseOwnership(
  userId: string,
  caseId: string
): Promise<ResourcePermissionResult> {
  const caseItem = await prisma.case.findUnique({
    where: { id: caseId },
    select: { id: true, userId: true, deletedAt: true },
  });

  if (!caseItem) {
    return {
      hasPermission: false,
      reason: '案件不存在',
    };
  }

  if (caseItem.deletedAt) {
    return {
      hasPermission: false,
      reason: '案件已被删除',
    };
  }

  if (caseItem.userId !== userId) {
    return {
      hasPermission: false,
      reason: '您无权访问此案件',
    };
  }

  return {
    hasPermission: true,
  };
}

/**
 * 检查辩论所有权
 * @param userId 用户ID
 * @param debateId 辩论ID
 * @returns 权限检查结果
 */
async function checkDebateOwnership(
  userId: string,
  debateId: string
): Promise<ResourcePermissionResult> {
  const debate = await prisma.debate.findUnique({
    where: { id: debateId },
    select: { id: true, userId: true, deletedAt: true, caseId: true },
  });

  if (!debate) {
    return {
      hasPermission: false,
      reason: '辩论不存在',
    };
  }

  if (debate.deletedAt) {
    return {
      hasPermission: false,
      reason: '辩论已被删除',
    };
  }

  // 检查用户是否是辩论创建者
  if (debate.userId === userId) {
    return {
      hasPermission: true,
    };
  }

  // 检查用户是否拥有辩论所属案件
  const caseItem = await prisma.case.findUnique({
    where: { id: debate.caseId },
    select: { userId: true, deletedAt: true },
  });

  if (caseItem && !caseItem.deletedAt && caseItem.userId === userId) {
    return {
      hasPermission: true,
    };
  }

  return {
    hasPermission: false,
    reason: '您无权访问此辩论',
  };
}

/**
 * 检查文档所有权
 * @param userId 用户ID
 * @param documentId 文档ID
 * @returns 权限检查结果
 */
async function checkDocumentOwnership(
  userId: string,
  documentId: string
): Promise<ResourcePermissionResult> {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, userId: true, deletedAt: true, caseId: true },
  });

  if (!document) {
    return {
      hasPermission: false,
      reason: '文档不存在',
    };
  }

  if (document.deletedAt) {
    return {
      hasPermission: false,
      reason: '文档已被删除',
    };
  }

  // 检查用户是否是文档创建者
  if (document.userId === userId) {
    return {
      hasPermission: true,
    };
  }

  // 检查用户是否拥有文档所属案件
  const caseItem = await prisma.case.findUnique({
    where: { id: document.caseId },
    select: { userId: true, deletedAt: true },
  });

  if (caseItem && !caseItem.deletedAt && caseItem.userId === userId) {
    return {
      hasPermission: true,
    };
  }

  return {
    hasPermission: false,
    reason: '您无权访问此文档',
  };
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 批量检查多个资源权限
 * @param userId 用户ID
 * @param resourceIds 资源ID数组
 * @param resourceType 资源类型
 * @returns 权限检查结果映射
 */
export async function checkMultipleResourcePermissions(
  userId: string,
  resourceIds: string[],
  resourceType: ResourceType
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const resourceId of resourceIds) {
    const result = await checkResourceOwnership(
      userId,
      resourceId,
      resourceType
    );
    results[resourceId] = result.hasPermission;
  }

  return results;
}

/**
 * 检查用户角色是否为管理员
 * @param userRole 用户角色
 * @returns 是否为管理员
 */
export function isAdminRole(userRole: UserRole): boolean {
  return userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
}

/**
 * 创建权限错误响应
 * @param reason 拒绝原因
 * @returns 403错误响应
 */
export function createPermissionErrorResponse(reason: string): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: reason || '权限不足',
        timestamp: new Date().toISOString(),
      },
    },
    { status: 403 }
  );
}
