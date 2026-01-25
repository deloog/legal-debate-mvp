/**
 * 费用计算引擎类型定义
 */

import { FeeConfigType } from '@prisma/client';

export { FeeConfigType };

// -----------------------------------------------------------------------------
// 基础类型
// -----------------------------------------------------------------------------

/**
 * 费用类型枚举
 */
export enum FeeType {
  LAWYER_FEE = 'LAWYER_FEE', // 律师费
  LITIGATION_FEE = 'LITIGATION_FEE', // 诉讼费
  TRAVEL_EXPENSE = 'TRAVEL_EXPENSE', // 差旅费
  OTHER_EXPENSE = 'OTHER_EXPENSE', // 其他费用
}

/**
 * 计费模式枚举
 */
export enum BillingMode {
  HOURLY = 'HOURLY', // 按小时
  FIXED = 'FIXED', // 固定费用
  PERCENTAGE = 'PERCENTAGE', // 按比例（如争议金额比例）
  CONTINGENCY = 'CONTINGENCY', // 风险代理（胜诉分成）
  HYBRID = 'HYBRID', // 混合模式
}

/**
 * 费用项接口
 */
export interface FeeItem {
  id: string;
  name: string;
  type: FeeType;
  amount: number;
  currency: string;
  description?: string;
  calculationDetails?: Record<string, unknown>; // 计算详情，用于展示计算过程
}

/**
 * 费用计算结果接口
 */
export interface FeeCalculationResult {
  totalAmount: number;
  currency: string;
  items: FeeItem[];
  breakdown: Record<FeeType, number>; // 按类型汇总
  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// 律师费相关类型
// -----------------------------------------------------------------------------

/**
 * 律师费配置接口
 */
export interface LawyerFeeConfig {
  mode: BillingMode;
  hourlyRate?: number; // 小时费率
  fixedAmount?: number; // 固定金额
  percentageRate?: number; // 比例费率（如5%）
  contingencyRate?: number; // 风险代理比例（如30%）
  baseAmount?: number; // 混合模式中的基础费用
  currency: string;
  minAmount?: number; // 最低收费
  maxAmount?: number; // 最高收费
}

/**
 * 律师费计算参数
 */
export interface LawyerFeeCalculationParams {
  config: LawyerFeeConfig;
  hours?: number; // 工作小时数
  caseAmount?: number; // 案件争议金额
  isWin?: boolean; // 是否胜诉（用于风险代理）
  winAmount?: number; // 胜诉金额
}

// -----------------------------------------------------------------------------
// 诉讼费相关类型
// -----------------------------------------------------------------------------

/**
 * 案件类型（用于诉讼费计算）
 */
export enum LitigationCaseType {
  PROPERTY = 'PROPERTY', // 财产案件
  DIVORCE = 'DIVORCE', // 离婚案件
  PERSONAL_RIGHTS = 'PERSONAL_RIGHTS', // 人格权案件
  INTELLECTUAL_PROPERTY = 'INTELLECTUAL_PROPERTY', // 知识产权案件
  LABOR_DISPUTE = 'LABOR_DISPUTE', // 劳动争议
  OTHER = 'OTHER', // 其他非财产案件
}

/**
 * 诉讼费配置接口
 */
export interface LitigationFeeConfig {
  caseType: LitigationCaseType;
  isReduced?: boolean; // 是否减半收取（如简易程序）
  currency: string;
  customRules?: LitigationFeeRule[]; // 自定义计算规则
}

/**
 * 诉讼费计算规则（分段累进）
 */
export interface LitigationFeeRule {
  minAmount: number; // 金额下限
  maxAmount: number | null; // 金额上限（null表示无限）
  rate: number; // 费率（%）
  plusAmount: number; // 加上固定金额
}

/**
 * 诉讼费计算参数
 */
export interface LitigationFeeCalculationParams {
  caseType: LitigationCaseType;
  amount?: number; // 争议金额
  isReduced?: boolean; // 是否减半
  config?: LitigationFeeConfig;
}

// -----------------------------------------------------------------------------
// 差旅费相关类型
// -----------------------------------------------------------------------------

/**
 * 交通工具类型
 */
export enum TransportType {
  FLIGHT = 'FLIGHT', // 飞机
  TRAIN = 'TRAIN', // 火车
  CAR = 'CAR', // 汽车/自驾
  TAXI = 'TAXI', // 出租车/网约车
  OTHER = 'OTHER', // 其他
}

/**
 * 差旅费配置接口
 */
export interface TravelExpenseConfig {
  dailyAllowance: number; // 每日伙食补助
  accommodationLimit: number; // 住宿费限额
  transportPolicy?: string; // 交通费政策
  currency: string;
}

/**
 * 差旅费项目
 */
export interface TravelExpenseItem {
  type: 'TRANSPORT' | 'ACCOMMODATION' | 'ALLOWANCE' | 'OTHER';
  amount: number;
  description?: string;
  date?: Date;
}

/**
 * 差旅费计算参数
 */
export interface TravelExpenseCalculationParams {
  days: number; // 出差天数
  peopleCount: number; // 人数
  expenses: TravelExpenseItem[]; // 实际发生费用
  config?: TravelExpenseConfig;
}

// -----------------------------------------------------------------------------
// 费率配置模型（对应数据库Json字段）
// -----------------------------------------------------------------------------

/**
 * 律师费率配置数据结构
 */
export interface LawyerFeeRateData {
  defaultMode: BillingMode;
  hourlyRate: number;
  percentageRules?: Array<{
    minAmount: number;
    maxAmount: number | null;
    rate: number;
  }>;
  contingencyRate: number;
}

/**
 * 诉讼费率配置数据结构
 */
export interface LitigationFeeRateData {
  rules: Record<LitigationCaseType, LitigationFeeRule[]>;
}

/**
 * 差旅费率配置数据结构
 */
export interface TravelExpenseRateData {
  dailyAllowance: number;
  accommodationLimit: number;
  cityLevels?: Record<string, number>; // 不同城市等级的系数
}

/**
 * 通用费率配置数据联合类型
 */
export type FeeRateData =
  | LawyerFeeRateData
  | LitigationFeeRateData
  | TravelExpenseRateData
  | Record<string, unknown>;

/**
 * 验证费率配置数据类型的守卫函数
 */
export function isLawyerFeeRateData(data: unknown): data is LawyerFeeRateData {
  return (data as LawyerFeeRateData).defaultMode !== undefined;
}

export function isLitigationFeeRateData(
  data: unknown
): data is LitigationFeeRateData {
  return (data as LitigationFeeRateData).rules !== undefined;
}

export function isTravelExpenseRateData(
  data: unknown
): data is TravelExpenseRateData {
  return (data as TravelExpenseRateData).dailyAllowance !== undefined;
}
