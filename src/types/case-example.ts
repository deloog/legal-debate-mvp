import { CaseExample, CaseType, CaseResult } from '@prisma/client';

/**
 * 案例库类型扩展
 */

/**
 * 导出 Prisma 生成的 CaseExample 类型
 */
export type { CaseExample };

/**
 * 创建案例输入接口
 */
export interface CreateCaseExampleInput {
  title: string;
  caseNumber: string;
  court: string;
  type: CaseType;
  cause?: string;
  facts: string;
  judgment: string;
  result: CaseResult;
  judgmentDate: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 更新案例输入接口
 */
export interface UpdateCaseExampleInput {
  title?: string;
  caseNumber?: string;
  court?: string;
  type?: CaseType;
  cause?: string;
  facts?: string;
  judgment?: string;
  result?: CaseResult;
  judgmentDate?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * 案例查询参数接口
 */
export interface CaseExampleQueryParams {
  type?: CaseType;
  cause?: string;
  result?: CaseResult;
  court?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: 'judgmentDate' | 'createdAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

/**
 * 案例列表响应接口
 */
export interface CaseExampleListResponse {
  examples: CaseExample[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 案例统计信息接口
 */
export interface CaseExampleStatistics {
  total: number;
  byType: Record<CaseType, number>;
  byResult: Record<CaseResult, number>;
  byCourt: Record<string, number>;
  byCause: Record<string, number>;
  winRate: number;
}

/**
 * 案例结果标签映射
 */
export const CASE_RESULT_LABELS: Record<CaseResult, string> = {
  [CaseResult.WIN]: '胜诉',
  [CaseResult.LOSE]: '败诉',
  [CaseResult.PARTIAL]: '部分胜诉',
  [CaseResult.WITHDRAW]: '撤诉',
};

/**
 * 获取案例结果标签
 */
export function getCaseResultLabel(result: CaseResult): string {
  return CASE_RESULT_LABELS[result] || result;
}

/**
 * 类型守卫：验证是否为有效的CaseResult
 */
export function isValidCaseResult(value: string): value is CaseResult {
  return Object.values(CaseResult).includes(value as CaseResult);
}

/**
 * 扩展的CaseExample类型，包含embedding字段
 */
export type CaseExampleWithEmbedding = CaseExample & {
  embedding?: number[] | null;
};

/**
 * 导出Prisma生成的CaseExample类型别名
 */
export type PrismaCaseExample = CaseExample;

/**
 * 导出Prisma生成的CaseExample类型
 */
export type CaseExampleExported = CaseExample;

/**
 * 相似案例匹配结果接口
 */
export interface SimilarCaseMatch {
  caseExample: PrismaCaseExample;
  similarity: number;
  matchingFactors: string[];
}

/**
 * 相似度检索参数接口
 */
export interface SimilaritySearchParams {
  caseId: string;
  topK?: number;
  threshold?: number;
  includeEmbedding?: boolean;
  caseType?: CaseType;
  result?: CaseResult;
  startDate?: Date;
  endDate?: Date;
}

/**
 * 相似度检索结果接口
 */
export interface SimilaritySearchResult {
  caseId: string;
  matches: SimilarCaseMatch[];
  totalMatches: number;
  searchTime: number;
  metadata?: {
    algorithm: string;
    vectorDimension: number;
    casesSearched: number;
  };
}

/**
 * 相似度计算方法
 */
export enum SimilarityMethod {
  COSINE = 'cosine',
  EUCLIDEAN = 'euclidean',
  DOT_PRODUCT = 'dot_product',
}

/**
 * 相似度检索配置接口
 */
export interface SimilaritySearchConfig {
  method: SimilarityMethod;
  topK: number;
  threshold: number;
  normalizeVectors: boolean;
  cacheEnabled: boolean;
  maxCacheSize: number;
}

/**
 * 批量相似度计算请求接口
 */
export interface BatchSimilarityRequest {
  caseId: string;
  targetIds: string[];
  method?: SimilarityMethod;
  normalizeVectors?: boolean;
}

/**
 * 批量相似度计算结果接口
 */
export interface BatchSimilarityResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    id: string;
    similarity: number;
    error?: string;
  }>;
}

/**
 * 胜败率分析结果接口
 */
export interface SuccessRateAnalysis {
  caseId: string;
  winRate: number;
  winProbability: number;
  confidence: number;
  similarCasesCount: number;
  winCasesCount: number;
  loseCasesCount: number;
  partialCasesCount: number;
  withdrawCasesCount: number;
  analysis: {
    trend: 'increasing' | 'decreasing' | 'stable';
    recommendation: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

/**
 * 胜败率分析参数接口
 */
export interface SuccessRateAnalysisParams {
  caseId: string;
  minSimilarity?: number;
  maxCases?: number;
  includePartial?: boolean;
  includeWithdraw?: boolean;
}
