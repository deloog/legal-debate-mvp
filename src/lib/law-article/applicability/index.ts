/**
 * 法条适用性分析模块
 *
 * 两阶段架构：
 * - Phase 0: RuleValidator — 硬性过滤（已废止/草案/未生效/已过期）
 * - Phase 1: AIReviewer   — 单次 AI 调用，语义相关性 + 适用性判断（并行）
 */

// 导出类型定义
export type {
  ApplicabilityInput,
  ApplicabilityConfig,
  RuleValidationResult,
  AIReviewResult,
  SemanticMatchResult,
  ArticleApplicabilityResult,
  ApplicabilityAnalysisReport,
  AnalysisStatistics,
} from './types';

export { DEFAULT_APPLICABILITY_CONFIG } from './types';

// 导出分析器和各层组件
export { ApplicabilityAnalyzer } from './applicability-analyzer';
export { RuleValidator } from './rule-validator';
export { AIReviewer } from './ai-reviewer';

export { default } from './applicability-analyzer';
