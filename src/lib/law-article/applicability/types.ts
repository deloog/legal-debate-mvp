import { LawArticle } from "@prisma/client";
import { DocumentAnalysisOutput } from "@/lib/agent/doc-analyzer/core/types";

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
  /** 是否启用AI语义匹配（默认：true） */
  useAI?: boolean;
  /** 是否启用规则验证（默认：true） */
  useRuleValidation?: boolean;
  /** 是否启用AI审查（默认：true） */
  useAIReview?: boolean;
  /** 语义相关性最小阈值（默认：0.3） */
  minSemanticRelevance?: number;
  /** 最终适用性评分最小阈值（默认：0.5） */
  minApplicabilityScore?: number;
  /** 最低评分直接排除阈值（默认：0.1） */
  minExclusionScore?: number;
  /** AI不适用且评分低时的阈值（默认：0.3） */
  aiLowConfidenceThreshold?: number;
  /** 默认适用性阈值（默认：0.2） */
  defaultApplicabilityThreshold?: number;
  /** 是否并行处理（默认：true） */
  parallel?: boolean;
  /** 是否使用缓存（默认：true） */
  useCache?: boolean;
}

/**
 * 语义匹配结果接口
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
 * 规则验证结果接口
 */
export interface RuleValidationResult {
  /** 是否通过时效性检查 */
  validity: {
    passed: boolean;
    reason?: string;
  };
  /** 是否通过适用范围检查 */
  scope: {
    passed: boolean;
    reason?: string;
  };
  /** 法条层级评分（0-1） */
  levelScore: number;
  /** 综合规则评分（0-1） */
  overallScore: number;
}

/**
 * AI审查结果接口
 */
export interface AIReviewResult {
  /** 是否适用 */
  applicable: boolean;
  /** 审查置信度（0-1） */
  confidence: number;
  /** 适用原因列表 */
  reasons: string[];
  /** 警告信息列表 */
  warnings: string[];
}

/**
 * 法条状态警告接口
 */
export interface StatusWarning {
  /** 警告级别 */
  level: "info" | "warning" | "error";
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
  /** 语义相关性评分 */
  semanticScore: number;
  /** 规则验证评分 */
  ruleScore: number;
  /** AI审查置信度 */
  aiConfidence?: number;
  /** 适用原因列表 */
  reasons: string[];
  /** 警告信息列表 */
  warnings: string[];
  /** 法条状态警告（废止/修订等） */
  statusWarning?: StatusWarning;
  /** 语义匹配详情 */
  semanticMatch?: SemanticMatchResult;
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
  /** 法条适用性结果列表 */
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
  /** 执行耗时（毫秒） */
  executionTime: number;
  /** 语义匹配耗时（毫秒） */
  semanticMatchingTime: number;
  /** 规则验证耗时（毫秒） */
  ruleValidationTime: number;
  /** AI审查耗时（毫秒） */
  aiReviewTime: number;
  /** 适用法条占比 */
  applicableRatio: number;
  /** 按法条类型统计 */
  byType: Record<string, number>;
  /** 按法律分类统计 */
  byCategory: Record<string, number>;
}

/**
 * 默认配置
 */
export const DEFAULT_APPLICABILITY_CONFIG: Required<ApplicabilityConfig> = {
  useAI: true,
  useRuleValidation: true,
  useAIReview: true,
  minSemanticRelevance: 0.3,
  minApplicabilityScore: 0.5,
  minExclusionScore: 0.1,
  aiLowConfidenceThreshold: 0.3,
  defaultApplicabilityThreshold: 0.2,
  parallel: true,
  useCache: true,
};
