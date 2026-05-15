/**
 * 用户角色管理API
 * 提供用户角色的分配和查询操作
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { createAuditLog } from '@/lib/audit/logger';
import type { AssignRoleRequest, UserRoleResponse } from '@/types/admin-user';
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

/**
 * PUT /api/admin/users/[id]/role
 * 为用户分配角色（管理员权限）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
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
    const { id } = await params;
    const body = (await request.json()) as AssignRoleRequest;

    // 验证必填字段
    if (!body.role) {
      return Response.json(
        { error: '参数错误', message: '角色不能为空' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    // 验证角色名称
    if (!isValidRole(body.role)) {
      return Response.json(
        { error: '参数错误', message: '无效的角色名称' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    const [currentUserRole, targetUser] = await Promise.all([
      getFreshUserRole(user.userId),
      prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true },
      }),
    ]);

    if (!targetUser) {
      return Response.json(
        { error: '资源不存在', message: '用户不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    if (id === user.userId && body.role !== targetUser.role) {
      return Response.json(
        { error: '禁止操作', message: '不能通过后台修改自己的角色' },
        { status: 403 }
      ) as unknown as NextResponse;
    }

    if (
      requiresSuperAdminForUserRoleChange(targetUser.role, body.role) &&
      !canManagePrivilegedRole(currentUserRole)
    ) {
      return Response.json(
        {
          error: '权限不足',
          message: '只有超级管理员可以管理管理员或超级管理员角色',
        },
        { status: 403 }
      ) as unknown as NextResponse;
    }

    // 更新用户角色
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: body.role as UserRole },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const responseData: UserRoleResponse = {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      name: updatedUser.name,
      role: updatedUser.role,
      status: updatedUser.status,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };

    // 记录角色变更审计日志（异步，不阻塞响应）
    createAuditLog({
      userId: user.userId,
      actionType: 'UPDATE_USER_ROLE',
      actionCategory: 'ADMIN',
      description: `管理员修改用户角色 → ${body.role}`,
      resourceType: 'User',
      resourceId: id,
      metadata: { newRole: body.role },
    }).catch(auditErr => {
      logger.error('角色变更审计日志记录失败:', auditErr);
    });

    return Response.json(
      {
        success: true,
        message: '角色分配成功',
        data: responseData,
      },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('分配角色失败:', error);
    return Response.json(
      { error: '服务器错误', message: '分配角色失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}
