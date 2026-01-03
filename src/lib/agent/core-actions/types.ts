/**
 * 核心原子函数类型定义
 * 基于Manus智能体架构理念
 * 分层行动空间：Core Layer -> Utility Layer -> Script Layer
 */

import { MemoryType } from "@prisma/client";

// =============================================================================
// 核心层类型（Core Layer - 18个原子函数）
// =============================================================================

/**
 * 文本分析结果
 */
export interface TextAnalysisResult {
  text: string;
  language: string;
  length: number;
  wordCount: number;
  lineCount: number;
  containsChinese: boolean;
  containsNumbers: boolean;
  keyPhrases: string[];
}

/**
 * 实体提取结果
 */
export interface ExtractedEntity {
  text: string;
  type: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
}

/**
 * 实体提取结果
 */
export interface EntityExtractionResult {
  entities: ExtractedEntity[];
  totalEntities: number;
  entitiesByType: Record<string, ExtractedEntity[]>;
}

/**
 * 内容分类结果
 */
export interface ClassificationResult {
  category: string;
  confidence: number;
  alternativeCategories: Array<{ category: string; confidence: number }>;
}

/**
 * 数据库检索参数
 */
export interface DatabaseSearchParams {
  table: string;
  query?: string;
  filters?: Record<string, unknown>;
  orderBy?: string;
  orderDirection?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

/**
 * 数据库检索结果
 */
export interface DatabaseSearchResult<T = unknown> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  executionTime: number;
}

/**
 * AI服务调用参数
 */
export interface AIServiceCallParams {
  prompt: string;
  provider: "deepseek" | "zhipu" | "openai";
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  systemPrompt?: string;
}

/**
 * AI服务调用结果
 */
export interface AIServiceCallResult {
  success: boolean;
  response: string;
  tokensUsed?: number;
  model: string;
  executionTime: number;
  error?: string;
}

/**
 * 数据验证规则
 */
export interface ValidationRule {
  field: string;
  type: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: unknown) => boolean;
}

/**
 * 数据验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{ field: string; message: string }>;
  warnings: string[];
}

/**
 * 格式转换参数
 */
export interface FormatTransformParams {
  sourceFormat: string;
  targetFormat: string;
  data: unknown;
}

/**
 * 格式转换结果
 */
export interface FormatTransformResult {
  success: boolean;
  data: unknown;
  warnings: string[];
}

/**
 * 缓存结果
 */
export interface CacheResult {
  success: boolean;
  cached: boolean;
  hit?: boolean;
  ttl?: number;
}

/**
 * 行动记录参数
 */
