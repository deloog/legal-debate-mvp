import {
  Evidence as PrismaEvidence,
  EvidenceRelation as PrismaEvidenceRelation,
} from '@prisma/client';

/**
 * 证据类型枚举
 */
export enum EvidenceType {
  DOCUMENT = 'DOCUMENT', // 书证
  PHYSICAL = 'PHYSICAL', // 物证
  WITNESS = 'WITNESS', // 证人证言
  EXPERT_OPINION = 'EXPERT_OPINION', // 鉴定意见
  AUDIO_VIDEO = 'AUDIO_VIDEO', // 音视频
  OTHER = 'OTHER', // 其他
}

/**
 * 证据状态枚举
 */
export enum EvidenceStatus {
  PENDING = 'PENDING', // 待审核
  ACCEPTED = 'ACCEPTED', // 已采纳
  REJECTED = 'REJECTED', // 已拒绝
  QUESTIONED = 'QUESTIONED', // 存疑
}

/**
 * 证据关联类型枚举
 */
export enum EvidenceRelationType {
  LEGAL_REFERENCE = 'LEGAL_REFERENCE', // 关联法条
  ARGUMENT = 'ARGUMENT', // 关联论点
  FACT = 'FACT', // 关联事实
  OTHER = 'OTHER', // 其他
}

/**
 * 创建证据输入接口
 */
