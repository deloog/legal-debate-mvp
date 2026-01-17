/**
 * 企业版会员等级配置
 */

import { LimitType } from '@/types/membership';
import type {
  TierDefinition,
  TierLimitDefinition,
  TierPermissionConfig,
} from './membership-tier-config';

/**
 * 企业版限制定义
 */
const ENTERPRISE_TIER_LIMITS: TierLimitDefinition[] = [
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
    limitValue: null,
    period: 'monthly',
    description: '无限AI令牌',
  },
  {
    limitType: LimitType.MAX_STORAGE_MB,
    limitValue: null,
    period: 'lifetime',
    description: '无限存储空间',
  },
  {
    limitType: LimitType.MAX_LAW_ARTICLE_SEARCHES,
    limitValue: null,
    period: 'monthly',
    description: '无限法条检索',
  },
  {
    limitType: LimitType.MAX_CONCURRENT_REQUESTS,
    limitValue: null,
    period: 'instant',
    description: '无限并发请求',
  },
];

/**
 * 企业版权限配置
 */
const ENTERPRISE_TIER_PERMISSIONS: TierPermissionConfig = {
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
    canAccessApi: true,
    canUseWhiteLabel: true,
    canAccessAdvancedAnalytics: true,
    canUseCustomPrompts: true,
    canExportMultipleFormats: true,
    canManageTeamMembers: true,
    canAccessCustomReports: true,
  },
};

/**
 * 企业版配置
 */
export const ENTERPRISE_TIER: TierDefinition = {
  name: 'enterprise',
  displayName: '企业版',
  description:
    '企业付费会员，适合企业和律师事务所，提供专属服务、API访问和无限资源',
  tier: 'ENTERPRISE',
  price: 999,
  currency: 'CNY',
  billingCycle: 'MONTHLY',
  features: [
    '无限资源使用',
    'API访问权限',
    '专属客户经理',
    '7x24小时技术支持',
    '定制化服务',
    '团队协作功能',
    '数据分析报告',
    'SLA服务保障',
  ],
  permissions: ENTERPRISE_TIER_PERMISSIONS,
  isActive: true,
  sortOrder: 4,
  limits: ENTERPRISE_TIER_LIMITS,
};
