/**
 * GET /api/v1/law-articles/laws
 * 按法律名称分组，返回法律列表（含条文数量）
 */

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/api-response';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/middleware/auth';
import { sanitizeSearchKeyword } from '@/lib/validation/query-params';

export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10))
  );
  const skip = (page - 1) * limit;

  const rawSearch = searchParams.get('search');
  const search = rawSearch ? sanitizeSearchKeyword(rawSearch) : null;
  const category = searchParams.get('category');
  const lawType = searchParams.get('lawType');
  const status = searchParams.get('status');

  // WHERE 子句条件
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (search) {
    conditions.push(`"lawName" ILIKE $${idx}`);
    params.push(`%${search}%`);
    idx++;
  }
  if (category) {
    conditions.push(`"category" = $${idx}`);
    params.push(category);
    idx++;
  }
  if (lawType) {
    conditions.push(`"lawType"::text = $${idx}`);
    params.push(lawType);
    idx++;
  }
  if (status) {
    conditions.push(`"status"::text = $${idx}`);
    params.push(status);
    idx++;
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(DISTINCT TRIM("lawName"))::int AS total FROM law_articles ${where}`;
  const dataSql = `
    SELECT
      TRIM("lawName") AS "lawName",
      "category",
      "lawType",
      "status",
      COUNT(*)::int AS "articleCount",
      MIN("effectiveDate") AS "effectiveDate"
    FROM law_articles
    ${where}
    GROUP BY TRIM("lawName"), "category", "lawType", "status"
    ORDER BY
      CASE "lawType"::text
        WHEN 'CONSTITUTION'             THEN 1
        WHEN 'LAW'                      THEN 2
        WHEN 'ADMINISTRATIVE_REGULATION' THEN 3
        WHEN 'JUDICIAL_INTERPRETATION'  THEN 4
        WHEN 'DEPARTMENTAL_RULE'        THEN 5
        WHEN 'LOCAL_REGULATION'         THEN 6
        ELSE 7
      END,
      -- 同层级内：修正案/修改决定等附属文件排在主体法律后面（排除"修正文本"即合并修正版）
      CASE
        WHEN TRIM("lawName") ~ '(修正案|修改决定|修改|补充规定|废止决定)' THEN 1
        ELSE 0
      END,
      MIN("effectiveDate") DESC NULLS LAST,
      TRIM("lawName")
    LIMIT $${idx} OFFSET $${idx + 1}
  `;

  const queryParams = [...params, limit, skip];

  const [countResult, laws] = await Promise.all([
    prisma.$queryRawUnsafe<[{ total: number }]>(countSql, ...params),
    prisma.$queryRawUnsafe<
      {
        lawName: string;
        category: string;
        lawType: string;
        status: string;
        articleCount: number;
        effectiveDate: Date | null;
      }[]
    >(dataSql, ...queryParams),
  ]);

  const total = countResult[0]?.total ?? 0;

  return createSuccessResponse(
    { laws },
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
