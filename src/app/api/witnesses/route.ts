import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createCreatedResponse,
  createSuccessResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { Prisma, WitnessStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { WitnessDetail, WitnessListResponse } from '../../../types/witness';

// 创建证人验证模式
const createWitnessSchema = z.object({
  caseId: z.string().min(1, '案件ID不能为空'),
  name: z.string().min(1, '证人姓名不能为空').max(200),
  phone: z.string().max(20).optional(),
  address: z.string().max(500).optional(),
  relationship: z.string().max(200).optional(),
  testimony: z.string().max(10000).optional(),
  courtScheduleId: z.string().optional(),
  status: z
    .enum(['NEED_CONTACT', 'CONTACTED', 'CONFIRMED', 'DECLINED', 'CANCELLED'])
    .optional(),
  metadata: z
    .union([
      z.object({}).passthrough(),
      z.array(z.unknown()),
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
    ])
    .optional(),
});

// 查询证人验证模式
const queryWitnessSchema = z.object({
  caseId: z.string().optional(),
  name: z.string().optional(),
  status: z
    .enum(['NEED_CONTACT', 'CONTACTED', 'CONFIRMED', 'DECLINED', 'CANCELLED'])
    .optional(),
  relationship: z.string().optional(),
  courtScheduleId: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
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
    status: witnessObj.status as WitnessStatus,
    metadata: witnessObj.metadata as unknown as Prisma.JsonValue,
    createdAt: new Date(witnessObj.createdAt as string),
    updatedAt: new Date(witnessObj.updatedAt as string),
  };

  if (includeCase) {
    const caseObj = witnessObj.case as Record<string, unknown> | undefined;
    detail.case = {
      id: String(caseObj?.id || ''),
      title: String(caseObj?.title || ''),
    };
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
 * GET /api/witnesses - 获取证人列表
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
  const query = queryWitnessSchema.parse(Object.fromEntries(searchParams));

  const where: Prisma.WitnessWhereInput = {
    case: {
      userId: authUser.userId,
    },
  };

  if (query.caseId) {
    where.caseId = query.caseId;
  }

  if (query.name) {
    where.name = {
      contains: query.name,
      mode: 'insensitive' as Prisma.QueryMode,
    };
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.relationship) {
    where.relationship = {
      contains: query.relationship,
      mode: 'insensitive' as Prisma.QueryMode,
    };
  }

  if (query.courtScheduleId) {
    where.courtScheduleId = query.courtScheduleId;
  }

  const orderBy: Prisma.WitnessOrderByWithRelationInput = {
    [query.sortBy]: query.sortOrder,
  };

  const [witnessList, total] = await Promise.all([
    prisma.witness.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy,
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

  const response: WitnessListResponse = {
    witnesses: witnessDetails,
    total,
    caseId: query.caseId || '',
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };

  return createSuccessResponse(response, {
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNext: (query.page - 1) * query.limit + query.limit < total,
      hasPrevious: query.page > 1,
    },
  });
});

/**
 * POST /api/witnesses - 创建证人
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
  const validatedData = createWitnessSchema.parse(body);

  // 验证案件是否存在且属于当前用户
  const caseExists = await prisma.case.findFirst({
    where: {
      id: validatedData.caseId,
      userId: authUser.userId,
    },
  });

  if (!caseExists) {
    return NextResponse.json(
      { error: '案件不存在或无权限', message: '案件不存在或您没有权限访问' },
      { status: 404 }
    );
  }

  // 验证法庭日程是否存在（如果提供了courtScheduleId）
  if (validatedData.courtScheduleId) {
    const courtScheduleExists = await prisma.courtSchedule.findFirst({
      where: {
        id: validatedData.courtScheduleId,
        caseId: validatedData.caseId,
      },
    });

    if (!courtScheduleExists) {
      return NextResponse.json(
        { error: '法庭日程不存在', message: '法庭日程不存在或不属于该案件' },
        { status: 404 }
      );
    }
  }

  // 创建证人
  const witness = await prisma.witness.create({
    data: {
      caseId: validatedData.caseId,
      name: validatedData.name,
      phone: validatedData.phone,
      address: validatedData.address,
      relationship: validatedData.relationship,
      testimony: validatedData.testimony,
      courtScheduleId: validatedData.courtScheduleId,
      status: validatedData.status || 'NEED_CONTACT',
      metadata: validatedData.metadata as Prisma.InputJsonValue,
    },
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
  });

  const witnessDetail = await mapWitnessToDetail(witness, true, true);

  return createCreatedResponse(witnessDetail);
});

/**
 * OPTIONS /api/witnesses - CORS预检请求
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
