/**
 * 法律时效计算引擎类型定义
 */

/**
 * 导入NotificationChannel（从notification.ts）
 */
export { NotificationChannel } from './notification';
import type { NotificationChannel } from './notification';

/**
 * 时效类型枚举
 */
export enum StatuteType {
  LITIGATION = 'LITIGATION', // 诉讼时效
  APPEAL = 'APPEAL', // 上诉时效
  ENFORCEMENT = 'ENFORCEMENT', // 执行时效
}

/**
 * 案件类型（用于时效计算）
 */
export enum CaseTypeForStatute {
  CIVIL = 'CIVIL', // 民事案件
  COMMERCIAL = 'COMMERCIAL', // 商事案件
  LABOR = 'LABOR', // 劳动案件
  INTELLECTUAL = 'INTELLECTUAL', // 知识产权案件
  ADMINISTRATIVE = 'ADMINISTRATIVE', // 行政案件
  CRIMINAL = 'CRIMINAL', // 刑事案件
  OTHER = 'OTHER', // 其他案件
}

/**
 * 特殊情况枚举
 */
export enum SpecialCircumstances {
  INTERRUPTION = 'INTERRUPTION', // 时效中断
  SUSPENSION = 'SUSPENSION', // 时效中止
  MINOR = 'MINOR', // 限制民事行为能力人
  DISABILITY = 'DISABILITY', // 无民事行为能力人
  FORCE_MAJEURE = 'FORCE_MAJEURE', // 不可抗力
  CLAIM_DENIAL = 'CLAIM_DENIAL', // 对方承认债务
  ASSETS_REPOSSESSION = 'ASSETS_REPOSSESSION', // 占有动产
  OTHER = 'OTHER',
}

/**
 * 时效计算结果接口
 */
export interface StatuteCalculationResult {
  id: string;
  caseId: string;
  statuteType: StatuteType;
  startDate: Date;
  deadlineDate: Date;
  remainingDays: number;
  isExpired: boolean;
  isApproaching: boolean; // 是否接近到期
  applicableRules: StatuteRule[];
  specialCircumstances: SpecialCircumstances[];
  calculationMetadata: StatuteMetadata;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 时效规则接口
 */
export interface StatuteRule {
  id: string;
  statuteType: StatuteType;
  caseType: CaseTypeForStatute;
  statutePeriod: number; // 时效期间（天数）
  description: string;
  legalBasis: string; // 法律依据
  effectiveDate: Date;
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 时效计算参数接口
 */
export interface StatuteCalculationParams {
  caseId: string;
  statuteType: StatuteType;
  caseType: CaseTypeForStatute;
  startDate: Date;
  endDate?: Date; // 用于计算已过的期间
  specialCircumstances?: SpecialCircumstances[];
  customRules?: StatuteRule[];
  timezone?: string;
}

/**
 * 时效元数据接口
 */
export interface StatuteMetadata {
  calculationMethod: 'STANDARD' | 'CUSTOM' | 'MIXED';
  appliedRules: string[]; // 应用的规则ID列表
  adjustments: {
    interruptionDays?: number; // 中断天数
    suspensionDays?: number; // 中止天数
    minorProtectionDays?: number; // 限制民事行为能力保护期
    customAdjustments?: number; // 自定义调整天数
  };
  warnings: string[]; // 警告信息
  recommendations: string[]; // 建议
  confidence: number; // 计算置信度 (0-1)
}

/**
 * 时效提醒配置接口
 */
export interface StatuteReminderConfig {
  enabled: boolean;
  reminderDays: number[]; // 提前提醒天数列表，如 [30, 15, 7, 1]
  channels: NotificationChannel[];
  autoGenerate: boolean;
  customMessages?: Record<string, string>;
}

/**
 * 时效提醒输入接口
 */
export interface StatuteReminderInput {
  userId: string;
  calculationResult: StatuteCalculationResult;
  config: StatuteReminderConfig;
}

/**
 * 时效计算查询参数接口
 */
export interface StatuteCalculationQueryParams {
  userId?: string;
  caseId?: string;
  statuteType?: StatuteType;
  caseType?: CaseTypeForStatute;
  startDate?: Date;
  endDate?: Date;
  isExpired?: boolean;
  isApproaching?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'deadlineDate' | 'remainingDays';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 时效计算列表响应接口
 */
export interface StatuteCalculationListResponse {
  calculations: StatuteCalculationResult[];
  total: number;
  page: number;
  limit: number;
  statistics: StatuteStatistics;
}

/**
 * 时效统计信息接口
 */
export interface StatuteStatistics {
  totalCalculations: number;
  expiredCount: number;
  approachingCount: number;
  validCount: number;
  averageRemainingDays: number;
  byType: Record<
    StatuteType,
    {
      total: number;
      expired: number;
      approaching: number;
      valid: number;
    }
  >;
  riskDistribution: {
    high: number; // 高风险（<7天）
    medium: number; // 中风险（7-30天）
    low: number; // 低风险（>30天）
  };
}

/**
 * 验证时效类型的守卫函数
 */
export function isValidStatuteType(value: string): value is StatuteType {
  return Object.values(StatuteType).includes(value as StatuteType);
}

/**
 * 验证案件类型的守卫函数
 */
export function isValidCaseTypeForStatute(
  value: string
): value is CaseTypeForStatute {
  return Object.values(CaseTypeForStatute).includes(
    value as CaseTypeForStatute
  );
}

/**
 * 验证特殊情况的守卫函数
 */
export function isValidSpecialCircumstance(
  value: string
): value is SpecialCircumstances {
  return Object.values(SpecialCircumstances).includes(
    value as SpecialCircumstances
  );
}

/**
 * 获取风险等级
 */
export function getRiskLevel(remainingDays: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (remainingDays <= 7) return 'HIGH';
  if (remainingDays <= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * 获取风险等级显示文本
 */
export function getRiskLevelLabel(
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW'
): string {
  switch (riskLevel) {
    case 'HIGH':
      return '高风险';
    case 'MEDIUM':
      return '中风险';
    case 'LOW':
      return '低风险';
    default:
      return '未知';
  }
}

/**
 * 获取时效类型显示标签
 */
export function getStatuteTypeLabel(statuteType: StatuteType): string {
  switch (statuteType) {
    case StatuteType.LITIGATION:
      return '诉讼时效';
    case StatuteType.APPEAL:
      return '上诉时效';
    case StatuteType.ENFORCEMENT:
      return '执行时效';
    default:
      return '未知';
  }
}

/**
 * 获取案件类型显示标签
 */
export function getCaseTypeLabel(caseType: CaseTypeForStatute): string {
  switch (caseType) {
    case CaseTypeForStatute.CIVIL:
      return '民事案件';
    case CaseTypeForStatute.COMMERCIAL:
      return '商事案件';
    case CaseTypeForStatute.LABOR:
      return '劳动案件';
    case CaseTypeForStatute.INTELLECTUAL:
      return '知识产权案件';
    case CaseTypeForStatute.ADMINISTRATIVE:
      return '行政案件';
    case CaseTypeForStatute.CRIMINAL:
      return '刑事案件';
    case CaseTypeForStatute.OTHER:
      return '其他案件';
    default:
      return '未知';
  }
}
