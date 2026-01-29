/**
 * 合同相关类型定义
 */

// 收费方式枚举
export enum FeeType {
  FIXED = 'FIXED', // 固定收费
  RISK = 'RISK', // 风险代理
  HOURLY = 'HOURLY', // 计时收费
  MIXED = 'MIXED', // 混合收费
}

// 合同状态枚举
export enum ContractStatus {
  DRAFT = 'DRAFT', // 草稿
  PENDING = 'PENDING', // 待签署
  SIGNED = 'SIGNED', // 已签署
  EXECUTING = 'EXECUTING', // 履行中
  COMPLETED = 'COMPLETED', // 已完成
  TERMINATED = 'TERMINATED', // 已终止
}

// 付款状态枚举
export enum ContractPaymentStatus {
  PENDING = 'PENDING', // 待付款
  PAID = 'PAID', // 已付款
  OVERDUE = 'OVERDUE', // 已逾期
  CANCELLED = 'CANCELLED', // 已取消
}

// 委托人类型
export type ClientType = 'INDIVIDUAL' | 'ENTERPRISE';

// 付款类型
export type PaymentType = 'FIRST' | 'MIDDLE' | 'FINAL';

// 付款方式
export type PaymentMethod = 'TRANSFER' | 'CASH' | 'WECHAT' | 'ALIPAY';

// 合同基本信息接口
export interface Contract {
  id: string;
  contractNumber: string;

  // 关联
  caseId?: string | null;
  consultationId?: string | null;

  // 委托方信息
  clientType: string;
  clientName: string;
  clientIdNumber?: string | null;
  clientAddress?: string | null;
  clientContact?: string | null;

  // 受托方信息
  lawFirmName: string;
  lawyerName: string;
  lawyerId: string;

  // 委托事项
  caseType: string;
  caseSummary: string;
  scope: string;

  // 收费信息
  feeType: FeeType;
  totalFee: number;
  paidAmount: number;
  feeDetails?: unknown;

  // 合同条款
  terms?: unknown;
  specialTerms?: string | null;

  // 签署信息
  status: ContractStatus;
  signedAt?: Date | null;
  signatureData?: unknown;

  // 文件
  filePath?: string | null;

  // 时间戳
  createdAt: Date;
  updatedAt: Date;
}

// 合同付款记录接口
export interface ContractPayment {
  id: string;
  contractId: string;

  paymentNumber: string;
  amount: number;
  paymentType: string;
  paymentMethod?: string | null;

  status: ContractPaymentStatus;
  paidAt?: Date | null;

  receiptNumber?: string | null;
  invoiceId?: string | null;

  note?: string | null;

  createdAt: Date;
  updatedAt: Date;
}

// 合同模板接口
export interface ContractTemplate {
  id: string;
  name: string;
  code: string;
  category: string;
  content: string;
  variables: unknown;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 创建合同输入
export interface CreateContractInput {
  // 关联
  caseId?: string;
  consultationId?: string;

  // 委托方信息
  clientType: string;
  clientName: string;
  clientIdNumber?: string;
  clientAddress?: string;
  clientContact?: string;

  // 受托方信息
  lawFirmName: string;
  lawyerName: string;
  lawyerId: string;

  // 委托事项
  caseType: string;
  caseSummary: string;
  scope: string;

  // 收费信息
  feeType: FeeType;
  totalFee: number;
  feeDetails?: unknown;

  // 合同条款
  terms?: unknown;
  specialTerms?: string;

  // 付款计划（可选）
  payments?: Array<{
    paymentType: string;
    amount: number;
    dueDate?: Date;
  }>;
}

// 更新合同输入
export interface UpdateContractInput {
  // 委托方信息
  clientType?: string;
  clientName?: string;
  clientIdNumber?: string;
  clientAddress?: string;
  clientContact?: string;

  // 受托方信息
  lawFirmName?: string;
  lawyerName?: string;

  // 委托事项
  caseType?: string;
  caseSummary?: string;
  scope?: string;

  // 收费信息
  feeType?: FeeType;
  totalFee?: number;
  feeDetails?: unknown;

  // 合同条款
  terms?: unknown;
  specialTerms?: string;

  // 状态
  status?: ContractStatus;

  // 签署信息
  signedAt?: Date;
  signatureData?: unknown;
}

// 创建付款记录输入
export interface CreatePaymentInput {
  contractId: string;
  amount: number;
  paymentType: string;
  paymentMethod?: string;
  note?: string;
  paidAt?: Date;
}

// 合同列表查询参数
export interface ContractListQuery {
  page?: number;
  pageSize?: number;
  status?: ContractStatus;
  keyword?: string; // 搜索客户名称或合同编号
  startDate?: string;
  endDate?: string;
}

// 合同详情响应（包含付款记录）
export interface ContractDetailResponse extends Contract {
  payments: ContractPayment[];
  case?: {
    id: string;
    title: string;
    caseNumber?: string | null;
  } | null;
}

// 付款进度信息
export interface PaymentProgress {
  totalFee: number;
  paidAmount: number;
  unpaidAmount: number;
  paymentRate: number; // 付款比例 0-100
  status: 'UNPAID' | 'PARTIAL' | 'FULL'; // 未付/部分/全额
}
