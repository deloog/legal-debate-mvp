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
