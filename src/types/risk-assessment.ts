/**
 * 风险评估模块类型定义
 * 用于企业法务风险评估功能
 */

import type {
  RiskType,
  RiskLevel,
  RiskCategory,
  RiskIdentificationResult,
  RiskMitigationSuggestion,
} from './risk';

// =============================================================================
// 风险评估表单类型
// =============================================================================

/**
 * 风险评估表单数据
 */
export interface RiskAssessmentFormData {
  caseId: string;
  caseTitle: string;
  caseType: string;
  caseDescription: string;
  parties: {
    plaintiff: string;
    defendant: string;
  };
  facts: string[];
  claims: string[];
  evidence: Array<{
    id: string;
    name: string;
    type: string;
    description: string;
  }>;
  legalBasis: Array<{
    id: string;
    lawName: string;
    articleNumber: string;
    content: string;
  }>;
}

// =============================================================================
// 风险评估结果类型
// =============================================================================

/**
 * 风险评估结果
 */
export interface RiskAssessmentResult {
  id: string;
  caseId: string;
  caseTitle: string;
  assessedAt: Date;
  assessmentTime: number; // 毫秒

  // 总体评估
  overallRiskLevel: RiskLevel;
  overallRiskScore: number; // 0-100
  winProbability: number; // 胜诉概率 0-100

  // 风险详情
  risks: RiskIdentificationResult[];

  // 统计信息
  statistics: RiskStatistics;

  // 建议
  suggestions: RiskMitigationSuggestion[];

  // 时间线
  timeline: RiskTimelineItem[];
}

/**
 * 风险统计信息
 */
export interface RiskStatistics {
  totalRisks: number;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  byCategory: Record<RiskCategory, number>;
  byType: Record<RiskType, number>;
}

/**
 * 风险时间线项
 */
export interface RiskTimelineItem {
  id: string;
  date: Date;
  title: string;
  description: string;
  riskLevel: RiskLevel;
  relatedRiskIds: string[];
}

// =============================================================================
// 风险图表数据类型
// =============================================================================

/**
 * 风险分布图表数据
 */
export interface RiskDistributionChartData {
  byLevel: Array<{
    level: RiskLevel;
    count: number;
    percentage: number;
  }>;
  byCategory: Array<{
    category: RiskCategory;
    count: number;
    percentage: number;
  }>;
  byType: Array<{
    type: RiskType;
    count: number;
    percentage: number;
  }>;
}

/**
 * 风险趋势图表数据
 */
export interface RiskTrendChartData {
  dates: string[];
  criticalRisks: number[];
  highRisks: number[];
  mediumRisks: number[];
  lowRisks: number[];
}

// =============================================================================
// API 请求和响应类型
// =============================================================================

/**
 * 风险评估请求
 */
export interface RiskAssessmentRequest {
  formData: RiskAssessmentFormData;
}

/**
 * 风险评估响应
 */
export interface RiskAssessmentResponse {
  success: boolean;
  data?: RiskAssessmentResult;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 风险评估历史项
 */
export interface RiskAssessmentHistoryItem {
  id: string;
  caseId: string;
  caseTitle: string;
  assessedAt: Date;
  overallRiskLevel: RiskLevel;
  overallRiskScore: number;
  totalRisks: number;
  criticalRisks: number;
}

/**
 * 风险评估历史响应
 */
export interface RiskAssessmentHistoryResponse {
  success: boolean;
  data?: {
    items: RiskAssessmentHistoryItem[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// =============================================================================
// 类型守卫函数
// =============================================================================

/**
 * 验证风险评估表单数据
 */
export function isValidRiskAssessmentFormData(
  data: unknown
): data is RiskAssessmentFormData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const form = data as Record<string, unknown>;

  // 验证必填字段
  if (typeof form.caseId !== 'string' || !form.caseId) {
    return false;
  }

  if (typeof form.caseTitle !== 'string' || !form.caseTitle) {
    return false;
  }

  if (typeof form.caseType !== 'string' || !form.caseType) {
    return false;
  }

  if (typeof form.caseDescription !== 'string' || !form.caseDescription) {
    return false;
  }

  // 验证当事人
  if (!form.parties || typeof form.parties !== 'object') {
    return false;
  }

  const parties = form.parties as Record<string, unknown>;
  if (
    typeof parties.plaintiff !== 'string' ||
    typeof parties.defendant !== 'string'
  ) {
    return false;
  }

  // 验证数组字段
  if (!Array.isArray(form.facts) || form.facts.length === 0) {
    return false;
  }

  if (!Array.isArray(form.claims) || form.claims.length === 0) {
    return false;
  }

  if (!Array.isArray(form.evidence)) {
    return false;
  }

  if (!Array.isArray(form.legalBasis)) {
    return false;
  }

  return true;
}
