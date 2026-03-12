import { LawArticle } from '@prisma/client';
import { DocumentAnalysisOutput } from '@/lib/agent/doc-analyzer/core/types';

/**
 * 适用性分析输入接口
 */
export interface ApplicabilityInput {
  /** 案情分析结果（来自DocAnalyzer） */
  caseInfo: DocumentAnalysisOutput;
  /** 检索到的法条列表（来自本地+外部检索） */
  articles: LawArticle[];
  /** 分析配置选项 */
  config?: ApplicabilityConfig;
}

/**
 * 适用性分析配置接口
 */
export interface ApplicabilityConfig {
  /** 是否启用AI分析（默认：true） */
  useAI?: boolean;
  /** 是否启用规则验证（hard filter，始终启用，此字段保留兼容性） */
  useRuleValidation?: boolean;
  /** 是否启用AI审查（与useAI含义相同，保留兼容性） */
  useAIReview?: boolean;
  /** 最终适用性评分最小阈值（默认：0.5） */
  minApplicabilityScore?: number;
  /** 语义相关性最小阈值（兼容性，新版由 minApplicabilityScore 统一控制） */
  minSemanticRelevance?: number;
  /** AI并发数量（默认：5） */
  concurrency?: number;
  /** 是否并行处理（兼容性，新版始终并行） */
  parallel?: boolean;
  /** 是否使用缓存（预留） */
  useCache?: boolean;
  /** 最低评分直接排除阈值（兼容性） */
  minExclusionScore?: number;
  /** AI不适用且评分低时的阈值（兼容性） */
  aiLowConfidenceThreshold?: number;
  /** 默认适用性阈值（兼容性） */
  defaultApplicabilityThreshold?: number;
}

/**
 * 规则验证结果接口（Phase 0 硬性过滤结果）
 */
export interface RuleValidationResult {
  /** 是否通过硬性过滤 */
  passed: boolean;
  /** 不通过的原因（未通过时必填） */
  reason?: string;
  /** 警告信息列表（通过但有潜在风险时填写，如已修订） */
  warnings: string[];
}

/**
 * AI分析结果接口（Phase 1 单次 AI 调用返回）
 */
export interface AIReviewResult {
  /** 是否适用 */
  applicable: boolean;
  /** 综合适用性评分（0-1） */
  score: number;
  /** 审查置信度（0-1） */
  confidence: number;
  /** 适用原因列表 */
  reasons: string[];
  /** 警告信息列表 */
  warnings: string[];
}

/**
 * 语义匹配结果接口（保留兼容性）
 */
export interface SemanticMatchResult {
  /** 语义相关性评分（0-1） */
  semanticRelevance: number;
  /** 相关性理由 */
  relevanceReason?: string;
  /** 关键词匹配列表 */
  matchedKeywords?: string[];
}

/**
 * 法条状态警告接口
 */
export interface StatusWarning {
  /** 警告级别 */
  level: 'info' | 'warning' | 'error';
  /** 警告消息 */
  message: string;
}

/**
 * 单条法条适用性结果接口
 */
export interface ArticleApplicabilityResult {
  /** 法条ID */
  articleId: string;
  /** 法条编号 */
  articleNumber: string;
  /** 法律名称 */
  lawName: string;
  /** 是否适用 */
  applicable: boolean;
  /** 适用性综合评分（0-1） */
  score: number;
  /** 语义相关性评分（新版中为AI综合评分） */
  semanticScore: number;
  /** 规则评分（通过硬性过滤为1.0，未通过为0） */
  ruleScore: number;
  /** AI审查置信度 */
  aiConfidence?: number;
  /** 适用原因列表 */
  reasons: string[];
  /** 警告信息列表 */
  warnings: string[];
  /** 法条状态警告（废止/修订等，保留兼容性） */
  statusWarning?: StatusWarning;
  /** 规则验证详情 */
  ruleValidation?: RuleValidationResult;
}

/**
 * 适用性分析报告接口
 */
export interface ApplicabilityAnalysisReport {
  /** 分析时间 */
  analyzedAt: Date;
  /** 总法条数 */
  totalArticles: number;
  /** 适用法条数 */
  applicableArticles: number;
  /** 不适用法条数 */
  notApplicableArticles: number;
  /** 法条适用性结果列表（按评分降序排列） */
  results: ArticleApplicabilityResult[];
  /** 分析统计信息 */
  statistics: AnalysisStatistics;
  /** 分析配置 */
  config: Required<ApplicabilityConfig>;
}

/**
 * 分析统计信息接口
 */
export interface AnalysisStatistics {
  /** 平均适用性评分 */
  averageScore: number;
  /** 最高适用性评分 */
  maxScore: number;
  /** 最低适用性评分 */
  minScore: number;
  /** 总执行耗时（毫秒） */
  executionTime: number;
  /** Phase 0 硬性过滤耗时（毫秒） */
  ruleValidationTime: number;
  /** Phase 1 AI分析耗时（毫秒，含并行等待） */
  semanticMatchingTime: number;
  /** 保留兼容性，始终为0 */
  aiReviewTime: number;
  /** 适用法条占比 */
  applicableRatio: number;
  /** 按法条类型统计适用数量 */
  byType: Record<string, number>;
  /** 按法律分类统计适用数量 */
  byCategory: Record<string, number>;
}

/**
 * 默认配置
 */
export const DEFAULT_APPLICABILITY_CONFIG: Required<ApplicabilityConfig> = {
  useAI: true,
  useRuleValidation: true,
  useAIReview: true,
  minApplicabilityScore: 0.5,
  minSemanticRelevance: 0.3,
  concurrency: 5,
  parallel: true,
  useCache: false,
  minExclusionScore: 0.1,
  aiLowConfidenceThreshold: 0.3,
  defaultApplicabilityThreshold: 0.2,
};
