/**
 * 逻辑推理规则库
 *
 * 功能：
 * 1. 定义14种逻辑连接词（因此、由于、基于、鉴于、综上等）
 * 2. 定义5种因果关系模式（直接因果、间接因果、条件因果、排除因果、复合因果）
 * 3. 定义3种推理类型（演绎推理、归纳推理、类比推理）
 * 4. 提供推理深度计算函数
 */

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 逻辑连接词类型
 */
export type ConnectorType =
  | 'causal' // 因果：因此、故而
  | 'conditional' // 条件：若、如果
  | 'adversative' // 转折：但是、然而
  | 'progressive' // 递进：进而、此外
  | 'explanatory' // 解释：因为、由于
  | 'conclusive'; // 总结：综上、故

/**
 * 推理类型
 */
export type ReasoningType = 'deductive' | 'inductive' | 'analogical';

/**
 * 因果关系类型
 */
export type CausalType =
  | 'direct' // 直接因果
  | 'indirect' // 间接因果
  | 'conditional' // 条件因果
  | 'exclusive' // 排除因果
  | 'compound'; // 复合因果

/**
 * 逻辑连接词
 */
export interface LogicalConnector {
  /** 连接词类型 */
  type: ConnectorType;
  /** 连接词文本 */
  word: string;
  /** 逻辑强度评分（0-1） */
  strength: number;
  /** 适用场景 */
  contexts: string[];
}

/**
 * 推理模式
 */
export interface ReasoningPattern {
  /** 推理类型 */
  type: ReasoningType;
  /** 步骤数量 */
  steps: number;
  /** 模式描述 */
  description: string;
}

/**
 * 因果关系
 */
export interface CausalRelation {
  /** 因果类型 */
  type: CausalType;
  /** 原因 */
  cause: string;
  /** 结果 */
  effect: string;
  /** 因果强度（0-1） */
  strength: number;
}

// =============================================================================
// 逻辑连接词库（14种）
// =============================================================================

/**
 * 逻辑连接词库
 * 按强度排序，从强到弱
 */
export const LOGICAL_CONNECTORS: LogicalConnector[] = [
  // 因果连接词（最强）
  { type: 'causal', word: '因此', strength: 1.0, contexts: ['conclusion'] },
  { type: 'causal', word: '故而', strength: 0.95, contexts: ['conclusion'] },
  { type: 'causal', word: '故', strength: 0.9, contexts: ['conclusion'] },
  { type: 'causal', word: '所以', strength: 0.9, contexts: ['conclusion'] },

  // 解释连接词（强）
  { type: 'explanatory', word: '因为', strength: 0.95, contexts: ['premise'] },
  { type: 'explanatory', word: '由于', strength: 0.9, contexts: ['premise'] },

  // 条件连接词（中）
  { type: 'conditional', word: '基于', strength: 0.85, contexts: ['premise'] },
  { type: 'conditional', word: '鉴于', strength: 0.8, contexts: ['premise'] },
  { type: 'conditional', word: '若', strength: 0.75, contexts: ['premise'] },
  { type: 'conditional', word: '如果', strength: 0.75, contexts: ['premise'] },

  // 总结连接词（中）
  {
    type: 'conclusive',
    word: '综上',
    strength: 0.85,
    contexts: ['conclusion'],
  },
  {
    type: 'conclusive',
    word: '由此可见',
    strength: 0.8,
    contexts: ['conclusion'],
  },

  // 递进连接词（弱）
  { type: 'progressive', word: '进而', strength: 0.7, contexts: ['argument'] },
  { type: 'progressive', word: '此外', strength: 0.65, contexts: ['argument'] },

  // 转折连接词（最弱）
  { type: 'adversative', word: '但是', strength: 0.5, contexts: ['argument'] },
  { type: 'adversative', word: '然而', strength: 0.45, contexts: ['argument'] },
];

// =============================================================================
// 推理模式定义
// =============================================================================

/**
 * 推理模式库
 */
export const REASONING_PATTERNS: Record<ReasoningType, ReasoningPattern> = {
  /**
   * 演绎推理
   * 从一般到特殊：前提→结论
   */
  deductive: {
    type: 'deductive',
    steps: 3,
    description: '从一般性原则推出具体结论',
  },

  /**
   * 归纳推理
   * 从特殊到一般：多个事实→普遍规律
   */
  inductive: {
    type: 'inductive',
    steps: 3,
    description: '从多个具体事实归纳出普遍规律',
  },

  /**
   * 类比推理
   * 相似案例→相似结论
   */
  analogical: {
    type: 'analogical',
    steps: 4,
    description: '通过类比相似案例推出结论',
  },
};

// =============================================================================
// 因果关系模式
// =============================================================================

/**
 * 因果关系关键词库
 */
export const CAUSAL_KEYWORDS: Record<CausalType, string[]> = {
  direct: ['导致', '致使', '造成', '引起', '产生', '因为'],
  indirect: ['进而', '随之', '因而'],
  conditional: ['若', '如果', '假设', '在...情况下'],
  exclusive: ['排除', '除非', '除了'],
  compound: ['不仅...而且', '一方面...另一方面'],
};

/**
 * 因果关系模式库
 */
