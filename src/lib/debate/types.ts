// 类型定义：辩论生成系统

/**
 * 辩论输入信息
 */
export interface DebateInput {
  // 案件信息
  caseInfo: {
    title: string;
    description: string;
    caseType: string;
    parties: {
      plaintiff: string;
      defendant: string;
    };
    claims: string[];
    facts: string[];
  };

  // 相关法条
  lawArticles: Array<{
    lawName: string;
    articleNumber: string;
    content: string;
    category?: string;
  }>;

  // 配置选项
  config?: {
    temperature?: number;
    maxTokens?: number;
    includeLegalAnalysis?: boolean;
    balanceStrictness?: 'low' | 'medium' | 'high';
  };
}

/**
 * 论点结构
 */
export interface Argument {
  // 基础信息
  id: string;
  side: 'plaintiff' | 'defendant';
  type: 'main_point' | 'supporting' | 'rebuttal' | 'evidence' | 'conclusion';

  // 论点内容
  content: string;
  reasoning: string; // 推理逻辑
  legalBasis: Array<{
    lawName: string;
    articleNumber: string;
    relevance: number; // 相关性评分 0-1
    explanation: string; // 法条如何支持论点
  }>;

  // 质量指标
  logicScore: number; // 逻辑清晰度 0-10
  legalAccuracyScore: number; // 法律准确性 0-10
  overallScore: number; // 综合评分 0-10

  // 生成信息
  generatedBy: 'ai' | 'rule';
  aiProvider?: 'zhipu' | 'deepseek';
  generationTime: number;

  // 扩展字段（用于存储验证数据等）
  metadata?: Record<string, unknown>;
}

/**
 * 辩论结果
 */
export interface DebateResult {
  // 基本信息
  id: string;
  input: DebateInput;
  generatedAt: string;

  // 双方论点
  plaintiffArguments: Argument[];
  defendantArguments: Argument[];

  // 质量评估
  qualityMetrics: {
    // 整体评分
    overallQuality: number; // 0-10

    // 各维度评分
    logicClarity: number; // 逻辑清晰度 0-10
    legalAccuracy: number; // 法律依据准确性 0-10
    balanceScore: number; // 正反方平衡度 0-10

    // 详细分析
    argumentCount: {
      plaintiff: number;
      defendant: number;
    };
    averageScores: {
      plaintiffLogic: number;
      plaintiffLegal: number;
      defendantLogic: number;
      defendantLegal: number;
    };
  };

  // 生成统计
  generationStats: {
    totalGenerationTime: number;
    averageArgumentTime: number;
    argumentCount: number;
    aiProvider: string;
  };
}

/**
 * 质量评估结果
 */
export interface QualityAssessment {
  passed: boolean;
  overallScore: number;
  metrics: {
    logicClarity: {
      score: number;
      details: string[];
    };
    legalAccuracy: {
      score: number;
      details: string[];
    };
    balance: {
      score: number;
      details: string[];
    };
  };
  suggestions: string[];
}

/**
 * 验证结果
 */
export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
  warnings: string[];
}

/**
 * Prompt选项
 */
export interface PromptOptions {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  includeExamples?: boolean;
}

/**
 * 辩论生成配置
 */
export interface DebateGenerationConfig {
  aiProvider: 'zhipu' | 'deepseek';
  temperature: number;
  maxTokens: number;
  balanceStrictness: 'low' | 'medium' | 'high';
  includeLegalAnalysis: boolean;
  enableReview: boolean;
  /**
   * 辩论模式
   * - fast: 快速模式，减少论点数量，缩短推理长度
   * - standard: 标准模式，平衡生成质量和速度
   * - detailed: 详细模式，增加论点数量，深化推理
   */
  debateMode: 'fast' | 'standard' | 'detailed';
}

/**
 * 辩论模式参数配置
 */
export interface DebateModeConfig {
  mainPointCount: number;
  supportingPointCount: number;
  rebuttalCount: number;
  reasoningLengthFactor: number;
  legalBasisFactor: number;
}

/**
 * 默认配置
 */
export const DEFAULT_DEBATE_CONFIG: DebateGenerationConfig = {
  aiProvider: 'deepseek',
  temperature: 0.7,
  maxTokens: 2000,
  balanceStrictness: 'medium',
  includeLegalAnalysis: true,
  enableReview: true,
  debateMode: 'standard',
};

/**
 * 辩论模式参数映射
 */
export const DEBATE_MODE_PARAMS: Record<
  'fast' | 'standard' | 'detailed',
  DebateModeConfig
> = {
  fast: {
    mainPointCount: 2,
    supportingPointCount: 1,
    rebuttalCount: 1,
    reasoningLengthFactor: 0.6,
    legalBasisFactor: 0.5,
  },
  standard: {
    mainPointCount: 3,
    supportingPointCount: 2,
    rebuttalCount: 2,
    reasoningLengthFactor: 1.0,
    legalBasisFactor: 1.0,
  },
  detailed: {
    mainPointCount: 4,
    supportingPointCount: 3,
    rebuttalCount: 3,
    reasoningLengthFactor: 1.5,
    legalBasisFactor: 1.3,
  },
};
