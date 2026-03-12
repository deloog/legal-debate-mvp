/**
 * 用户角色管理API
 * 提供用户角色的分配和查询操作
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type { AssignRoleRequest, UserRoleResponse } from '@/types/admin-user';
import type { UserRole } from '@/types/auth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

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
 * 检查用户是否存在
 */
async function checkUserExists(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  return user !== null;
}

// =============================================================================
// API处理函数
// =============================================================================

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

    // 检查用户是否存在
    const userExists = await checkUserExists(id);
    if (!userExists) {
      return Response.json(
        { error: '资源不存在', message: '用户不存在' },
        { status: 404 }
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
