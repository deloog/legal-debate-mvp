import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  buildScheduleAccessWhere,
  checkCaseSchedulePermission,
} from '@/lib/court-schedule/schedule-access';
import { CasePermission } from '@/types/case-collaboration';
import { z } from 'zod';
import { ScheduleConflictDetectionResponse } from '@/types/court-schedule';

const conflictQuerySchema = z.object({
  scheduleId: z.string().optional(),
  caseId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

/**
 * GET /api/court-schedules/conflicts
 * 检测日程冲突
 *
 * @queryParam scheduleId - 日程ID（检测该日程与其他日程的冲突）
 * @queryParam caseId - 案件ID（检测该案件的所有潜在冲突）
 * @queryParam startTime - 开始时间（检测该时间范围内的冲突）
 * @queryParam endTime - 结束时间（检测该时间范围内的冲突）
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
  const query = conflictQuerySchema.parse(Object.fromEntries(searchParams));

  const conflicts: Array<{
    scheduleId: string;
    conflictingScheduleId: string;
    conflictingTitle: string;
    conflictType: 'SAME_TIME' | 'OVERLAPPING';
    startTime: Date;
    endTime: Date;
  }> = [];

  let targetSchedule: { id: string; startTime: Date; endTime: Date } | null =
    null;

  if (query.scheduleId) {
    const accessWhere = await buildScheduleAccessWhere(
      authUser.userId,
      CasePermission.VIEW_SCHEDULES
    );

    targetSchedule = await prisma.courtSchedule.findFirst({
      where: {
        id: query.scheduleId,
        AND: [accessWhere],
      },
    });

    if (!targetSchedule) {
      return NextResponse.json(
        { error: '日程不存在或无权访问' },
        { status: 404 }
      );
    }
  }

  const accessWhere = await buildScheduleAccessWhere(
    authUser.userId,
    CasePermission.VIEW_SCHEDULES
  );
  const where: Record<string, unknown> = {
    AND: [accessWhere],
    status: { notIn: ['CANCELLED'] },
  };

  if (query.scheduleId) {
    where.id = { not: query.scheduleId };
  }

  if (query.caseId) {
    const access = await checkCaseSchedulePermission(
      authUser.userId,
      query.caseId,
      CasePermission.VIEW_SCHEDULES
    );

    if (!access.hasAccess) {
      return NextResponse.json(
        { error: access.message },
        { status: access.status }
      );
    }

    where.caseId = query.caseId;
  }

  if (targetSchedule) {
    const schedules = await prisma.courtSchedule.findMany({
      where,
      orderBy: {
        startTime: 'asc',
      },
    });

    for (const schedule of schedules) {
      const conflictType = detectConflictType(
        targetSchedule.startTime,
        targetSchedule.endTime,
        schedule.startTime,
        schedule.endTime
      );

      if (conflictType) {
        conflicts.push({
          scheduleId: query.scheduleId!,
          conflictingScheduleId: schedule.id,
          conflictingTitle: schedule.title,
          conflictType,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        });
      }
    }
  } else if (query.caseId) {
    const schedules = await prisma.courtSchedule.findMany({
      where: { ...where, caseId: query.caseId },
      orderBy: {
        startTime: 'asc',
      },
    });

    for (let i = 0; i < schedules.length; i++) {
      for (let j = i + 1; j < schedules.length; j++) {
        const conflictType = detectConflictType(
          schedules[i].startTime,
          schedules[i].endTime,
          schedules[j].startTime,
          schedules[j].endTime
        );

        if (conflictType) {
          conflicts.push({
            scheduleId: schedules[i].id,
            conflictingScheduleId: schedules[j].id,
            conflictingTitle: schedules[j].title,
            conflictType,
            startTime: schedules[j].startTime,
            endTime: schedules[j].endTime,
          });
        }
      }
    }
  } else {
    return NextResponse.json(
      { error: '必须提供scheduleId或caseId参数' },
      { status: 400 }
    );
  }

  const response: ScheduleConflictDetectionResponse = {
    hasConflicts: conflicts.length > 0,
    conflicts,
  };

  return createSuccessResponse(response);
});

/**
 * 检测两个时间段是否冲突
 */
function detectConflictType(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): 'SAME_TIME' | 'OVERLAPPING' | null {
  const sameTime = start1.getTime() === start2.getTime();
  const overlaps = start1 < end2 && start2 < end1 && !sameTime;

  if (sameTime) {
    return 'SAME_TIME';
  }

  if (overlaps) {
    return 'OVERLAPPING';
  }

  return null;
}

/**
 * OPTIONS /api/court-schedules/conflicts
 * CORS预检请求
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
