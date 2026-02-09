/**
 * 角色管理API
 * 提供角色的CRUD操作
 */

import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type {
  CreateRoleRequest,
  RoleListQueryParams,
  RoleListResponse,
} from '@/types/admin-role';
import type { UserRole } from '@/types/auth';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): RoleListQueryParams {
  const url = new URL(request.url);
  return {
    page: url.searchParams.get('page') ?? '1',
    pageSize:
      url.searchParams.get('pageSize') ?? url.searchParams.get('limit') ?? '20',
    search:
      url.searchParams.get('search') ??
      url.searchParams.get('keyword') ??
      undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: RoleListQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.search && params.search.trim() !== '') {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/roles
 * 获取角色列表（管理员权限）
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
    // 解析查询参数
    const params = parseQueryParams(request);
    const page = Math.max(1, Number.parseInt(params.page, 10));
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(params.pageSize, 10))
    );
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where = buildWhereClause(params);

    // 查询角色总数
    const total = await prisma.role.count({ where });

    // 查询角色列表
    const roles = await prisma.role.findMany({
      where,
      skip,
      take: pageSize,
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    // 获取每个角色的用户数量
    const rolesWithUserCount = await Promise.all(
      roles.map(async role => {
        const userCount = await prisma.user.count({
          where: { role: role.name as UserRole },
        });

        return {
          id: role.id,
          name: role.name,
          description: role.description,
          isDefault: role.isDefault,
          permissions: role.permissions.map(rp => ({
            id: rp.permission.id,
            name: rp.permission.name,
            description: rp.permission.description,
          })),
          userCount,
          createdAt: role.createdAt,
          updatedAt: role.updatedAt,
        };
      })
    );

    // 构建响应数据
    const responseData: RoleListResponse = {
      roles: rolesWithUserCount,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    return Response.json(
      { data: responseData },
      { status: 200 }
    ) as unknown as NextResponse;
  } catch (error) {
    console.error('获取角色列表失败:', error);
    return Response.json(
      { error: '服务器错误', message: '获取角色列表失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}

/**
 * POST /api/admin/roles
 * 创建新角色（管理员权限）
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return Response.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    ) as unknown as NextResponse;
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'user:create');
  if (permissionError) {
    return permissionError;
  }

  try {
    const body = (await request.json()) as CreateRoleRequest;

    // 验证必填字段
    if (!body.name || body.name.trim() === '') {
      return Response.json(
        { error: '参数错误', message: '角色名称不能为空' },
        { status: 400 }
      ) as unknown as NextResponse;
    }

    // 检查角色名称是否已存在
    const existingRole = await prisma.role.findUnique({
      where: { name: body.name },
    });

    if (existingRole) {
      return Response.json(
        { error: '参数错误', message: '角色名称已存在' },
        { status: 409 }
      ) as unknown as NextResponse;
    }

    // 创建角色
    const newRole = await prisma.role.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() ?? null,
        isDefault: body.isDefault ?? false,
      },
    });

    return Response.json(
      {
        message: '角色创建成功',
        data: {
          id: newRole.id,
          name: newRole.name,
          description: newRole.description,
          isDefault: newRole.isDefault,
        },
      },
      { status: 201 }
    ) as unknown as NextResponse;
  } catch (error) {
    console.error('创建角色失败:', error);
    return Response.json(
      { error: '服务器错误', message: '创建角色失败' },
      { status: 500 }
    ) as unknown as NextResponse;
  }
}
