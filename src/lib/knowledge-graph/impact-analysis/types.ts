/**
 * 知识图谱动态更新 - 影响分析类型定义
 * 当法条被修改或废止时，分析受影响的关系并提供处理建议
 */

import { RelationType, VerificationStatus } from '@prisma/client';

/**
 * 变更类型
 */
export enum ChangeType {
  /** 法条被修改 */
  AMENDED = 'amended',
  /** 法条被废止 */
  REPEALED = 'repealed',
}

/**
 * 影响状态
 */
export enum ImpactStatus {
  /** 无影响 */
  NONE = 'none',
  /** 可能失效 */
  POTENTIALLY_INVALID = 'potentially_invalid',
  /** 需要重新审查 */
  NEEDS_REVIEW = 'needs_review',
  /** 受影响但仍然有效 */
  AFFECTED = 'affected',
}

/**
 * 建议操作类型
 */
export enum RecommendationAction {
  /** 标记为失效 */
  MARK_AS_INVALID = 'mark_as_invalid',
  /** 请求重新审核 */
  REQUEST_REVIEW = 'request_review',
  /** 自动验证 */
  AUTO_VERIFY = 'auto_verify',
  /** 无需操作 */
  NO_ACTION = 'no_action',
}

/**
 * 受影响的关系
 */
export interface ImpactedRelation {
  /** 关系ID */
  relationId: string;
  /** 源法条ID */
  sourceId: string;
  /** 源法条名称 */
  sourceLawName: string;
  /** 源法条编号 */
  sourceArticleNumber: string;
  /** 目标法条ID */
  targetId: string;
  /** 目标法条名称 */
  targetLawName: string;
  /** 目标法条编号 */
  targetArticleNumber: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 影响状态 */
  impactStatus: ImpactStatus;
  /** 当前验证状态 */
  verificationStatus: VerificationStatus;
  /** 关系强度 */
  strength: number;
  /** 置信度 */
  confidence: number;
  /** 发现方法 */
  discoveryMethod: string;
}

/**
 * 影响处理建议
 */
export interface ImpactRecommendation {
  /** 建议ID */
  recommendationId: string;
  /** 关系ID */
  relationId: string;
  /** 建议操作 */
  action: RecommendationAction;
  /** 建议原因 */
  reason: string;
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 估计影响范围 */
  impactScope: string;
  /** 是否需要人工确认 */
  requiresHumanConfirmation: boolean;
}

/**
 * 影响分析输入
 */
export interface ImpactAnalysisInput {
  /** 法条ID */
  lawArticleId: string;
  /** 变更类型 */
  changeType: ChangeType;
  /** 分析深度（查询几度关系） */
  depth?: number;
  /** 是否包含间接影响 */
  includeIndirect?: boolean;
}

/**
 * 影响分析结果
 */
export interface ImpactAnalysisResult {
  /** 分析的法条ID */
  articleId: string;
  /** 法条名称 */
  articleName: string;
  /** 法条编号 */
  articleNumber: string;
  /** 变更类型 */
  changeType: ChangeType;
  /** 受影响的关系列表 */
  impactedRelations: ImpactedRelation[];
  /** 处理建议列表 */
  recommendations: ImpactRecommendation[];
  /** 统计信息 */
  statistics: ImpactStatistics;
  /** 分析时间 */
  analyzedAt: string;
}

/**
 * 影响统计
 */
export interface ImpactStatistics {
  /** 总受影响关系数 */
  totalImpacted: number;
  /** 按影响状态分组 */
  byImpactStatus: Partial<Record<ImpactStatus, number>>;
  /** 按关系类型分组 */
  byRelationType: Partial<Record<RelationType, number>>;
  /** 高优先级建议数 */
  highPriorityCount: number;
  /** 中优先级建议数 */
  mediumPriorityCount: number;
  /** 低优先级建议数 */
  lowPriorityCount: number;
}

/**
 * 关系更新输入
 */
export interface RelationUpdateInput {
  /** 关系ID */
  relationId: string;
  /** 新的验证状态 */
  verificationStatus?: VerificationStatus;
  /** 影响状态 */
  impactStatus?: ImpactStatus;
  /** 拒绝原因 */
  rejectionReason?: string;
  /** 审核人ID */
  verifiedBy?: string;
  /** 审核备注 */
  reviewComment?: string;
}

/**
 * 批量更新结果
 */
export interface BatchUpdateResult {
  /** 成功更新的数量 */
  successCount: number;
  /** 失败的数量 */
  failedCount: number;
  /** 更新结果列表 */
  results: Array<{
    relationId: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * 影响分析配置
 */
export interface ImpactAnalysisConfig {
  /** 默认分析深度 */
  defaultDepth: number;
  /** 高影响关系阈值（受影响关系数） */
  highImpactThreshold: number;
  /** 中影响关系阈值 */
  mediumImpactThreshold: number;
  /** 是否启用自动验证 */
  enableAutoVerify: boolean;
  /** 自动验证的条件 */
  autoVerifyConditions: {
    /** 最小置信度 */
    minConfidence: number;
    /** 最小强度 */
    minStrength: number;
    /** 必须已验证 */
    mustBeVerified: boolean;
  };
}
