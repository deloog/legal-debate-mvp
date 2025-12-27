/**
 * StrategistAgent - 类型定义
 * 
 * 定义策略生成相关的所有类型和接口
 */

import type { AgentContext } from '../../../types/agent';

// =============================================================================
// 策略生成输入类型
// =============================================================================

/**
 * 当事人信息
 */
export interface PartyInfo {
  name: string;
  role: 'plaintiff' | 'defendant';
  representative?: string;
}

/**
 * 案件基本信息
 */
export interface CaseInfo {
  caseType: string;
  parties: PartyInfo[];
  claims: string[];
  facts: string[];
  caseTypeCode?: string;
}

/**
 * 法条分析结果
 */
export interface LegalAnalysis {
  applicableLaws: Array<{
    law: string;
    relevance: number;
    article?: string;
  }>;
  precedents?: Array<{
    case: string;
    similarity: number;
    outcome?: string;
  }>;
}

/**
 * 案件上下文
 */
export interface CaseContext {
  jurisdiction: string;
  courtLevel: string;
  complexity: 'simple' | 'medium' | 'complex';
  estimatedDuration?: string;
}

/**
 * 策略生成输入
 */
export interface StrategyInput {
  caseInfo: CaseInfo;
  legalAnalysis: LegalAnalysis;
  context?: CaseContext;
}

// =============================================================================
// 策略生成输出类型
// =============================================================================

/**
 * SWOT分析
 */
export interface SWOTAnalysis {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

/**
 * 策略建议
 */
export interface StrategyRecommendation {
  strategy: string;
  rationale: string;
  implementationSteps: string[];
  expectedOutcome: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * 风险因素
 */
export interface RiskFactor {
  factor: string;
  impact: 'low' | 'medium' | 'high';
  probability: number;
  mitigation: string;
}

/**
 * 风险评估
 */
export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  confidence: number;
  riskFactors: RiskFactor[];
}

/**
 * 策略生成输出
 */
export interface StrategyOutput {
  success: boolean;
  swotAnalysis: SWOTAnalysis;
  strategyRecommendations: StrategyRecommendation[];
  riskAssessment: RiskAssessment;
  processingTime?: number;
  confidence?: number;
}

// =============================================================================
// AI策略生成中间类型
// =============================================================================

/**
 * AI策略生成响应
 */
export interface AIStrategyResponse {
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  strategies: Array<{
    strategy: string;
    rationale: string;
    implementationSteps: string[];
    expectedOutcome: string;
  }>;
  risks: Array<{
    factor: string;
    impact: 'low' | 'medium' | 'high';
    probability: number;
    mitigation: string;
  }>;
}

// =============================================================================
// 规则验证类型
// =============================================================================

/**
 * 规则验证结果
 */
export interface RuleValidationResult {
  valid: boolean;
  violations: string[];
  warnings: string[];
  suggestions: string[];
}

// =============================================================================
// 风险评估配置
// =============================================================================

/**
 * 风险评估配置
 */
export interface RiskAssessmentConfig {
  confidenceThreshold: number;
  highRiskThreshold: number;
  mediumRiskThreshold: number;
  enableDetailedAnalysis: boolean;
}
