/**
 * 语义分歧检测器
 * 使用多种方法检测两个文本之间是否存在语义分歧
 */

/**
 * 常见法律反驳模式
 */
const LEGAL_CONTRADICTION_PATTERNS = [
  {
    positive: ['同意', '认可', '肯定', '成立', '支持'],
    negative: ['反对', '否认', '否定', '不成立', '不支持'],
  },
  {
    positive: ['应当', '应该', '必须', '需'],
    negative: ['不应当', '不应该', '不必', '无需'],
  },
  {
    positive: ['符合', '满足', '具备'],
    negative: ['不符合', '不满足', '不具备'],
  },
  { positive: ['有效', '成立', '合法'], negative: ['无效', '不成立', '违法'] },
  { positive: ['有', '存在'], negative: ['无', '不存在'] },
  { positive: ['可以', '可行'], negative: ['不可以', '不可行'] },
  { positive: ['责任', '过错'], negative: ['无责', '无过错'] },
  { positive: ['损害', '损失'], negative: ['无损害', '无损失'] },
  { positive: ['因果关系', '因果'], negative: ['无因果关系', '无因果'] },
  { positive: ['主观', '故意'], negative: ['客观', '过失'] },
  { positive: ['全部', '完全'], negative: ['部分', '不完全'] },
  { positive: ['主要', '根本'], negative: ['次要', '非根本'] },
];

/**
 * 法律推理模式
 */
const LEGAL_REASONING_PATTERNS = [
  { pattern: /根据|依据|按照/, counter: /不应|不能|不得/ },
  { pattern: /依据|遵照/, counter: /违反|违背/ },
  { pattern: /构成|成立/, counter: /不构成|不成立/ },
  { pattern: /适用|使用/, counter: /不适用/ },
  { pattern: /主张|认为/, counter: /否认|否定/ },
  { pattern: /举证|证明/, counter: /无法|不能/ },
  { pattern: /免责|免除/, counter: /不能|不得/ },
  { pattern: /赔偿|补偿/, counter: /无需|不应/ },
];

/**
 * 强度修饰词
 */
const INTENSIFIERS = [
  '完全',
  '彻底',
  '绝对',
  '显然',
  '明显',
  '必然',
  '必定',
  '确实',
];

/**
 * 检测文本中的矛盾强度
 */
function detectContradictionStrength(text1: string, text2: string): number {
  let strength = 0;

  for (const pattern of LEGAL_CONTRADICTION_PATTERNS) {
    const posIn1 = pattern.positive.some(w => text1.includes(w));
    const negIn1 = pattern.negative.some(w => text1.includes(w));
    const posIn2 = pattern.positive.some(w => text2.includes(w));
    const negIn2 = pattern.negative.some(w => text2.includes(w));

    if ((posIn1 && negIn2) || (negIn1 && posIn2)) {
      strength += 1;

      const combined = text1 + text2;
      if (INTENSIFIERS.some(w => combined.includes(w))) {
        strength += 0.5;
      }
    }
  }

  for (const { pattern, counter } of LEGAL_REASONING_PATTERNS) {
    const hasPattern = pattern.test(text1) || pattern.test(text2);
    const hasCounter = counter.test(text1) || counter.test(text2);

    if (hasPattern && hasCounter) {
      strength += 1.5;
    }
  }

  return Math.min(strength / 3, 1);
}

/**
 * 检测逻辑对立关系
 */
