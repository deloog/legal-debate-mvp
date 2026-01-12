/**
 * Mock文档分析器
 *
 * 当AI服务失败时，提供降级的Mock数据
 * 用于保证系统的可用性和基本功能
 */

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 文档分析结果
 */
export interface DocAnalysisResult {
  document_type: string;
  case_number: string;
  case_title: string;
  parties: Party[];
  legal_representatives: LegalRepresentative[];
  claims: string[];
  causes_of_action: string[];
  key_facts: string[];
  core_disputes: string[];
  procedural_history: string[];
  litigation_status: string;
  court_name: string;
  trial_date: string | null;
  relevant_laws: string[];
  analysis_confidence: number;
  raw_response: string;
  metadata: AnalysisMetadata;
}

/**
 * 当事人
 */
export interface Party {
  type: 'plaintiff' | 'defendant' | 'third_party';
  name: string;
  role: string;
}

/**
 * 诉讼代理人
 */
export interface LegalRepresentative {
  name: string;
  role: 'lawyer' | 'legal_representative';
  organization?: string;
}

/**
 * 分析元数据
 */
export interface AnalysisMetadata {
  processing_time: number;
  model_used: string;
  timestamp: string;
  fallback_used?: boolean;
}

// =============================================================================
// Mock数据生成
// =============================================================================

/**
 * 生成默认的Mock文档分析结果
 *
 * @returns Mock分析结果
 */
export function fallbackDocAnalysis(): DocAnalysisResult {
  console.warn('[Mock] 使用Mock文档分析结果');

  return {
    document_type: 'unknown',
    case_number: '',
    case_title: '',
    parties: [],
    legal_representatives: [],
    claims: [],
    causes_of_action: [],
    key_facts: [],
    core_disputes: [],
    procedural_history: [],
    litigation_status: '',
    court_name: '',
    trial_date: null,
    relevant_laws: [],
    analysis_confidence: 0,
    raw_response: '',
    metadata: {
      processing_time: 0,
      model_used: 'mock',
      timestamp: new Date().toISOString(),
      fallback_used: true,
    },
  };
}

/**
 * 验证Mock结果的有效性
 *
 * @param result - 待验证的结果
 * @returns 是否有效
 */
export function validateMockResult(
  result: unknown
): result is DocAnalysisResult {
  if (!result || typeof result !== 'object') {
    return false;
  }

  const typedResult = result as Partial<DocAnalysisResult>;

  // 检查必需的字段
  const requiredFields: Array<keyof DocAnalysisResult> = [
    'document_type',
    'case_number',
    'case_title',
    'parties',
    'legal_representatives',
    'claims',
    'causes_of_action',
    'key_facts',
    'core_disputes',
    'procedural_history',
    'litigation_status',
    'court_name',
    'trial_date',
    'relevant_laws',
    'analysis_confidence',
    'raw_response',
    'metadata',
  ];

  for (const field of requiredFields) {
    if (!(field in typedResult)) {
      console.error(`[Mock] 缺少必需字段: ${field}`);
      return false;
    }
  }

  // 验证metadata
  if (!typedResult.metadata || typeof typedResult.metadata !== 'object') {
    console.error('[Mock] metadata格式错误');
    return false;
  }

  // 验证数据类型
  if (
    !Array.isArray(typedResult.parties) ||
    !Array.isArray(typedResult.legal_representatives) ||
    !Array.isArray(typedResult.claims) ||
    !Array.isArray(typedResult.causes_of_action) ||
    !Array.isArray(typedResult.key_facts) ||
    !Array.isArray(typedResult.core_disputes) ||
    !Array.isArray(typedResult.procedural_history) ||
    !Array.isArray(typedResult.relevant_laws)
  ) {
    console.error('[Mock] 数组字段类型错误');
    return false;
  }

  if (typeof typedResult.analysis_confidence !== 'number') {
    console.error('[Mock] analysis_confidence应为数字类型');
    return false;
  }

  if (typeof typedResult.raw_response !== 'string') {
    console.error('[Mock] raw_response应为字符串类型');
    return false;
  }

  return true;
}

/**
 * 创建带有基本信息的Mock结果
 *
 * @param partial - 部分结果数据
 * @returns 完整的Mock结果
 */
export function createMockResult(
  partial: Partial<DocAnalysisResult> = {}
): DocAnalysisResult {
  const baseResult = {
    document_type: 'unknown',
    case_number: '',
    case_title: '',
    parties: [],
    legal_representatives: [],
    claims: [],
    causes_of_action: [],
    key_facts: [],
    core_disputes: [],
    procedural_history: [],
    litigation_status: '',
    court_name: '',
    trial_date: null,
    relevant_laws: [],
    analysis_confidence: 0,
    raw_response: '',
    metadata: {
      processing_time: 0,
      model_used: 'mock',
      timestamp: new Date().toISOString(),
      fallback_used: true,
    },
  } satisfies DocAnalysisResult;

  return {
    ...baseResult,
    ...partial,
    metadata: {
      ...baseResult.metadata,
      ...(partial.metadata || {}),
    },
  };
}

/**
 * 生成Mock当事人
 *
 * @param name - 当事人名称
 * @param type - 当事人类型
 * @returns Mock当事人
 */
export function createMockParty(
  name: string,
  type: 'plaintiff' | 'defendant' | 'third_party' = 'defendant'
): Party {
  const role =
    type === 'plaintiff' ? '原告' : type === 'defendant' ? '被告' : '第三人';

  return {
    name,
    type,
    role,
  };
}

/**
 * 生成Mock诉讼代理人
 *
 * @param name - 代理人姓名
 * @param role - 代理人角色
 * @returns Mock诉讼代理人
 */
export function createMockLegalRepresentative(
  name: string,
  role: 'lawyer' | 'legal_representative' = 'lawyer'
): LegalRepresentative {
  return {
    name,
    role,
    organization: '',
  };
}

// =============================================================================
// 默认导出
// =============================================================================

export const mockDocAnalyzer = {
  fallbackDocAnalysis,
  validateMockResult,
  createMockResult,
  createMockParty,
  createMockLegalRepresentative,
};
