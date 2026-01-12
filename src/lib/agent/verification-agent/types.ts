// 验证Agent类型定义

/**
 * 验证结果接口
 */
export interface VerificationResult {
  overallScore: number; // 综合评分 (0-1)
  factualAccuracy: number; // 事实准确性评分 (0-1)
  logicalConsistency: number; // 逻辑一致性评分 (0-1)
  taskCompleteness: number; // 任务完成度评分 (0-1)
  passed: boolean; // 是否通过验证 (threshold >= 0.90)
  issues: VerificationIssue[]; // 发现的问题列表
  suggestions: VerificationSuggestion[]; // 改进建议列表
  verificationTime: number; // 验证耗时 (ms)
  metadata?: Record<string, unknown>; // 额外的元数据
}

/**
 * 验证问题接口
 */
export interface VerificationIssue {
  id: string; // 问题ID
  type: IssueType; // 问题类型
  severity: IssueSeverity; // 严重程度
  category: IssueCategory; // 问题类别
  field?: string; // 涉及的字段
  message: string; // 问题描述
  suggestion?: string; // 建议解决方案
  detectedBy: string; // 检测来源 (factual/logical/completeness)
}

/**
 * 验证建议接口
 */
export interface VerificationSuggestion {
  id: string; // 建议ID
  type: SuggestionType; // 建议类型
  priority: SuggestionPriority; // 优先级
  target?: string; // 目标字段或功能
  action: string; // 具体行动建议
  reason: string; // 建议原因
  estimatedImpact: string; // 预期影响
}

/**
 * 事实验证结果接口
 */
export interface FactualVerificationResult {
  score: number; // 事实准确性评分 (0-1)
  passed: boolean; // 是否通过
  details: {
    partyCheck: PartyVerification; // 当事人信息验证
    amountCheck: AmountVerification; // 金额数据验证
    dateCheck: DateVerification; // 日期时间验证
    consistencyCheck: ConsistencyVerification; // 数据一致性验证
  };
}

/**
 * 逻辑验证结果接口
 */
export interface LogicalVerificationResult {
  score: number; // 逻辑一致性评分 (0-1)
  passed: boolean; // 是否通过
  details: {
    claimFactMatch: number; // 诉讼请求与事实匹配度 (0-1)
    reasoningChain: ReasoningChainCheck; // 推理链完整性检查
    legalLogic: LegalLogicCheck; // 法条引用逻辑性检查
    contradictions: ContradictionCheck; // 矛盾检测
  };
}

/**
 * 完成度验证结果接口
 */
export interface CompletenessVerificationResult {
  score: number; // 任务完成度评分 (0-1)
  passed: boolean; // 是否通过
  details: {
    requiredFields: RequiredFieldsCheck; // 必填字段完整性
    businessRules: BusinessRulesCheck; // 业务规则符合性
    formatCheck: FormatCheck; // 输出格式正确性
    qualityCheck: QualityThresholdCheck; // 质量阈值检查
  };
}

/**
 * 当事人信息验证
 */
export interface PartyVerification {
  passed: boolean; // 是否通过
  details: {
    plaintiffValid: boolean; // 原告信息有效
    defendantValid: boolean; // 被告信息有效
    rolesMatch: boolean; // 角色匹配正确
  };
  issues: string[]; // 发现的问题
}

/**
 * 金额数据验证
 */
export interface AmountVerification {
  passed: boolean; // 是否通过
  details: {
    formatValid: boolean; // 格式正确
    rangeValid: boolean; // 数值合理
    unitValid: boolean; // 单位正确
    currencyValid: boolean; // 货币正确
  };
  issues: string[]; // 发现的问题
}

/**
 * 日期时间验证
 */
export interface DateVerification {
  passed: boolean; // 是否通过
  details: {
    formatValid: boolean; // 格式正确
    logicalValid: boolean; // 逻辑合理
    chronologicalValid: boolean; // 时间顺序正确
  };
  issues: string[]; // 发现的问题
}

/**
 * 数据一致性验证
 */
export interface ConsistencyVerification {
  passed: boolean; // 是否通过
  details: {
    dataConsistent: boolean; // 数据一致
    noConflicts: boolean; // 无冲突
    matchesSource: boolean; // 与源数据匹配
  };
  issues: string[]; // 发现的问题
}

/**
 * 推理链完整性检查
 */
export interface ReasoningChainCheck {
  score: number; // 评分 (0-1)
  steps: number; // 推理步骤数
  gaps: string[]; // 推理缺口
  loops: string[]; // 循环推理
}

/**
 * 法条引用逻辑性检查
 */
