import { Prisma } from '@prisma/client';

/**
 * 时间线事件配置接口
 */
export interface TimelineEventConfig {
  triggerStatus?: string;
  triggerConditions?: (caseData: unknown) => boolean;
  generateTitle: (caseData: unknown) => string;
  generateDescription: (caseData: unknown) => string | null;
}

/**
 * 案件数据接口（时间线事件生成）
 */
export interface CaseDataForTimeline {
  id: string;
  createdAt: Date;
  status?: string;
  type?: string;
  caseNumber?: string;
  court?: string;
  cause?: string;
  metadata?: Prisma.JsonValue;
}

/**
 * 时间线事件元数据接口
 */
export interface CaseMetadataForTimeline {
  stage?: string;
  trialScheduled?: boolean;
  trialDate?: string;
  trialCourtroom?: string;
  presidingJudge?: string;
  judgmentIssued?: boolean;
  judgmentResult?: string;
  judgmentDate?: string;
  appealFiled?: boolean;
  appealCourt?: string;
  appealDeadline?: string;
  executionStarted?: boolean;
  executionCourt?: string;
  executionDeadline?: string;
  closedReason?: string;
  closeDate?: string;
  [key: string]: unknown;
}

/**
 * 时间线摘要接口
 */
export interface TimelineSummary {
  totalEvents: number;
  latestEvent: TimelineEventInfo | null;
  eventTypeCounts: Record<string, number>;
  dateRange: {
    start: Date;
    end: Date;
  } | null;
}

/**
 * 时间线事件信息接口
 */
export interface TimelineEventInfo {
  id: string;
  caseId: string;
  eventType: string;
  title: string;
  description: string | null;
  eventDate: Date;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 类型守卫：检查是否为对象
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 类型守卫：检查是否有指定属性
 */
export function hasProperty(
  obj: Record<string, unknown>,
  prop: string
): boolean {
  return prop in obj;
}

/**
 * 类型守卫：检查属性是否为字符串
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * 类型守卫：检查属性是否为布尔值
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
