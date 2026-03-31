/**
 * GET  /api/v1/law-articles  - 获取法条列表（支持分页、筛选、搜索）
 * POST /api/v1/law-articles  - 创建法条
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db';
import { LawCategory, LawType, LawStatus } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  validatePagination,
  validateSortBy,
  validateSortOrder,
  sanitizeSearchKeyword,
} from '@/lib/validation/query-params';

const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'lawName',
  'articleNumber',
  'effectiveDate',
  'viewCount',
  'referenceCount',
] as const;

/**
 * GET /api/v1/law-articles
 * 获取法条列表
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);

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

  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  // 筛选参数
  const category = searchParams.get('category') as LawCategory | null;
  const lawType = searchParams.get('lawType') as LawType | null;
  const status = searchParams.get('status') as LawStatus | null;
  const dataSource = searchParams.get('dataSource');
  const rawSearch = searchParams.get('search');
  const search = rawSearch ? sanitizeSearchKeyword(rawSearch) : null;
  // 精确匹配法律名称（从法律详情页进入时使用）
  const exactLawName = searchParams.get('lawName');
  // 默认隐藏已废止/已失效条文（hideArchived=true）
  const hideArchived = searchParams.get('hideArchived') !== 'false';

  const where: Record<string, unknown> = {};

  if (category) where.category = category;
  if (lawType) where.lawType = lawType;
  if (status) where.status = status;
  if (dataSource) where.dataSource = dataSource;

  if (exactLawName) {
    where.lawName = exactLawName;
  } else if (search) {
    where.OR = [
      { lawName: { contains: search, mode: 'insensitive' } },
      { searchableText: { contains: search, mode: 'insensitive' } },
      { articleNumber: { contains: search, mode: 'insensitive' } },
    ];
  }

  // 按精确法律名称浏览条文时，使用中文数字转换函数正确排序
  const useCnSort = exactLawName && sortBy === 'articleNumber';
  const archivedStatuses = `('REPEALED','EXPIRED')`;
  const archiveFilter = hideArchived
    ? `AND "status"::text NOT IN ${archivedStatuses}`
    : '';

  const [articles, total] = await Promise.all([
    useCnSort
      ? prisma.$queryRawUnsafe<
          {
            id: string;
            lawName: string;
            articleNumber: string;
            fullText: string;
            lawType: string;
            category: string;
            status: string;
            effectiveDate: Date | null;
            issuingAuthority: string | null;
            dataSource: string;
            viewCount: number;
            referenceCount: number;
            createdAt: Date;
            updatedAt: Date;
          }[]
        >(
          `SELECT id, "lawName", "articleNumber", "fullText", "lawType"::text, "category"::text,
                  "status"::text, "effectiveDate", "issuingAuthority", "dataSource",
                  "viewCount", "referenceCount", "createdAt", "updatedAt"
           FROM (
             SELECT DISTINCT ON ("articleNumber")
               id, "lawName", "articleNumber", "fullText", "lawType", "category", "status",
               "effectiveDate", "issuingAuthority", "dataSource",
               "viewCount", "referenceCount", "createdAt", "updatedAt"
             FROM law_articles
             WHERE "lawName" = $1
             ORDER BY "articleNumber",
               CASE "status"::text
                 WHEN 'VALID'   THEN 1
                 WHEN 'AMENDED' THEN 2
                 WHEN 'DRAFT'   THEN 3
                 WHEN 'EXPIRED' THEN 4
                 WHEN 'REPEALED' THEN 5
                 ELSE 6
               END
           ) deduped
           WHERE TRUE ${archiveFilter}
           ORDER BY cn_article_sort_key("articleNumber") ${sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}
           LIMIT $2 OFFSET $3`,
          exactLawName,
          limit,
          skip
        )
      : prisma.lawArticle.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            fullText: true,
            lawType: true,
            category: true,
            status: true,
            effectiveDate: true,
            issuingAuthority: true,
            dataSource: true,
            viewCount: true,
            referenceCount: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
    useCnSort
      ? prisma
          .$queryRawUnsafe<[{ total: number }]>(
            `SELECT COUNT(*)::int AS total FROM (
             SELECT DISTINCT ON ("articleNumber") "status"
             FROM law_articles WHERE "lawName" = $1
             ORDER BY "articleNumber",
               CASE "status"::text WHEN 'VALID' THEN 1 WHEN 'AMENDED' THEN 2 WHEN 'DRAFT' THEN 3 ELSE 4 END
           ) d WHERE TRUE ${archiveFilter}`,
            exactLawName
          )
          .then(r => r[0]?.total ?? 0)
      : prisma.lawArticle.count({ where }),
  ]);

  return createSuccessResponse(
    { articles, total },
    {
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrevious: page > 1,
      },
    }
  );
});

/**
 * POST /api/v1/law-articles
 * 创建法条（仅管理员）
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 从DB实时读取角色，防止 JWT payload 过期角色绕过
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: '权限不足', message: '仅管理员可创建法条' },
      { status: 403 }
    );
  }

  const body = await request.json();

  const required = [
    'lawName',
    'articleNumber',
    'fullText',
    'lawType',
    'category',
    'effectiveDate',
    'issuingAuthority',
  ];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json(
        { error: '参数缺失', message: `${field} 为必填项` },
        { status: 400 }
      );
    }
  }

  const article = await prisma.lawArticle.create({
    data: {
      lawName: body.lawName,
      articleNumber: body.articleNumber,
      fullText: body.fullText,
      lawType: body.lawType as LawType,
      category: body.category as LawCategory,
      subCategory: body.subCategory,
      tags: body.tags || [],
      keywords: body.keywords || [],
      effectiveDate: new Date(body.effectiveDate),
      expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
      issuingAuthority: body.issuingAuthority,
      jurisdiction: body.jurisdiction,
      searchableText:
        body.searchableText ||
        `${body.lawName} ${body.articleNumber} ${body.fullText}`,
      dataSource: body.dataSource || 'local',
    },
  });

  return createSuccessResponse(article);
});
