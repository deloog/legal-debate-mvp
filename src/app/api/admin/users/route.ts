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
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  sanitizeSearchKeyword,
  validatePagination,
  validateSortBy,
  validateSortOrder,
} from '@/lib/validation/query-params';
import type { UserListQueryParams, UserListResponse } from '@/types/admin-user';
import { NextRequest, NextResponse } from 'next/server';

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 允许的排序字段白名单
 */
const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'lastLoginAt',
  'email',
  'username',
  'name',
  'role',
  'status',
] as const;

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
  const searchParams = url.searchParams;

  // 使用验证工具处理分页和排序参数
  const pagination = validatePagination({
    page: searchParams.get('page'),
    pageSize: searchParams.get('pageSize') ?? searchParams.get('limit'),
  });

  const sortBy = validateSortBy(
    searchParams.get('sortBy'),
    [...ALLOWED_SORT_FIELDS],
    'createdAt'
  );

  const sortOrder = validateSortOrder(searchParams.get('sortOrder'), 'desc');

  // 清理搜索关键词
  const rawSearch = searchParams.get('search') ?? searchParams.get('keyword');
  const search = rawSearch ? sanitizeSearchKeyword(rawSearch) : undefined;

  return {
    page: pagination.page.toString(),
    pageSize: pagination.limit.toString(),
    sortBy,
    sortOrder,
    role: searchParams.get('role') ?? undefined,
    status: searchParams.get('status') ?? undefined,
    search,
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
    // 解析查询参数（已包含验证和清理）
    const params = parseQueryParams(request);
    const page = Number.parseInt(params.page ?? '1', 10);
    const pageSize = Number.parseInt(params.pageSize ?? '20', 10);
    const { sortBy, sortOrder } = params;
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
        [sortBy as string]: sortOrder,
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
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    return successResponse(responseData, '获取用户列表成功');
  } catch (error) {
    logger.error('获取用户列表失败:', error);
    return serverErrorResponse('获取用户列表失败');
  }
}
