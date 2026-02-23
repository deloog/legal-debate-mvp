import { prisma } from '@/lib/db/prisma';
import { CaseTimelineEventType } from '@/types/case';
import {
  CaseDataForTimeline,
  TimelineEventConfig,
  TimelineSummary,
  isObject,
  isString,
  isBoolean,
} from '@/types/timeline-generator';
import { CaseStatus, Prisma } from '@prisma/client';

/**
 * 自动时间线生成器
 * 根据案件状态变化自动生成时间线事件
 */

/**
 * 时间线事件映射配置
 * 根据案件状态和时间线事件的对应关系
 */
const TIMELINE_EVENT_MAPPING: Record<string, TimelineEventConfig> = {
  FILING: {
    triggerStatus: 'ACTIVE',
    triggerConditions: (caseData: unknown) => {
      return checkCaseStatus(caseData, 'ACTIVE');
    },
    generateTitle: (caseData: unknown) => {
      const caseNumber = extractStringProperty(caseData, 'caseNumber');
      return caseNumber ? `案件立案：${caseNumber}` : '案件已立案';
    },
    generateDescription: (caseData: unknown) => {
      const details: string[] = [];
      const court = extractStringProperty(caseData, 'court');
      const cause = extractStringProperty(caseData, 'cause');

      if (court) details.push(`审理法院：${court}`);
      if (cause) details.push(`案由：${cause}`);

      return details.length > 0 ? details.join('\n') : null;
    },
  },
  PRETRIAL: {
    triggerConditions: (caseData: unknown) => {
      if (!checkCaseStatus(caseData, 'ACTIVE')) {
        return false;
      }
      return checkMetadataStage(caseData, 'PRETRIAL');
    },
    generateTitle: () => '进入审前准备阶段',
    generateDescription: () => null,
  },
  TRIAL: {
    triggerConditions: (caseData: unknown) => {
      if (!checkCaseStatus(caseData, 'ACTIVE')) {
        return false;
      }
      return (
        checkMetadataStage(caseData, 'TRIAL') ||
        checkMetadataBoolean(caseData, 'trialScheduled')
      );
    },
    generateTitle: (caseData: unknown) => {
      const trialDate = extractMetadataString(caseData, 'trialDate');
      if (trialDate) {
        return `开庭审理：${trialDate}`;
      }
      return '开庭审理';
    },
    generateDescription: (caseData: unknown) => {
      const details: string[] = [];
      const court = extractStringProperty(caseData, 'court');
      const trialCourtroom = extractMetadataString(caseData, 'trialCourtroom');
      const presidingJudge = extractMetadataString(caseData, 'presidingJudge');

      if (court) details.push(`审理法院：${court}`);
      if (trialCourtroom) details.push(`法庭：${trialCourtroom}`);
      if (presidingJudge) details.push(`审判长：${presidingJudge}`);

      return details.length > 0 ? details.join('\n') : null;
    },
  },
  JUDGMENT: {
    triggerConditions: (caseData: unknown) => {
      if (!checkCaseStatus(caseData, 'ACTIVE')) {
        return false;
      }
      return (
        checkMetadataStage(caseData, 'JUDGMENT') ||
        checkMetadataBoolean(caseData, 'judgmentIssued')
      );
    },
    generateTitle: () => '判决已下达',
    generateDescription: (caseData: unknown) => {
      const details: string[] = [];
      const judgmentResult = extractMetadataString(caseData, 'judgmentResult');
      const judgmentDate = extractMetadataString(caseData, 'judgmentDate');

      if (judgmentResult) details.push(`判决结果：${judgmentResult}`);
      if (judgmentDate) details.push(`判决日期：${judgmentDate}`);

      return details.length > 0 ? details.join('\n') : null;
    },
  },
  APPEAL: {
    triggerConditions: (caseData: unknown) => {
      if (!checkCaseStatus(caseData, 'ACTIVE')) {
        return false;
      }
      return (
        checkMetadataStage(caseData, 'APPEAL') ||
        checkMetadataBoolean(caseData, 'appealFiled')
      );
    },
    generateTitle: () => '提起上诉',
    generateDescription: (caseData: unknown) => {
      const details: string[] = [];
      const appealCourt = extractMetadataString(caseData, 'appealCourt');
      const appealDeadline = extractMetadataString(caseData, 'appealDeadline');

      if (appealCourt) details.push(`上诉法院：${appealCourt}`);
      if (appealDeadline) details.push(`上诉期限：${appealDeadline}`);

      return details.length > 0 ? details.join('\n') : null;
    },
  },
  EXECUTION: {
    triggerConditions: (caseData: unknown) => {
      if (!checkCaseStatus(caseData, 'ACTIVE')) {
        return false;
      }
      return (
        checkMetadataStage(caseData, 'EXECUTION') ||
        checkMetadataBoolean(caseData, 'executionStarted')
      );
    },
    generateTitle: () => '进入执行程序',
    generateDescription: (caseData: unknown) => {
      const details: string[] = [];
      const executionCourt = extractMetadataString(caseData, 'executionCourt');
      const executionDeadline = extractMetadataString(
        caseData,
        'executionDeadline'
      );

      if (executionCourt) details.push(`执行法院：${executionCourt}`);
      if (executionDeadline) details.push(`执行期限：${executionDeadline}`);

      return details.length > 0 ? details.join('\n') : null;
    },
  },
  CLOSED: {
    triggerStatus: 'COMPLETED',
    triggerConditions: (caseData: unknown) => {
      const status = extractStatusProperty(caseData);
      return status === 'COMPLETED' || status === 'ARCHIVED';
    },
    generateTitle: (caseData: unknown) => {
      const status = extractStatusProperty(caseData);
      if (status === 'ARCHIVED') {
        return '案件已归档';
      }
      return '案件已结案';
    },
    generateDescription: (caseData: unknown) => {
      const details: string[] = [];
      const closedReason = extractMetadataString(caseData, 'closedReason');
      const closeDate = extractMetadataString(caseData, 'closeDate');

      if (closedReason) details.push(`结案原因：${closedReason}`);
      if (closeDate) details.push(`结案日期：${closeDate}`);

      return details.length > 0 ? details.join('\n') : null;
    },
  },
};

