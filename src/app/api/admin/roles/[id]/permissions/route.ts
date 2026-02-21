/**
 * 角色权限管理API
 * 提供角色权限的查询、分配和撤销操作
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type {
  AssignPermissionRequest,
  PermissionsListResponse,
} from '@/types/admin-role';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 检查角色是否存在
 */
async function checkRoleExists(roleId: string): Promise<boolean> {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });
  return role !== null;
}

/**
 * 检查权限是否存在
 */
async function checkPermissionExists(permissionId: string): Promise<boolean> {
  const permission = await prisma.permission.findUnique({
    where: { id: permissionId },
  });
  return permission !== null;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/roles/[id]/permissions
 * 获取角色的权限列表（管理员权限）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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
  const permissionError = await validatePermissions(request, 'user:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { id } = params;

    // 检查角色是否存在
    const roleExists = await checkRoleExists(id);
    if (!roleExists) {
      return Response.json(
        { error: '资源不存在', message: '角色不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 查询角色的权限
    const rolePermissions = await prisma.rolePermission.findMany({
      where: { roleId: id },
      include: {
        permission: true,
      },
      orderBy: {
        permission: {
          resource: 'asc',
          action: 'asc',
        },
      },
    });

    const permissions = rolePermissions.map(rp => ({
      id: rp.permission.id,
      name: rp.permission.name,
      description: rp.permission.description,
      resource: rp.permission.resource,
      action: rp.permission.action,
    }));

    const responseData: PermissionsListResponse = {
      permissions,
      total: permissions.length,
    };

    return Response.json(
      { data: responseData },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('获取角色权限失败:', error);
    return Response.json(
      { error: '服务器错误', message: '获取角色权限失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * POST /api/admin/roles/[id]/permissions
 * 为角色分配权限（管理员权限）
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const { id } = params;
    const body = (await request.json()) as AssignPermissionRequest;

    // 验证必填字段
    const { permissionId } = body;
    if (!permissionId) {
      return Response.json(
        { error: '参数错误', message: '权限ID不能为空' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    // 检查角色是否存在
    const roleExists = await checkRoleExists(id);
    if (!roleExists) {
      return Response.json(
        { error: '资源不存在', message: '角色不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 检查权限是否存在
    const permissionExists = await checkPermissionExists(permissionId);
    if (!permissionExists) {
      return Response.json(
        { error: '资源不存在', message: '权限不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 检查角色是否已拥有该权限
    const existingAssignment = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: id,
          permissionId,
        },
      },
    });

    if (existingAssignment) {
      return Response.json(
        { error: '参数错误', message: '角色已拥有该权限' },
        { status: 409 }
      ) as unknown as NextResponse;
    }

    // 分配权限
    await prisma.rolePermission.create({
      data: {
        roleId: id,
        permissionId,
      },
    });

    return Response.json(
      { message: '权限分配成功' },
      { status: 201 }
    ) as unknown as NextResponse;
  } catch (error) {
    logger.error('分配权限失败:', error);
    return Response.json(
      { error: '服务器错误', message: '分配权限失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}
