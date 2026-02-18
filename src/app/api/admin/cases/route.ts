/**
 * 案件管理API - 管理员专用
 * 支持分页、筛选、搜索、删除
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  validateSortBy,
  validateSortOrder,
  validatePagination,
  sanitizeSearchKeyword,
} from '@/lib/validation/query-params';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
  notFoundResponse,
} from '@/lib/api-response';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 案件列表查询参数
 */
interface CaseListQueryParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  status?: string;
  type?: string;
  userId?: string;
  search?: string;
}

/**
 * 案件列表响应数据
 */
interface CaseListResponse {
  cases: Array<{
    id: string;
    title: string;
    description: string | null;
    type: string;
    status: string;
    amount: string | null;
    caseNumber: string | null;
    cause: string | null;
    court: string | null;
    plaintiffName: string | null;
    defendantName: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: string;
      email: string;
      username: string | null;
      name: string | null;
    };
    documentsCount: number;
    debatesCount: number;
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证案件类型枚举值
 */
function isValidCaseType(type: string): boolean {
  const validTypes = [
    'CIVIL',
    'CRIMINAL',
    'ADMINISTRATIVE',
    'COMMERCIAL',
    'LABOR',
    'INTELLECTUAL',
    'OTHER',
  ];
  return validTypes.includes(type);
}

/**
 * 验证案件状态枚举值
 */
function isValidCaseStatus(status: string): boolean {
  const validStatuses = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'];
  return validStatuses.includes(status);
}

/**
 * 允许的排序字段白名单
 */
const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
  'type',
  'caseNumber',
] as const;

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): CaseListQueryParams {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // 使用验证工具处理分页和排序参数
  const pagination = validatePagination({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
  });

  const sortBy = validateSortBy(
    searchParams.get('sortBy'),
    [...ALLOWED_SORT_FIELDS],
    'createdAt'
  );

  const sortOrder = validateSortOrder(searchParams.get('sortOrder'), 'desc');

  // 清理搜索关键词
  const rawSearch = searchParams.get('search');
  const search = rawSearch ? sanitizeSearchKeyword(rawSearch) : undefined;

  return {
    page: pagination.page,
    limit: pagination.limit,
    sortBy,
    sortOrder,
    status: searchParams.get('status') ?? undefined,
    type: searchParams.get('type') ?? undefined,
    userId: searchParams.get('userId') ?? undefined,
    search,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: CaseListQueryParams) {
  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (params.status && isValidCaseStatus(params.status)) {
    where.status = params.status;
  }

  if (params.type && isValidCaseType(params.type)) {
    where.type = params.type;
  }

  if (params.userId && params.userId.trim() !== '') {
    where.userId = params.userId;
  }

  if (params.search && params.search.trim() !== '') {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { caseNumber: { contains: params.search, mode: 'insensitive' } },
      { cause: { contains: params.search, mode: 'insensitive' } },
      { plaintiffName: { contains: params.search, mode: 'insensitive' } },
      { defendantName: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  return where;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/cases
 * 获取案件列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'case:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    // 解析查询参数（已包含验证和清理）
    const params = parseQueryParams(request);
    const { page, limit, sortBy, sortOrder } = params;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where = buildWhereClause(params);

    // 查询案件总数
    const total = await prisma.case.count({ where });

    // 查询案件列表
    const cases = await prisma.case.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        status: true,
        amount: true,
        caseNumber: true,
        cause: true,
        court: true,
        plaintiffName: true,
        defendantName: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
          },
        },
        _count: {
          select: {
            documents: true,
            debates: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    // 构建响应数据
    const responseData: CaseListResponse = {
      cases: cases.map(caseItem => ({
        id: caseItem.id,
        title: caseItem.title,
        description: caseItem.description,
        type: caseItem.type,
        status: caseItem.status,
        amount: caseItem.amount ? caseItem.amount.toString() : null,
        caseNumber: caseItem.caseNumber,
        cause: caseItem.cause,
        court: caseItem.court,
        plaintiffName: caseItem.plaintiffName,
        defendantName: caseItem.defendantName,
        createdAt: caseItem.createdAt,
        updatedAt: caseItem.updatedAt,
        user: caseItem.user,
        documentsCount: caseItem._count.documents,
        debatesCount: caseItem._count.debates,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return successResponse(responseData, '获取案件列表成功');
  } catch (error) {
    console.error('获取案件列表失败:', error);
    return serverErrorResponse('获取案件列表失败');
  }
}

/**
 * DELETE /api/admin/cases/[id]
 * 删除案件（软删除）
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'case:delete');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { id } = await params;

    // 检查案件是否存在
    const existingCase = await prisma.case.findUnique({
      where: { id },
    });

    if (!existingCase) {
      return notFoundResponse('案件不存在');
    }

    // 软删除案件
    await prisma.case.update({
      where: { id },
      data: {
        deletedAt: new Date(),
      },
    });

    return successResponse(undefined, '案件删除成功');
  } catch (error) {
    console.error('删除案件失败:', error);
    return serverErrorResponse('删除案件失败');
  }
}

/**
 * OPTIONS /api/admin/cases
 * CORS预检请求
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
