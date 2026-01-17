/**
 * 会员等级配置数据定义
 * 包含类型定义和工具函数
 */

import { FREE_TIER } from './membership-tier-free';
import { BASIC_TIER } from './membership-tier-basic';
import { PROFESSIONAL_TIER } from './membership-tier-professional';
import { ENTERPRISE_TIER } from './membership-tier-enterprise';
import type { LimitType } from '@/types/membership';

// =============================================================================
// 会员等级权限配置类型
// =============================================================================

/**
 * 会员等级权限配置类型
 */
export interface TierPermissionConfig {
  // 功能权限
  canCreateCase: boolean;
  canCreateDebate: boolean;
  canAnalyzeDocument: boolean;
  canSearchLawArticle: boolean;
  canUseAdvancedFeatures: boolean;
  canExportData: boolean;
  canUseBatchProcessing: boolean;

  // AI功能权限
  canUseDeepSeek: boolean;
  canUseZhipuAI: boolean;
  canUseCustomModel: boolean;

  // 优先级权限
  prioritySupport: boolean;
  dedicatedSupport: boolean;

  // 自定义权限
  customPermissions: Record<string, unknown>;
}

/**
 * 会员等级限制定义
 */
export interface TierLimitDefinition {
  limitType: LimitType;
  limitValue: number | null;
  period?: string;
  description?: string;
}

/**
 * 会员等级定义
 */
export interface TierDefinition {
  name: string;
  displayName: string;
  description: string;
  tier: 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';
  price: number;
  currency: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'LIFETIME';
  features: string[];
  permissions: TierPermissionConfig;
  isActive: boolean;
  sortOrder: number;
  limits: TierLimitDefinition[];
}

// =============================================================================
// 会员等级配置
// =============================================================================

/**
 * 所有会员等级配置
 */
export const MEMBERSHIP_TIERS: TierDefinition[] = [
  FREE_TIER,
  BASIC_TIER,
  PROFESSIONAL_TIER,
  ENTERPRISE_TIER,
];

/**
 * 根据等级名称获取配置
 */
export function getTierConfig(name: string): TierDefinition | undefined {
  return MEMBERSHIP_TIERS.find(tier => tier.name === name);
}

/**
 * 获取所有激活的会员等级
 */
export function getActiveTiers(): TierDefinition[] {
  return MEMBERSHIP_TIERS.filter(tier => tier.isActive);
}

/**
 * 根据sortOrder排序获取等级配置
 */
export function getSortedTiers(): TierDefinition[] {
  return [...MEMBERSHIP_TIERS].sort((a, b) => a.sortOrder - b.sortOrder);
}