export interface LogActionParams {
  actionType: string;
  actionName: string;
  agentName?: string;
  input?: unknown;
  output?: unknown;
  status: "success" | "failure" | "partial";
  executionTime?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 行动记录结果
 */
export interface LogActionResult {
  success: boolean;
  recordId?: string;
  error?: string;
}

/**
 * 输出验证参数
 */
export interface VerifyOutputParams {
  output: unknown;
  validationCriteria: unknown;
  source?: unknown;
}

/**
 * 输出验证结果
 */
export interface VerifyOutputResult {
  valid: boolean;
  score: number;
  issues: Array<{ type: string; message: string; severity: string }>;
  passed: boolean;
}

/**
 * 错误处理参数
 */
export interface HandleErrorParams {
  error: Error;
  context?: unknown;
  agentName?: string;
  actionName?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 错误处理结果
 */
export interface HandleErrorResult {
  handled: boolean;
  errorId?: string;
  actionTaken: string;
  recovered: boolean;
  retryable: boolean;
}

/**
 * 重试操作参数
 */
export interface RetryOperationParams {
  operation: () => Promise<unknown>;
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error) => boolean;
}

/**
 * 重试操作结果
 */
export interface RetryOperationResult<T = unknown> {
  success: boolean;
  result?: T;
  attempts: number;
  executionTime: number;
  error?: Error;
}

/**
 * 结果合并参数
 */
export interface MergeResultsParams<T = unknown> {
  results: T[][];
  deduplicate?: boolean;
  keySelector?: (item: T) => string;
  sortKey?: keyof T;
}

/**
 * 结果合并结果
 */
export interface MergeResultsResult<T = unknown> {
  merged: T[];
  totalItems: number;
  duplicatesRemoved: number;
}

/**
 * 数据过滤参数
 */
export interface FilterDataParams<T = unknown> {
  data: T[];
  filterFn: (item: T) => boolean;
  options?: {
    maxResults?: number;
    offset?: number;
  };
}

/**
 * 数据过滤结果
 */
export interface FilterDataResult<T = unknown> {
  filtered: T[];
  totalMatched: number;
  returnedCount: number;
}

/**
 * 项目排序参数
 */
export interface RankItemsParams<T = unknown> {
  items: T[];
  scoreFn: (item: T) => number;
  order?: "asc" | "desc";
}

/**
 * 项目排序结果
 */
export interface RankItemsResult<T = unknown> {
  ranked: T[];
  scores: number[];
  minScore: number;
  maxScore: number;
}

/**
 * 摘要生成参数
 */
export interface GenerateSummaryParams {
  content: string;
  maxLength?: number;
  targetRatio?: number;
  preserveKeyInfo?: boolean;
}

/**
 * 摘要生成结果
 */
export interface GenerateSummaryResult {
  summary: string;
  originalLength: number;
  summaryLength: number;
  compressionRatio: number;
  keyPoints: string[];
}

/**
 * 版本对比参数
 */
export interface CompareVersionsParams<T = unknown> {
  versionA: T;
  versionB: T;
  compareFields?: (keyof T)[];
}

/**
 * 版本对比结果
 */
export interface CompareVersionsResult<T = unknown> {
  hasDifferences: boolean;
  differences: Array<{
    field: keyof T;
    valueA: unknown;
    valueB: unknown;
    changeType: "added" | "removed" | "modified";
  }>;
  versionA: T;
  versionB: T;
}

/**
 * 记忆更新参数
 */
export interface UpdateMemoryParams {
  memoryType: MemoryType;
  memoryKey: string;
  memoryValue: unknown;
  importance?: number;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

/**
 * 记忆更新结果
 */
export interface UpdateMemoryResult {
  success: boolean;
  memoryId?: string;
  action: "created" | "updated";
  compressed?: boolean;
  compressionRatio?: number;
}

// =============================================================================
// 实用层类型（Utility Layer - 组合函数）
// =============================================================================

/**
 * 文档解析参数
 */
export interface ParseDocumentParams {
  content: string;
  fileName?: string;
  options?: {
    extractEntities?: boolean;
    classifyContent?: boolean;
    extractTimeline?: boolean;
  };
}

/**
 * 文档解析结果
 */
export interface ParseDocumentResult {
  analysis: TextAnalysisResult;
  entities?: EntityExtractionResult;
  classification?: ClassificationResult;
  timeline?: Array<{ date: string; event: string }>;
}

/**
 * 法律检索参数
 */
export interface SearchLawsParams {
  query: string;
  category?: string;
  limit?: number;
  useCache?: boolean;
}

/**
 * 法律检索结果
 */
export interface SearchLawsResult {
  articles: Array<{
    id: string;
    title: string;
    content: string;
    category: string;
    relevanceScore: number;
  }>;
  totalResults: number;
  cached: boolean;
}

/**
 * 论点生成参数
 */
export interface GenerateArgumentParams {
  caseInfo: unknown;
  side: "plaintiff" | "defendant";
  legalBasis?: unknown;
}

/**
 * 论点生成结果
 */
export interface GenerateArgumentResult {
  argument: string;
  supportingPoints: string[];
  legalReferences: string[];
  confidence: number;
}

// =============================================================================
// 脚本层类型（Script Layer - 复杂操作）
// =============================================================================

/**
 * AI流式生成结果
 */
export interface AIStreamGenerator {
  generate: () => AsyncGenerator<string>;
  cancel: () => void;
}

/**
 * 数据库批量查询参数
 */
export interface BatchQueryParams {
  queries: DatabaseSearchParams[];
  maxConcurrency?: number;
}

/**
 * 数据库批量查询结果
 */
export interface BatchQueryResult<T = unknown> {
  results: Array<{
    query: Record<string, unknown>;
    data: T[];
    error?: Error;
  }>;
  successCount: number;
  failureCount: number;
  totalExecutionTime: number;
}

/**
 * 外部API调用参数
 */
export interface ExternalAPIParams {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  retryConfig?: RetryOperationParams;
}

/**
 * 外部API调用结果
 */
export interface ExternalAPIResult<T = unknown> {
  success: boolean;
  data?: T;
  statusCode?: number;
  executionTime: number;
  error?: string;
}

// =============================================================================
// 统一类型导出
// =============================================================================

/**
 * 原子函数配置
 */
export interface CoreActionConfig {
  enableLogging?: boolean;
  enableCache?: boolean;
  enableRetry?: boolean;
  timeout?: number;
  metadata?: Record<string, unknown>;
}
