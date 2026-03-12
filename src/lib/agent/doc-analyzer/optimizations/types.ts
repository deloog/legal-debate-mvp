/**
 * 准确率优化器类型定义
 *
 * 定义多阶段分析优化所需的所有类型
 */

import type {
  Party,
  Claim,
  TimelineEvent,
  DocumentAnalysisOutput,
} from '../core/types';

// =============================================================================
// 输入类型
// =============================================================================

export interface DocumentInput {
  documentId: string;
  content: string;
  fileType?: string;
}

// =============================================================================
// 快速分析结果
// =============================================================================

export interface QuickAnalysisResult {
  parties: Party[];
  claims: Claim[];
  amounts: ExtractedAmount[];
  keyDates: string[];
  confidence: number;
}

export interface ExtractedAmount {
  value: number;
  currency: string;
  context: string;
  position: number;
}

// =============================================================================
// 深度分析结果
// =============================================================================

export interface DeepAnalysisResult extends QuickAnalysisResult {
  facts: ExtractedFact[];
  detailedClaims: DetailedClaim[];
  timeline: TimelineEvent[];
}

export interface ExtractedFact {
  id: string;
  content: string;
  category: FactCategory;
  confidence: number;
  evidence: string[];
}

export type FactCategory =
  | 'CONTRACT_TERM'
  | 'PERFORMANCE_ACT'
  | 'BREACH_BEHAVIOR'
  | 'DAMAGE_OCCURRENCE'
  | 'LEGAL_RELATION'
  | 'OTHER';

export interface DetailedClaim extends Claim {
  extractionMethod: 'AI' | 'RULE' | 'HYBRID';
  relatedFacts: string[];
  legalBasisDetails: LegalBasisDetail[];
}

export interface LegalBasisDetail {
  lawName: string;
  articleNumber: string;
  relevance: number;
}

// =============================================================================
// 验证结果
// =============================================================================

export interface ValidationIssue {
  type: ValidationIssueType;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  field: string;
  message: string;
  suggestion?: string;
  originalValue?: unknown;
  suggestedValue?: unknown;
}

export type ValidationIssueType =
  | 'PARTY_INCONSISTENCY'
  | 'AMOUNT_MISMATCH'
  | 'DATE_CONFLICT'
  | 'CLAIM_DUPLICATE'
  | 'MISSING_REQUIRED'
  | 'LOGIC_ERROR'
  | 'FORMAT_ERROR';

export interface ValidatedResult extends DeepAnalysisResult {
  validation: {
    issues: ValidationIssue[];
    score: number;
    isValid: boolean;
  };
}

// =============================================================================
// AI确认结果
// =============================================================================

export interface UncertainItem {
  id: string;
  type: 'PARTY' | 'CLAIM' | 'AMOUNT' | 'DATE' | 'FACT';
  value: unknown;
  confidence: number;
  reason: string;
}

export interface AIConfirmation {
  itemId: string;
  confirmed: boolean;
  correctedValue?: unknown;
  explanation: string;
}

// =============================================================================
// 优化配置
// =============================================================================

export interface AccuracyOptimizerConfig {
  enableQuickAnalysis: boolean;
  enableDeepAnalysis: boolean;
  enableCrossValidation: boolean;
  enableAIConfirmation: boolean;
  confidenceThreshold: number;
  validationThreshold: number;
  maxRetries: number;
  timeout: number;
}

export const DEFAULT_OPTIMIZER_CONFIG: AccuracyOptimizerConfig = {
  enableQuickAnalysis: true,
  enableDeepAnalysis: true,
  enableCrossValidation: true,
  enableAIConfirmation: true,
  confidenceThreshold: 0.7,
  validationThreshold: 0.8,
  maxRetries: 2,
  timeout: 30000,
};

// =============================================================================
// 优化结果
// =============================================================================

export interface OptimizationResult {
  output: DocumentAnalysisOutput;
  stages: StageResult[];
  totalTime: number;
  improvementScore: number;
}

export interface StageResult {
  stage: OptimizationStage;
  success: boolean;
  duration: number;
  confidenceBefore: number;
  confidenceAfter: number;
  issuesFound: number;
  issuesFixed: number;
}

export type OptimizationStage =
  | 'QUICK_ANALYSIS'
  | 'DEEP_ANALYSIS'
  | 'CROSS_VALIDATION'
  | 'AI_CONFIRMATION';

// =============================================================================
// 验证器接口
// =============================================================================

export interface AccuracyValidatorInterface {
  validateParties(
    content: string,
    parties: Party[]
  ): Promise<ValidationIssue[]>;
  validateAmounts(
    content: string,
    amounts: ExtractedAmount[]
  ): Promise<ValidationIssue[]>;
  validateDates(content: string, dates: string[]): Promise<ValidationIssue[]>;
  validateClaims(content: string, claims: Claim[]): Promise<ValidationIssue[]>;
  calculateValidationScore(issues: ValidationIssue[]): number;
}
