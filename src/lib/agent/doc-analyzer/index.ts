/**
 * DocAnalyzer模块主入口
 *
 * 导出DocAnalyzerAgent和相关类型
 */

export { DocAnalyzerAgent } from "./doc-analyzer-agent";

// 导出核心类型
export type { DocumentAnalysisInput } from "./core/types";
export type { DocumentAnalysisOutput } from "./core/types";
export type { ExtractedData } from "./core/types";
export type { Party } from "./core/types";
export type { Claim } from "./core/types";
export type { ClaimType } from "./core/types";
export type { TimelineEvent } from "./core/types";
export type { CaseType } from "./core/types";
export type { AnalysisMetadata } from "./core/types";
export type { AnalysisProcess } from "./core/types";
export type { ValidationResults } from "./core/types";
export type { ReviewResult } from "./core/types";
export type { ReviewIssue } from "./core/types";
export type { ReviewerConfig } from "./core/types";
export type { DocAnalyzerConfig } from "./core/types";

// 导出常量
export {
  DEFAULT_CONFIG,
  CLAIM_TYPE_MAP,
  CLAIM_TYPE_LABELS,
  ERROR_MESSAGES,
} from "./core/constants";

// 导出提取器
export { TextExtractor } from "./extractors/text-extractor";
export { AmountExtractor } from "./extractors/amount-extractor";
export { ClaimExtractor } from "./extractors/claim-extractor";

// 导出处理器
export { AIProcessor } from "./processors/ai-processor";
export { RuleProcessor } from "./processors/rule-processor";
export { CacheProcessor } from "./processors/cache-processor";

// 导出验证器
export { InputValidator, validateInput } from "./validators";

// 导出Reviewers
export { ReviewerManager } from "./reviewers/reviewer-manager";
export type { IReviewer } from "./reviewers/reviewer-manager";
export { AIReviewer } from "./reviewers/ai-reviewer";
export { RuleReviewer } from "./reviewers/rule-reviewer";
