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
  options?: DocumentAnalysisOptions;
  content?: string;
}

// =============================================================================
// 输出类型
// =============================================================================

export interface DocumentAnalysisOptions {
  extractParties?: boolean;
  extractClaims?: boolean;
  extractTimeline?: boolean;
  extractDisputeFocus?: boolean;
  extractKeyFacts?: boolean;
  generateSummary?: boolean;
  analyzeEvidence?: boolean;
  comprehensiveAnalysis?: boolean;
}

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
  source?: 'explicit' | 'inferred' | 'TEXT_EXTRACTION' | 'CASE_INFO'; // 证据来源
  type?: TimelineEventType; // 兼容性字段
}

export interface TimelineReport {
  events: TimelineEvent[];
  totalEvents: number;
  dateRange: {
    start: string | null;
    end: string | null;
    duration: number | null;
  };
  averageInterval: number;
  intervals: number[];
}

export type TimelineEventType =
  | 'CONTRACT_SIGNED'
  | 'PERFORMANCE_START'
  | 'BREACH_OCCURRED'
  | 'DEMAND_SENT'
  | 'LAWSUIT_FILED'
  | 'FILING' // 立案
  | 'HEARING' // 开庭
  | 'JUDGMENT' // 判决
  | 'EVIDENCE' // 证据
  | 'DEFENSE' // 答辩
  | 'MEDIATION' // 调解
  | 'SERVICE' // 送达
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
  originalValue?: unknown;
  correctedValue?: unknown;
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
// 分析过程类型
// =============================================================================

export interface AnalysisMetadata {
  pages?: number;
  wordCount?: number;
  fileSize?: number;
  analysisModel: string;
  tokenUsed?: number;
  processingTime?: number;
  analysisProcess?: AnalysisProcess;
  evidenceAnalysis?: EvidenceAnalysisResult;
  comprehensiveAnalysis?: ComprehensiveAnalysisResult;
  warnings?: string[]; // 警告信息数组
  optimizationStages?: OptimizationStageResult[]; // 优化阶段结果
}

// 优化阶段结果类型
export interface OptimizationStageResult {
  stage:
    | 'QUICK_ANALYSIS'
    | 'DEEP_ANALYSIS'
    | 'CROSS_VALIDATION'
    | 'AI_CONFIRMATION';
  success: boolean;
  duration: number;
  confidenceBefore: number;
  confidenceAfter: number;
  issuesFound: number;
  issuesFixed: number;
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

// =============================================================================
// 证据分析类型（新增）
// =============================================================================

export type EvidenceType =
  | 'PHYSICAL_EVIDENCE' // 物证
  | 'DOCUMENTARY_EVIDENCE' // 书证
  | 'WITNESS_TESTIMONY' // 证人证言
  | 'EXPERT_OPINION' // 鉴定意见
  | 'AUDIO_VIDEO_EVIDENCE' // 视听资料
  | 'ELECTRONIC_EVIDENCE' // 电子数据
  | 'OTHER';

export interface ClassifiedEvidence {
  id: string;
  type: EvidenceType;
  content: string;
  source: string; // 证据来源描述
  strength: number; // 1-5，5最强
  reliability: number; // 0-1
  relatedTo: string[]; // 关联的当事人、诉讼请求等ID
}

export interface EvidenceRelation {
  evidenceId: string;
  relatedTo: string;
  relationType: 'SUPPORTS' | 'CONTRADICTS' | 'RELATES_TO';
  strength: number; // 关联强度 0-1
}

export interface EvidenceStrengthReport {
  totalEvidence: number;
  strongEvidence: number; // strength >= 4
  weakEvidence: number; // strength <= 2
  averageStrength: number;
  averageReliability: number;
  byType: Record<EvidenceType, number>;
}

export interface EvidenceAnalysisResult {
  classifiedEvidence: ClassifiedEvidence[];
  evidenceRelations: EvidenceRelation[];
  strengthReport: EvidenceStrengthReport;
  completenessScore: number; // 0-1
  confidence: number; // 0-1
  missingEvidenceTypes: EvidenceType[];
}

// =============================================================================
// 综合分析类型（新增）
// =============================================================================

export interface ConsistencyIssue {
  type:
    | 'PARTY_CLAIM_MISMATCH'
    | 'TIMELINE_DISCREPANCY'
    | 'EVIDENCE_CONTRADICTION'
    | 'LOGIC_GAP';
  severity: 'ERROR' | 'WARNING' | 'INFO';
  description: string;
  affectedItems: string[]; // 相关的当事人ID、时间线事件ID等
  suggestion?: string;
}

export interface ConsistencyReport {
  isConsistent: boolean;
  issues: ConsistencyIssue[];
  score: number; // 0-1
  partyClaimConsistency: number;
  timelineConsistency: number;
  evidenceConsistency: number;
}

export interface CompletenessCheck {
  category: string;
  isComplete: boolean;
  missingItems: string[];
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface CompletenessReport {
  overallComplete: boolean;
  score: number; // 0-1
  checks: CompletenessCheck[];
  partyCompleteness: number;
  timelineCompleteness: number;
  evidenceChainCompleteness: number;
  suggestions: string[];
}

export interface QualityScoreReport {
  overallScore: number; // 0-100
  accuracyScore: number; // 准确性
  completenessScore: number; // 完整性
  consistencyScore: number; // 一致性
  relevanceScore: number; // 相关性
  grade: 'EXCELLENT' | 'GOOD' | 'SATISFACTORY' | 'NEEDS_IMPROVEMENT' | 'POOR';
}

export interface ComprehensiveAnalysisResult {
  consistencyReport: ConsistencyReport;
  completenessReport: CompletenessReport;
  qualityScore: QualityScoreReport;
  suggestions: string[];
  overallConfidence: number; // 0-1
  metadata: {
    analyzedAt: number;
    analysisDuration: number;
    dataSources: string[];
  };
}
