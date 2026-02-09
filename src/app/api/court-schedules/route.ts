import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createCreatedResponse,
  createSuccessResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  CourtScheduleDetail,
  CourtScheduleStatus,
  CourtScheduleType,
  ScheduleWithCase,
} from '@/types/court-schedule';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createScheduleSchema = z
  .object({
    caseId: z.string().min(1, '案件ID不能为空'),
    title: z.string().min(1, '标题不能为空').max(200),
    type: z
      .enum(['TRIAL', 'MEDIATION', 'ARBITRATION', 'MEETING', 'OTHER'])
      .default('TRIAL'),
    startTime: z.string().min(1, '开始时间不能为空'),
    endTime: z.string().min(1, '结束时间不能为空'),
    location: z.string().max(200).optional(),
    judge: z.string().max(100).optional(),
    notes: z.string().max(5000).optional(),
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
  })
  .required({ caseId: true, title: true, startTime: true, endTime: true });

const queryScheduleSchema = z.object({
  caseId: z.string().optional(),
  type: z
    .enum(['TRIAL', 'MEDIATION', 'ARBITRATION', 'MEETING', 'OTHER'])
    .optional(),
  status: z
    .enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'])
    .optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(10),
  sortBy: z.enum(['startTime', 'createdAt', 'updatedAt']).default('startTime'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

function mapScheduleToDetail(schedule: ScheduleWithCase): CourtScheduleDetail {
  return {
    id: schedule.id,
    caseId: schedule.caseId,
    title: schedule.title,
    type: schedule.type as CourtScheduleType,
    startTime: schedule.startTime,
    endTime: schedule.endTime,
    location: schedule.location,
    judge: schedule.judge,
    notes: schedule.notes,
    status: schedule.status as CourtScheduleStatus,
    metadata: schedule.metadata as Record<string, unknown> | null,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
    caseTitle: schedule.case?.title,
    caseType: schedule.case?.type,
  };
}

/**
 * GET /api/court-schedules
 * 获取法庭日程列表
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
  const query = queryScheduleSchema.parse(Object.fromEntries(searchParams));

  const where: Record<string, unknown> = {
    case: {
      userId: authUser.userId,
      deletedAt: null,
    },
  };

  if (query.caseId) {
    where.caseId = query.caseId;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.startDate || query.endDate) {
    where.startTime = {};
    if (query.startDate) {
      (where.startTime as Record<string, unknown>).gte = new Date(
        query.startDate
      );
    }
    if (query.endDate) {
      (where.startTime as Record<string, unknown>).lte = new Date(
        query.endDate
      );
    }
  }

  const orderBy: Record<string, 'asc' | 'desc'> = {
    [query.sortBy]: query.sortOrder,
  };

  const [schedules, total] = await Promise.all([
    prisma.courtSchedule.findMany({
      where,
      include: {
        case: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
      },
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.courtSchedule.count({ where }),
  ]);

  const scheduleDetails: CourtScheduleDetail[] =
    schedules.map(mapScheduleToDetail);

  return createSuccessResponse(
    { schedules: scheduleDetails, total },
    {
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNext: (query.page - 1) * query.limit + query.limit < total,
        hasPrevious: query.page > 1,
      },
    }
  );
});

/**
 * POST /api/court-schedules
 * 创建法庭日程
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
  const validatedData = createScheduleSchema.parse(body);

  const startDate = new Date(validatedData.startTime);
  const endDate = new Date(validatedData.endTime);

  if (startDate >= endDate) {
    return NextResponse.json(
      { error: '开始时间必须早于结束时间' },
      { status: 400 }
    );
  }

  const caseRecord = await prisma.case.findUnique({
    where: {
      id: validatedData.caseId,
      userId: authUser.userId,
      deletedAt: null,
    },
  });

  if (!caseRecord) {
    return NextResponse.json(
      { error: '案件不存在或无权访问' },
      { status: 404 }
    );
  }

  const conflict = await prisma.courtSchedule.findFirst({
    where: {
      caseId: validatedData.caseId,
      startTime: startDate,
      status: { notIn: ['CANCELLED'] },
    },
  });

  if (conflict) {
    return NextResponse.json(
      { error: '该案件在此时间已有日程安排' },
      { status: 409 }
    );
  }

  const schedule = await prisma.courtSchedule.create({
    data: {
      caseId: validatedData.caseId,
      title: validatedData.title,
      type: validatedData.type,
      startTime: startDate,
      endTime: endDate,
      location: validatedData.location,
      judge: validatedData.judge,
      notes: validatedData.notes,
      metadata: validatedData.metadata as Prisma.InputJsonValue,
    },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
    },
  });

  const scheduleDetail = mapScheduleToDetail(schedule);

  return createCreatedResponse(scheduleDetail);
});

/**
 * OPTIONS /api/court-schedules
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
