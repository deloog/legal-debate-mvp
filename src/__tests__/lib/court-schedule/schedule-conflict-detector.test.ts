/**
 * 法庭日程冲突检测测试
 * 验证日程冲突检测的各种场景
 */

// 使用真实数据库进行集成测试
jest.mock('@/lib/db/prisma', () => {
  const { PrismaClient: RealPrismaClient } = jest.requireActual(
    '@prisma/client'
  ) as typeof import('@prisma/client');
  return { prisma: new RealPrismaClient() };
});

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '@jest/globals';
import { prisma } from '@/lib/db/prisma';
import {
  detectConflictType,
  detectScheduleConflicts,
  detectCaseConflicts,
  detectConflictsInTimeRange,
  validateScheduleUpdate,
} from '@/lib/court-schedule/schedule-conflict-detector';

describe('Court Schedule Conflict Detection', () => {
  let testUserId: string;
  let testCaseId: string;
  let scheduleIds: string[] = [];

  beforeAll(async () => {
    // 创建测试用户
    const user = await prisma.user.create({
      data: {
        email: `test-schedule-${Date.now()}@test.com`,
        name: 'Test Schedule User',
        role: 'USER',
        status: 'ACTIVE',
      },
    });
    testUserId = user.id;

    // 创建测试案件
    const caseRecord = await prisma.case.create({
      data: {
        userId: testUserId,
        title: '测试案件',
        description: '测试案件描述',
        type: 'CIVIL',
        status: 'ACTIVE',
      },
    });
    testCaseId = caseRecord.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.courtSchedule.deleteMany({
      where: { caseId: testCaseId },
    });
    await prisma.case.delete({ where: { id: testCaseId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // 清理之前创建的日程
    await prisma.courtSchedule.deleteMany({
      where: { caseId: testCaseId },
    });
    scheduleIds = [];
  });

  describe('detectConflictType', () => {
    it('应该检测到同一时间冲突', () => {
      const start1 = new Date('2024-01-15T10:00:00.000Z');
      const end1 = new Date('2024-01-15T11:00:00.000Z');
      const start2 = new Date('2024-01-15T10:00:00.000Z');
      const end2 = new Date('2024-01-15T12:00:00.000Z');

      const result = detectConflictType(start1, end1, start2, end2);
      expect(result).toBe('SAME_TIME');
    });

    it('应该检测到时间重叠冲突', () => {
      const start1 = new Date('2024-01-15T10:00:00.000Z');
      const end1 = new Date('2024-01-15T11:00:00.000Z');
      const start2 = new Date('2024-01-15T10:30:00.000Z');
      const end2 = new Date('2024-01-15T12:00:00.000Z');

      const result = detectConflictType(start1, end1, start2, end2);
      expect(result).toBe('OVERLAPPING');
    });

    it('应该检测到包含关系的重叠', () => {
      const start1 = new Date('2024-01-15T10:00:00.000Z');
      const end1 = new Date('2024-01-15T12:00:00.000Z');
      const start2 = new Date('2024-01-15T10:30:00.000Z');
      const end2 = new Date('2024-01-15T11:30:00.000Z');

      const result = detectConflictType(start1, end1, start2, end2);
      expect(result).toBe('OVERLAPPING');
    });

    it('应该返回null当时间不重叠', () => {
      const start1 = new Date('2024-01-15T10:00:00.000Z');
      const end1 = new Date('2024-01-15T11:00:00.000Z');
      const start2 = new Date('2024-01-15T11:00:00.000Z');
      const end2 = new Date('2024-01-15T12:00:00.000Z');

      const result = detectConflictType(start1, end1, start2, end2);
      expect(result).toBeNull();
    });

    it('应该返回null当时间段完全分离', () => {
      const start1 = new Date('2024-01-15T10:00:00.000Z');
      const end1 = new Date('2024-01-15T11:00:00.000Z');
      const start2 = new Date('2024-01-15T14:00:00.000Z');
      const end2 = new Date('2024-01-15T15:00:00.000Z');

      const result = detectConflictType(start1, end1, start2, end2);
      expect(result).toBeNull();
    });

    it('应该返回null当时间段无效', () => {
      const start1 = new Date('2024-01-15T11:00:00.000Z');
      const end1 = new Date('2024-01-15T10:00:00.000Z');
      const start2 = new Date('2024-01-15T10:00:00.000Z');
      const end2 = new Date('2024-01-15T12:00:00.000Z');

      const result = detectConflictType(start1, end1, start2, end2);
      expect(result).toBeNull();
    });
  });

  describe('detectScheduleConflicts', () => {
    it('应该检测到与同一案件其他日程的冲突', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      const schedule2 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午调解',
          type: 'MEDIATION',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T11:30:00.000Z'),
        },
      });

      scheduleIds.push(schedule1.id, schedule2.id);

      const conflicts = await detectScheduleConflicts(schedule1.id);
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflictType).toBe('OVERLAPPING');
      expect(conflicts[0].conflictingScheduleId).toBe(schedule2.id);
    });

    it('应该返回空数组当不存在冲突', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      const schedule2 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '下午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T14:00:00.000Z'),
          endTime: new Date('2024-01-15T15:00:00.000Z'),
        },
      });

      scheduleIds.push(schedule1.id, schedule2.id);

      const conflicts = await detectScheduleConflicts(schedule1.id);
      expect(conflicts).toHaveLength(0);
    });

    it('应该支持排除已取消的日程', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      const cancelledSchedule = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '已取消的调解',
          type: 'MEDIATION',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T11:30:00.000Z'),
          status: 'CANCELLED',
        },
      });

      scheduleIds.push(schedule1.id, cancelledSchedule.id);

      const conflicts = await detectScheduleConflicts(schedule1.id);
      expect(conflicts).toHaveLength(0);
    });

    it('应该支持包含已取消的日程', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      const cancelledSchedule = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '已取消的调解',
          type: 'MEDIATION',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T11:30:00.000Z'),
          status: 'CANCELLED',
        },
      });

      scheduleIds.push(schedule1.id, cancelledSchedule.id);

      const conflicts = await detectScheduleConflicts(schedule1.id, {
        includeCancelled: true,
      });
      expect(conflicts).toHaveLength(1);
    });

    it('应该返回空数组当日程不存在', async () => {
      const conflicts = await detectScheduleConflicts('non-existent-id');
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('detectCaseConflicts', () => {
    it('应该检测案件内所有冲突', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      const schedule2 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午调解',
          type: 'MEDIATION',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T11:30:00.000Z'),
        },
      });

      const schedule3 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '下午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T14:00:00.000Z'),
          endTime: new Date('2024-01-15T15:00:00.000Z'),
        },
      });

      scheduleIds.push(schedule1.id, schedule2.id, schedule3.id);

      const conflicts = await detectCaseConflicts(testCaseId);
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      expect(conflicts.some(c => c.conflictType === 'OVERLAPPING')).toBe(true);
    });

    it('应该返回空数组当案件无冲突', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      scheduleIds.push(schedule1.id);

      const conflicts = await detectCaseConflicts(testCaseId);
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('detectConflictsInTimeRange', () => {
    let otherCaseId: string;

    beforeAll(async () => {
      // 创建另一个案件
      const otherCase = await prisma.case.create({
        data: {
          userId: testUserId,
          title: '其他测试案件',
          description: '其他测试案件描述',
          type: 'CIVIL',
          status: 'ACTIVE',
        },
      });
      otherCaseId = otherCase.id;
    });

    afterAll(async () => {
      // 清理其他案件
      await prisma.courtSchedule.deleteMany({
        where: { caseId: otherCaseId },
      });
      await prisma.case.delete({ where: { id: otherCaseId } });
    });

    it('应该检测时间范围内的所有冲突', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      const schedule2 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午调解',
          type: 'MEDIATION',
          startTime: new Date('2024-01-15T10:30:00.000Z'),
          endTime: new Date('2024-01-15T11:30:00.000Z'),
        },
      });

      const schedule3 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '下午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T14:00:00.000Z'),
          endTime: new Date('2024-01-15T15:00:00.000Z'),
        },
      });

      scheduleIds.push(schedule1.id, schedule2.id, schedule3.id);

      const startDate = new Date('2024-01-15T09:00:00.000Z');
      const endDate = new Date('2024-01-15T12:00:00.000Z');

      const conflicts = await detectConflictsInTimeRange(
        testUserId,
        startDate,
        endDate
      );
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validateScheduleUpdate', () => {
    it('应该检测日程更新后的冲突', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      const schedule2 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '下午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T14:00:00.000Z'),
          endTime: new Date('2024-01-15T15:00:00.000Z'),
        },
      });

      scheduleIds.push(schedule1.id, schedule2.id);

      const newStartTime = new Date('2024-01-15T14:30:00.000Z');
      const newEndTime = new Date('2024-01-15T15:30:00.000Z');

      const conflicts = await validateScheduleUpdate(
        schedule1.id,
        newStartTime,
        newEndTime
      );
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].conflictingScheduleId).toBe(schedule2.id);
    });

    it('应该抛出错误当新时间段无效', async () => {
      const schedule1 = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '上午开庭',
          type: 'TRIAL',
          startTime: new Date('2024-01-15T10:00:00.000Z'),
          endTime: new Date('2024-01-15T11:00:00.000Z'),
        },
      });

      scheduleIds.push(schedule1.id);

      const newStartTime = new Date('2024-01-15T11:00:00.000Z');
      const newEndTime = new Date('2024-01-15T10:00:00.000Z');

      await expect(
        validateScheduleUpdate(schedule1.id, newStartTime, newEndTime)
      ).rejects.toThrow('开始时间必须早于结束时间');
    });

    it('应该返回空数组当日程不存在', async () => {
      const newStartTime = new Date('2024-01-15T14:00:00.000Z');
      const newEndTime = new Date('2024-01-15T15:00:00.000Z');

      const conflicts = await validateScheduleUpdate(
        'non-existent-id',
        newStartTime,
        newEndTime
      );
      expect(conflicts).toHaveLength(0);
    });
  });
});
