/**
 * 法庭日程冲突检测工具
 */

import { prisma } from '@/lib/db/prisma';
import { ScheduleConflict } from '@/types/court-schedule';

/**
 * 冲突检测选项
 */
export interface ConflictDetectionOptions {
  excludeScheduleId?: string;
  includeCancelled?: boolean;
}

/**
 * 检测两个时间段是否冲突
 *
 * @param start1 第一个时间段的开始时间
 * @param end1 第一个时间段的结束时间
 * @param start2 第二个时间段的开始时间
 * @param end2 第二个时间段的结束时间
 * @returns 冲突类型：SAME_TIME（同一时间）、OVERLAPPING（重叠）、null（无冲突）
 */
export function detectConflictType(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): 'SAME_TIME' | 'OVERLAPPING' | null {
  if (start1 >= end1 || start2 >= end2) {
    return null;
  }

  const sameTime = start1.getTime() === start2.getTime();
  const overlaps = start1 < end2 && start2 < end1;

  if (sameTime) {
    return 'SAME_TIME';
  }

  if (overlaps) {
    return 'OVERLAPPING';
  }

  return null;
}

/**
 * 检测指定日程是否与同一案件的其它日程冲突
 *
 * @param scheduleId 日程ID
 * @param options 检测选项
 * @returns 冲突列表
 */
export async function detectScheduleConflicts(
  scheduleId: string,
  options: ConflictDetectionOptions = {}
): Promise<ScheduleConflict[]> {
  const schedule = await prisma.courtSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    return [];
  }

  const where: Record<string, unknown> = {
    caseId: schedule.caseId,
    id: { not: scheduleId },
    status: options.includeCancelled ? undefined : { notIn: ['CANCELLED'] },
  };

  if (options.excludeScheduleId) {
    where.id = { not: options.excludeScheduleId };
  }

  const otherSchedules = await prisma.courtSchedule.findMany({
    where,
    orderBy: {
      startTime: 'asc',
    },
  });

  const conflicts: ScheduleConflict[] = [];

  for (const other of otherSchedules) {
    const conflictType = detectConflictType(
      schedule.startTime,
      schedule.endTime,
      other.startTime,
      other.endTime
    );

    if (conflictType) {
      conflicts.push({
        scheduleId: scheduleId,
        conflictingScheduleId: other.id,
        conflictingTitle: other.title,
        conflictType,
        startTime: other.startTime,
        endTime: other.endTime,
      });
    }
  }

  return conflicts;
}

/**
 * 检测指定案件的所有潜在冲突
 *
 * @param caseId 案件ID
 * @param options 检测选项
 * @returns 冲突列表
 */
export async function detectCaseConflicts(
  caseId: string,
  options: ConflictDetectionOptions = {}
): Promise<ScheduleConflict[]> {
  const where: Record<string, unknown> = {
    caseId,
    status: options.includeCancelled ? undefined : { notIn: ['CANCELLED'] },
  };

  if (options.excludeScheduleId) {
    where.id = { not: options.excludeScheduleId };
  }

  const schedules = await prisma.courtSchedule.findMany({
    where,
    orderBy: {
      startTime: 'asc',
    },
  });

  const conflicts: ScheduleConflict[] = [];

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

  return conflicts;
}

/**
 * 检测用户的所有案件中的冲突
 *
 * @param userId 用户ID
 * @returns 按案件ID分组的冲突列表
 */
export async function detectAllUserConflicts(
  userId: string
): Promise<Record<string, ScheduleConflict[]>> {
  const cases = await prisma.case.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  const conflictsByCase: Record<string, ScheduleConflict[]> = {};

  for (const caseRecord of cases) {
    const conflicts = await detectCaseConflicts(caseRecord.id);
    if (conflicts.length > 0) {
      conflictsByCase[caseRecord.id] = conflicts;
    }
  }

  return conflictsByCase;
}

/**
 * 检测指定时间范围内用户所有案件的潜在冲突
 *
 * @param userId 用户ID
 * @param startDate 开始时间
 * @param endDate 结束时间
 * @returns 冲突列表
 */
export async function detectConflictsInTimeRange(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ScheduleConflict[]> {
  const schedules = await prisma.courtSchedule.findMany({
    where: {
      case: {
        userId,
        deletedAt: null,
      },
      status: { notIn: ['CANCELLED'] },
      startTime: {
        lte: endDate,
      },
      endTime: {
        gte: startDate,
      },
    },
    include: {
      case: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  const conflicts: ScheduleConflict[] = [];

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

  return conflicts;
}

/**
 * 验证日程修改是否会导致冲突
 *
 * @param scheduleId 日程ID
 * @param newStartTime 新的开始时间
 * @param newEndTime 新的结束时间
 * @param includeCancelled 是否包含已取消的日程
 * @returns 冲突列表
 */
export async function validateScheduleUpdate(
  scheduleId: string,
  newStartTime: Date,
  newEndTime: Date,
  includeCancelled = false
): Promise<ScheduleConflict[]> {
  const schedule = await prisma.courtSchedule.findUnique({
    where: { id: scheduleId },
  });

  if (!schedule) {
    return [];
  }

  if (newStartTime >= newEndTime) {
    throw new Error('开始时间必须早于结束时间');
  }

  const where: Record<string, unknown> = {
    caseId: schedule.caseId,
    id: { not: scheduleId },
  };

  if (!includeCancelled) {
    where.status = { notIn: ['CANCELLED'] };
  }

  const otherSchedules = await prisma.courtSchedule.findMany({
    where,
    orderBy: {
      startTime: 'asc',
    },
  });

  const conflicts: ScheduleConflict[] = [];

  for (const other of otherSchedules) {
    const conflictType = detectConflictType(
      newStartTime,
      newEndTime,
      other.startTime,
      other.endTime
    );

    if (conflictType) {
      conflicts.push({
        scheduleId: scheduleId,
        conflictingScheduleId: other.id,
        conflictingTitle: other.title,
        conflictType,
        startTime: other.startTime,
        endTime: other.endTime,
      });
    }
  }

  return conflicts;
}
