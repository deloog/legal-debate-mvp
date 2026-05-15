import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  buildScheduleAccessWhere,
  buildScheduleOverlapWhere,
  parseScheduleDate,
} from '@/lib/court-schedule/schedule-access';
import { CasePermission } from '@/types/case-collaboration';
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

  const accessWhere = await buildScheduleAccessWhere(
    authUser.userId,
    CasePermission.VIEW_SCHEDULES
  );

  const schedule = await prisma.courtSchedule.findFirst({
    where: {
      id,
      AND: [accessWhere],
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

  const accessWhere = await buildScheduleAccessWhere(
    authUser.userId,
    CasePermission.EDIT_SCHEDULES
  );

  const existingSchedule = await prisma.courtSchedule.findFirst({
    where: {
      id,
      AND: [accessWhere],
    },
  });

  if (!existingSchedule) {
    return NextResponse.json({ error: '日程不存在' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (validatedData.title !== undefined) {
    updateData.title = validatedData.title;
  }
  if (validatedData.type !== undefined) {
    updateData.type = validatedData.type;
  }
  if (validatedData.startTime !== undefined) {
    const startDate = parseScheduleDate(validatedData.startTime);
    if (!startDate) {
      return NextResponse.json({ error: '开始时间格式无效' }, { status: 400 });
    }
    updateData.startTime = startDate;
  }
  if (validatedData.endTime !== undefined) {
    const endDate = parseScheduleDate(validatedData.endTime);
    if (!endDate) {
      return NextResponse.json({ error: '结束时间格式无效' }, { status: 400 });
    }
    updateData.endTime = endDate;
  }
  if (validatedData.location !== undefined) {
    updateData.location = validatedData.location;
  }
  if (validatedData.judge !== undefined) {
    updateData.judge = validatedData.judge;
  }
  if (validatedData.notes !== undefined) {
    updateData.notes = validatedData.notes;
  }
  if (validatedData.status !== undefined) {
    updateData.status = validatedData.status;
  }
  if (validatedData.metadata !== undefined) {
    updateData.metadata = validatedData.metadata;
  }

  const nextStartDate =
    (updateData.startTime as Date | undefined) ?? existingSchedule.startTime;
  const nextEndDate =
    (updateData.endTime as Date | undefined) ?? existingSchedule.endTime;

  if (nextStartDate >= nextEndDate) {
    return NextResponse.json(
      { error: '开始时间必须早于结束时间' },
      { status: 400 }
    );
  }

  const nextStatus =
    (updateData.status as CourtScheduleStatus | undefined) ??
    (existingSchedule.status as CourtScheduleStatus);
  const shouldCheckConflict =
    updateData.startTime !== undefined ||
    updateData.endTime !== undefined ||
    (existingSchedule.status === 'CANCELLED' && nextStatus !== 'CANCELLED');

  if (nextStatus !== 'CANCELLED' && shouldCheckConflict) {
    const conflict = await prisma.courtSchedule.findFirst({
      where: buildScheduleOverlapWhere(
        existingSchedule.caseId,
        nextStartDate,
        nextEndDate,
        id
      ),
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

  const accessWhere = await buildScheduleAccessWhere(
    authUser.userId,
    CasePermission.DELETE_SCHEDULES
  );

  const existingSchedule = await prisma.courtSchedule.findFirst({
    where: {
      id,
      AND: [accessWhere],
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
