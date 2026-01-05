/**
 * LegalAgent - 法律智能代理
 *
 * 导出所有法律智能代理相关的类和类型
 */

// 导出主类
export { LegalAgent } from "./legal-agent";

// 导出子模块
export { LawSearcher } from "./law-searcher";
export { ApplicabilityAnalyzer } from "./applicability-analyzer";
export { ArgumentGenerator } from "./argument-generator";
export { LegalReasoner } from "./legal-reasoner";

// 导出类型
export type {
  LegalQuery,
  LawArticle,
  SearchResult,
  ApplicabilityAnalysisInput,
  ApplicabilityResult,
  SemanticMatchResult,
  RuleValidationResult,
  AIReviewResult,
  LegalBasis,
  Argument,
  ArgumentGenerationResult,
  ArgumentSide,
  ArgumentType,
  Fact,
  ReasoningStep,
  ReasoningChain,
  LogicValidationResult,
  LegalAgentConfig,
} from "./types";

// 导出默认配置
export { DEFAULT_LEGAL_AGENT_CONFIG } from "./types";