function detectLogicalOpposition(text1: string, text2: string): boolean {
  const oppositions = [
    ['是', '不是'],
    ['有', '没有'],
    ['能', '不能'],
    ['可以', '不可以'],
    ['同意', '不同意'],
    ['支持', '反对'],
    ['成立', '不成立'],
    ['有效', '无效'],
  ];

  for (const [pos, neg] of oppositions) {
    if (
      (text1.includes(pos) && text2.includes(neg)) ||
      (text1.includes(neg) && text2.includes(pos))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * 检测因果关系冲突
 */
function detectCausalConflict(text1: string, text2: string): boolean {
  const causePatterns = [/因为|由于|鉴于|因/, /导致|引起|致使/, /造成/];

  const effectPatterns = [/所以|因此|因而/, /故/, /于是/];

  const hasCause1 = causePatterns.some(p => p.test(text1));
  const hasEffect1 = effectPatterns.some(p => p.test(text1));
  const hasCause2 = causePatterns.some(p => p.test(text2));
  const hasEffect2 = effectPatterns.some(p => p.test(text2));

  if (hasCause1 && hasEffect2) {
    return true;
  }
  if (hasCause2 && hasEffect1) {
    return true;
  }

  return false;
}

/**
 * 检测事实主张冲突
 */
function detectFactConflict(text1: string, text2: string): boolean {
  const factClaimPatterns = [
    /主张|声称|称/,
    /承认|确认/,
    /否认|否定/,
    /明知|知道/,
    /不知|不知道/,
  ];

  const hasFact1 = factClaimPatterns.some(p => p.test(text1));
  const hasFact2 = factClaimPatterns.some(p => p.test(text2));

  if (hasFact1 && hasFact2) {
    const contradictions = [
      ['承认', '否认'],
      ['确认', '否定'],
      ['明知', '不知'],
      ['知道', '不知道'],
    ];

    for (const [pos, neg] of contradictions) {
      if (
        (text1.includes(pos) && text2.includes(neg)) ||
        (text1.includes(neg) && text2.includes(pos))
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * 计算文本相似度（基于Jaccard相似度）
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  const intersection = new Set(Array.from(words1).filter(x => words2.has(x)));
  const union = new Set(Array.from(words1).concat(Array.from(words2)));

  return intersection.size / union.size;
}

/**
 * 语义分歧检测结果
 */
export interface SemanticDisagreementResult {
  hasDisagreement: boolean;
  confidence: number;
  disagreementType: 'contradiction' | 'logical' | 'causal' | 'fact' | 'none';
  description: string;
}

/**
 * 检测两个文本之间是否存在语义分歧
 */
export function detectSemanticDisagreement(
  content1: string,
  content2: string
): SemanticDisagreementResult {
  if (!content1 || !content2) {
    return {
      hasDisagreement: false,
      confidence: 0,
      disagreementType: 'none',
      description: '输入文本为空',
    };
  }

  const contradictionStrength = detectContradictionStrength(content1, content2);
  const hasLogicalOpposition = detectLogicalOpposition(content1, content2);
  const hasCausalConflict = detectCausalConflict(content1, content2);
  const hasFactConflict = detectFactConflict(content1, content2);
  const similarity = calculateSimilarity(content1, content2);

  let maxConfidence = contradictionStrength;
  let disagreementType: SemanticDisagreementResult['disagreementType'] =
    'contradiction';

  if (hasLogicalOpposition && maxConfidence < 0.8) {
    maxConfidence = 0.8;
    disagreementType = 'logical';
  }

  if (hasCausalConflict && maxConfidence < 0.9) {
    maxConfidence = 0.9;
    disagreementType = 'causal';
  }

  if (hasFactConflict && maxConfidence < 0.85) {
    maxConfidence = 0.85;
    disagreementType = 'fact';
  }

  const hasDisagreement = maxConfidence > 0.5 || similarity < 0.3;

  const descriptions: Record<string, string> = {
    contradiction: `检测到内容矛盾，置信度: ${(maxConfidence * 100).toFixed(0)}%`,
    logical: `检测到逻辑对立关系，置信度: ${(maxConfidence * 100).toFixed(0)}%`,
    causal: `检测到因果关系冲突，置信度: ${(maxConfidence * 100).toFixed(0)}%`,
    fact: `检测到事实主张冲突，置信度: ${(maxConfidence * 100).toFixed(0)}%`,
    none: `未检测到明显分歧，相似度: ${(similarity * 100).toFixed(0)}%`,
  };

  return {
    hasDisagreement,
    confidence: maxConfidence,
    disagreementType,
    description: descriptions[disagreementType],
  };
}

/**
 * 检测多个论点之间的分歧
 */
export function detectMultipleDisagreements(
  contents: Array<{ id: string; content: string; side: string }>
): Array<{
  pair: [string, string];
  result: SemanticDisagreementResult;
}> {
  const results: Array<{
    pair: [string, string];
    result: SemanticDisagreementResult;
  }> = [];

  for (let i = 0; i < contents.length; i++) {
    for (let j = i + 1; j < contents.length; j++) {
      const item1 = contents[i];
      const item2 = contents[j];

      if (item1.side !== item2.side) {
        const result = detectSemanticDisagreement(item1.content, item2.content);
        results.push({
          pair: [item1.id, item2.id],
          result,
        });
      }
    }
  }

  return results;
}
