/**
 * 会员等级系统类型定义
 */

// =============================================================================
// 会员等级枚举
// =============================================================================

/**
 * 会员等级类型
 */
export enum MembershipTier {
  FREE = 'FREE', // 免费版
  BASIC = 'BASIC', // 基础版
  PROFESSIONAL = 'PROFESSIONAL', // 专业版
  ENTERPRISE = 'ENTERPRISE', // 企业版
}

/**
 * 会员状态
 */
export enum MembershipStatus {
  ACTIVE = 'ACTIVE', // 活跃
  EXPIRED = 'EXPIRED', // 已过期
  CANCELLED = 'CANCELLED', // 已取消
  SUSPENDED = 'SUSPENDED', // 已暂停
  PENDING = 'PENDING', // 待处理
}

/**
 * 订阅周期
 */
export enum BillingCycle {
  MONTHLY = 'MONTHLY', // 月付
  QUARTERLY = 'QUARTERLY', // 季付
  YEARLY = 'YEARLY', // 年付
  LIFETIME = 'LIFETIME', // 永久
}

/**
 * 使用量类型
 */
export enum UsageType {
  CASE_CREATED = 'CASE_CREATED', // 创建案件
  DEBATE_GENERATED = 'DEBATE_GENERATED', // 生成辩论
  DOCUMENT_ANALYZED = 'DOCUMENT_ANALYZED', // 分析文档
  LAW_ARTICLE_SEARCHED = 'LAW_ARTICLE_SEARCHED', // 搜索法条
  AI_TOKEN_USED = 'AI_TOKEN_USED', // 使用AI令牌
  STORAGE_USED = 'STORAGE_USED', // 存储空间使用
}

/**
 * 限制类型
 */
export enum LimitType {
  MAX_CASES = 'MAX_CASES', // 最大案件数
  MAX_DEBATES = 'MAX_DEBATES', // 最大辩论数
  MAX_DOCUMENTS = 'MAX_DOCUMENTS', // 最大文档数
  MAX_AI_TOKENS_MONTHLY = 'MAX_AI_TOKENS_MONTHLY', // 月度AI令牌限制
  MAX_STORAGE_MB = 'MAX_STORAGE_MB', // 最大存储空间（MB）
  MAX_LAW_ARTICLE_SEARCHES = 'MAX_LAW_ARTICLE_SEARCHES', // 最大法条搜索次数
  MAX_CONCURRENT_REQUESTS = 'MAX_CONCURRENT_REQUESTS', // 最大并发请求数
}

// =============================================================================
// 会员等级定义接口
// =============================================================================

/**
 * 会员等级定义
 */
export interface MembershipTierDef {
  id: string;
  name: string;
  displayName: string;
  description: string;
  tier: MembershipTier;
  price: number;
  currency: string;
  billingCycle: BillingCycle;
  features: string[];
  permissions: MembershipPermissionConfig;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 会员权限配置
 */
export interface MembershipPermissionConfig {
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

  // 自定义权限（JSON格式）
  customPermissions: Record<string, unknown>;
}

// =============================================================================
// 用户会员关系接口
// =============================================================================

/**
 * 用户会员信息
 */
export interface UserMembership {
  id: string;
  userId: string;
  tierId: string;
  status: MembershipStatus;
  tier: MembershipTier;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt?: Date;
  cancelledReason?: string;
  pausedAt?: Date;
  pausedReason?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;

  // 关联的会员等级定义
  tierDef?: MembershipTierDef;

  // 关联的用户
  user?: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
  };
}

// =============================================================================
// 使用量记录接口
// =============================================================================

/**
 * 使用量记录
 */
export interface UsageRecord {
  id: string;
  userId: string;
  membershipId: string;
  usageType: UsageType;
  quantity: number;
  unit: string;
  resourceId?: string; // 关联的资源ID（如案件ID、辩论ID等）
  resourceType?: string; // 资源类型
  description?: string;
  metadata?: Record<string, unknown>;
  periodStart: Date; // 计费周期开始时间
  periodEnd: Date; // 计费周期结束时间
  createdAt: Date;
  updatedAt: Date;

  // 关联的用户
  user?: {
    id: string;
    email: string;
  };

