/**
 * 咨询类型枚举
 */
export enum ConsultationType {
  PHONE = 'PHONE',
  VISIT = 'VISIT',
  ONLINE = 'ONLINE',
  REFERRAL = 'REFERRAL',
}

/**
 * 咨询类型标签映射
 */
export const CONSULTATION_TYPE_LABELS: Record<ConsultationType, string> = {
  [ConsultationType.PHONE]: '电话咨询',
  [ConsultationType.VISIT]: '来访咨询',
  [ConsultationType.ONLINE]: '在线咨询',
  [ConsultationType.REFERRAL]: '转介绍',
};

/**
 * 咨询状态枚举
 */
export enum ConsultStatus {
  PENDING = 'PENDING',
  FOLLOWING = 'FOLLOWING',
  CONVERTED = 'CONVERTED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

/**
 * 咨询状态标签映射
 */
export const CONSULT_STATUS_LABELS: Record<ConsultStatus, string> = {
  [ConsultStatus.PENDING]: '待跟进',
  [ConsultStatus.FOLLOWING]: '跟进中',
  [ConsultStatus.CONVERTED]: '已转化',
  [ConsultStatus.CLOSED]: '已关闭',
  [ConsultStatus.ARCHIVED]: '已归档',
};

/**
 * 咨询状态颜色映射（用于UI展示）
 */
export const CONSULT_STATUS_COLORS: Record<ConsultStatus, string> = {
  [ConsultStatus.PENDING]: 'gray',
  [ConsultStatus.FOLLOWING]: 'blue',
  [ConsultStatus.CONVERTED]: 'green',
  [ConsultStatus.CLOSED]: 'red',
  [ConsultStatus.ARCHIVED]: 'gray',
};

/**
 * AI评估结果接口
 */
export interface AIAssessment {
  winRate: number;
  winRateReasoning: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  difficultyFactors: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskFactors: string[];
  suggestedFeeMin: number;
  suggestedFeeMax: number;
  feeReasoning: string;
  keyLegalPoints: Array<{
    point: string;
    relevantLaw: string;
  }>;
  suggestions: string[];
  similarCases?: Array<{
    caseName: string;
    result: string;
    similarity: number;
  }>;
}

/**
 * 创建咨询记录输入接口
 */
export interface CreateConsultationInput {
  consultType: ConsultationType;
  consultTime: Date;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCompany?: string;
  caseType?: string;
  caseSummary: string;
  clientDemand?: string;
  followUpDate?: Date;
  followUpNotes?: string;
}

/**
 * 更新咨询记录输入接口
 */
export interface UpdateConsultationInput {
  consultType?: ConsultationType;
  consultTime?: Date;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientCompany?: string;
  caseType?: string;
  caseSummary?: string;
  clientDemand?: string;
  followUpDate?: Date;
  followUpNotes?: string;
  status?: ConsultStatus;
  aiAssessment?: AIAssessment;
  winRate?: number;
  difficulty?: string;
  riskLevel?: string;
  suggestedFee?: number;
}

/**
 * 咨询记录查询参数接口
 */
export interface ConsultationQueryParams {
  userId?: string;
  status?: ConsultStatus;
  consultType?: ConsultationType;
  startDate?: Date;
  endDate?: Date;
  keyword?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'consultTime' | 'createdAt' | 'followUpDate';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 咨询记录统计信息接口
 */
export interface ConsultationStatistics {
  totalConsultations: number;
  pendingConsultations: number;
  followingConsultations: number;
  convertedConsultations: number;
  conversionRate: number;
  consultationsByType: Record<ConsultationType, number>;
  consultationsByStatus: Record<ConsultStatus, number>;
  averageFollowUpTime?: number;
}

/**
 * 创建跟进记录输入接口
 */
export interface CreateFollowUpInput {
  consultationId: string;
  followUpType: string;
  content: string;
  result?: string;
  nextFollowUp?: Date;
}

/**
 * 跟进记录接口
 */
export interface FollowUpRecord {
  id: string;
  consultationId: string;
  followUpTime: Date;
  followUpType: string;
  content: string;
  result: string | null;
  nextFollowUp: Date | null;
  createdBy: string;
  createdAt: Date;
}

/**
 * 类型守卫：验证是否为有效的 ConsultationType
 */
export function isValidConsultationType(
  value: string
): value is ConsultationType {
  return Object.values(ConsultationType).includes(value as ConsultationType);
}

/**
 * 类型守卫：验证是否为有效的 ConsultStatus
 */
export function isValidConsultStatus(value: string): value is ConsultStatus {
  return Object.values(ConsultStatus).includes(value as ConsultStatus);
}

/**
 * 获取咨询类型标签
 */
export function getConsultationTypeLabel(type: ConsultationType): string {
  return CONSULTATION_TYPE_LABELS[type] || type;
}

/**
 * 获取咨询状态标签
 */
export function getConsultStatusLabel(status: ConsultStatus): string {
  return CONSULT_STATUS_LABELS[status] || status;
}

/**
 * 获取咨询状态颜色
 */
export function getConsultStatusColor(status: ConsultStatus): string {
  return CONSULT_STATUS_COLORS[status] || 'gray';
}

/**
 * 生成咨询编号
 * 格式: ZX + 年月日 + 3位序号
 * 示例: ZX20260128001
 */
export function generateConsultNumber(
  date: Date = new Date(),
  sequence: number = 1
): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const seq = String(sequence).padStart(3, '0');
  return `ZX${year}${month}${day}${seq}`;
}

/**
 * 计算转化率
 */
export function calculateConversionRate(
  totalConsultations: number,
  convertedConsultations: number
): number {
  if (totalConsultations === 0) {
    return 0;
  }
  return (convertedConsultations / totalConsultations) * 100;
}

// ============================================================================
// API 响应类型定义（集中化管理）
// ============================================================================

/**
 * 咨询列表响应数据
 */
export interface ConsultationListItem {
  id: string;
  consultNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  consultType: ConsultationType;
  consultTime: Date;
  caseType: string | null;
  status: ConsultStatus;
  followUpDate: Date | null;
  winRate: number | null;
  difficulty: string | null;
  riskLevel: string | null;
  suggestedFee: number | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 咨询列表响应（带分页）
 */
export interface ConsultationListResponse {
  items: ConsultationListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 咨询详情响应数据（包含关联数据）
 */
export interface ConsultationDetailResponse {
  id: string;
  consultNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  clientCompany: string | null;
  consultType: ConsultationType;
  consultTime: Date;
  caseType: string | null;
  caseSummary: string;
  clientDemand: string | null;
  status: ConsultStatus;
  followUpDate: Date | null;
  followUpNotes: string | null;
  aiAssessment: unknown | null;
  winRate: number | null;
  difficulty: string | null;
  riskLevel: string | null;
  suggestedFee: number | null;
  convertedToCaseId: string | null;
  convertedAt: Date | null;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  followUps: Array<{
    id: string;
    followUpTime: Date;
    followUpType: string;
    content: string;
    result: string | null;
    nextFollowUp: Date | null;
    createdBy: string;
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 跟进记录响应数据
 */
export interface FollowUpResponse {
  id: string;
  consultationId: string;
  followUpTime: Date;
  followUpType: string;
  content: string;
  result: string | null;
  nextFollowUp: Date | null;
  createdBy: string;
  createdAt: Date;
}

/**
 * 创建跟进记录请求
 */
export interface CreateFollowUpRequest {
  followUpType: string;
  content: string;
  result?: string;
  nextFollowUp?: string;
}

/**
 * 转化预览数据
 */
export interface ConversionPreviewData {
  consultNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  consultType?: ConsultationType; // 可选，与路由返回匹配
  caseType: string | null;
  caseSummary: string;
  clientDemand: string | null;
  existingCase?: {
    // 可选，与路由返回匹配
    id: string;
    caseNumber: string;
    title: string;
  } | null;
  suggestedTitle: string;
  suggestedCaseType: string;
  winRate: number | null;
  difficulty: string | null;
  riskLevel: string | null;
  suggestedFee: number | null;
}

/**
 * 转化请求
 */
export interface ConvertRequest {
  title?: string;
  description?: string;
  caseType?: string;
  plaintiffName?: string;
  defendantName?: string;
  amount?: number;
  createClient?: boolean;
}

/**
 * 费用计算请求
 */
export interface CalculateFeeRequest {
  consultationId?: string;
  caseType?: string;
  caseAmount?: number;
  complexity?: 'EASY' | 'MEDIUM' | 'HARD';
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  feeMode?: string;
  riskRate?: number;
  estimatedHours?: number;
  hourlyRate?: number;
  stages?: Array<{
    name: string;
    percentage: number;
  }>;
}

/**
 * 费用计算响应
 */
export interface FeeCalculationResult {
  baseFee: number;
  complexityMultiplier: number;
  durationMultiplier: number;
  totalFee: number;
  feeBreakdown: {
    item: string;
    amount: number;
  }[];
}
