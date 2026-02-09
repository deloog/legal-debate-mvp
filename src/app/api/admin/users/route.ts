/**
 * 用户列表API - 管理员专用
 * 支持分页、筛选、搜索
 */

import {
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import type { UserListQueryParams, UserListResponse } from '@/types/admin-user';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证角色枚举值
 */
function isValidRole(role: string): boolean {
  const validRoles = ['USER', 'LAWYER', 'ENTERPRISE', 'ADMIN', 'SUPER_ADMIN'];
  return validRoles.includes(role);
}

/**
 * 验证状态枚举值
 */
function isValidStatus(status: string): boolean {
  const validStatuses = ['ACTIVE', 'SUSPENDED', 'BANNED', 'INACTIVE'];
  return validStatuses.includes(status);
}

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): UserListQueryParams {
  const url = new URL(request.url);
  return {
    page: url.searchParams.get('page') ?? '1',
    pageSize:
      url.searchParams.get('pageSize') ?? url.searchParams.get('limit') ?? '20',
    role: url.searchParams.get('role') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    search:
      url.searchParams.get('search') ??
      url.searchParams.get('keyword') ??
      undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: UserListQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.role && isValidRole(params.role)) {
    where.role = params.role;
  }

  if (params.status && isValidStatus(params.status)) {
    where.status = params.status;
  }

  if (params.search && params.search.trim() !== '') {
    where.OR = [
      { email: { contains: params.search, mode: 'insensitive' } },
      { username: { contains: params.search, mode: 'insensitive' } },
      { name: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/users
 * 获取用户列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
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

    // 查询用户总数
    const total = await prisma.user.count({ where });

    // 查询用户列表
    const users = await prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 构建响应数据
    const responseData: UserListResponse = {
      users: users.map(user => ({
        ...user,
        phone: null,
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    return successResponse(responseData, '获取用户列表成功');
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return serverErrorResponse('获取用户列表失败');
  }
}
