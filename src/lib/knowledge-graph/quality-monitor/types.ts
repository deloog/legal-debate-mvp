/**
 * 数据质量监控模块类型定义
 */

import {
  RelationType,
  DiscoveryMethod,
  LawCategory,
  LawStatus,
  VerificationStatus,
  LawType,
} from '@prisma/client';

// =============================================================================
// 通用类型
// =============================================================================

/**
 * 监控统计选项基类
 */
export interface BaseStatsOptions {
  relationType?: RelationType;
}

// =============================================================================
// 准确性监控相关类型
// =============================================================================

/**
 * 准确性统计选项
 */
export interface AccuracyStatsOptions extends BaseStatsOptions {
  relationType?: RelationType;
  discoveryMethod?: DiscoveryMethod;
}

/**
 * 准确性指标
 */
export interface AccuracyMetrics {
  /** 总关系数 */
  totalRelations: number;
  /** 已验证关系数 */
  verifiedRelations: number;
  /** 用户反馈总数 */
  userFeedbackCount: number;
  /** 正面反馈数 */
  positiveFeedbackCount: number;
  /** 负面反馈数 */
  negativeFeedbackCount: number;
  /** 正面反馈率 (0-1) */
  positiveFeedbackRate: number;
  /** 验证率 (0-1) */
  verificationRate: number;
}

/**
 * 低质量关系
 */
export interface LowQualityRelation {
  /** 关系ID */
  relationId: string;
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 反馈总数 */
  feedbackCount: number;
  /** 负面反馈数 */
  negativeFeedbackCount: number;
  /** 负面反馈率 (0-1) */
  negativeFeedbackRate: number;
}

// =============================================================================
// 覆盖率监控相关类型
// =============================================================================

/**
 * 覆盖率统计选项
 */
export interface CoverageStatsOptions {
  lawType?: LawType;
  category?: LawCategory;
  status?: LawStatus;
}

/**
 * 覆盖率指标
 */
export interface CoverageMetrics {
  /** 总法条数 */
  totalArticles: number;
  /** 有关系的法条数 */
  articlesWithRelations: number;
  /** 覆盖率 (0-1) */
  coverageRate: number;
  /** 平均每个法条的关系数 */
  averageRelationsPerArticle: number;
  /** 孤立法条数 */
  orphanArticles: number;
}

/**
 * 孤立法条
 */
export interface OrphanArticle {
  /** 法条ID */
  id: string;
  /** 法规名称 */
  lawName: string;
  /** 条号 */
  articleNumber: string;
  /** 法规类型 */
  lawType: LawType;
  /** 法规分类 */
  category: LawCategory;
  /** 法条状态 */
  status: LawStatus;
  /** 创建时间 */
  createdAt: Date;
}

// =============================================================================
// 时效性监控相关类型
// =============================================================================

/**
 * 时效性统计选项
 */
export interface TimelinessStatsOptions {
  staleThresholdDays?: number;
  pendingThresholdDays?: number;
}

/**
 * 时效性指标
 */
export interface TimelinessMetrics {
  /** 总关系数 */
  totalRelations: number;
  /** 待审核关系数 */
  pendingRelations: number;
  /** 待审核率 (0-1) */
  pendingRate: number;
  /** 过期关系数 */
  staleRelations: number;
  /** 过期关系率 (0-1) */
  staleRate: number;
  /** 失效关系数 */
  expiredRelations: number;
  /** 失效关系率 (0-1) */
  expiredRate: number;
}

/**
 * 失效关系（涉及失效法条的关系）
 */
export interface ExpiredRelation {
  /** 关系ID */
  relationId: string;
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 源法条是否失效 */
  expiredSource: boolean;
  /** 目标法条是否失效 */
  expiredTarget: boolean;
  /** 失效日期 */
  expiryDate: Date | null;
  /** 源法条状态 */
  sourceStatus: LawStatus;
  /** 目标法条状态 */
  targetStatus: LawStatus;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 过期关系（创建时间超过阈值且仍为待审核状态的关系）
 */
export interface StaleRelation {
  /** 关系ID */
  relationId: string;
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
  /** 距离创建的天数 */
  daysSinceCreation: number;
  /** 验证状态 */
  verificationStatus: VerificationStatus;
  /** 距离更新的天数 */
  daysSinceUpdate: number;
}

// =============================================================================
// 综合监控指标
// =============================================================================

/**
 * 数据质量综合报告
 */
export interface DataQualityReport {
  /** 报告时间 */
  reportTime: Date;
  /** 准确性指标 */
  accuracy: AccuracyMetrics;
  /** 覆盖率指标 */
  coverage: CoverageMetrics;
  /** 时效性指标 */
  timeliness: TimelinessMetrics;
  /** 总体评分 (0-100) */
  overallScore: number;
  /** 质量等级 */
  qualityLevel: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  /** 需要关注的问题 */
  issues: DataQualityIssue[];
}

/**
 * 数据质量问题
 */
export interface DataQualityIssue {
  /** 问题类型 */
  type: 'ACCURACY' | 'COVERAGE' | 'TIMELINESS';
  /** 严重程度 */
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  /** 问题描述 */
  description: string;
  /** 影响数量 */
  affectedCount: number;
  /** 建议措施 */
  recommendation: string;
}

/**
 * 质量等级
 */
export type QualityLevel = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

/**
 * 严重程度
 */
export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

// =============================================================================
// 监控配置
// =============================================================================

/**
 * 质量监控配置
 */
export interface QualityMonitorConfig {
  /** 准确性监控配置 */
  accuracy: {
    /** 低质量关系阈值（负面反馈率） */
    lowQualityThreshold: number;
    /** 最小反馈数阈值 */
    minFeedbackCount: number;
  };
  /** 覆盖率监控配置 */
  coverage: {
    /** 最低覆盖率目标 */
    minCoverageRate: number;
    /** 最大孤立法条数 */
    maxOrphanArticles: number;
  };
  /** 时效性监控配置 */
  timeliness: {
    /** 过期关系阈值天数 */
    staleThresholdDays: number;
    /** 待审核关系阈值天数 */
    pendingThresholdDays: number;
  };
}

/**
 * 默认质量监控配置
 */
export const DEFAULT_QUALITY_MONITOR_CONFIG: QualityMonitorConfig = {
  accuracy: {
    lowQualityThreshold: 0.5,
    minFeedbackCount: 3,
  },
  coverage: {
    minCoverageRate: 0.8,
    maxOrphanArticles: 100,
  },
  timeliness: {
    staleThresholdDays: 90,
    pendingThresholdDays: 30,
  },
};
