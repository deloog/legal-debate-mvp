/**
 * 风险评估类型定义
 */

// =============================================================================
// 枚举定义
// =============================================================================

/**
 * 风险类型枚举
 */
export enum RiskType {
  LEGAL_PROCEDURE = 'legal_procedure', // 法律程序风险
  EVIDENCE_STRENGTH = 'evidence_strength', // 证据强度风险
  STATUTE_LIMITATION = 'statute_limitation', // 诉讼时效风险
  JURISDICTION = 'jurisdiction', // 管辖权风险
  COST_BENEFIT = 'cost_benefit', // 成本效益风险
  FACT_VERIFICATION = 'fact_verification', // 事实核实风险
  LEGAL_BASIS = 'legal_basis', // 法律依据风险
  CONTRADICTION = 'contradiction', // 矛盾风险
  PROOF_BURDEN = 'proof_burden', // 举证责任风险
}

/**
 * 风险等级枚举
 */
export enum RiskLevel {
  LOW = 'low', // 低风险
  MEDIUM = 'medium', // 中风险
  HIGH = 'high', // 高风险
  CRITICAL = 'critical', // 严重风险
}

/**
 * 风险类别枚举
 */
export enum RiskCategory {
  PROCEDURAL = 'procedural', // 程序风险
  EVIDENTIARY = 'evidentiary', // 证据风险
  SUBSTANTIVE = 'substantive', // 实体风险
  STRATEGIC = 'strategic', // 策略风险
}

/**
 * 建议类型枚举
 */
export enum MitigationSuggestionType {
  GATHER_EVIDENCE = 'gather_evidence', // 收集证据
  AMEND_CLAIM = 'amend_claim', // 修改诉讼请求
  CHANGE_STRATEGY = 'change_strategy', // 改变策略
  ADD_LEGAL_BASIS = 'add_legal_basis', // 增加法律依据
  CONSULT_EXPERT = 'consult_expert', // 咨询专家
  CONSIDER_SETTLEMENT = 'consider_settlement', // 考虑和解
  VERIFY_FACTS = 'verify_facts', // 核实事实
}

/**
 * 建议优先级枚举
 */
export enum SuggestionPriority {
  URGENT = 'urgent', // 紧急
  HIGH = 'high', // 高
  MEDIUM = 'medium', // 中
  LOW = 'low', // 低
}

// =============================================================================
// 接口定义
// =============================================================================

/**
 * 风险识别结果
 */
export interface RiskIdentificationResult {
  id: string;
  riskType: RiskType;
  riskCategory: RiskCategory;
  riskLevel: RiskLevel;
  score: number; // 0-1
  confidence: number; // 0-1
  description: string;
  evidence: string[]; // 支持该风险判断的证据
  suggestions: RiskMitigationSuggestion[];
  metadata?: Record<string, unknown>;
  identifiedAt: Date;
}

/**
 * 风险评分结果
 */
export interface RiskAssessmentResult {
  caseId: string;
  overallRiskLevel: RiskLevel;
  overallRiskScore: number; // 0-1
  risks: RiskIdentificationResult[];
  statistics: RiskStatistics;
  suggestions: RiskMitigationSuggestion[];
  assessmentTime: number; // ms
  assessedAt: Date;
}

/**
 * 风险统计信息
 */
export interface RiskStatistics {
  totalRisks: number;
  byLevel: Record<RiskLevel, number>;
  byCategory: Record<RiskCategory, number>;
  byType: Record<RiskType, number>;
  criticalRisks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
}

/**
 * 风险缓解建议
 */
export interface RiskMitigationSuggestion {
  id: string;
  riskType: RiskType;
  suggestionType: MitigationSuggestionType;
  priority: SuggestionPriority;
  action: string;
  reason: string;
  estimatedImpact: string;
  estimatedEffort: string; // 如：1-2天
}

/**
 * 风险识别输入
 */
