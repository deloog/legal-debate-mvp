/**
 * 会员类型定义
 * 集中定义会员相关的类型
 */

/**
 * 会员状态
 */
export type MembershipStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'PAUSED'
  | 'SUSPENDED'
  | 'PENDING';

/**
 * 会员状态常量（运行时可用）
 */
export const MembershipStatusValues = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  PAUSED: 'PAUSED',
  SUSPENDED: 'SUSPENDED',
  PENDING: 'PENDING',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const MembershipStatus = MembershipStatusValues;

/**
 * 会员变更类型
 */
export type MembershipChangeType =
  | 'UPGRADE'
  | 'DOWNGRADE'
  | 'RENEW'
  | 'CANCEL'
  | 'EXPIRE'
  | 'PAUSE'
  | 'RESUME';

/**
 * 会员变更类型常量（运行时可用）
 */
export const MembershipChangeTypeValues = {
  UPGRADE: 'UPGRADE',
  DOWNGRADE: 'DOWNGRADE',
  RENEW: 'RENEW',
  CANCEL: 'CANCEL',
  EXPIRE: 'EXPIRE',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const MembershipChangeType = MembershipChangeTypeValues;

/**
 * 会员等级
 */
export type MembershipTier = 'FREE' | 'BASIC' | 'PROFESSIONAL' | 'ENTERPRISE';

/**
 * 会员等级常量（运行时可用）
 */
export const MembershipTierValues = {
  FREE: 'FREE',
  BASIC: 'BASIC',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const MembershipTier = MembershipTierValues;

/**
 * 使用类型（匹配 Prisma Schema）
 */
export type UsageType =
  | 'CASE_CREATED'
  | 'DEBATE_GENERATED'
  | 'DOCUMENT_ANALYZED'
  | 'LAW_ARTICLE_SEARCHED'
  | 'AI_TOKEN_USED'
  | 'STORAGE_USED';

/**
 * 限制类型
 */
export type LimitType =
  | 'MAX_CASES'
  | 'MAX_DEBATES'
  | 'MAX_DOCUMENTS'
  | 'MAX_AI_TOKENS_MONTHLY'
  | 'MAX_STORAGE_MB'
  | 'MAX_LAW_ARTICLE_SEARCHES'
  | 'MAX_CONCURRENT_REQUESTS';

/**
 * 限制类型常量（运行时可用）
 */
export const LimitTypeValues = {
  MAX_CASES: 'MAX_CASES',
  MAX_DEBATES: 'MAX_DEBATES',
  MAX_DOCUMENTS: 'MAX_DOCUMENTS',
  MAX_AI_TOKENS_MONTHLY: 'MAX_AI_TOKENS_MONTHLY',
  MAX_STORAGE_MB: 'MAX_STORAGE_MB',
  MAX_LAW_ARTICLE_SEARCHES: 'MAX_LAW_ARTICLE_SEARCHES',
  MAX_CONCURRENT_REQUESTS: 'MAX_CONCURRENT_REQUESTS',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const LimitType = LimitTypeValues;

/**
 * 使用统计（扩展版）
 */
export interface UsageStats {
  used: number;
  limit: number;
  resetAt: Date | null;
  // 扩展字段用于详细统计
  userId?: string;
  casesCreated?: number;
  debatesGenerated?: number;
  documentsAnalyzed?: number;
  lawArticleSearches?: number;
  aiTokensUsed?: number;
  storageUsedMB?: number;
  limits?: {
    MAX_CASES?: number;
    MAX_DEBATES?: number;
    MAX_DOCUMENTS?: number;
    MAX_AI_TOKENS_MONTHLY?: number;
    MAX_STORAGE_MB?: number;
    MAX_LAW_ARTICLE_SEARCHES?: number;
    MAX_CONCURRENT_REQUESTS?: number;
  };
  remaining?: {
    cases?: number;
    debates?: number;
    documents?: number;
    aiTokens?: number;
    storage?: number;
    lawArticleSearches?: number;
  };
  periodStart?: Date;
  periodEnd?: Date;
}

/**
 * 会员详情
 */
export interface MembershipDetail {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
  tierId: string;
  tier: {
    id: string;
    name: string;
    level: number;
    price: number;
    features: string[];
  };
  status: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  paymentMethod: string | null;
  lastPaymentAt: Date | null;
  nextPaymentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 会员列表响应
 */
export interface MembershipListResponse {
  memberships: MembershipDetail[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 会员查询参数
 */
export interface MembershipQueryParams {
  page?: string;
  pageSize?: string;
  tierId?: string;
  status?: string;
  keyword?: string;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 升级请求
 */
export interface MembershipUpgradeRequest {
  tierId: string;
  paymentMethod?: string;
  autoRenew?: boolean;
}

/**
 * 降级请求
 */
export interface MembershipDowngradeRequest {
  reason?: string;
  effectiveDate?: string;
}

/**
 * 取消请求
 */
export interface MembershipCancelRequest {
  reason?: string;
  immediate?: boolean;
}

/**
 * 续费请求
 */
export interface MembershipRenewRequest {
  duration: number;
  paymentMethod?: string;
  autoRenew?: boolean;
}

/**
 * 会员统计
 */
export interface MembershipStatistics {
  total: number;
  active: number;
  expired: number;
  cancelled: number;
  byTier: Record<string, number>;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
}

// =============================================================================
// 阶段1新增类型（2024年类型修复计划）
// =============================================================================

/**
 * 计费周期
 */
export type BillingCycle = 'MONTHLY' | 'YEARLY' | 'QUARTERLY' | 'LIFETIME';

/**
 * 计费周期常量（运行时可用）
 */
export const BillingCycleValues = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
  QUARTERLY: 'QUARTERLY',
  LIFETIME: 'LIFETIME',
} as const;

// 导出类型别名作为值（兼容旧代码）
export const BillingCycle = BillingCycleValues;

/**
 * 会员等级限制配置
 */
export interface TierLimitConfig {
  cases: number;
  debates: number;
  documents: number;
  storage: number;
  aiTokens: number;
  users: number;
  features: string[];
  // 兼容旧代码的嵌套 limits 属性
  limits?: {
    MAX_CASES: number;
    MAX_DEBATES: number;
    MAX_DOCUMENTS: number;
    MAX_AI_TOKENS_MONTHLY: number;
    MAX_STORAGE_MB: number;
    MAX_LAW_ARTICLE_SEARCHES: number;
    MAX_CONCURRENT_REQUESTS: number;
  };
  // 直接访问的属性（兼容）
  MAX_CASES?: number;
  MAX_DEBATES?: number;
  MAX_DOCUMENTS?: number;
  MAX_AI_TOKENS_MONTHLY?: number;
  MAX_STORAGE_MB?: number;
  MAX_LAW_ARTICLE_SEARCHES?: number;
  MAX_CONCURRENT_REQUESTS?: number;
}

/**
 * 用户会员信息（简化版）
 */
export interface UserMembership {
  id: string;
  userId: string;
  tierId?: string; // 兼容旧代码
  tier: MembershipTier;
  status: MembershipStatus;
  startDate: Date;
  endDate: Date;
  limits: TierLimitConfig;
  usage: Record<string, number>;
  autoRenew?: boolean;
}

/**
 * 会员等级定义
 */
export interface MembershipTierDef {
  id: string;
  tier: MembershipTier;
  name: string;
  displayName?: string;
  description?: string;
  level: number;
  price: number;
  currency?: string; // 兼容旧代码
  billingCycle: BillingCycle;
  features: string[];
  limits: TierLimitConfig;
  permissions?: Record<string, unknown>;
  // 兼容旧代码的额外字段
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * 会员变更历史
 */
export interface MembershipHistory {
  id: string;
  membershipId: string;
  userId?: string; // 兼容旧代码
  changeType: MembershipChangeType;
  previousTier: MembershipTier | null;
  newTier: MembershipTier;
  previousStatus: MembershipStatus | null;
  newStatus: MembershipStatus;
  reason: string | null;
  performedBy?: string; // 兼容旧代码
  createdAt: Date;
  // 兼容旧代码的别名
  fromTier?: MembershipTier | null;
  toTier?: MembershipTier;
  fromStatus?: MembershipStatus | null;
  toStatus?: MembershipStatus;
}

/**
 * 会员权限配置
 */
export interface MembershipPermissionConfig {
  // 基础功能权限
  canCreateCase: boolean;
  canCreateDebate: boolean;
  canAnalyzeDocument: boolean;
  canSearchLawArticle: boolean;
  canUseAI: boolean;
  canExportData: boolean;
  canInviteMembers: boolean;
  canManageTeam: boolean;
  maxTeamMembers: number;

  // 高级功能权限
  canUseAdvancedFeatures: boolean;
  canUseBatchProcessing: boolean;

  // AI模型权限
  canUseDeepSeek: boolean;
  canUseZhipuAI: boolean;
  canUseCustomModel: boolean;

  // 支持服务权限
  prioritySupport: boolean;
  dedicatedSupport: boolean;

  // 自定义权限
  customPermissions: Record<string, boolean>;
}

/**
 * 使用量记录
 */
export interface UsageRecord {
  id: string;
  membershipId: string;
  usageType: UsageType;
  amount: number;
  resetAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
