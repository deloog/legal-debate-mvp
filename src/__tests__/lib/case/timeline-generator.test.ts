/**
 * Timeline Generator 单元测试
 * 测试时间线生成器的类型安全性和功能
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  generateTimelineEventFromCaseChange,
  generateTimelineForCase,
  getTimelineSummary,
} from '@/lib/case/timeline-generator';
import {
  isObject,
  isString,
  isBoolean,
  hasProperty,
} from '@/types/timeline-generator';
import { CaseTimelineEventType } from '@/types/case';
import { CaseStatus } from '@prisma/client';

// Mock prisma module
jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    caseTimeline: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    $disconnect: jest.fn(),
  },
}));

// Type assertion for mocked prisma methods
import { prisma } from '@/lib/db/prisma';

const mockedFindUnique = prisma.case.findUnique as jest.Mock;
const mockedFindMany = prisma.case.findMany as jest.Mock;
const mockedTimelineFindFirst = prisma.caseTimeline.findFirst as jest.Mock;
const mockedTimelineFindMany = prisma.caseTimeline.findMany as jest.Mock;
const mockedTimelineCreate = prisma.caseTimeline.create as jest.Mock;

describe('Timeline Generator 类型守卫测试', () => {
  describe('isObject', () => {
    it('应该正确识别对象', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
      expect(isObject({ nested: { prop: 'value' } })).toBe(true);
    });

    it('应该拒绝非对象值', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(123)).toBe(false);
      expect(isObject(true)).toBe(false);
      expect(isObject([1, 2, 3])).toBe(false);
    });
  });

  describe('isString', () => {
    it('应该正确识别字符串', () => {
      expect(isString('')).toBe(true);
      expect(isString('hello')).toBe(true);
      expect(isString('123')).toBe(true);
    });

    it('应该拒绝非字符串值', () => {
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString(123)).toBe(false);
      expect(isString(true)).toBe(false);
      expect(isString({})).toBe(false);
    });
  });

  describe('isBoolean', () => {
    it('应该正确识别布尔值', () => {
      expect(isBoolean(true)).toBe(true);
      expect(isBoolean(false)).toBe(true);
    });

    it('应该拒绝非布尔值', () => {
      expect(isBoolean(null)).toBe(false);
      expect(isBoolean(undefined)).toBe(false);
      expect(isBoolean('true')).toBe(false);
      expect(isBoolean(1)).toBe(false);
      expect(isBoolean({})).toBe(false);
    });
  });

  describe('hasProperty', () => {
    it('应该正确检测属性存在', () => {
      const obj = { a: 1, b: 'test', c: true };
      expect(hasProperty(obj, 'a')).toBe(true);
      expect(hasProperty(obj, 'b')).toBe(true);
      expect(hasProperty(obj, 'c')).toBe(true);
    });

    it('应该正确检测属性不存在', () => {
      const obj = { a: 1 };
      expect(hasProperty(obj, 'b')).toBe(false);
      expect(hasProperty(obj, 'c')).toBe(false);
    });
  });
});

describe('Timeline Generator 功能测试', () => {
  const mockCaseId = 'test-case-id';
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateTimelineEventFromCaseChange', () => {
    it('当案件不存在时不应该生成时间线事件', async () => {
      mockedFindUnique.mockResolvedValue(null);

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).not.toHaveBeenCalled();
    });

    it('应该为ACTIVE状态的案件生成FILING事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        caseNumber: 'CN2024001',
        court: '北京市第一中级人民法院',
        cause: '合同纠纷',
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件立案：CN2024001',
        description: '审理法院：北京市第一中级人民法院\n案由：合同纠纷',
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.FILING,
          case: { connect: { id: mockCaseId } },
          title: expect.stringContaining('案件立案'),
        }),
      });
    });

    it('当指定eventType时应该生成特定类型的时间线事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.TRIAL,
        title: '开庭审理',
        description: null,
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.TRIAL,
        { note: '测试元数据' }
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.TRIAL,
          case: { connect: { id: mockCaseId } },
          title: '时间线事件',
          metadata: { note: '测试元数据' },
        }),
      });
    });

    it('当24小时内已存在相同类型事件时不应该重复创建', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      const recentEvent = {
        id: 'recent-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件立案',
        description: null,
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(),
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(recentEvent);

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).not.toHaveBeenCalled();
    });

    it('当COMPLETED状态时应生成CLOSED事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.COMPLETED,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.CLOSED,
        title: '案件已结案',
        description: null,
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.COMPLETED
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.CLOSED,
          case: { connect: { id: mockCaseId } },
          title: '案件已结案',
        }),
      });
    });
  });

  describe('generateTimelineForCase', () => {
    it('当案件不存在时不应该生成时间线', async () => {
      mockedFindUnique.mockResolvedValue(null);

      await generateTimelineForCase(mockCaseId);

      expect(mockedTimelineCreate).not.toHaveBeenCalled();
    });

    it('当案件已存在时间线事件时应该跳过生成', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      const existingTimeline = [
        {
          id: 'existing-event-id',
          caseId: mockCaseId,
          eventType: CaseTimelineEventType.FILING,
          title: '案件立案',
          description: null,
          eventDate: new Date(),
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindMany.mockResolvedValue(existingTimeline);

      await generateTimelineForCase(mockCaseId);

      expect(mockedTimelineCreate).not.toHaveBeenCalled();
    });

    it('应该为没有时间线的案件生成时间线事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindMany.mockResolvedValue([]);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件已立案',
        description: null,
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineForCase(mockCaseId);

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.FILING,
          case: { connect: { id: mockCaseId } },
        }),
      });
    });
  });

  describe('getTimelineSummary', () => {
    it('应该返回空时间线摘要', async () => {
      mockedTimelineFindMany.mockResolvedValue([]);

      const summary = await getTimelineSummary(mockCaseId);

      expect(summary).toEqual({
        totalEvents: 0,
        latestEvent: null,
        eventTypeCounts: {},
        dateRange: null,
      });
    });

    it('应该返回正确的时间线摘要', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          caseId: mockCaseId,
          eventType: CaseTimelineEventType.FILING,
          title: '案件立案',
          description: '法院：北京一中院',
          eventDate: new Date('2024-01-01'),
          metadata: null,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
        {
          id: 'event-2',
          caseId: mockCaseId,
          eventType: CaseTimelineEventType.TRIAL,
          title: '开庭审理',
          description: '法庭：第一审判庭',
          eventDate: new Date('2024-02-01'),
          metadata: null,
          createdAt: new Date('2024-02-01'),
          updatedAt: new Date('2024-02-01'),
        },
        {
          id: 'event-3',
          caseId: mockCaseId,
          eventType: CaseTimelineEventType.JUDGMENT,
          title: '判决已下达',
          description: null,
          eventDate: new Date('2024-03-01'),
          metadata: null,
          createdAt: new Date('2024-03-01'),
          updatedAt: new Date('2024-03-01'),
        },
      ];

      mockedTimelineFindMany.mockResolvedValue(mockEvents);

      const summary = await getTimelineSummary(mockCaseId);

      expect(summary.totalEvents).toBe(3);
      expect(summary.latestEvent?.eventType).toBe(CaseTimelineEventType.FILING);
      expect(summary.eventTypeCounts).toEqual({
        FILING: 1,
        TRIAL: 1,
        JUDGMENT: 1,
      });
      expect(summary.dateRange).toEqual({
        start: new Date('2024-03-01'),
        end: new Date('2024-01-01'),
      });
    });

    it('应该正确计算事件类型计数', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          caseId: mockCaseId,
          eventType: CaseTimelineEventType.FILING,
          title: '案件立案',
          description: null,
          eventDate: new Date(),
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'event-2',
          caseId: mockCaseId,
          eventType: CaseTimelineEventType.FILING,
          title: '案件立案',
          description: null,
          eventDate: new Date(),
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'event-3',
          caseId: mockCaseId,
          eventType: CaseTimelineEventType.TRIAL,
          title: '开庭审理',
          description: null,
          eventDate: new Date(),
          metadata: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockedTimelineFindMany.mockResolvedValue(mockEvents);

      const summary = await getTimelineSummary(mockCaseId);

      expect(summary.eventTypeCounts.FILING).toBe(2);
      expect(summary.eventTypeCounts.TRIAL).toBe(1);
    });
  });

  describe('额外覆盖率测试', () => {
    it('应该为FILING事件生成包含法院和案由的描述', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        caseNumber: 'CN2024001',
        court: '北京市朝阳区人民法院',
        cause: '合同纠纷',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件立案：CN2024001',
        description: '审理法院：北京市朝阳区人民法院\n案由：合同纠纷',
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.FILING,
          title: '案件立案：CN2024001',
          description: '审理法院：北京市朝阳区人民法院\n案由：合同纠纷',
        }),
      });
    });

    it('应该为FILING事件生成仅包含法院的描述', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        caseNumber: 'CN2024002',
        court: '北京市海淀区人民法院',
        cause: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件立案：CN2024002',
        description: '审理法院：北京市海淀区人民法院',
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: '审理法院：北京市海淀区人民法院',
        }),
      });
    });

    it('应该为FILING事件生成仅包含案由的描述', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        caseNumber: 'CN2024003',
        court: null,
        cause: '借款纠纷',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件立案：CN2024003',
        description: '案由：借款纠纷',
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: '案由：借款纠纷',
        }),
      });
    });

    it('应该为TRIAL事件生成不包含trialDate的标题', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: {
          trialScheduled: true,
          trialDate: null,
        },
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.TRIAL,
        title: '时间线事件',
        description: null,
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.TRIAL
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: '时间线事件',
        }),
      });
    });

    it('应该为没有triggerStatus的事件生成默认标题', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.CUSTOM,
        title: '时间线事件',
        description: null,
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.CUSTOM
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: '时间线事件',
        }),
      });
    });

    it('应该处理带有元数据的案件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        caseNumber: 'CN2024002',
        court: '北京市朝阳区人民法院',
        cause: '借款纠纷',
        metadata: {
          stage: 'PRETRIAL',
          trialScheduled: false,
          judgmentIssued: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件立案：CN2024002',
        description: '审理法院：北京市朝阳区人民法院\n案由：借款纠纷',
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).toHaveBeenCalled();
    });

    it('应该处理错误情况', async () => {
      mockedFindUnique.mockRejectedValue(new Error('Database error'));

      await expect(
        generateTimelineEventFromCaseChange(mockCaseId, null, CaseStatus.ACTIVE)
      ).rejects.toThrow('Database error');
    });

    it('当超过24小时后应该允许创建新事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      const oldEvent = {
        id: 'old-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件立案',
        description: null,
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25小时前
        updatedAt: new Date(),
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(oldEvent);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件已立案',
        description: null,
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).toHaveBeenCalled();
    });

    it('应该为PRETRIAL阶段的案件生成事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        metadata: {
          stage: 'PRETRIAL',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.PRETRIAL,
        title: '时间线事件',
        description: null,
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.PRETRIAL
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.PRETRIAL,
          title: '时间线事件',
        }),
      });
    });

    it('应该为已安排开庭的案件生成TRIAL事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        metadata: {
          trialScheduled: true,
          trialDate: '2024-03-15',
          trialCourtroom: '第一审判庭',
          presidingJudge: '张法官',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.TRIAL,
        title: '时间线事件',
        description: null,
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.TRIAL
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.TRIAL,
          title: '时间线事件',
        }),
      });
    });

    it('应该为已下达判决的案件生成JUDGMENT事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        metadata: {
          judgmentIssued: true,
          judgmentResult: '胜诉',
          judgmentDate: '2024-04-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.JUDGMENT,
        title: '时间线事件',
        description: null,
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.JUDGMENT
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.JUDGMENT,
          title: '时间线事件',
        }),
      });
    });

    it('应该为已提起上诉的案件生成APPEAL事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        metadata: {
          appealFiled: true,
          appealCourt: '北京市高级人民法院',
          appealDeadline: '2024-05-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.APPEAL,
        title: '时间线事件',
        description: null,
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.APPEAL
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.APPEAL,
          title: '时间线事件',
        }),
      });
    });

    it('应该为已进入执行的案件生成EXECUTION事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        metadata: {
          executionStarted: true,
          executionCourt: '北京市朝阳区人民法院执行局',
          executionDeadline: '2024-06-01',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.EXECUTION,
        title: '时间线事件',
        description: null,
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.EXECUTION
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.EXECUTION,
          title: '时间线事件',
        }),
      });
    });

    it('应该为ARCHIVED状态的案件生成归档事件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: 'ARCHIVED',
        metadata: {
          closeDate: '2024-07-01',
          closedReason: '自然结案',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.CLOSED,
        title: '案件已归档',
        description: '结案原因：自然结案\n结案日期：2024-07-01',
        eventDate: new Date(),
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        'ARCHIVED' as CaseStatus
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: CaseTimelineEventType.CLOSED,
          title: '案件已归档',
          description: '结案原因：自然结案\n结案日期：2024-07-01',
        }),
      });
    });

    it('应该处理没有案件号的案件', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        caseNumber: null,
        court: null,
        cause: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineFindFirst.mockResolvedValue(null);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.FILING,
        title: '案件已立案',
        description: null,
        eventDate: new Date(),
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: '案件已立案',
          description: null,
        }),
      });
    });

    it('应该使用additionalData合并元数据', async () => {
      const mockCaseData = {
        id: mockCaseId,
        userId: mockUserId,
        title: '测试案件',
        description: '测试描述',
        type: 'CIVIL',
        status: CaseStatus.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        amount: null,
        caseNumber: null,
        court: null,
        cause: null,
        plaintiffName: null,
        defendantName: null,
        clientId: null,
        metadata: null,
      };

      mockedFindUnique.mockResolvedValue(mockCaseData);
      mockedTimelineCreate.mockResolvedValue({
        id: 'timeline-event-id',
        caseId: mockCaseId,
        eventType: CaseTimelineEventType.TRIAL,
        title: '时间线事件',
        description: null,
        eventDate: new Date(),
        metadata: { note: '测试元数据', extra: '额外信息' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await generateTimelineEventFromCaseChange(
        mockCaseId,
        null,
        CaseStatus.ACTIVE,
        CaseTimelineEventType.TRIAL,
        { note: '测试元数据', extra: '额外信息' }
      );

      expect(mockedTimelineCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: { note: '测试元数据', extra: '额外信息' },
        }),
      });
    });
  });
});
