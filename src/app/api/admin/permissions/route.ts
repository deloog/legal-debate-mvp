/**
 * 权限列表API
 * 提供权限的查询功能
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type { PermissionListResponse } from '@/types/admin-role';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/permissions
 * 获取权限列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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
    // 查询权限列表，按资源和动作排序
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    // 构建响应数据
    const responseData: PermissionListResponse = {
      permissions: permissions.map(perm => ({
        id: perm.id,
        name: perm.name,
        description: perm.description,
        resource: perm.resource,
        action: perm.action,
        createdAt: perm.createdAt,
        updatedAt: perm.updatedAt,
      })),
    };

    return Response.json(
      { data: responseData },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    console.error('获取权限列表失败:', error);
    return Response.json(
      { error: '服务器错误', message: '获取权限列表失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}
