/**
 * 专业版会员等级配置
 */

import { LimitType } from '@/types/membership';
import type {
  TierDefinition,
  TierLimitDefinition,
  TierPermissionConfig,
} from './membership-tier-config';

/**
 * 专业版限制定义
 */
const PROFESSIONAL_TIER_LIMITS: TierLimitDefinition[] = [
  {
    limitType: LimitType.MAX_CASES,
    limitValue: null,
    period: 'monthly',
    description: '无限案件管理',
  },
  {
    limitType: LimitType.MAX_DEBATES,
    limitValue: null,
    period: 'monthly',
    description: '无限辩论生成',
  },
  {
    limitType: LimitType.MAX_DOCUMENTS,
    limitValue: null,
    period: 'monthly',
    description: '无限文档分析',
  },
  {
    limitType: LimitType.MAX_AI_TOKENS_MONTHLY,
    limitValue: 1000000,
    period: 'monthly',
    description: '每月最多使用100万个AI令牌',
  },
  {
    limitType: LimitType.MAX_STORAGE_MB,
    limitValue: 10000,
    period: 'lifetime',
    description: '最大存储空间10GB',
  },
  {
    limitType: LimitType.MAX_LAW_ARTICLE_SEARCHES,
    limitValue: null,
    period: 'monthly',
    description: '无限法条检索',
  },
  {
    limitType: LimitType.MAX_CONCURRENT_REQUESTS,
    limitValue: 10,
    period: 'instant',
    description: '最多10个并发请求',
  },
];

/**
 * 专业版权限配置
 */
const PROFESSIONAL_TIER_PERMISSIONS: TierPermissionConfig = {
  canCreateCase: true,
  canCreateDebate: true,
  canAnalyzeDocument: true,
  canSearchLawArticle: true,
  canUseAdvancedFeatures: true,
  canExportData: true,
  canUseBatchProcessing: true,
  canUseDeepSeek: true,
  canUseZhipuAI: true,
  canUseCustomModel: true,
  prioritySupport: true,
  dedicatedSupport: true,
  customPermissions: {
    canAccessAdvancedAnalytics: true,
    canUseCustomPrompts: true,
    canExportMultipleFormats: true,
  },
};

/**
 * 专业版配置
 */
export const PROFESSIONAL_TIER: TierDefinition = {
  name: 'professional',
  displayName: '专业版',
  description: '专业付费会员，适合律师和法律从业者，提供高级功能和无限制服务',
  tier: 'PROFESSIONAL',
  price: 299,
  currency: 'CNY',
  billingCycle: 'MONTHLY',
  features: [
    '无限案件管理',
    '无限辩论生成',
    '无限文档分析',
    '批量处理功能',
    '高级AI模型',
    '自定义模型训练',
    '优先技术支持',
    '专属客服通道',
  ],
  permissions: PROFESSIONAL_TIER_PERMISSIONS,
  isActive: true,
  sortOrder: 3,
  limits: PROFESSIONAL_TIER_LIMITS,
};
