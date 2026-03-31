/**
 * 角色详情API
 * 提供单个角色的查询、更新和删除操作
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import { logRoleChange } from '@/lib/membership/audit-logger';
import { RoleDetailResponse } from '@/types/admin-role';
import type { UserRole } from '@/types/auth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 检查角色是否为系统内置角色（不能删除）
 */
function isSystemRole(roleName: string): boolean {
  const systemRoles = ['USER', 'LAWYER', 'ENTERPRISE', 'ADMIN', 'SUPER_ADMIN'];
  return systemRoles.includes(roleName);
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/roles/[id]
 * 获取角色详情（管理员权限）
 */
export async function GET(
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

  // 检查权限 - 使用 role:read 权限
  const permissionError = await validatePermissions(request, 'role:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { id } = await params;

    // 查询角色详情
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
          orderBy: [
            { permission: { resource: 'asc' } },
            { permission: { action: 'asc' } },
          ],
        },
      },
    });

    if (!role) {
      return Response.json(
        { error: '资源不存在', message: '角色不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 获取使用该角色的用户数量
    const userCount = await prisma.user.count({
      where: { role: role.name as UserRole },
    });

    // 构建响应数据
    const responseData: RoleDetailResponse = {
      id: role.id,
      name: role.name,
      description: role.description,
      isDefault: role.isDefault,
      permissions: role.permissions.map(rp => ({
        id: rp.permission.id,
        name: rp.permission.name,
        description: rp.permission.description,
        resource: rp.permission.resource,
        action: rp.permission.action,
      })),
      userCount,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    };

    return Response.json(
      { data: responseData },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('获取角色详情失败:', error);
    return Response.json(
      { error: '服务器错误', message: '获取角色详情失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * PUT /api/admin/roles/[id]
 * 更新角色信息（管理员权限）
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

  // 检查权限 - 使用 role:update 权限
  const permissionError = await validatePermissions(request, 'role:update');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { id } = await params;
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      isDefault?: boolean;
    };

    // 检查角色是否存在
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return Response.json(
        { error: '资源不存在', message: '角色不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 如果要修改角色名称，检查新名称是否已被使用
    if (body.name && body.name.trim() !== existingRole.name) {
      const nameExists = await prisma.role.findUnique({
        where: { name: body.name.trim() },
      });

      if (nameExists) {
        return Response.json(
          { error: '参数错误', message: '角色名称已被使用' },
          { status: 409 }
        ) as unknown as NextResponse;
      }
    }

    // 更新角色信息
    const updatedRole = await prisma.role.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name.trim() }),
        ...(body.description !== undefined && {
          description: body.description.trim() ?? null,
        }),
        ...(body.isDefault !== undefined && { isDefault: body.isDefault }),
      },
    });

    // 记录审计日志
    await logRoleChange(
      id,
      'update',
      {
        name: updatedRole.name,
        description: updatedRole.description,
        isDefault: updatedRole.isDefault,
      },
      user.userId
    );

    return Response.json(
      {
        message: '角色更新成功',
        data: {
          id: updatedRole.id,
          name: updatedRole.name,
          description: updatedRole.description,
          isDefault: updatedRole.isDefault,
        },
      },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('更新角色失败:', error);
    return Response.json(
      { error: '服务器错误', message: '更新角色失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * DELETE /api/admin/roles/[id]
 * 删除角色（管理员权限）
 */
export async function DELETE(
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

  // 检查权限 - 使用 role:delete 权限
  const permissionError = await validatePermissions(request, 'role:delete');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { id } = await params;

    // 检查角色是否存在
    const existingRole = await prisma.role.findUnique({
      where: { id },
    });

    if (!existingRole) {
      return Response.json(
        { error: '资源不存在', message: '角色不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 检查是否为系统内置角色
    if (isSystemRole(existingRole.name)) {
      return Response.json(
        { error: '操作不允许', message: '系统内置角色不能删除' },
        { status: 403 }
      ) as unknown as NextResponse;
    }

    // 检查是否有用户正在使用该角色
    const userCount = await prisma.user.count({
      where: { role: existingRole.name as UserRole },
    });

    if (userCount > 0) {
      return Response.json(
        {
          error: '操作不允许',
          message: `该角色下还有 ${userCount} 个用户，无法删除`,
        },
        { status: 409 }
      ) as unknown as NextResponse;
    }

    // 记录审计日志（在删除前记录）
    await logRoleChange(
      id,
      'delete',
      {
        name: existingRole.name,
        description: existingRole.description,
      },
      user.userId
    );

    // 删除角色的所有权限关联
    await prisma.rolePermission.deleteMany({
      where: { roleId: id },
    });

    // 删除角色
    await prisma.role.delete({
      where: { id },
    });

    return Response.json(
      { message: '角色删除成功' },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('删除角色失败:', error);
    return Response.json(
      { error: '服务器错误', message: '删除角色失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}
