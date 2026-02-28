/**
 * 合同类型定义
 * 集中定义合同相关的类型
 */

/**
 * 合同状态（匹配 Prisma Schema）
 */
export type ContractStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'SIGNED'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'TERMINATED';

/**
 * 合同状态常量（运行时可用）
 */
export const ContractStatusValues = {
  DRAFT: 'DRAFT',
  PENDING: 'PENDING',
  SIGNED: 'SIGNED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  TERMINATED: 'TERMINATED',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const ContractStatus = ContractStatusValues;

/**
 * 费用类型（匹配 Prisma Schema）
 */
export type FeeType = 'FIXED' | 'RISK' | 'HOURLY' | 'MIXED';

/**
 * 费用类型常量（运行时可用）
 */
export const FeeTypeValues = {
  FIXED: 'FIXED',
  RISK: 'RISK',
  HOURLY: 'HOURLY',
  MIXED: 'MIXED',
};

// 导出类型别名作为值（兼容旧代码）
export const FeeType = FeeTypeValues;

/**
 * 合同付款状态（匹配 Prisma Schema）
 */
export type ContractPaymentStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED';

/**
 * 合同付款状态常量（运行时可用）
 */
export const ContractPaymentStatusValues = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const ContractPaymentStatus = ContractPaymentStatusValues;

/**
 * 合同详情
 */
export interface ContractDetail {
  id: string;
  contractNumber: string;
  title: string;
  content: string;
  type: string;
  status: string;
  partyA: {
    id: string;
    name: string;
    type: string;
    contact: string;
  } | null;
  partyB: {
    id: string;
    name: string;
    type: string;
    contact: string;
  } | null;
  amount: number | null;
  startDate: Date | null;
  endDate: Date | null;
  fileUrl: string | null;
  signatureStatus: string;
  signedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 合同列表响应
 */
export interface ContractListResponse {
  contracts: ContractDetail[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 合同查询参数
 */
export interface ContractQueryParams {
  page?: string;
  pageSize?: string;
  status?: string;
  type?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 合同创建请求
 */
export interface CreateContractInput {
  title: string;
  content: string;
  type: string;
  partyAId?: string;
  partyBId?: string;
  amount?: number;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 合同更新请求
 */
export interface UpdateContractInput {
  title?: string;
  content?: string;
  type?: string;
  status?: string;
  amount?: number;
  startDate?: Date;
  endDate?: Date;
}

// =============================================================================
// 合同履约监控类型
// =============================================================================

/**
 * 履约节点状态
 */
export type MilestoneStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'OVERDUE'
  | 'CANCELLED';

/**
 * 履约节点状态常量
 */
export const MilestoneStatusValues = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
  CANCELLED: 'CANCELLED',
} as const;

/**
 * 异常类型
 */
export type AnomalyType =
  | 'EARLY_PAYMENT'
  | 'LATE_PAYMENT'
  | 'UNVERIFIED_PAYMENT'
  | 'EARLY_DELIVERY'
  | 'LATE_DELIVERY'
  | 'QUALITY_ISSUE'
  | 'OTHER';

/**
 * 异常类型常量
 */
export const AnomalyTypeValues = {
  EARLY_PAYMENT: 'EARLY_PAYMENT',
  LATE_PAYMENT: 'LATE_PAYMENT',
  UNVERIFIED_PAYMENT: 'UNVERIFIED_PAYMENT',
  EARLY_DELIVERY: 'EARLY_DELIVERY',
  LATE_DELIVERY: 'LATE_DELIVERY',
  QUALITY_ISSUE: 'QUALITY_ISSUE',
  OTHER: 'OTHER',
} as const;

/**
 * 创建合同履约节点请求
 */
export interface CreateContractPerformanceInput {
  contractId: string;
  milestone: string;
  milestoneDate: Date;
  description?: string;
  milestoneType?: 'payment' | 'delivery' | 'milestone' | 'deadline';
  responsibleParty?: string;
  responsibleRole?: string;
  caseId?: string;
  notes?: string;
  reminderEnabled?: boolean;
  reminderDays?: number[];
}

/**
 * 更新合同履约节点请求
 */
export interface UpdateContractPerformanceInput {
  milestone?: string;
  milestoneDate?: Date;
  description?: string;
  milestoneType?: string;
  actualDate?: Date;
  actualAmount?: number;
  variance?: number;
  varianceReason?: string;
  milestoneStatus?: MilestoneStatus;
  isAnomalous?: boolean;
  anomalyType?: AnomalyType;
  anomalyDescription?: string;
  recommendedAction?: string;
  responsibleParty?: string;
  responsibleRole?: string;
  notes?: string;
  reminderEnabled?: boolean;
  reminderDays?: number[];
}

/**
 * 合同履约节点查询参数
 */
export interface ContractPerformanceQueryParams {
  contractId?: string;
  milestoneStatus?: MilestoneStatus;
  isAnomalous?: boolean;
  caseId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

/**
 * 合同履约节点响应
 */
export interface ContractPerformanceResponse {
  id: string;
  contractId: string;
  milestone: string;
  milestoneDate: Date;
  milestoneStatus: MilestoneStatus;
  description?: string;
  milestoneType?: string;
  actualDate?: Date;
  actualAmount?: number;
  variance?: number;
  varianceReason?: string;
  isAnomalous: boolean;
  anomalyType?: AnomalyType;
  anomalyDescription?: string;
  recommendedAction?: string;
  reminderEnabled: boolean;
  reminderDays: number[];
  reminderSent: boolean;
  reminderCount: number;
  lastReminderAt?: Date;
  responsibleParty?: string;
  responsibleRole?: string;
  caseId?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 创建提醒配置请求
 */
export interface CreateReminderConfigInput {
  enterpriseId?: string;
  userId?: string;
  reminderType: string;
  enabled?: boolean;
  channels?: string[];
  advanceDays?: number[];
  timeOfDay?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
}

/**
 * 更新提醒配置请求
 */
export interface UpdateReminderConfigInput {
  enabled?: boolean;
  channels?: string[];
  advanceDays?: number[];
  timeOfDay?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  isActive?: boolean;
}

/**
 * 提醒配置响应
 */
export interface ReminderConfigResponse {
  id: string;
  enterpriseId?: string;
  userId?: string;
  reminderType: string;
  enabled: boolean;
  channels: string[];
  advanceDays: number[];
  timeOfDay?: string;
  isRecurring: boolean;
  recurringPattern?: string;
  isActive: boolean;
  totalRemindersSent: number;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