export interface RiskIdentificationInput {
  caseId: string;
  caseTitle: string;
  caseType?: string;
  facts: string[]; // 案件事实
  claims?: string[]; // 诉讼请求
  evidence?: Array<{
    name: string;
    type: string;
    description?: string;
  }>;
  legalBasis?: Array<{
    lawName: string;
    articleNumber: string;
  }>;
  parties?: {
    plaintiff?: string;
    defendant?: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * 风险评分配置
 */
export interface RiskScoringConfig {
  weights: {
    procedural: number; // 程序风险权重
    evidentiary: number; // 证据风险权重
    substantive: number; // 实体风险权重
    strategic: number; // 策略风险权重
  };
  thresholds: {
    low: number; // 低风险阈值
    medium: number; // 中风险阈值
    high: number; // 高风险阈值
    critical: number; // 严重风险阈值
  };
}

/**
 * 默认风险评分配置
 */
export const DEFAULT_RISK_SCORING_CONFIG: RiskScoringConfig = {
  weights: {
    procedural: 0.25,
    evidentiary: 0.35,
    substantive: 0.3,
    strategic: 0.1,
  },
  thresholds: {
    low: 0.3,
    medium: 0.5,
    high: 0.7,
    critical: 0.85,
  },
};

// =============================================================================
// 类型守卫函数
// =============================================================================

/**
 * 类型守卫：验证是否为有效的风险类型
 */
export function isValidRiskType(value: unknown): value is RiskType {
  return (
    typeof value === 'string' &&
    Object.values(RiskType).includes(value as RiskType)
  );
}

/**
 * 类型守卫：验证是否为有效的风险等级
 */
export function isValidRiskLevel(value: unknown): value is RiskLevel {
  return (
    typeof value === 'string' &&
    Object.values(RiskLevel).includes(value as RiskLevel)
  );
}

/**
 * 类型守卫：验证是否为有效的风险类别
 */
export function isValidRiskCategory(value: unknown): value is RiskCategory {
  return (
    typeof value === 'string' &&
    Object.values(RiskCategory).includes(value as RiskCategory)
  );
}

/**
 * 类型守卫：验证风险识别输入
 */
export function isValidRiskIdentificationInput(
  data: unknown
): data is RiskIdentificationInput {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const input = data as Record<string, unknown>;

  if (typeof input.caseId !== 'string' || !input.caseId) {
    return false;
  }

  if (typeof input.caseTitle !== 'string' || !input.caseTitle) {
    return false;
  }

  if (!Array.isArray(input.facts)) {
    return false;
  }

  return true;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 获取风险类型的中文名称
 */
export function getRiskTypeLabel(type: RiskType): string {
  const labels: Record<RiskType, string> = {
    [RiskType.LEGAL_PROCEDURE]: '法律程序风险',
    [RiskType.EVIDENCE_STRENGTH]: '证据强度风险',
    [RiskType.STATUTE_LIMITATION]: '诉讼时效风险',
    [RiskType.JURISDICTION]: '管辖权风险',
    [RiskType.COST_BENEFIT]: '成本效益风险',
    [RiskType.FACT_VERIFICATION]: '事实核实风险',
    [RiskType.LEGAL_BASIS]: '法律依据风险',
    [RiskType.CONTRADICTION]: '矛盾风险',
    [RiskType.PROOF_BURDEN]: '举证责任风险',
  };
  return labels[type] || '未知';
}

/**
 * 获取风险等级的中文名称
 */
export function getRiskLevelLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    [RiskLevel.LOW]: '低风险',
    [RiskLevel.MEDIUM]: '中风险',
    [RiskLevel.HIGH]: '高风险',
    [RiskLevel.CRITICAL]: '严重风险',
  };
  return labels[level] || '未知';
}

/**
 * 获取风险等级的颜色
 */
export function getRiskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    [RiskLevel.LOW]: '#22c55e', // 绿色
    [RiskLevel.MEDIUM]: '#f59e0b', // 橙色
    [RiskLevel.HIGH]: '#f97316', // 橙红色
    [RiskLevel.CRITICAL]: '#dc2626', // 红色
  };
  return colors[level] || '#6c757d';
}

/**
 * 获取风险类别的中文名称
 */
export function getRiskCategoryLabel(category: RiskCategory): string {
  const labels: Record<RiskCategory, string> = {
    [RiskCategory.PROCEDURAL]: '程序风险',
    [RiskCategory.EVIDENTIARY]: '证据风险',
    [RiskCategory.SUBSTANTIVE]: '实体风险',
    [RiskCategory.STRATEGIC]: '策略风险',
  };
  return labels[category] || '未知';
}

/**
 * 获取建议类型的中文名称
 */
export function getSuggestionTypeLabel(type: MitigationSuggestionType): string {
  const labels: Record<MitigationSuggestionType, string> = {
    [MitigationSuggestionType.GATHER_EVIDENCE]: '收集证据',
    [MitigationSuggestionType.AMEND_CLAIM]: '修改诉讼请求',
    [MitigationSuggestionType.CHANGE_STRATEGY]: '改变策略',
    [MitigationSuggestionType.ADD_LEGAL_BASIS]: '增加法律依据',
    [MitigationSuggestionType.CONSULT_EXPERT]: '咨询专家',
    [MitigationSuggestionType.CONSIDER_SETTLEMENT]: '考虑和解',
    [MitigationSuggestionType.VERIFY_FACTS]: '核实事实',
  };
  return labels[type] || '未知';
}

/**
 * 根据分数计算风险等级
 */
export function calculateRiskLevel(
  score: number,
  config: RiskScoringConfig = DEFAULT_RISK_SCORING_CONFIG
): RiskLevel {
  if (score >= config.thresholds.critical) {
    return RiskLevel.CRITICAL;
  }
  if (score >= config.thresholds.high) {
    return RiskLevel.HIGH;
  }
  if (score >= config.thresholds.medium) {
    return RiskLevel.MEDIUM;
  }
  return RiskLevel.LOW;
}

/**
 * 生成风险ID
 */
export function generateRiskId(): string {
  return `risk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 生成建议ID
 */
export function generateSuggestionId(): string {
  return `suggestion_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 格式化风险数据用于展示
 */
export function formatRiskForDisplay(
  risk: RiskIdentificationResult
): Record<string, unknown> {
  return {
    id: risk.id,
    type: getRiskTypeLabel(risk.riskType),
    category: getRiskCategoryLabel(risk.riskCategory),
    level: getRiskLevelLabel(risk.riskLevel),
    levelColor: getRiskLevelColor(risk.riskLevel),
    score: (risk.score * 100).toFixed(1),
    confidence: (risk.confidence * 100).toFixed(1),
    description: risk.description,
    evidence: risk.evidence,
    suggestionCount: risk.suggestions.length,
    identifiedAt: risk.identifiedAt,
  };
}
