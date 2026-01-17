/**
 * 免费版会员等级配置
 */

import { LimitType } from '@/types/membership';
import type {
  TierDefinition,
  TierLimitDefinition,
  TierPermissionConfig,
} from './membership-tier-config';

/**
 * 免费版限制定义
 */
const FREE_TIER_LIMITS: TierLimitDefinition[] = [
  {
    limitType: LimitType.MAX_CASES,
    limitValue: 3,
    period: 'monthly',
    description: '每月最多创建3个案件',
  },
  {
    limitType: LimitType.MAX_DEBATES,
    limitValue: 0,
    period: 'monthly',
    description: '免费版不提供辩论生成功能',
  },
  {
    limitType: LimitType.MAX_DOCUMENTS,
    limitValue: 5,
    period: 'monthly',
    description: '每月最多分析5个文档',
  },
  {
    limitType: LimitType.MAX_AI_TOKENS_MONTHLY,
    limitValue: 10000,
    period: 'monthly',
    description: '每月最多使用1万个AI令牌',
  },
  {
    limitType: LimitType.MAX_STORAGE_MB,
    limitValue: 100,
    period: 'lifetime',
    description: '最大存储空间100MB',
  },
  {
    limitType: LimitType.MAX_LAW_ARTICLE_SEARCHES,
    limitValue: 50,
    period: 'monthly',
    description: '每月最多搜索50次法条',
  },
  {
    limitType: LimitType.MAX_CONCURRENT_REQUESTS,
    limitValue: 2,
    period: 'instant',
    description: '最多2个并发请求',
  },
];

/**
 * 免费版权限配置
 */
const FREE_TIER_PERMISSIONS: TierPermissionConfig = {
  canCreateCase: true,
  canCreateDebate: false,
  canAnalyzeDocument: true,
  canSearchLawArticle: true,
  canUseAdvancedFeatures: false,
  canExportData: false,
  canUseBatchProcessing: false,
  canUseDeepSeek: true,
  canUseZhipuAI: true,
  canUseCustomModel: false,
  prioritySupport: false,
  dedicatedSupport: false,
  customPermissions: {},
};

/**
 * 免费版配置
 */
export const FREE_TIER: TierDefinition = {
  name: 'free',
  displayName: '免费版',
  description: '基础免费会员，适合个人用户试用，提供基础功能体验',
  tier: 'FREE',
  price: 0,
  currency: 'CNY',
  billingCycle: 'MONTHLY',
  features: [
    '基础功能体验',
    '最多创建3个案件',
    '文档分析功能',
    '法条检索功能',
    '标准AI模型',
  ],
  permissions: FREE_TIER_PERMISSIONS,
  isActive: true,
  sortOrder: 1,
  limits: FREE_TIER_LIMITS,
};
