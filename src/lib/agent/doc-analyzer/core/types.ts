/**
 * DocAnalyzer核心类型定义
 * 
 * 文档分析智能体的输入输出类型定义
 */

// =============================================================================
// 输入类型
// =============================================================================

export interface DocumentAnalysisInput {
  documentId: string;
  filePath: string;
  fileType: 'PDF' | 'DOCX' | 'DOC' | 'TXT' | 'IMAGE';
  options?: {
    extractParties?: boolean;
    extractClaims?: boolean;
    extractTimeline?: boolean;
    generateSummary?: boolean;
  };
  content?: string; // 直接提供文本内容（用于测试）
}

export interface DocumentAnalysisOptions {
  extractParties?: boolean;
  extractClaims?: boolean;
  extractTimeline?: boolean;
  extractDisputeFocus?: boolean;
  extractKeyFacts?: boolean;
  generateSummary?: boolean;
}

// =============================================================================
// 输出类型
// =============================================================================

export interface DocumentAnalysisOutput {
  success: boolean;
  extractedData: ExtractedData;
  confidence: number;
  processingTime: number;
  metadata: AnalysisMetadata;
}

export interface ExtractedData {
  parties: Party[];
  claims: Claim[];
  timeline?: TimelineEvent[];
  disputeFocuses?: DisputeFocus[];
  keyFacts?: KeyFact[];
  summary?: string;
  caseType?: CaseType;
}

export interface Party {
  type: 'plaintiff' | 'defendant' | 'other';
  name: string;
  role?: string;
  contact?: string;
  address?: string;
  _inferred?: boolean; // 标记为推断结果
}

export interface Claim {
  type: ClaimType;
  content: string;
  amount?: number;
  currency: string;
  evidence?: string[];
  legalBasis?: string;
  _inferred?: boolean; // 标记为推断结果
}

export type ClaimType =
  | 'PAY_PRINCIPAL'
  | 'PAY_INTEREST'
  | 'PAY_PENALTY'
  | 'PAY_DAMAGES'
  | 'LITIGATION_COST'
  | 'PERFORMANCE'
  | 'TERMINATION'
  | 'OTHER';

export interface TimelineEvent {
  id?: string; // 唯一标识
  date: string;
  event: string;
  description?: string;
  eventType?: TimelineEventType;
  importance?: number; // 1-5，5最重要
  evidence?: string[];
  source?: 'explicit' | 'inferred'; // 明确提到或推断的
}

export type TimelineEventType =
  | 'CONTRACT_SIGNED'
  | 'PERFORMANCE_START'
  | 'BREACH_OCCURRED'
  | 'DEMAND_SENT'
  | 'LAWSUIT_FILED'
  | 'OTHER';

export type CaseType =
  | 'civil'
  | 'criminal'
  | 'administrative'
  | 'commercial'
  | 'labor'
  | 'intellectual'
  | 'other';

// =============================================================================
// 争议焦点类型
// =============================================================================

export interface DisputeFocus {
  id: string; // 唯一标识
  category: DisputeFocusCategory;
  description: string; // 争议焦点描述
  positionA: string; // 原告观点
  positionB: string; // 被告观点
  coreIssue: string; // 核心争议点
  importance: number; // 重要性评分 1-10
  confidence: number; // 置信度 0-1
  relatedClaims: string[]; // 关联的诉讼请求
  relatedFacts: string[]; // 关联的关键事实ID
  evidence?: string[]; // 支持证据
  legalBasis?: string; // 法律依据
  _inferred?: boolean; // 是否推断得到
}

export type DisputeFocusCategory =
  | 'CONTRACT_BREACH'
  | 'PAYMENT_DISPUTE'
  | 'LIABILITY_ISSUE'
  | 'DAMAGES_CALCULATION'
  | 'PERFORMANCE_DISPUTE'
  | 'VALIDITY_ISSUE'
  | 'OTHER';

// =============================================================================
// 关键事实类型
// =============================================================================

