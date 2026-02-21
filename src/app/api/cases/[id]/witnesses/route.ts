import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  CaseWitnessListResponse,
  WitnessDetail,
  WitnessStatus,
} from '../../../../../types/witness';

// 查询案件证人验证模式
const queryCaseWitnessesSchema = z.object({
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
 * GET /api/cases/[id]/witnesses - 获取案件证人列表
 */
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const caseId = params.id;

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

    const { searchParams } = new URL(request.url);
    const query = queryCaseWitnessesSchema.parse(
      Object.fromEntries(searchParams)
    );

    const where: Prisma.WitnessWhereInput = {
      caseId,
    };

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

    const response: CaseWitnessListResponse = {
      witnesses: witnessDetails,
      total,
      caseId,
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
  }
);

/**
 * OPTIONS /api/cases/[id]/witnesses - CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