export const CAUSAL_PATTERNS: Record<CausalType, CausalRelation> = {
  /**
   * 直接因果
   * A直接导致B
   */
  direct: {
    type: 'direct',
    cause: '事实A',
    effect: '事实B',
    strength: 1.0,
  },

  /**
   * 间接因果
   * A→C→B
   */
  indirect: {
    type: 'indirect',
    cause: '事实A',
    effect: '事实B',
    strength: 0.8,
  },

  /**
   * 条件因果
   * 在条件下A导致B
   */
  conditional: {
    type: 'conditional',
    cause: '事实A',
    effect: '事实B',
    strength: 0.7,
  },

  /**
   * 排除因果
   * A发生，除非C否则B
   */
  exclusive: {
    type: 'exclusive',
    cause: '事实A',
    effect: '事实B',
    strength: 0.6,
  },

  /**
   * 复合因果
   * A和B共同导致C
   */
  compound: {
    type: 'compound',
    cause: '事实A和事实B',
    effect: '事实C',
    strength: 0.9,
  },
};

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 根据上下文选择最合适的逻辑连接词
 *
 * @param context - 上下文（premise/premise/conclusion/argument）
 * @param minStrength - 最小强度要求
 * @returns 最合适的逻辑连接词
 */
export function selectLogicalConnector(
  context: 'premise' | 'conclusion' | 'argument',
  minStrength: number = 0.7
): LogicalConnector | undefined {
  const connectors = LOGICAL_CONNECTORS.filter(
    c => c.contexts.includes(context) && c.strength >= minStrength
  );

  if (connectors.length === 0) {
    return undefined;
  }

  // 返回强度最高的连接词
  return connectors.reduce((max, current) =>
    current.strength > max.strength ? current : max
  );
}

/**
 * 根据上下文获取所有可用的逻辑连接词
 *
 * @param context - 上下文（premise/premise/conclusion/argument）
 * @returns 可用的逻辑连接词列表
 */
export function getAvailableConnectors(
  context: 'premise' | 'conclusion' | 'argument'
): LogicalConnector[] {
  return LOGICAL_CONNECTORS.filter(c => c.contexts.includes(context));
}

/**
 * 随机获取一个逻辑连接词
 *
 * @param context - 上下文（premise/premise/conclusion/argument）
 * @returns 随机的逻辑连接词
 */
export function getRandomConnector(
  context: 'premise' | 'conclusion' | 'argument'
): LogicalConnector {
  const connectors = getAvailableConnectors(context);
  const index = Math.floor(Math.random() * connectors.length);
  return connectors[index];
}

/**
 * 识别文本中的因果关系类型
 *
 * @param text - 待分析的文本
 * @returns 因果关系类型
 */
export function identifyCausalType(text: string): CausalType | undefined {
  for (const [type, keywords] of Object.entries(CAUSAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        return type as CausalType;
      }
    }
  }
  return undefined;
}

/**
 * 计算推理深度
 *
 * @param steps - 推理步骤数
 * @param type - 推理类型
 * @returns 推理深度评分（0-1）
 */
export function calculateReasoningDepth(
  steps: number,
  type: ReasoningType
): number {
  // 基础分
  let score = Math.min(steps / 3, 1.0);

  // 根据推理类型调整
  const pattern = REASONING_PATTERNS[type];
  if (pattern) {
    // 演绎推理奖励
    if (type === 'deductive') {
      score += 0.1;
    }
    // 类比推理奖励（步骤多更复杂）
    else if (type === 'analogical' && steps >= 4) {
      score += 0.1;
    }
    // 归纳推理奖励（事实多更可靠）
    else if (type === 'inductive' && steps >= 3) {
      score += 0.05;
    }
  }

  return Math.min(1.0, score);
}

/**
 * 获取推理模式
 *
 * @param type - 推理类型
 * @returns 推理模式
 */
export function getReasoningPattern(type: ReasoningType): ReasoningPattern {
  return REASONING_PATTERNS[type];
}

/**
 * 生成推理链
 *
 * @param premise - 前提
 * @param reasoning - 推理过程
 * @param conclusion - 结论
 * @param type - 推理类型
 * @returns 推理步骤数组
 */
export function generateReasoningChain(
  premise: string,
  reasoning: string,
  conclusion: string
): string[] {
  const chain: string[] = [];

  // 步骤1：前提
  const connector1 = getRandomConnector('premise');
  chain.push(`${connector1.word}${premise}`);

  // 步骤2：推理
  const connector2 = getRandomConnector('argument');
  chain.push(`${connector2.word}${reasoning}`);

  // 步骤3：结论
  const connector3 = getRandomConnector('conclusion');
  chain.push(`${connector3.word}${conclusion}`);

  return chain;
}

/**
 * 评估论点逻辑性
 *
 * @param content - 论点内容
 * @returns 逻辑性评分（0-1）
 */
export function evaluateArgumentLogic(content: string): number {
  let score = 0.5; // 基础分

  // 检查是否包含逻辑连接词
  const hasStrongConnector = LOGICAL_CONNECTORS.some(
    c => c.strength >= 0.8 && content.includes(c.word)
  );
  if (hasStrongConnector) {
    score += 0.2;
  }

  // 检查因果关系
  const hasCausal = Object.values(CAUSAL_KEYWORDS).some(keywords =>
    keywords.some(k => content.includes(k))
  );
  if (hasCausal) {
    score += 0.2;
  }

  // 检查推理深度
  const reasoningSteps = generateReasoningChain('前提', '推理', '结论');
  if (reasoningSteps.length >= 3) {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

/**
 * 获取逻辑连接词数量
 *
 * @returns 逻辑连接词总数
 */
export function getConnectorCount(): number {
  return LOGICAL_CONNECTORS.length;
}

/**
 * 获取推理类型数量
 *
 * @returns 推理类型总数
 */
export function getReasoningTypeCount(): number {
  return Object.keys(REASONING_PATTERNS).length as number;
}

/**
 * 获取因果类型数量
 *
 * @returns 因果类型总数
 */
export function getCausalTypeCount(): number {
  return Object.keys(CAUSAL_PATTERNS).length as number;
}
