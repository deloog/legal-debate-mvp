/**
 * 权限检查中间件
 * 用于API路由的权限验证
 */

import type { NextRequest, NextResponse } from 'next/server';
import { hasPermission } from './permissions';
import type { PermissionCheckResult } from '@/types/permission';
import { getAuthUser } from './auth';

// =============================================================================
// 权限检查选项
// =============================================================================

/**
 * 权限检查模式
 */
export enum PermissionCheckMode {
  ANY = 'any', // 拥有任意一个权限即可
  ALL = 'all', // 必须拥有所有权限
}

/**
 * 权限检查配置选项
 */
export interface PermissionCheckOptions {
  mode?: PermissionCheckMode;
  onError?: (result: PermissionCheckResult) => NextResponse;
}

// =============================================================================
// 权限检查中间件
// =============================================================================

/**
 * 检查请求是否有指定权限
 * @param userId 用户ID
 * @param requiredPermissions 需要的权限列表
 * @param options 检查选项
 * @returns 权限检查结果
 */
export async function checkPermissions(
  userId: string,
  requiredPermissions: string[],
  options: PermissionCheckOptions = {}
): Promise<PermissionCheckResult> {
  const mode = options.mode ?? PermissionCheckMode.ALL;
  const results: PermissionCheckResult[] = [];

  // 检查每个权限
  for (const permission of requiredPermissions) {
    const result = await hasPermission(userId, permission);
    results.push(result);

    // ANY模式：只要有一个权限满足即可
    if (mode === PermissionCheckMode.ANY && result.hasPermission) {
      return {
        hasPermission: true,
        requiredPermission: permission,
      };
    }

    // ALL模式：必须所有权限都满足
    if (mode === PermissionCheckMode.ALL && !result.hasPermission) {
      return {
        hasPermission: false,
        reason: result.reason,
        requiredPermission: permission,
        actualPermissions: result.actualPermissions,
      };
    }
  }

  // ALL模式检查通过
  if (mode === PermissionCheckMode.ALL && results.length > 0) {
    const lastResult = results[results.length - 1] ?? { actualPermissions: [] };
    return {
      hasPermission: true,
      requiredPermission: requiredPermissions.join(','),
      actualPermissions: lastResult.actualPermissions,
    };
  }

  // 默认返回无权限
  return {
    hasPermission: false,
    reason: '缺少所需权限',
    requiredPermission: requiredPermissions.join(','),
  };
}

/**
 * 创建权限检查中间件
 * @param requiredPermissions 需要的权限列表
 * @param options 检查选项
 * @returns 中间件函数
 */
export function requirePermission(
  requiredPermissions: string | string[],
  options: PermissionCheckOptions = {}
) {
  return async function (request: NextRequest, userId: string) {
    const permissions = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    const result = await checkPermissions(userId, permissions, options);

    if (!result.hasPermission) {
      if (options.onError) {
        return options.onError(result);
      }
      return createPermissionErrorResponse(result);
    }

    return null;
  };
}

/**
 * 创建权限错误响应
 * @param result 权限检查结果
 * @returns 403错误响应
 */
function createPermissionErrorResponse(
  result: PermissionCheckResult
): NextResponse {
  return Response.json(
    {
      error: '权限不足',
      message: result.reason ?? '您没有执行此操作的权限',
      requiredPermission: result.requiredPermission,
      actualPermissions: result.actualPermissions ?? [],
    },
    { status: 403 }
  ) as unknown as NextResponse;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证权限名称格式
 * @param permission 权限名称
 * @returns 是否有效
 */
export function isValidPermissionName(permission: string): boolean {
  const regex = /^[a-z_]+:[a-z_]+$/;
  return regex.test(permission);
}

/**
 * 从请求中提取用户ID
 * @param request NextRequest对象
 * @returns 用户ID或null
 */
export function extractUserIdFromRequest(request: NextRequest): string | null {
  const userId = request.headers.get('x-user-id');
  return userId ?? null;
}

/**
 * 简化的权限检查函数
 * @param request NextRequest对象
 * @param requiredPermissions 需要的权限
 * @param options 检查选项
 * @returns NextResponse或null
 */
export async function validatePermissions(
  request: NextRequest,
  requiredPermissions: string | string[],
  options: PermissionCheckOptions = {}
): Promise<NextResponse | null> {
  // 先从JWT token中获取用户信息
  const user = await getAuthUser(request);

  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    ) as unknown as NextResponse;
  }

  // 使用JWT payload中的userId
  const userId = user.userId;

  const checkMiddleware = requirePermission(requiredPermissions, options);
  return checkMiddleware(request, userId);
}
