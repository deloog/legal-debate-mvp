import {
  Witness as PrismaWitness,
  WitnessStatus as PrismaWitnessStatus,
} from '@prisma/client';

/**
 * 证人状态枚举
 * 从Prisma生成的枚举中导出
 */
export type WitnessStatus = PrismaWitnessStatus;

/**
 * 证人状态标签映射
 */
export const WITNESS_STATUS_LABELS: Record<WitnessStatus, string> = {
  NEED_CONTACT: '待联系',
  CONTACTED: '已联系',
  CONFIRMED: '已确认出庭',
  DECLINED: '拒绝出庭',
  CANCELLED: '已取消',
};

/**
 * 类型守卫：验证是否为有效的WitnessStatus
 */
export function isValidWitnessStatus(value: string): value is WitnessStatus {
  const witnessStatusValues = [
    'NEED_CONTACT',
    'CONTACTED',
    'CONFIRMED',
    'DECLINED',
    'CANCELLED',
  ] as const;
  return witnessStatusValues.includes(value as WitnessStatus);
}

/**
 * 获取证人状态标签
 */
export function getWitnessStatusLabel(status: WitnessStatus): string {
  return WITNESS_STATUS_LABELS[status] || status;
}

/**
 * 创建证人输入接口
 */
export interface CreateWitnessInput {
  caseId: string;
  name: string;
  phone?: string;
  address?: string;
  relationship?: string; // 与当事人的关系
  testimony?: string; // 证词
  courtScheduleId?: string;
  status?: WitnessStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 更新证人输入接口
 */
export interface UpdateWitnessInput {
  name?: string;
  phone?: string;
  address?: string;
  relationship?: string;
  testimony?: string;
  courtScheduleId?: string;
  status?: WitnessStatus;
  metadata?: Record<string, unknown>;
}

/**
 * 证人查询参数接口
 */
export interface WitnessQueryParams {
  caseId?: string;
  name?: string;
  status?: WitnessStatus;
  relationship?: string;
  courtScheduleId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 证人详情接口
 */
export interface WitnessDetail extends PrismaWitness {
  case?: {
    id: string;
    title: string;
  };
  caseTitle?: string;
  courtScheduleTitle?: string;
  courtSchedule?: {
    id: string;
    title: string;
  } | null;
}

/**
 * 证人列表响应接口
 */
export interface WitnessListResponse {
  witnesses: WitnessDetail[];
  total: number;
  caseId: string;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 证人统计信息接口
 */
export interface WitnessStatistics {
  totalWitnesses: number;
  witnessesByStatus: Record<WitnessStatus, number>;
  confirmedWitnesses: number;
  pendingWitnesses: number;
  averageTestimonyLength?: number;
}

/**
 * 证人批量操作输入接口
 */
export interface WitnessBulkActionInput {
  witnessIds: string[];
  action: 'updateStatus' | 'delete';
  status?: WitnessStatus;
  reason?: string;
}

/**
 * 证人批量操作响应接口
 */
export interface WitnessBulkActionResponse {
  success: boolean;
  succeeded: string[];
  failed: Array<{
    witnessId: string;
    reason: string;
  }>;
  message: string;
}

/**
 * 证人出庭提醒输入接口
 */
export interface WitnessCourtReminderInput {
  witnessId: string;
  courtScheduleId: string;
  reminderType: 'EMAIL' | 'SMS' | 'BOTH';
  reminderTime: Date;
  message?: string;
}

/**
 * 证人出庭提醒响应接口
 */
export interface WitnessCourtReminderResponse {
  success: boolean;
  reminderId: string;
  sentAt: Date;
  message: string;
}

/**
 * 证人证词分析输入接口
 */
export interface WitnessTestimonyAnalysisInput {
  witnessId: string;
  testimony: string;
  analysisType: 'CREDIBILITY' | 'CONSISTENCY' | 'RELEVANCE';
}

/**
 * 证人证词分析响应接口
 */
export interface WitnessTestimonyAnalysisResponse {
  success: boolean;
  analysisId: string;
  credibilityScore?: number;
  consistencyScore?: number;
  relevanceScore?: number;
  issues?: string[];
  suggestions?: string[];
  analyzedAt: Date;
}

/**
 * 类型守卫函数：验证创建证人输入数据
 */
export function isValidCreateWitnessInput(
  data: unknown
): data is CreateWitnessInput {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const input = data as Record<string, unknown>;

  if (typeof input.caseId !== 'string' || !input.caseId) {
    return false;
  }

  if (typeof input.name !== 'string' || !input.name) {
    return false;
  }

  if (
    input.status !== undefined &&
    typeof input.status === 'string' &&
    !isValidWitnessStatus(input.status)
  ) {
    return false;
  }

  return true;
}

/**
 * 类型守卫函数：验证更新证人输入数据
 */
export function isValidUpdateWitnessInput(
  data: unknown
): data is UpdateWitnessInput {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const input = data as Record<string, unknown>;

  if (
    input.status !== undefined &&
    typeof input.status === 'string' &&
    !isValidWitnessStatus(input.status)
  ) {
    return false;
  }

  return true;
}

/**
 * 格式化证人数据用于展示
 */
export function formatWitnessForDisplay(
  witness: WitnessDetail
): Record<string, unknown> {
  return {
    id: witness.id,
    name: witness.name,
    phone: witness.phone,
    address: witness.address,
    relationship: witness.relationship,
    status: getWitnessStatusLabel(witness.status as WitnessStatus),
    testimonyLength: witness.testimony?.length || 0,
    createdAt: witness.createdAt,
    updatedAt: witness.updatedAt,
    caseTitle: witness.caseTitle,
    courtScheduleTitle: witness.courtScheduleTitle,
  };
}

/**
 * 证人导出数据接口
 */
export interface WitnessExportData {
  witnesses: WitnessDetail[];
  exportDate: Date;
  exportFormat: 'JSON' | 'CSV' | 'PDF';
  statistics: WitnessStatistics;
}

/**
 * 证人导入数据接口
 */
export interface WitnessImportData {
  caseId: string;
  witnesses: Array<{
    name: string;
    phone?: string;
    address?: string;
    relationship?: string;
    testimony?: string;
    status?: WitnessStatus;
  }>;
  importOptions?: {
    skipDuplicates?: boolean;
    updateExisting?: boolean;
  };
}

/**
 * 证人导入响应接口
 */
export interface WitnessImportResponse {
  success: boolean;
  imported: number;
  skipped: number;
  failed: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
  importId: string;
}

/**
 * 证人搜索参数接口
 */
export interface WitnessSearchParams {
  caseId: string;
  query: string;
  searchFields?: (
    | 'name'
    | 'phone'
    | 'address'
    | 'relationship'
    | 'testimony'
  )[];
  page?: number;
  limit?: number;
}

/**
 * 证人搜索结果接口
 */
export interface WitnessSearchResult {
  witnesses: WitnessDetail[];
  total: number;
  query: string;
  searchFields: string[];
}

/**
 * 案件证人列表响应接口
 * 继承 WitnessListResponse 并添加案件ID
 */
export type CaseWitnessListResponse = WitnessListResponse & {
  caseId: string;
};
