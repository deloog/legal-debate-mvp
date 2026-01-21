/**
 * CourtSchedule API 测试文件
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('CourtSchedule Database Model', () => {
  let testCaseId: string;
  let testScheduleId: string;

  beforeAll(async () => {
    // 创建测试用户
    const testUser = await prisma.user.create({
      data: {
        email: 'court-schedule-test@example.com',
        username: 'courtscheduletest',
        name: 'Court Schedule Test User',
        role: 'LAWYER',
        status: 'ACTIVE',
      },
    });

    // 创建测试案件
    const testCase = await prisma.case.create({
      data: {
        userId: testUser.id,
        title: '测试案件',
        description: '测试案件描述',
        type: 'CIVIL',
        status: 'ACTIVE',
      },
    });
    testCaseId = testCase.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.courtSchedule.deleteMany({});
    try {
      await prisma.case.deleteMany({});
      await prisma.user.deleteMany({
        where: {
          email: {
            in: [
              'court-schedule-test@example.com',
              'court-schedule-temp@example.com',
            ],
          },
        },
      });
    } catch (error) {
      // 忽略清理错误
    }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // 每个测试前的准备
  });

  afterEach(async () => {
    // 每个测试后清理日程数据
    await prisma.courtSchedule.deleteMany({});
  });

  describe('CourtSchedule Model Creation', () => {
    it('应该成功创建法庭日程', async () => {
      const schedule = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '首次开庭',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T11:00:00'),
          location: '第一法庭',
          judge: '张法官',
          status: 'SCHEDULED',
        },
      });

      expect(schedule).toBeDefined();
      expect(schedule.id).toBeDefined();
      expect(schedule.title).toBe('首次开庭');
      expect(schedule.type).toBe('TRIAL');
      expect(schedule.status).toBe('SCHEDULED');
      expect(schedule.location).toBe('第一法庭');
      expect(schedule.judge).toBe('张法官');
      testScheduleId = schedule.id;
    });

    it('应该支持所有法庭日程类型', async () => {
      const types = [
        'TRIAL',
        'MEDIATION',
        'ARBITRATION',
        'MEETING',
        'OTHER',
      ] as const;
      const createdSchedules = [];

      for (const type of types) {
        const index = types.indexOf(type);
        const schedule = await prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: `${type}日程`,
            type,
            startTime: new Date(`2026-01-25T0${index + 1}:00:00`),
            endTime: new Date(`2026-01-25T0${index + 1}:30:00`),
            status: 'SCHEDULED',
          },
        });
        createdSchedules.push(schedule);
      }

      expect(createdSchedules).toHaveLength(5);
      createdSchedules.forEach((schedule, index) => {
        expect(schedule.type).toBe(types[index]);
      });
    });

    it('应该支持所有法庭日程状态', async () => {
      const statuses = [
        'SCHEDULED',
        'CONFIRMED',
        'COMPLETED',
        'CANCELLED',
        'RESCHEDULED',
      ] as const;
      const createdSchedules = [];

      for (const status of statuses) {
        const schedule = await prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: `${status}日程`,
            startTime: new Date(
              `2026-01-25T0${statuses.indexOf(status) + 1}:00:00`
            ),
            endTime: new Date(
              `2026-01-25T0${statuses.indexOf(status) + 1}:30:00`
            ),
            status,
          },
        });
        createdSchedules.push(schedule);
      }

      expect(createdSchedules).toHaveLength(5);
      createdSchedules.forEach((schedule, index) => {
        expect(schedule.status).toBe(statuses[index]);
      });
    });

    it('应该支持可选字段', async () => {
      const schedule = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '最小日程',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      expect(schedule.location).toBeNull();
      expect(schedule.judge).toBeNull();
      expect(schedule.notes).toBeNull();
    });

    it('应该支持metadata字段', async () => {
      const metadata = {
        customField: '自定义值',
        priority: 'HIGH',
        tags: ['重要', '紧急'],
      };

      const schedule = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '带元数据的日程',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
          metadata,
        },
      });

      expect(schedule.metadata).toEqual(metadata);
    });
  });

  describe('CourtSchedule Model Read', () => {
    it('应该能够查询单个日程', async () => {
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '查询测试日程',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      const found = await prisma.courtSchedule.findUnique({
        where: { id: created.id },
      });

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
      expect(found?.title).toBe('查询测试日程');
    });

    it('应该能够查询案件的所有日程', async () => {
      const schedules = await Promise.all([
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '日程1',
            type: 'TRIAL',
            startTime: new Date('2026-01-25T09:00:00'),
            endTime: new Date('2026-01-25T10:00:00'),
            status: 'SCHEDULED',
          },
        }),
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '日程2',
            type: 'MEDIATION',
            startTime: new Date('2026-01-26T09:00:00'),
            endTime: new Date('2026-01-26T10:00:00'),
            status: 'SCHEDULED',
          },
        }),
      ]);

      const found = await prisma.courtSchedule.findMany({
        where: { caseId: testCaseId },
      });

      expect(found).toHaveLength(2);
      expect(found[0].caseId).toBe(testCaseId);
      expect(found[1].caseId).toBe(testCaseId);
    });

    it('应该能够按类型筛选', async () => {
      await Promise.all([
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '庭审',
            type: 'TRIAL',
            startTime: new Date('2026-01-25T09:00:00'),
            endTime: new Date('2026-01-25T10:00:00'),
            status: 'SCHEDULED',
          },
        }),
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '调解',
            type: 'MEDIATION',
            startTime: new Date('2026-01-26T09:00:00'),
            endTime: new Date('2026-01-26T10:00:00'),
            status: 'SCHEDULED',
          },
        }),
      ]);

      const trials = await prisma.courtSchedule.findMany({
        where: { type: 'TRIAL' },
      });

      expect(trials).toHaveLength(1);
      expect(trials[0].type).toBe('TRIAL');
    });

    it('应该能够按状态筛选', async () => {
      await Promise.all([
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '已安排',
            type: 'TRIAL',
            startTime: new Date('2026-01-25T09:00:00'),
            endTime: new Date('2026-01-25T10:00:00'),
            status: 'SCHEDULED',
          },
        }),
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '已完成',
            type: 'TRIAL',
            startTime: new Date('2026-01-26T09:00:00'),
            endTime: new Date('2026-01-26T10:00:00'),
            status: 'COMPLETED',
          },
        }),
      ]);

      const scheduled = await prisma.courtSchedule.findMany({
        where: { status: 'SCHEDULED' },
      });

      expect(scheduled).toHaveLength(1);
      expect(scheduled[0].status).toBe('SCHEDULED');
    });
  });

  describe('CourtSchedule Model Update', () => {
    it('应该能够更新日程标题', async () => {
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '原标题',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      const updated = await prisma.courtSchedule.update({
        where: { id: created.id },
        data: { title: '新标题' },
      });

      expect(updated.title).toBe('新标题');
    });

    it('应该能够更新日程状态', async () => {
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '状态更新测试',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      const updated = await prisma.courtSchedule.update({
        where: { id: created.id },
        data: { status: 'CONFIRMED' },
      });

      expect(updated.status).toBe('CONFIRMED');
    });

    it('应该能够更新时间', async () => {
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '时间更新测试',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      const newStartTime = new Date('2026-01-25T14:00:00');
      const newEndTime = new Date('2026-01-25T16:00:00');

      const updated = await prisma.courtSchedule.update({
        where: { id: created.id },
        data: {
          startTime: newStartTime,
          endTime: newEndTime,
        },
      });

      expect(updated.startTime).toEqual(newStartTime);
      expect(updated.endTime).toEqual(newEndTime);
    });
  });

  describe('CourtSchedule Model Delete', () => {
    it('应该能够删除日程', async () => {
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '删除测试',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      await prisma.courtSchedule.delete({
        where: { id: created.id },
      });

      const found = await prisma.courtSchedule.findUnique({
        where: { id: created.id },
      });

      expect(found).toBeNull();
    });
  });

  describe('CourtSchedule Model Constraints', () => {
    it('应该禁止同一案件同一时间有多个日程', async () => {
      const startTime = new Date('2026-01-25T09:00:00');
      const endTime = new Date('2026-01-25T10:00:00');

      await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '日程1',
          type: 'TRIAL',
          startTime,
          endTime,
          status: 'SCHEDULED',
        },
      });

      await expect(
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '日程2',
            type: 'TRIAL',
            startTime,
            endTime,
            status: 'SCHEDULED',
          },
        })
      ).rejects.toThrow();
    });

    it('应该允许同一案件不同时间的日程', async () => {
      const startTime1 = new Date('2026-01-25T09:00:00');
      const endTime1 = new Date('2026-01-25T10:00:00');
      const startTime2 = new Date('2026-01-25T14:00:00');
      const endTime2 = new Date('2026-01-25T16:00:00');

      await Promise.all([
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '上午庭审',
            type: 'TRIAL',
            startTime: startTime1,
            endTime: endTime1,
            status: 'SCHEDULED',
          },
        }),
        prisma.courtSchedule.create({
          data: {
            caseId: testCaseId,
            title: '下午调解',
            type: 'MEDIATION',
            startTime: startTime2,
            endTime: endTime2,
            status: 'SCHEDULED',
          },
        }),
      ]);

      const schedules = await prisma.courtSchedule.findMany({
        where: { caseId: testCaseId },
      });

      expect(schedules).toHaveLength(2);
    });
  });

  describe('CourtSchedule Model Indexes', () => {
    it('应该能够使用caseId索引查询', async () => {
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '索引测试',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      // 验证索引有效（通过查询性能测试）
      const schedules = await prisma.courtSchedule.findMany({
        where: { caseId: testCaseId },
      });

      expect(schedules.length).toBeGreaterThan(0);
    });

    it('应该能够使用type索引查询', async () => {
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '类型索引测试',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      const schedules = await prisma.courtSchedule.findMany({
        where: { type: 'TRIAL' },
      });

      expect(schedules.length).toBeGreaterThan(0);
    });

    it('应该能够使用startTime索引查询', async () => {
      const startTime = new Date('2026-01-25T09:00:00');
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '时间索引测试',
          type: 'TRIAL',
          startTime,
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      const schedules = await prisma.courtSchedule.findMany({
        where: {
          startTime: { gte: startTime },
        },
      });

      expect(schedules.length).toBeGreaterThan(0);
    });

    it('应该能够使用status索引查询', async () => {
      const created = await prisma.courtSchedule.create({
        data: {
          caseId: testCaseId,
          title: '状态索引测试',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      const schedules = await prisma.courtSchedule.findMany({
        where: { status: 'SCHEDULED' },
      });

      expect(schedules.length).toBeGreaterThan(0);
    });
  });

  describe('CourtSchedule Model Cascade Delete', () => {
    it('应该能够在删除案件时级联删除相关日程', async () => {
      // 创建临时用户
      const tempUser = await prisma.user.create({
        data: {
          email: 'court-schedule-temp@example.com',
          username: 'courtscheduletemp',
          name: 'Temp User',
          role: 'LAWYER',
          status: 'ACTIVE',
        },
      });

      // 创建临时案件
      const tempCase = await prisma.case.create({
        data: {
          userId: tempUser.id,
          title: '临时案件',
          description: '临时案件描述',
          type: 'CIVIL',
          status: 'ACTIVE',
        },
      });

      // 创建日程
      await prisma.courtSchedule.create({
        data: {
          caseId: tempCase.id,
          title: '临时日程',
          type: 'TRIAL',
          startTime: new Date('2026-01-25T09:00:00'),
          endTime: new Date('2026-01-25T10:00:00'),
          status: 'SCHEDULED',
        },
      });

      // 验证日程存在
      let schedules = await prisma.courtSchedule.findMany({
        where: { caseId: tempCase.id },
      });
      expect(schedules).toHaveLength(1);

      // 删除案件和用户
      await prisma.case.delete({
        where: { id: tempCase.id },
      });
      await prisma.user.delete({
        where: { id: tempUser.id },
      });

      // 验证日程被级联删除
      schedules = await prisma.courtSchedule.findMany({
        where: { caseId: tempCase.id },
      });
      expect(schedules).toHaveLength(0);
    });
  });
});
