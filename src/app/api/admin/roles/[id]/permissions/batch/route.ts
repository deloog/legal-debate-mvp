/**
 * 角色权限批量操作API
 * 提供角色权限的批量分配和批量撤销操作
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 批量分配权限请求体
 */
interface BatchAssignPermissionsRequest {
  permissionIds: string[];
}

/**
 * 批量撤销权限请求体
 */
interface BatchRevokePermissionsRequest {
  permissionIds: string[];
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * PUT /api/admin/roles/[id]/permissions/batch
 * 批量为角色分配权限（管理员权限）
 */
export async function PUT(
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
    const body = (await request.json()) as BatchAssignPermissionsRequest;

    // 验证必填字段
    if (!body.permissionIds || !Array.isArray(body.permissionIds)) {
      return Response.json(
        { error: '参数错误', message: '权限ID列表必须为数组' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    if (body.permissionIds.length === 0) {
      return Response.json(
        { error: '参数错误', message: '权限ID列表不能为空' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    // 检查角色是否存在
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return Response.json(
        { error: '资源不存在', message: '角色不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 检查所有权限是否存在
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: body.permissionIds },
      },
    });

    if (permissions.length !== body.permissionIds.length) {
      return Response.json(
        { error: '参数错误', message: '部分权限不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 批量创建角色权限关联（跳过重复）
    const result = await prisma.rolePermission.createMany({
      data: body.permissionIds.map(permissionId => ({
        roleId: id,
        permissionId,
      })),
      skipDuplicates: true,
    });

    return Response.json(
      {
        message: `成功分配 ${result.count} 个权限`,
        count: result.count,
      },
      { status: 201 }
    ) as unknown as NextResponse;
  } catch (error) {
    console.error('批量分配权限失败:', error);
    return Response.json(
      { error: '服务器错误', message: '批量分配权限失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * DELETE /api/admin/roles/[id]/permissions/batch
 * 批量撤销角色的权限（管理员权限）
 */
export async function DELETE(
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
    const body = (await request.json()) as BatchRevokePermissionsRequest;

    // 验证必填字段
    if (!body.permissionIds || !Array.isArray(body.permissionIds)) {
      return Response.json(
        { error: '参数错误', message: '权限ID列表必须为数组' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    if (body.permissionIds.length === 0) {
      return Response.json(
        { error: '参数错误', message: '权限ID列表不能为空' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    // 检查角色是否存在
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      return Response.json(
        { error: '资源不存在', message: '角色不存在' },
        { status: 404 }
      ) as unknown as NextResponse;
    }

    // 批量删除角色权限关联
    const result = await prisma.rolePermission.deleteMany({
      where: {
        roleId: id,
        permissionId: { in: body.permissionIds },
      },
    });

    return Response.json(
      {
        message: `成功撤销 ${result.count} 个权限`,
        count: result.count,
      },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    console.error('批量撤销权限失败:', error);
    return Response.json(
      { error: '服务器错误', message: '批量撤销权限失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}
