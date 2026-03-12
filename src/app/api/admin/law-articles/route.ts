/**
 * 法条列表API - 管理员专用
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
import { LAW_PERMISSIONS } from '@/types/permission';
import { LawCategory, LawStatus, LawType } from '@prisma/client';
import { NextRequest } from 'next/server';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 法条列表查询参数
 */
interface LawArticleListQueryParams {
  page?: string;
  limit?: string;
  lawType?: string;
  category?: string;
  status?: string;
  search?: string;
}

/**
 * 法条列表响应数据
 */
interface LawArticleListResponse {
  articles: Array<{
    id: string;
    lawName: string;
    articleNumber: string;
    fullText: string;
    lawType: string;
    category: string;
    subCategory: string | null;
    status: string;
    version: string;
    effectiveDate: Date;
    viewCount: number;
    referenceCount: number;
    createdAt: Date;
    updatedAt: Date;
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
 * 验证法律类型枚举值
 */
function isValidLawType(lawType: string): boolean {
  const validTypes = Object.values(LawType);
  return validTypes.includes(lawType as LawType);
}

/**
 * 验证法律类别枚举值
 */
function isValidCategory(category: string): boolean {
  const validCategories = Object.values(LawCategory);
  return validCategories.includes(category as LawCategory);
}

/**
 * 验证法条状态枚举值
 */
function isValidStatus(status: string): boolean {
  const validStatuses = Object.values(LawStatus);
  return validStatuses.includes(status as LawStatus);
}

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): LawArticleListQueryParams {
  const url = new URL(request.url);
  return {
    page: url.searchParams.get('page') ?? '1',
    limit: url.searchParams.get('limit') ?? '20',
    lawType: url.searchParams.get('lawType') ?? undefined,
    category: url.searchParams.get('category') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: LawArticleListQueryParams) {
  const where: Record<string, unknown> = {};

  if (params.lawType && isValidLawType(params.lawType)) {
    where.lawType = params.lawType as LawType;
  }

  if (params.category && isValidCategory(params.category)) {
    where.category = params.category as LawCategory;
  }

  if (params.status && isValidStatus(params.status)) {
    where.status = params.status as LawStatus;
  }

  if (params.search && params.search.trim() !== '') {
    const searchTerm = params.search.trim();
    where.OR = [
      { lawName: { contains: searchTerm, mode: 'insensitive' } },
      { articleNumber: { contains: searchTerm, mode: 'insensitive' } },
      { fullText: { contains: searchTerm, mode: 'insensitive' } },
      { searchableText: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  return where;
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/law-articles
 * 获取法条列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(
    request,
    LAW_PERMISSIONS.READ ?? 'law:read'
  );
  if (permissionError) {
    return permissionError;
  }

  try {
    // 解析查询参数
    const params = parseQueryParams(request);
    const page = Math.max(1, Number.parseInt(params.page ?? '1', 10));
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(params.limit ?? '20', 10))
    );
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where = buildWhereClause(params);

    // 查询法条总数
    const total = await prisma.lawArticle.count({ where });

    // 查询法条列表
    const articles = await prisma.lawArticle.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ lawName: 'asc' }, { articleNumber: 'asc' }],
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        fullText: true,
        lawType: true,
        category: true,
        subCategory: true,
        status: true,
        version: true,
        effectiveDate: true,
        viewCount: true,
        referenceCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // 构建响应数据
    const responseData: LawArticleListResponse = {
      articles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return successResponse(responseData, '获取法条列表成功');
  } catch (error) {
    logger.error('获取法条列表失败:', error);
    return serverErrorResponse('获取法条列表失败');
  }
}