/**
 * 提取案件状态属性
 */
function extractStatusProperty(caseData: unknown): string | undefined {
  if (!isObject(caseData)) {
    return undefined;
  }
  const status = caseData.status;
  if (isString(status)) {
    return status;
  }
  return undefined;
}

/**
 * 提取字符串属性
 */
function extractStringProperty(
  caseData: unknown,
  prop: string
): string | undefined {
  if (!isObject(caseData)) {
    return undefined;
  }
  const value = caseData[prop];
  if (isString(value)) {
    return value;
  }
  return undefined;
}

/**
 * 提取元数据中的字符串属性
 */
function extractMetadataString(
  caseData: unknown,
  prop: string
): string | undefined {
  if (!isObject(caseData)) {
    return undefined;
  }
  const metadata = caseData.metadata;
  if (!isObject(metadata)) {
    return undefined;
  }
  const value = metadata[prop];
  if (isString(value)) {
    return value;
  }
  return undefined;
}

/**
 * 检查案件状态
 */
function checkCaseStatus(caseData: unknown, expectedStatus: string): boolean {
  const status = extractStatusProperty(caseData);
  return status === expectedStatus;
}

/**
 * 检查元数据中的stage属性
 */
function checkMetadataStage(caseData: unknown, expectedStage: string): boolean {
  const stage = extractMetadataString(caseData, 'stage');
  return stage === expectedStage;
}

/**
 * 检查元数据中的布尔属性
 */
function checkMetadataBoolean(caseData: unknown, prop: string): boolean {
  if (!isObject(caseData)) {
    return false;
  }
  const metadata = caseData.metadata;
  if (!isObject(metadata)) {
    return false;
  }
  const value = metadata[prop];
  return isBoolean(value) && value;
}

/**
 * 根据案件状态生成时间线事件
 */
