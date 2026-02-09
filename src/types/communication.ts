/**
 * 沟通记录类型定义
 */

import { CommunicationRecord as PrismaCommunicationRecord } from '@prisma/client';

/**
 * 沟通记录类型枚举
 */
export type CommunicationType =
  | 'PHONE'
  | 'EMAIL'
  | 'MEETING'
  | 'WECHAT'
  | 'OTHER';

/**
 * 创建沟通记录输入接口
 */
export interface CreateCommunicationInput {
  clientId: string;
  type: CommunicationType;
  summary: string;
  content?: string;
  nextFollowUpDate?: string;
  isImportant?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 更新沟通记录输入接口
 */
export interface UpdateCommunicationInput {
  type?: CommunicationType;
  summary?: string;
  content?: string;
  nextFollowUpDate?: string;
  isImportant?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 沟通记录查询参数接口
 */
export interface CommunicationQueryParams {
  clientId?: string;
  userId?: string;
  type?: CommunicationType;
  isImportant?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'nextFollowUpDate';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 沟通记录详情接口
 * 用于API响应
 */
export interface CommunicationRecordDetail {
  id: string;
  clientId: string;
  userId: string;
  type: CommunicationType;
  summary: string;
  content: string | null;
  nextFollowUpDate: Date | null;
  isImportant: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 沟通记录列表响应接口
 */
export interface CommunicationListResponse {
  communications: CommunicationRecordDetail[];
  total: number;
}

/**
 * 沟通记录统计信息接口
 */
export interface CommunicationStatistics {
  totalRecords: number;
  recordsByType: Record<CommunicationType, number>;
  importantRecords: number;
  pendingFollowUps: number;
  recentRecords: CommunicationRecordDetail[];
}

/**
 * 沟通记录包含用户信息的内部类型
 * 用于API层数据转换
 */
export interface CommunicationRecordWithUser {
  id: string;
  clientId: string;
  userId: string;
  type: 'PHONE' | 'EMAIL' | 'MEETING' | 'WECHAT' | 'OTHER';
  summary: string;
  content: string | null;
  nextFollowUpDate: Date | null;
  isImportant: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  client?: {
    id: string;
    name: string;
    contact?: string;
  };
}

/**
 * Prisma模型类型导出（用于类型兼容性）
 */
export type CommunicationRecord = PrismaCommunicationRecord;
