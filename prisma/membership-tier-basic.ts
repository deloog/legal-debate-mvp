/**
 * 基础版会员等级配置
 */

import { LimitType } from '@/types/membership';
import type {
  TierDefinition,
  TierLimitDefinition,
  TierPermissionConfig,
} from './membership-tier-config';

/**
 * 基础版限制定义
 */
const BASIC_TIER_LIMITS: TierLimitDefinition[] = [
  {
    limitType: LimitType.MAX_CASES,
    limitValue: 50,
    period: 'monthly',
    description: '每月最多创建50个案件',
  },
  {
    limitType: LimitType.MAX_DEBATES,
    limitValue: 20,
    period: 'monthly',
    description: '每月最多生成20次辩论',
  },
  {
    limitType: LimitType.MAX_DOCUMENTS,
    limitValue: 100,
    period: 'monthly',
    description: '每月最多分析100个文档',
  },
  {
    limitType: LimitType.MAX_AI_TOKENS_MONTHLY,
    limitValue: 100000,
    period: 'monthly',
    description: '每月最多使用10万个AI令牌',
  },
  {
    limitType: LimitType.MAX_STORAGE_MB,
    limitValue: 1000,
    period: 'lifetime',
    description: '最大存储空间1GB',
  },
  {
    limitType: LimitType.MAX_LAW_ARTICLE_SEARCHES,
    limitValue: null,
    period: 'monthly',
    description: '无限法条检索',
  },
  {
    limitType: LimitType.MAX_CONCURRENT_REQUESTS,
    limitValue: 5,
    period: 'instant',
    description: '最多5个并发请求',
  },
];

/**
 * 基础版权限配置
 */
const BASIC_TIER_PERMISSIONS: TierPermissionConfig = {
  canCreateCase: true,
  canCreateDebate: true,
  canAnalyzeDocument: true,
  canSearchLawArticle: true,
  canUseAdvancedFeatures: true,
  canExportData: true,
  canUseBatchProcessing: false,
  canUseDeepSeek: true,
  canUseZhipuAI: true,
  canUseCustomModel: false,
  prioritySupport: true,
  dedicatedSupport: false,
  customPermissions: {},
};

/**
 * 基础版配置
 */
export const BASIC_TIER: TierDefinition = {
  name: 'basic',
  displayName: '基础版',
  description: '基础付费会员，适合个人用户，提供完整的案件分析功能',
  tier: 'BASIC',
  price: 99,
  currency: 'CNY',
  billingCycle: 'MONTHLY',
  features: [
    '完整案件管理',
    '辩论生成功能',
    '文档深度分析',
    '无限法条检索',
    '数据导出功能',
    '优先技术支持',
  ],
  permissions: BASIC_TIER_PERMISSIONS,
  isActive: true,
  sortOrder: 2,
  limits: BASIC_TIER_LIMITS,
};