export interface CreateEvidenceInput {
  caseId: string;
  type: EvidenceType;
  name: string;
  description?: string;
  fileUrl?: string;
  submitter?: string;
  source?: string;
  status?: EvidenceStatus;
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 更新证据输入接口
 */
export interface UpdateEvidenceInput {
  type?: EvidenceType;
  name?: string;
  description?: string;
  fileUrl?: string;
  submitter?: string;
  source?: string;
  status?: EvidenceStatus;
  relevanceScore?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 证据查询参数接口
 */
export interface EvidenceQueryParams {
  caseId?: string;
  type?: EvidenceType;
  status?: EvidenceStatus;
  submitter?: string;
  source?: string;
  minRelevanceScore?: number;
  maxRelevanceScore?: number;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'relevanceScore' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 证据详情接口
 */
export interface EvidenceDetail extends PrismaEvidence {
  caseTitle?: string;
  relations?: EvidenceRelationDetail[];
}

/**
 * 证据列表响应接口
 */
export interface EvidenceListResponse {
  evidence: EvidenceDetail[];
  total: number;
  caseId: string;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 证据列表项接口
 */
export interface EvidenceListItem {
  id: string;
  title?: string; // 可选，与路由返回匹配
  name: string;
  type: string;
  status: string;
  description: string | null;
  fileUrl: string | null;
  submitter: string | null;
  source: string | null;
  relevanceScore: number | null;
  metadata: Record<string, unknown> | null;
  caseId: string;
  caseTitle?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string; // 可选，与路由返回匹配
  deletedAt: Date | null;
  relations?: unknown[];
}

/**
 * 创建证据关联输入接口
 */
export interface CreateEvidenceRelationInput {
  evidenceId: string;
  relationType: EvidenceRelationType;
  relatedId: string;
  description?: string;
}

/**
 * 证据关联详情接口
 */
export interface EvidenceRelationDetail extends PrismaEvidenceRelation {
  relatedTitle?: string;
  relatedType?: string;
}

/**
 * 证据关联列表响应接口
 */
export interface EvidenceRelationListResponse {
  relations: EvidenceRelationDetail[];
  total: number;
  evidenceId: string;
}

/**
 * 证据统计信息接口
 */
export interface EvidenceStatistics {
  totalEvidence: number;
  evidenceByType: Record<EvidenceType, number>;
  evidenceByStatus: Record<EvidenceStatus, number>;
  averageRelevanceScore?: number;
  acceptedEvidence: number;
  pendingEvidence: number;
}

/**
 * 证据文件上传响应接口
 */
export interface EvidenceFileUploadResponse {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
}

/**
 * 证据批量操作输入接口
 */
export interface EvidenceBulkActionInput {
  evidenceIds: string[];
  action: 'updateStatus' | 'delete';
  status?: EvidenceStatus;
  reason?: string;
}

/**
 * 证据批量操作响应接口
 */
export interface EvidenceBulkActionResponse {
  success: boolean;
  succeeded: string[];
  failed: Array<{
    evidenceId: string;
    reason: string;
  }>;
  message: string;
}

/**
 * 类型守卫函数：验证是否为有效的证据类型
 */
export function isValidEvidenceType(value: unknown): value is EvidenceType {
  return (
    typeof value === 'string' &&
    Object.values(EvidenceType).includes(value as EvidenceType)
  );
}

/**
 * 类型守卫函数：验证是否为有效的证据状态
 */
export function isValidEvidenceStatus(value: unknown): value is EvidenceStatus {
  return (
    typeof value === 'string' &&
    Object.values(EvidenceStatus).includes(value as EvidenceStatus)
  );
}

/**
 * 类型守卫函数：验证是否为有效的证据关联类型
 */
export function isValidEvidenceRelationType(
  value: unknown
): value is EvidenceRelationType {
  return (
    typeof value === 'string' &&
    Object.values(EvidenceRelationType).includes(value as EvidenceRelationType)
  );
}

/**
 * 类型守卫函数：验证证据输入数据
 */
export function isValidCreateEvidenceInput(
  data: unknown
): data is CreateEvidenceInput {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const input = data as Record<string, unknown>;

  if (typeof input.caseId !== 'string' || !input.caseId) {
    return false;
  }

  if (!isValidEvidenceType(input.type)) {
    return false;
  }

  if (typeof input.name !== 'string' || !input.name) {
    return false;
  }

  return true;
}

/**
 * 类型守卫函数：验证证据更新数据
 */
export function isValidUpdateEvidenceInput(
  data: unknown
): data is UpdateEvidenceInput {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const input = data as Record<string, unknown>;

  if (input.type !== undefined && !isValidEvidenceType(input.type)) {
    return false;
  }

  if (input.status !== undefined && !isValidEvidenceStatus(input.status)) {
    return false;
  }

  return true;
}

/**
 * 获取证据类型的中文名称
 */
export function getEvidenceTypeLabel(type: EvidenceType): string {
  const labels: Record<EvidenceType, string> = {
    [EvidenceType.DOCUMENT]: '书证',
    [EvidenceType.PHYSICAL]: '物证',
    [EvidenceType.WITNESS]: '证人证言',
    [EvidenceType.EXPERT_OPINION]: '鉴定意见',
    [EvidenceType.AUDIO_VIDEO]: '音视频',
    [EvidenceType.OTHER]: '其他',
  };
  return labels[type] || '未知';
}

/**
 * 获取证据状态的中文名称
 */
export function getEvidenceStatusLabel(status: EvidenceStatus): string {
  const labels: Record<EvidenceStatus, string> = {
    [EvidenceStatus.PENDING]: '待审核',
    [EvidenceStatus.ACCEPTED]: '已采纳',
    [EvidenceStatus.REJECTED]: '已拒绝',
    [EvidenceStatus.QUESTIONED]: '存疑',
  };
  return labels[status] || '未知';
}

/**
 * 获取证据关联类型的中文名称
 */
export function getEvidenceRelationTypeLabel(
  type: EvidenceRelationType
): string {
  const labels: Record<EvidenceRelationType, string> = {
    [EvidenceRelationType.LEGAL_REFERENCE]: '关联法条',
    [EvidenceRelationType.ARGUMENT]: '关联论点',
    [EvidenceRelationType.FACT]: '关联事实',
    [EvidenceRelationType.OTHER]: '其他',
  };
  return labels[type] || '未知';
}

/**
 * 格式化证据数据用于展示
 */
export function formatEvidenceForDisplay(
  evidence: EvidenceDetail
): Record<string, unknown> {
  return {
    id: evidence.id,
    name: evidence.name,
    type: getEvidenceTypeLabel(evidence.type as EvidenceType),
    status: getEvidenceStatusLabel(evidence.status as EvidenceStatus),
    submitter: evidence.submitter,
    source: evidence.source,
    relevanceScore: evidence.relevanceScore,
    createdAt: evidence.createdAt,
    fileUrl: evidence.fileUrl,
    description: evidence.description,
    relationCount: evidence.relations?.length || 0,
  };
}
