// =============================================================================
// 知识图谱质量评分系统 - 类型定义
// =============================================================================

import { Prisma } from '@prisma/client';

/**
 * 质量等级
 */
export type QualityLevel = 'low' | 'medium' | 'high' | 'excellent';

/**
 * 质量等级的中文描述
 */
export const QualityLevelLabels: Record<QualityLevel, string> = {
  low: '低质量',
  medium: '中等质量',
  high: '高质量',
  excellent: '优秀质量',
};

/**
 * 质量评分输入数据
 */
export interface QualityScoreInput {
  aiConfidence?: number | null;
  verificationCount: number;
  positiveFeedback: number;
  negativeFeedback: number;
}

/**
 * 评分因子（各维度的原始分数）
 */
export interface ScoreFactors {
  aiScore: number; // AI置信度分数 0-1
  verificationScore: number; // 验证次数分数 0-1
  feedbackScore: number; // 用户反馂数值 0-1
}

/**
 * 质量评分结果
 */
export interface QualityScoreResult {
  qualityScore: number; // 综合质量分数 0-100
  qualityLevel: QualityLevel; // 质量等级
  factors: ScoreFactors; // 各维度分数
}

/**
 * 质量评分权重配置
 */
export interface QualityScoreWeights {
  ai: number; // AI置信度权重
  verification: number; // 验证次数权重
  feedback: number; // 用户反馈权重
}

/**
 * 默认评分权重
 */
export const DefaultQualityScoreWeights: QualityScoreWeights = {
  ai: 0.3,
  verification: 0.2,
  feedback: 0.5,
};

/**
 * 关系质量分数数据
 */
export interface RelationQualityData {
  relationId: string;
  aiConfidence?: number | null;
  verificationCount: number;
  positiveFeedback: number;
  negativeFeedback: number;
  qualityScore: number;
  qualityLevel: QualityLevel;
}

/**
 * 批量质量评分输入
 */
export interface BatchQualityScoreInput {
  relationIds: string[];
  calculateForces?: boolean; // 是否强制重新计算（忽略已有分数）
}

/**
 * 质量统计结果
 */
export interface QualityStats {
  totalRelations: number;
  excellentCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  averageScore: number;
  scoreDistribution: Record<QualityLevel, number>;
}

/**
 * 低质量关系查询参数
 */
export interface LowQualityRelationsInput {
  qualityLevel?: QualityLevel; // 筛选特定质量等级
  minScore?: number; // 最低分数
  maxScore?: number; // 最高分数
  limit?: number; // 返回数量限制
  offset?: number; // 分页偏移
  sortBy?: 'score' | 'createdAt'; // 排序字段
  sortOrder?: 'asc' | 'desc'; // 排序方向
}

/**
 * 低质量关系项
 */
export interface LowQualityRelation {
  id: string;
  relationId: string;
  sourceArticleId: string;
  sourceArticleName: string;
  sourceArticleNumber: string;
  targetArticleId: string;
  targetArticleName: string;
  targetArticleNumber: string;
  relationType: string;
  qualityScore: number;
  qualityLevel: QualityLevel;
  factors: ScoreFactors;
  createdAt: Date;
  lastCalculatedAt: Date;
}

/**
 * 更新质量分数输入
 */
export interface UpdateQualityScoreInput {
  relationId: string;
  incrementVerification?: boolean; // 是否增加验证次数
  addPositiveFeedback?: boolean; // 是否增加正面反馈
  addNegativeFeedback?: boolean; // 是否增加负面反馈
  forceRecalculate?: boolean; // 是否强制重新计算
}

/**
 * 质量预警信息
 */
export interface QualityWarning {
  relationId: string;
  warningType: 'LOW_QUALITY' | 'QUALITY_DECLINED' | 'HIGH_NEGATIVE_FEEDBACK';
  message: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  currentScore: number;
  previousScore?: number;
  timestamp: Date;
}

/**
 * Prisma 知识图谱质量评分数据类型
 */
export type KnowledgeGraphQualityScoreData =
  Prisma.KnowledgeGraphQualityScoreGetPayload<{
    include: {
      relation: {
        include: {
          source: true;
          target: true;
        };
      };
    };
  }>;

/**
 * Prisma 关系数据类型
 */
export type RelationData = Prisma.LawArticleRelationGetPayload<{
  include: {
    qualityScore: true;
    feedbacks: true;
    aiFeedbacks: true;
  };
}>;

/**
 * 质量分数阈值配置
 */
export interface QualityScoreThresholds {
  excellent: number; // 优秀阈值
  high: number; // 高质量阈值
  medium: number; // 中等质量阈值
  low: number; // 低质量阈值
}

/**
 * 默认质量分数阈值
 */
export const DefaultQualityScoreThresholds: QualityScoreThresholds = {
  excellent: 90,
  high: 75,
  medium: 60,
  low: 0,
};