  // 关联的会员
  membership?: UserMembership;
}

/**
 * 使用量统计
 */
export interface UsageStats {
  userId: string;
  periodStart: Date;
  periodEnd: Date;

  // 各类型使用量
  casesCreated: number;
  debatesGenerated: number;
  documentsAnalyzed: number;
  lawArticleSearches: number;
  aiTokensUsed: number;
  storageUsedMB: number;

  // 限制信息
  limits: TierLimitConfig;

  // 剩余额度
  remaining: {
    cases: number;
    debates: number;
    documents: number;
    lawArticleSearches: number;
    aiTokens: number;
    storageMB: number;
  };
}

// =============================================================================
// 等级限制配置接口
// =============================================================================

/**
 * 等级限制配置
 */
export interface TierLimitConfig {
  tier: MembershipTier;
  limits: Record<LimitType, number | null>; // null表示无限制
}

/**
 * 等级限制定义
 */
export interface TierLimitDef {
  id: string;
  tierId: string;
  tier: MembershipTier;
  limitType: LimitType;
  limitValue: number | null; // null表示无限制
  period?: string; // 计费周期（如monthly, daily等）
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// API请求/响应类型
// =============================================================================

/**
 * 会员升级请求
 */
export interface MembershipUpgradeRequest {
  tierId: string;
  billingCycle: BillingCycle;
  autoRenew?: boolean;
  paymentMethodId?: string;
}

/**
 * 会员升级响应
 */
export interface MembershipUpgradeResponse {
  success: boolean;
  message: string;
  data?: {
    membership: UserMembership;
    order?: {
      id: string;
      amount: number;
      currency: string;
      paymentUrl?: string;
    };
  };
  error?: string;
}

/**
 * 会员信息查询响应
 */
export interface MembershipInfoResponse {
  success: boolean;
  message: string;
  data?: {
    currentMembership: UserMembership;
    availableTiers: MembershipTierDef[];
    usageStats: UsageStats;
    canUpgrade: boolean;
    upgradeOptions?: {
      tier: MembershipTierDef;
      price: number;
      savings?: number;
    }[];
  };
  error?: string;
}

/**
 * 使用量查询请求
 */
export interface UsageQueryRequest {
  periodStart?: Date;
  periodEnd?: Date;
  usageType?: UsageType;
  page?: number;
  limit?: number;
}

/**
 * 使用量查询响应
 */
export interface UsageQueryResponse {
  success: boolean;
  message: string;
  data?: {
    records: UsageRecord[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    summary: {
      totalUsage: number;
      byType: Record<UsageType, number>;
    };
  };
  error?: string;
}

// =============================================================================
// 权限检查相关类型
// =============================================================================

/**
 * 权限检查请求
 */
export interface PermissionCheckRequest {
  userId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
}

/**
 * 权限检查响应
 */
export interface PermissionCheckResponse {
  success: boolean;
  message: string;
  data?: {
    hasPermission: boolean;
    currentTier: MembershipTier;
    requiredTier?: MembershipTier;
    limitReached?: boolean;
    currentUsage?: number;
    limit?: number | null;
  };
  error?: string;
}

// =============================================================================
// 会员变更历史类型
// =============================================================================

/**
 * 会员变更类型
 */
export enum MembershipChangeType {
  UPGRADE = 'UPGRADE', // 升级
  DOWNGRADE = 'DOWNGRADE', // 降级
  CANCEL = 'CANCEL', // 取消
  RENEW = 'RENEW', // 续费
  PAUSE = 'PAUSE', // 暂停
  RESUME = 'RESUME', // 恢复
  EXPIRE = 'EXPIRE', // 过期
}

/**
 * 会员变更历史
 */
export interface MembershipHistory {
  id: string;
  userId: string;
  membershipId: string;
  changeType: MembershipChangeType;
  fromTier?: MembershipTier;
  toTier?: MembershipTier;
  fromStatus: MembershipStatus;
  toStatus: MembershipStatus;
  reason?: string;
  performedBy: string; // 操作者ID（系统或管理员）
  metadata?: Record<string, unknown>;
  createdAt: Date;

  // 关联的用户
  user?: {
    id: string;
    email: string;
  };
}