export interface LegalLogicCheck {
  score: number; // 评分 (0-1)
  valid: boolean; // 引用有效
  relevant: boolean; // 引用相关
  hierarchy: string; // 层级关系 (law > regulation > rule)
}

/**
 * 矛盾检测
 */
export interface ContradictionCheck {
  hasContradictions: boolean; // 是否有矛盾
  contradictions: Contradiction[]; // 矛盾列表
}

/**
 * 矛盾详情
 */
export interface Contradiction {
  id: string; // 矛盾ID
  type: ContradictionType; // 矛盾类型
  description: string; // 描述
  statements: string[]; // 矛盾的陈述
  severity: IssueSeverity; // 严重程度
}

/**
 * 必填字段完整性检查
 */
export interface RequiredFieldsCheck {
  totalFields: number;
  filledFields: number;
  missingFields: string[];
  score: number;
  passed: boolean;
}

/**
 * 业务规则符合性检查
 */
export interface BusinessRulesCheck {
  passed: boolean; // 是否通过
  violatedRules: string[]; // 违反的规则列表
  warnings: string[]; // 警告信息
}

/**
 * 输出格式正确性检查
 */
export interface FormatCheck {
  passed: boolean; // 是否通过
  formatErrors: FormatError[]; // 格式错误列表
  formatWarnings: FormatError[]; // 格式警告列表
}

/**
 * 格式错误
 */
export interface FormatError {
  field: string; // 字段名
  error: string; // 错误描述
  expected: string; // 期望格式
  actual: string; // 实际值
}

/**
 * 质量阈值检查
 */
export interface QualityThresholdCheck {
  score: number;
  thresholds: Record<
    string,
    { actual: number; threshold: number; passed: boolean }
  >;
  passed: boolean;
}

/**
 * 问题类型枚举
 */
export enum IssueType {
  MISSING_DATA = 'missing_data',
  INCORRECT_DATA = 'incorrect_data',
  INCONSISTENT_DATA = 'inconsistent_data',
  LOGICAL_ERROR = 'logical_error',
  FORMAT_ERROR = 'format_error',
  VALIDATION_ERROR = 'validation_error',
  BUSINESS_RULE_VIOLATION = 'business_rule_violation',
  QUALITY_BELOW_THRESHOLD = 'quality_below_threshold',
  CONTRADICTION = 'contradiction',
  AMBIGUITY = 'ambiguity',
}

/**
 * 问题严重程度
 */
export enum IssueSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 问题类别
 */
export enum IssueCategory {
  FACTUAL = 'factual',
  LOGICAL = 'logical',
  COMPLETENESS = 'completeness',
  FORMAT = 'format',
  QUALITY = 'quality',
}

/**
 * 建议类型
 */
export enum SuggestionType {
  DATA_COMPLETION = 'data_completion',
  DATA_CORRECTION = 'data_correction',
  LOGIC_IMPROVEMENT = 'logic_improvement',
  FORMAT_STANDARDIZATION = 'format_standardization',
  VALIDATION_ENHANCEMENT = 'validation_enhancement',
  RISK_MITIGATION = 'risk_mitigation',
}

/**
 * 建议优先级
 */
export enum SuggestionPriority {
  URGENT = 'urgent',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 矛盾类型
 */
export enum ContradictionType {
  FACTUAL = 'factual',
  LOGICAL = 'logical',
  TEMPORAL = 'temporal',
  CAUSAL = 'causal',
  LEGAL = 'legal',
}

/**
 * 验证配置
 */
export interface VerificationConfig {
  thresholds: {
    factual: number; // 事实准确性阈值 (默认 0.85)
    logical: number; // 逻辑一致性阈值 (默认 0.80)
    completeness: number; // 任务完成度阈值 (默认 0.90)
    overall: number; // 综合评分阈值 (默认 0.90)
  };
  weights: {
    factual: number; // 事实准确性权重 (默认 0.40)
    logical: number; // 逻辑一致性权重 (默认 0.35)
    completeness: number; // 任务完成度权重 (默认 0.25)
  };
  aiSettings: {
    enabled: boolean; // 是否启用AI辅助
    provider: string; // AI提供商
    timeout: number; // 超时时间 (ms)
  };
}

/**
 * 默认验证配置
 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  thresholds: {
    factual: 0.85,
    logical: 0.8,
    completeness: 0.9,
    overall: 0.9,
  },
  weights: {
    factual: 0.4,
    logical: 0.35,
    completeness: 0.25,
  },
  aiSettings: {
    enabled: true,
    provider: 'zhipu',
    timeout: 30000,
  },
};