export interface KeyFact {
  id: string; // 唯一标识
  category: FactCategory;
  description: string; // 事实描述
  details: string; // 详细说明
  importance: number; // 重要性评分 1-10
  confidence: number; // 置信度 0-1
  evidence?: string[]; // 支持证据
  relatedTimeline?: string[]; // 关联的时间线事件ID
  relatedDisputes: string[]; // 关联的争议焦点ID
  factType: FactType; // 事实类型
  verification?: FactVerification; // 事实验证信息
}

export type FactCategory =
  | 'CONTRACT_TERM'
  | 'PERFORMANCE_ACT'
  | 'BREACH_BEHAVIOR'
  | 'DAMAGE_OCCURRENCE'
  | 'LEGAL_RELATION'
  | 'OTHER';

export type FactType =
  | 'EXPLICIT' // 明确提到的事实
  | 'INFERRED' // 推断得到的事实
  | 'ADMITTED' // 承认的事实
  | 'DISPUTED'; // 争议的事实

export interface FactVerification {
  status: 'VERIFIED' | 'CONTROVERSIAL' | 'UNVERIFIED';
  sources: string[];
  reliability: number; // 可靠性评分 0-1
}

// =============================================================================
// AI响应类型
// =============================================================================

export interface AIAnalysisResponse {
  extractedData: ExtractedData;
  confidence: number;
  tokenUsed: number;
  analysisProcess?: AnalysisProcess;
}

// =============================================================================
// 后处理类型
// =============================================================================

export interface PostProcessingResult {
  data: ExtractedData;
  corrections: Correction[];
  confidenceAdjustment: number;
}

export interface Correction {
  type: 'ADD_CLAIM' | 'ADD_PARTY' | 'FIX_AMOUNT' | 'FIX_ROLE' | 'OTHER';
  description: string;
  originalValue?: any;
  correctedValue?: any;
  rule: string;
}

// =============================================================================
// 审查类型
// =============================================================================

export interface ReviewResult {
  passed: boolean;
  score: number;
  issues: ReviewIssue[];
  corrections: Correction[];
  reviewer: string;
}

export interface ReviewIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  category: string;
  message: string;
  suggestion?: string;
}

export interface ReviewerConfig {
  enabled: boolean;
  threshold: number;
  rules: string[];
}

// =============================================================================
// 配置类型
// =============================================================================

export interface DocAnalyzerConfig {
  aiTimeout: number;
  maxRetries: number;
  maxTextChunkSize: number;
  cacheEnabled: boolean;
  cacheTTL: number;
  maxConcurrentDocuments: number;
  reviewers: {
    aiReviewer: ReviewerConfig;
    ruleReviewer: ReviewerConfig;
    confidenceReviewer: ReviewerConfig;
  };
}

// =============================================================================
// 缓存类型
// =============================================================================

export interface CacheConfig {
  enabled: boolean;
  ttl: number;
  namespace: string;
}

// =============================================================================
// 工具类型
// =============================================================================

export interface TextChunk {
  text: string;
  start: number;
  end: number;
}

export interface ProcessingStats {
  totalTime: number;
  ocrTime: number;
  aiTime: number;
  postProcessingTime: number;
  reviewTime: number;
  cacheHit: boolean;
}

// =============================================================================
// 分析过程类型（新增）
// =============================================================================

export interface AnalysisMetadata {
  pages?: number;
  wordCount?: number;
  fileSize?: number;
  analysisModel: string;
  tokenUsed?: number;
  processingTime?: number;
  analysisProcess?: AnalysisProcess;
}

export interface AnalysisProcess {
  ocrErrors: string[];
  entitiesListed: {
    persons: string[];
    companies: string[];
    amounts: string[];
  };
  roleReasoning: string;
  claimDecomposition: string;
  amountNormalization: string;
  validationResults: ValidationResults;
}

export interface ValidationResults {
  duplicatesFound: string[];
  roleConflicts: string[];
  missingClaims: string[];
  amountInconsistencies: string[];
  timelineGaps?: string[];
  focusConflicts?: string[];
  factInconsistencies?: string[];
}
