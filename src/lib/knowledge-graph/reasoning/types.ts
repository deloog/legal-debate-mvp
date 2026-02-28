/**
 * 知识图谱推理规则引擎类型定义
 *
 * 功能：支持法条关系的推理和推导
 */

import { RelationType } from '@prisma/client';

/**
 * 推理规则类型
 */
export enum RuleType {
  /** 传递性替代：A替代B，B替代C → A间接替代C */
  TRANSITIVE_SUPERSESSION = 'TRANSITIVE_SUPERSESSION',
  /** 冲突传播：A引用B，B已失效 → 提示引用有效性 */
  CONFLICT_PROPAGATION = 'CONFLICT_PROPAGATION',
  /** 补全关系链：A补全B，B补全C → A间接补全C */
  COMPLETION_CHAIN = 'COMPLETION_CHAIN',
}

/**
 * 推理规则优先级
 */
export enum RulePriority {
  HIGH = 1,
  MEDIUM = 2,
  LOW = 3,
}

/**
 * 推理规则元数据
 */
export interface RuleMetadata {
  /** 规则类型 */
  type: RuleType;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description: string;
  /** 规则优先级 */
  priority: RulePriority;
  /** 是否启用 */
  enabled: boolean;
  /** 适用关系类型 */
  applicableRelationTypes: RelationType[];
}

/**
 * 推理结果
 */
export interface InferenceResult {
  /** 规则类型 */
  ruleType: RuleType;
  /** 源法条ID */
  sourceArticleId: string;
  /** 目标法条ID */
  targetArticleId: string;
  /** 推断出的关系类型 */
  inferredRelation: RelationType;
  /** 置信度（0-1） */
  confidence: number;
  /** 推理路径（中间法条ID） */
  reasoningPath: string[];
  /** 推理说明 */
  explanation: string;
}

/**
 * 推理摘要
 */
export interface InferenceSummary {
  /** 总推断数量 */
  totalInferences: number;
  /** 高置信度推断（confidence >= 0.7） */
  highConfidenceInferences: number;
  /** 中等置信度推断（0.3 <= confidence < 0.7） */
  mediumConfidenceInferences: number;
  /** 低置信度推断（confidence < 0.3） */
  lowConfidenceInferences: number;
  /** 按规则类型分类的推断数量 */
  inferencesByRule: Record<RuleType, number>;
  /** 警告信息 */
  warnings: string[];
}

/**
 * 规则应用结果
 */
export interface RuleApplicationResult {
  /** 规则类型 */
  ruleType: RuleType;
  /** 推断结果列表 */
  inferences: InferenceResult[];
  /** 应用耗时（毫秒） */
  executionTimeMs: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 推理执行结果
 */
export interface ReasoningExecutionResult {
  /** 源法条ID */
  sourceArticleId: string;
  /** 应用的规则类型 */
  appliedRules: RuleType[];
  /** 所有推断结果 */
  inferences: InferenceResult[];
  /** 推理摘要 */
  summary: InferenceSummary;
  /** 总执行时间（毫秒） */
  totalExecutionTimeMs: number;
}

/**
 * 法条关系数据（简化版，用于推理）
 */
export interface ArticleRelation {
  /** 关系ID */
  id: string;
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 关系强度（0-1） */
  strength: number;
  /** 验证状态 */
  verificationStatus: string;
}

/**
 * 法条数据（简化版，用于推理）
 */
export interface ArticleNode {
  /** 法条ID */
  id: string;
  /** 法律名称 */
  lawName: string;
  /** 条文编号 */
  articleNumber: string;
  /** 法条状态 */
  status: string;
  /** 生效日期 */
  effectiveDate?: Date;
}

/**
 * 推理上下文
 */
export interface ReasoningContext {
  /** 法条节点 */
  nodes: Map<string, ArticleNode>;
  /** 法条关系 */
  relations: Map<string, ArticleRelation>;
  /** 源法条ID */
  sourceArticleId: string;
  /** 最大推理深度 */
  maxDepth: number;
  /** 已访问的法条（防止循环） */
  visited: Set<string>;
}

/**
 * 规则执行选项
 */
export interface RuleExecutionOptions {
  /** 最大推理深度（默认5） */
  maxDepth?: number;
  /** 最小置信度阈值（默认0.3） */
  minConfidence?: number;
  /** 是否包含中等置信度结果（默认true） */
  includeMediumConfidence?: boolean;
  /** 是否包含低置信度结果（默认false） */
  includeLowConfidence?: boolean;
}
