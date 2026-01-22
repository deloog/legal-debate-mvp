import { Case as PrismaCase, OwnerType } from '@prisma/client';

/**
 * 案件拥有者类型枚举
 * 从Prisma生成的枚举中导出
 */
export type CaseOwnerType = OwnerType;

/**
 * 拥有者类型标签映射
 */
export const OWNER_TYPE_LABELS: Record<OwnerType, string> = {
  [OwnerType.USER]: '个人',
  [OwnerType.TEAM]: '团队',
};

/**
 * 类型守卫：验证是否为有效的OwnerType
 */
export function isValidOwnerType(value: string): value is OwnerType {
  return Object.values(OwnerType).includes(value as OwnerType);
}

/**
 * 获取拥有者类型标签
 */
export function getOwnerTypeLabel(type: OwnerType): string {
  return OWNER_TYPE_LABELS[type] || type;
}

// DocAnalyzer输出的metadata结构
export interface CaseMetadata {
  parties?: {
    plaintiff?: PartyInfo;
    defendant?: PartyInfo;
    thirdParties?: PartyInfo[];
  };
  caseDetails?: {
    cause?: string;
    subCause?: string;
    amount?: number;
    court?: string;
    caseNumber?: string;
  };
  claims?: Claim[];
  facts?: Fact[];
  keyDates?: Record<string, string>;
  docAnalyzerMetadata?: {
    analysisId?: string;
    analyzedAt?: string;
    confidence?: number;
    extractedFields?: string[];
  };
}

export interface PartyInfo {
  name: string;
  type?: 'individual' | 'company' | 'organization';
  idNumber?: string;
  address?: string;
  contact?: string;
  legalRepresentative?: string;
}

export interface Claim {
  id: string;
  type: 'payment' | 'compensation' | 'performance' | 'declaration' | 'other';
  description: string;
  amount?: number;
  currency?: string;
  basis?: string;
}

export interface Fact {
  id: string;
  description: string;
  date?: string;
  evidenceRefs?: string[];
}

// 扩展的Case类型
export type CaseWithMetadata = PrismaCase & {
  metadata?: CaseMetadata | null;
};

// 创建Case的DTO
export interface CreateCaseInput {
  title: string;
  description: string;
  type: string;
  plaintiffName?: string;
  defendantName?: string;
  cause?: string;
  amount?: number;
  court?: string;
  caseNumber?: string;
  metadata?: CaseMetadata;
  ownerType?: OwnerType;
  sharedWithTeam?: boolean;
}

// 更新Case的DTO
export interface UpdateCaseInput {
  title?: string;
  description?: string;
  type?: string;
  status?: string;
  plaintiffName?: string;
  defendantName?: string;
  cause?: string;
  amount?: number;
  court?: string;
  caseNumber?: string;
  metadata?: CaseMetadata;
  ownerType?: OwnerType;
  sharedWithTeam?: boolean;
}

// 查询Case的参数
export interface CaseQueryParams {
  userId?: string;
  status?: string;
  type?: string;
  plaintiffName?: string;
  defendantName?: string;
  cause?: string;
  court?: string;
  ownerType?: OwnerType;
  sharedWithTeam?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

// DocAnalyzer输入结构
export interface DocAnalyzerInput {
  documentContent: string;
  documentType: 'lawsuit' | 'contract' | 'evidence' | 'other';
  caseId?: string;
}

// DocAnalyzer输出结构
export interface DocAnalyzerOutput {
  success: boolean;
  data?: CaseMetadata;
  error?: string;
  confidence?: number;
  processingTime?: number;
}

// 案件统计信息
export interface CaseStatistics {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  casesByType: Record<string, number>;
  casesByCause: Record<string, number>;
  averageAmount?: number;
}

/**
 * 案件时间线事件类型枚举
 */
export enum CaseTimelineEventType {
  FILING = 'FILING', // 立案
  PRETRIAL = 'PRETRIAL', // 审前准备
  TRIAL = 'TRIAL', // 开庭
  JUDGMENT = 'JUDGMENT', // 判决
  APPEAL = 'APPEAL', // 上诉
  EXECUTION = 'EXECUTION', // 执行
  CLOSED = 'CLOSED', // 结案
  CUSTOM = 'CUSTOM', // 自定义事件
}

/**
 * 创建时间线事件输入接口
 */
export interface CreateTimelineEventInput {
  caseId: string;
  eventType: CaseTimelineEventType;
  title: string;
  description?: string;
  eventDate: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 更新时间线事件输入接口
 */
export interface UpdateTimelineEventInput {
  eventType?: CaseTimelineEventType;
  title?: string;
  description?: string;
  eventDate?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 时间线事件查询参数接口
 */
export interface TimelineEventQueryParams {
  caseId?: string;
  eventType?: CaseTimelineEventType;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'eventDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 时间线事件接口
 */
export interface TimelineEvent {
  id: string;
  caseId: string;
  eventType: CaseTimelineEventType;
  title: string;
  description: string | null;
  eventDate: Date;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 时间线事件列表响应接口
 */
export interface TimelineEventListResponse {
  events: TimelineEvent[];
  total: number;
  caseId: string;
}

/**
 * 案件状态截止日期配置接口
 */
export interface CaseStatusDeadlineConfig {
  caseType: string;
  fromStatus: string;
  toStatus: string;
  deadlineDays: number;
  reminderDaysBefore: number[];
  description: string;
}

/**
 * 案件状态提醒生成输入接口
 */
export interface CaseStatusReminderInput {
  userId: string;
  caseId: string;
  caseTitle: string;
  config: CaseStatusDeadlineConfig;
  deadline: Date;
}