export async function generateTimelineEventFromCaseChange(
  caseId: string,
  _previousStatus: CaseStatus | null,
  currentStatus: CaseStatus,
  eventType?: CaseTimelineEventType,
  additionalData?: Prisma.InputJsonValue
): Promise<void> {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      console.error(`案件 ${caseId} 不存在`);
      return;
    }

    if (eventType) {
      await createTimelineEvent(
        eventType,
        caseData as CaseDataForTimeline,
        additionalData
      );
      return;
    }

    for (const [eventTypeName, eventConfig] of Object.entries(
      TIMELINE_EVENT_MAPPING
    )) {
      const typedEventType = eventTypeName as CaseTimelineEventType;

      const triggerConditionsMet = eventConfig.triggerConditions?.(caseData);
      const triggerStatusMet =
        'triggerStatus' in eventConfig &&
        eventConfig.triggerStatus &&
        currentStatus === eventConfig.triggerStatus;

      if (triggerConditionsMet || triggerStatusMet) {
        const existingEvent = await prisma.caseTimeline.findFirst({
          where: {
            caseId,
            eventType: typedEventType,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        });

        if (existingEvent) {
          const timeDiff = Date.now() - existingEvent.createdAt.getTime();
          if (timeDiff < 24 * 60 * 60 * 1000) {
            continue;
          }
        }

        await createTimelineEvent(
          typedEventType,
          caseData as CaseDataForTimeline,
          additionalData,
          eventConfig
        );
        break;
      }
    }
  } catch (error) {
    console.error('生成时间线事件失败:', error);
    throw error;
  }
}

/**
 * 创建时间线事件
 */
async function createTimelineEvent(
  eventType: CaseTimelineEventType,
  caseData: CaseDataForTimeline,
  additionalData?: Prisma.InputJsonValue,
  eventConfig?: TimelineEventConfig
): Promise<void> {
  const mergedData: unknown = additionalData
    ? { ...caseData, ...(additionalData as Record<string, unknown>) }
    : caseData;

  await prisma.caseTimeline.create({
    data: {
      case: { connect: { id: caseData.id } },
      eventType,
      title: eventConfig?.generateTitle
        ? eventConfig.generateTitle(mergedData)
        : '时间线事件',
      description: eventConfig?.generateDescription
        ? eventConfig.generateDescription(mergedData)
        : null,
      eventDate: new Date(),
      metadata: (additionalData || {}) as Prisma.InputJsonValue,
    },
  });

  console.info(`已创建时间线事件: ${eventType}`);
}

/**
 * 批量为案件生成时间线事件
 * 用于历史数据迁移或重建时间线
 */
export async function generateTimelineForCase(caseId: string): Promise<void> {
  try {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      console.error(`案件 ${caseId} 不存在`);
      return;
    }

    const existingTimeline = await prisma.caseTimeline.findMany({
      where: { caseId },
      orderBy: { eventDate: 'desc' },
      take: 1,
    });

    if (existingTimeline.length > 0) {
      console.info(`案件 ${caseId} 已有时间线事件，跳过生成`);
      return;
    }

    await generateTimelineEventFromCaseChange(caseId, null, caseData.status);
  } catch (error) {
    console.error(`为案件 ${caseId} 生成时间线失败:`, error);
    throw error;
  }
}

/**
 * 获取案件的时间线摘要
 */
export async function getTimelineSummary(
  caseId: string
): Promise<TimelineSummary> {
  const events = await prisma.caseTimeline.findMany({
    where: { caseId },
    orderBy: { eventDate: 'desc' },
  });

  const summary: TimelineSummary = {
    totalEvents: events.length,
    latestEvent:
      events.length > 0
        ? {
            id: events[0].id,
            caseId: events[0].caseId,
            eventType: events[0].eventType,
            title: events[0].title,
            description: events[0].description,
            eventDate: events[0].eventDate,
            metadata: events[0].metadata,
            createdAt: events[0].createdAt,
            updatedAt: events[0].updatedAt,
          }
        : null,
    eventTypeCounts: events.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] || 0) + 1;
      return acc;
    }, {}),
    dateRange:
      events.length > 0
        ? {
            start: events[events.length - 1].eventDate,
            end: events[0].eventDate,
          }
        : null,
  };

  return summary;
}
