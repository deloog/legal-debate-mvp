/**
 * 法庭日程类型定义
 */

// 从Prisma导入枚举类型，保持一致性
import {
  CourtScheduleStatus as PrismaCourtScheduleStatus,
  CourtScheduleType as PrismaCourtScheduleType,
} from '@prisma/client';

export type CourtScheduleType = PrismaCourtScheduleType;
export type CourtScheduleStatus = PrismaCourtScheduleStatus;

/**
 * 创建法庭日程输入接口
 */
export interface CreateCourtScheduleInput {
  caseId: string;
  title: string;
  type?: CourtScheduleType;
  startTime: Date;
  endTime: Date;
  location?: string;
  judge?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 更新法庭日程输入接口
 */
export interface UpdateCourtScheduleInput {
  title?: string;
  type?: CourtScheduleType;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  judge?: string;
  notes?: string;
  status?: CourtScheduleStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 法庭日程查询参数接口
 */
export interface CourtScheduleQueryParams {
  caseId?: string;
  userId?: string;
  type?: CourtScheduleType;
  status?: CourtScheduleStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'startTime' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 法庭日程详情接口
 */
export interface CourtScheduleDetail {
  id: string;
  caseId: string;
  title: string;
  type: CourtScheduleType;
  startTime: Date;
  endTime: Date;
  location: string | null;
  judge: string | null;
  notes: string | null;
  status: CourtScheduleStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  caseTitle?: string;
  caseType?: string;
}

/**
 * 法庭日程列表响应接口
 */
export interface CourtScheduleListResponse {
  schedules: CourtScheduleDetail[];
  total: number;
}

/**
 * 日程冲突检测接口
 */
export interface ScheduleConflict {
  scheduleId: string;
  conflictingScheduleId: string;
  conflictingTitle: string;
  conflictType: 'SAME_TIME' | 'OVERLAPPING';
  startTime: Date;
  endTime: Date;
}

/**
 * 日程冲突检测响应接口
 */
export interface ScheduleConflictDetectionResponse {
  hasConflicts: boolean;
  conflicts: ScheduleConflict[];
}

/**
 * 日程统计信息接口
 */
export interface ScheduleStatistics {
  totalSchedules: number;
  schedulesByType: Record<CourtScheduleType, number>;
  schedulesByStatus: Record<CourtScheduleStatus, number>;
  upcomingSchedules: CourtScheduleDetail[];
  completedSchedulesThisMonth: number;
}

/**
 * 日程日历视图数据接口
 */
export interface CalendarSchedule {
  id: string;
  title: string;
  type: CourtScheduleType;
  start: Date;
  end: Date;
  location?: string;
  status: CourtScheduleStatus;
  caseId: string;
  caseTitle?: string;
}

/**
 * 法庭日程包含案件信息的内部类型
 * 用于API层数据转换
 */
export interface ScheduleWithCase {
  id: string;
  caseId: string;
  title: string;
  type: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  judge: string | null;
  notes: string | null;
  status: string;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
  case?: {
    id: string;
    title: string;
    type: string;
  };
}
