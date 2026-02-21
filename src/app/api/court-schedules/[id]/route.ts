import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  CourtScheduleDetail,
  CourtScheduleStatus,
  CourtScheduleType,
  ScheduleWithCase,
} from '@/types/court-schedule';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateScheduleSchema = z
  .object({
    title: z.string().min(1, '标题不能为空').max(200).optional(),
    type: z
      .enum(['TRIAL', 'MEDIATION', 'ARBITRATION', 'MEETING', 'OTHER'])
      .optional(),
    startTime: z.string().min(1, '开始时间不能为空').optional(),
    endTime: z.string().min(1, '结束时间不能为空').optional(),
    location: z.string().max(200).optional(),
    judge: z.string().max(100).optional(),
    notes: z.string().max(5000).optional(),
    status: z
      .enum(['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'RESCHEDULED'])
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
  })
  .strict();

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
 * GET /api/court-schedules/[id]
 * 获取法庭日程详情
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const id = request.url.split('/').pop();

  if (!id) {
    return NextResponse.json({ error: '日程ID不能为空' }, { status: 400 });
  }

  const schedule = await prisma.courtSchedule.findFirst({
    where: {
      id,
      case: {
        userId: authUser.userId,
        deletedAt: null,
      },
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

  if (!schedule) {
    return NextResponse.json({ error: '日程不存在' }, { status: 404 });
  }

  return createSuccessResponse(mapScheduleToDetail(schedule));
});

/**
 * PUT /api/court-schedules/[id]
 * 更新法庭日程
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const id = request.url.split('/').pop();

  if (!id) {
    return NextResponse.json({ error: '日程ID不能为空' }, { status: 400 });
  }

  const body = await request.json();
  const validatedData = updateScheduleSchema.parse(body);

  const existingSchedule = await prisma.courtSchedule.findFirst({
    where: {
      id,
      case: {
        userId: authUser.userId,
        deletedAt: null,
      },
    },
  });

  if (!existingSchedule) {
    return NextResponse.json({ error: '日程不存在' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (validatedData.title) {
    updateData.title = validatedData.title;
  }
  if (validatedData.type) {
    updateData.type = validatedData.type;
  }
  if (validatedData.startTime) {
    updateData.startTime = new Date(validatedData.startTime);
  }
  if (validatedData.endTime) {
    updateData.endTime = new Date(validatedData.endTime);
  }
  if (validatedData.location) {
    updateData.location = validatedData.location;
  }
  if (validatedData.judge) {
    updateData.judge = validatedData.judge;
  }
  if (validatedData.notes) {
    updateData.notes = validatedData.notes;
  }
  if (validatedData.status) {
    updateData.status = validatedData.status;
  }
  if (validatedData.metadata) {
    updateData.metadata = validatedData.metadata;
  }

  if (updateData.startTime && updateData.endTime) {
    const startDate = updateData.startTime as Date;
    const endDate = updateData.endTime as Date;
    if (startDate >= endDate) {
      return NextResponse.json(
        { error: '开始时间必须早于结束时间' },
        { status: 400 }
      );
    }
  }

  if (updateData.startTime) {
    const conflict = await prisma.courtSchedule.findFirst({
      where: {
        id: { not: id },
        caseId: existingSchedule.caseId,
        startTime: updateData.startTime as Date,
        status: { notIn: ['CANCELLED'] },
      },
    });

    if (conflict) {
      return NextResponse.json(
        { error: '该案件在此时间已有日程安排' },
        { status: 409 }
      );
    }
  }

  const schedule = await prisma.courtSchedule.update({
    where: { id },
    data: updateData,
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

  return createSuccessResponse(mapScheduleToDetail(schedule));
});

/**
 * DELETE /api/court-schedules/[id]
 * 删除法庭日程
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const id = request.url.split('/').pop();

  if (!id) {
    return NextResponse.json({ error: '日程ID不能为空' }, { status: 400 });
  }

  const existingSchedule = await prisma.courtSchedule.findFirst({
    where: {
      id,
      case: {
        userId: authUser.userId,
        deletedAt: null,
      },
    },
  });

  if (!existingSchedule) {
    return NextResponse.json({ error: '日程不存在' }, { status: 404 });
  }

  await prisma.courtSchedule.delete({
    where: { id },
  });

  return createSuccessResponse({ message: '日程已删除' });
});

/**
 * OPTIONS /api/court-schedules/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
