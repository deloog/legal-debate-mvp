/**
 * 法条适用性分析模块
 *
 * 五层架构：
 * - Layer 1: AI语义匹配
 * - Layer 2: 规则验证
 * - Layer 3: AI审查
 */

// 导出类型定义
export type {
  ApplicabilityInput,
  ApplicabilityConfig,
  SemanticMatchResult,
  RuleValidationResult,
  AIReviewResult,
  ArticleApplicabilityResult,
  ApplicabilityAnalysisReport,
  AnalysisStatistics,
} from "./types";

export { DEFAULT_APPLICABILITY_CONFIG } from "./types";

// 导出分析器和各层组件
export { ApplicabilityAnalyzer } from "./applicability-analyzer";
export { SemanticMatcher } from "./semantic-matcher";
export { RuleValidator } from "./rule-validator";
export { AIReviewer } from "./ai-reviewer";

export { default } from "./applicability-analyzer";
