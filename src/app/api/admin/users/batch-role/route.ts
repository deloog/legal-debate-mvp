/**
 * 批量用户角色管理API
 * 提供批量分配角色给用户的操作
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type {
  BatchAssignDetailResult,
  BatchAssignRoleRequest,
  UserAssignResult,
} from '@/types/admin-user';
import type { UserRole } from '@/types/auth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import {
  canManagePrivilegedRole,
  getFreshUserRole,
  requiresSuperAdminForUserRoleChange,
} from '@/lib/admin/role-security';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证角色名称是否有效
 */
function isValidRole(role: string): boolean {
  const validRoles: Array<string> = [
    'USER',
    'LAWYER',
    'ENTERPRISE',
    'ADMIN',
    'SUPER_ADMIN',
  ];
  return validRoles.includes(role);
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * POST /api/admin/users/batch-role
 * 批量分配角色给用户（管理员权限）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    ) as unknown as NextResponse;
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:update');
  if (permissionError) {
    return permissionError;
  }

  try {
    const body = (await request.json()) as BatchAssignRoleRequest;

    // 验证必填字段
    if (!body.userIds || !Array.isArray(body.userIds)) {
      return NextResponse.json(
        { error: '参数错误', message: '用户ID列表必须为数组' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    if (body.userIds.length === 0) {
      return NextResponse.json(
        { error: '参数错误', message: '用户ID列表不能为空' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    if (!body.role) {
      return NextResponse.json(
        { error: '参数错误', message: '角色不能为空' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    // 验证角色名称
    if (!isValidRole(body.role)) {
      return NextResponse.json(
        { error: '参数错误', message: '无效的角色名称' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    const currentUserRole = await getFreshUserRole(user.userId);

    if (body.userIds.includes(user.userId)) {
      return NextResponse.json(
        { error: '禁止操作', message: '批量角色调整不能包含当前登录账号' },
        { status: 403 }
      ) as unknown as NextResponse;
    }

    // 批量查询用户
    const users = await prisma.user.findMany({
      where: {
        id: { in: body.userIds },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (users.length !== body.userIds.length) {
      return NextResponse.json(
        { error: '参数错误', message: '部分用户不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    const touchesPrivilegedRoles = users.some(targetUser =>
      requiresSuperAdminForUserRoleChange(targetUser.role, body.role)
    );

    if (touchesPrivilegedRoles && !canManagePrivilegedRole(currentUserRole)) {
      return NextResponse.json(
        {
          error: '权限不足',
          message: '只有超级管理员可以批量管理管理员或超级管理员角色',
        },
        { status: 403 }
      ) as unknown as NextResponse;
    }

    // 批量更新用户角色
    const results: UserAssignResult[] = await Promise.all(
      users.map(async u => {
        try {
          await prisma.user.update({
            where: { id: u.id },
            data: { role: body.role as UserRole },
          });
          return {
            success: true,
            userId: u.id,
            email: u.email,
          };
        } catch {
          return {
            success: false,
            userId: u.id,
            email: u.email,
            message: '更新失败',
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    const detailResult: BatchAssignDetailResult = {
      total: results.length,
      success: successCount,
      failed: failureCount,
      results,
    };

    return NextResponse.json(
      {
        message: `成功分配 ${successCount} 个用户的角色，失败 ${failureCount} 个`,
        data: detailResult,
      },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('批量分配角色失败:', error);
    return NextResponse.json(
      { error: '服务器错误', message: '批量分配角色失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}
