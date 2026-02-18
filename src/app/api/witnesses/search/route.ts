import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { WitnessDetail, WitnessSearchResult } from '@/types/witness';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// 搜索验证模式
const searchSchema = z.object({
  caseId: z.string().min(1, '案件ID不能为空'),
  query: z.string().min(1, '搜索关键词不能为空').max(200),
  searchFields: z
    .array(z.enum(['name', 'phone', 'address', 'relationship', 'testimony']))
    .default(['name', 'phone', 'address', 'relationship']),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// 搜索参数验证模式（可选参数）
const searchQuerySchema = z.object({
  caseId: z.string().optional(),
  query: z.string().optional(),
  searchFields: z.string().optional(), // JSON string
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// 映射证人数据到详情
async function mapWitnessToDetail(
  witness: unknown,
  includeCase = true,
  includeCourtSchedule = false
): Promise<WitnessDetail> {
  if (!witness || typeof witness !== 'object') {
    throw new Error('无效的证人数据');
  }

  const witnessObj = witness as Record<string, unknown>;
  const detail: WitnessDetail = {
    id: String(witnessObj.id || ''),
    caseId: String(witnessObj.caseId || ''),
    name: String(witnessObj.name || ''),
    phone: witnessObj.phone as string | null,
    address: witnessObj.address as string | null,
    relationship: witnessObj.relationship as string | null,
    testimony: witnessObj.testimony as string | null,
    courtScheduleId: witnessObj.courtScheduleId as string | null,
    status: witnessObj.status as
      | 'NEED_CONTACT'
      | 'CONTACTED'
      | 'CONFIRMED'
      | 'DECLINED'
      | 'CANCELLED',
    metadata: witnessObj.metadata as unknown as Prisma.JsonValue,
    createdAt: new Date(witnessObj.createdAt as string),
    updatedAt: new Date(witnessObj.updatedAt as string),
  };

  if (includeCase) {
    const caseObj = witnessObj.case as Record<string, unknown> | undefined;
    if (caseObj) {
      detail.case = {
        id: String(caseObj.id || ''),
        title: String(caseObj.title || ''),
      };
    }
  }

  if (includeCourtSchedule && witnessObj.courtScheduleId) {
    const courtScheduleObj = witnessObj.courtSchedule as
      | Record<string, unknown>
      | undefined;
    if (courtScheduleObj) {
      detail.courtSchedule = {
        id: String(courtScheduleObj.id || ''),
        title: String(courtScheduleObj.title || ''),
      };
    }
  }

  return detail;
}

/**
 * GET /api/witnesses/search - 搜索证人
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

  // 解析查询参数
  const rawQuery = Object.fromEntries(searchParams);
  let validatedQuery: z.infer<typeof searchQuerySchema>;

  try {
    validatedQuery = searchQuerySchema.parse(rawQuery);
  } catch (error) {
    return NextResponse.json(
      { error: '参数验证失败', message: String(error) },
      { status: 400 }
    );
  }

  const { caseId, query, page, limit } = validatedQuery;

  if (!caseId) {
    return NextResponse.json(
      { error: '缺少案件ID', message: '必须提供caseId参数' },
      { status: 400 }
    );
  }

  if (!query) {
    return NextResponse.json(
      { error: '缺少搜索关键词', message: '必须提供query参数' },
      { status: 400 }
    );
  }

  // 验证案件是否存在且属于当前用户
  const caseExists = await prisma.case.findFirst({
    where: {
      id: caseId,
      userId: authUser.userId,
    },
  });

  if (!caseExists) {
    return NextResponse.json(
      { error: '案件不存在或无权限', message: '案件不存在或您没有权限访问' },
      { status: 404 }
    );
  }

  // 构建搜索条件
  const searchFields = [
    'name',
    'phone',
    'address',
    'relationship',
    'testimony',
  ];
  const orConditions: Prisma.WitnessWhereInput['OR'] = [];

  for (const field of searchFields) {
    orConditions.push({
      [field]: {
        contains: query,
        mode: 'insensitive' as Prisma.QueryMode,
      },
    });
  }

  const where: Prisma.WitnessWhereInput = {
    caseId,
    OR: orConditions,
  };

  const [witnessList, total] = await Promise.all([
    prisma.witness.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
        courtSchedule: {
          select: {
            id: true,
            title: true,
          },
        },
      } as Prisma.WitnessInclude,
    }),
    prisma.witness.count({ where }),
  ]);

  const witnessDetails = await Promise.all(
    witnessList.map((w: unknown) => mapWitnessToDetail(w, true, true))
  );

  const response: WitnessSearchResult = {
    witnesses: witnessDetails,
    total,
    query,
    searchFields,
  };

  return createSuccessResponse(response, {
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: (page - 1) * limit + limit < total,
      hasPrevious: page > 1,
    },
  });
});

/**
 * POST /api/witnesses/search - 高级搜索证人
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const body = await request.json();

  let validatedData: z.infer<typeof searchSchema>;
  try {
    validatedData = searchSchema.parse(body);
  } catch (error) {
    return NextResponse.json(
      { error: '参数验证失败', message: String(error) },
      { status: 400 }
    );
  }

  const { caseId, query, searchFields, page, limit } = validatedData;

  // 验证案件是否存在且属于当前用户
  const caseExists = await prisma.case.findFirst({
    where: {
      id: caseId,
      userId: authUser.userId,
    },
  });

  if (!caseExists) {
    return NextResponse.json(
      { error: '案件不存在或无权限', message: '案件不存在或您没有权限访问' },
      { status: 404 }
    );
  }

  // 构建搜索条件
  const orConditions: Prisma.WitnessWhereInput['OR'] = [];

  for (const field of searchFields) {
    orConditions.push({
      [field]: {
        contains: query,
        mode: 'insensitive' as Prisma.QueryMode,
      },
    });
  }

  const where: Prisma.WitnessWhereInput = {
    caseId,
    OR: orConditions,
  };

  const [witnessList, total] = await Promise.all([
    prisma.witness.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
        courtSchedule: {
          select: {
            id: true,
            title: true,
          },
        },
      } as Prisma.WitnessInclude,
    }),
    prisma.witness.count({ where }),
  ]);

  const witnessDetails = await Promise.all(
    witnessList.map((w: unknown) => mapWitnessToDetail(w, true, true))
  );

  const response: WitnessSearchResult = {
    witnesses: witnessDetails,
    total,
    query,
    searchFields,
  };

  return createSuccessResponse(response, {
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: (page - 1) * limit + limit < total,
      hasPrevious: page > 1,
    },
  });
});

/**
 * OPTIONS /api/witnesses/search - CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
