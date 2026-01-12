/**
 * 争议焦点提取器 - 规则匹配层
 * 第二层：使用多种规则模式进行匹配
 */

import type {
  DisputeFocus,
  DisputeFocusCategory,
  ExtractedData,
} from '../../core/types';

/**
 * 初始化规则模式
 */
export function initializeRulePatterns(): Map<DisputeFocusCategory, RegExp[]> {
  const patterns = new Map<DisputeFocusCategory, RegExp[]>();

  patterns.set('CONTRACT_BREACH', [
    /违约/gi,
    /未履行\s*(合同|义务)/gi,
    /解除\s*合同/gi,
    /终止\s*合同/gi,
    /违反\s*合同/gi,
    /履行\s*合同/gi,
    /未\s*按.*履行/gi,
    /构成\s*违约/gi,
    /违反\s*约定/gi,
    /未\s*按.*约定/gi,
    /被告.*未.*履行/gi,
    /被告.*未能.*履行/gi,
  ]);

  patterns.set('PAYMENT_DISPUTE', [
    /支付\s*本金/gi,
    /偿还\s*欠款/gi,
    /金额.*争议/gi,
    /支付\s*数额/gi,
    /支付\s*金额/gi,
    /本金.*数额/gi,
    /数额.*争议/gi,
    /本金.*为.*万元/gi,
    /支付.*本金/gi,
    /本金/gi,
    /借款.*本金/gi,
  ]);

  patterns.set('LIABILITY_ISSUE', [
    /承担\s*责任/gi,
    /责任\s*认定/gi,
    /责任\s*划分/gi,
    /责任.*分歧/gi,
    /责任.*争议/gi,
    /承担.*责任/gi,
    /违约\s*责任/gi,
    /责任\s*承担/gi,
    /减轻\s*责任/gi,
  ]);

  patterns.set('DAMAGES_CALCULATION', [
    /损失.*计算/gi,
    /赔偿\s*数额/gi,
    /违约金.*计算/gi,
    /损害.*赔偿/gi,
    /赔偿\s*方式/gi,
    /计算方式.*意见不一/gi,
  ]);

  patterns.set('PERFORMANCE_DISPUTE', [
    /继续\s*履行/gi,
    /履行\s*义务/gi,
    /是否\s*履行/gi,
    /履行.*争议/gi,
  ]);

  patterns.set('VALIDITY_ISSUE', [
    /合同\s*效力/gi,
    /是否\s*有效/gi,
    /是否\s*成立/gi,
    /是否\s*变更/gi,
    /合同.*有效/gi,
    /合同.*成立/gi,
  ]);

  patterns.set('OTHER', [
    /争议\s*焦点/gi,
    /核心.*问题/gi,
    /主要.*分歧/gi,
    /存在分歧/gi,
    /意见不一/gi,
  ]);

  return patterns;
}

/**
 * 规则匹配层 - 使用多种规则模式进行匹配
 */
export function ruleMatchLayer(
  text: string,
  extractedData?: ExtractedData,
  aiExtracted?: DisputeFocus[],
  rulePatterns?: Map<DisputeFocusCategory, RegExp[]>
): DisputeFocus[] {
  const focuses: DisputeFocus[] = [];
  let idCounter = aiExtracted ? aiExtracted.length : 0;
  const patternsMap = rulePatterns || initializeRulePatterns();

  // 调试日志
  console.log('[规则匹配层] 开始匹配文本长度:', text.length);
  console.log('[规则匹配层] 模式数量:', patternsMap.size);

  for (const [category, patterns] of patternsMap) {
    console.log(
      `[规则匹配层] 处理类别: ${category}, 模式数量: ${patterns.length}`
    );
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        // 检查是否已被AI提取层覆盖
        const isAlreadyExtracted = aiExtracted?.some(aiFocus =>
          isSimilarFocus(aiFocus, match[0], category)
        );

        if (!isAlreadyExtracted) {
          const id = `rule_focus_${idCounter++}`;
          const focus = buildRuleBasedFocus(
            id,
            category,
            match,
            text,
            extractedData
          );
          if (focus) focuses.push(focus);
        }
      }
    }
  }

  return focuses;
}

/**
 * 判断两个争议焦点是否相似
 */
function isSimilarFocus(
  aiFocus: DisputeFocus,
  matchedText: string,
  category: DisputeFocusCategory
): boolean {
  if (aiFocus.category !== category) return false;

  const aiDesc = aiFocus.description.toLowerCase();
  const matchedLower = matchedText.toLowerCase();

  // 更宽松的相似性判断：如果有50%以上的文本重叠则认为是相似的
  const intersection = Math.min(aiDesc.length, matchedLower.length);
  const overlap =
    aiDesc.substring(0, intersection) ===
    matchedLower.substring(0, intersection);

  // 如果核心争议点相同，也认为是相似的
  const coreIssueMatch =
    aiFocus.coreIssue === matchedText ||
    aiFocus.coreIssue.includes(matchedText) ||
    matchedText.includes(aiFocus.coreIssue);

  return overlap || coreIssueMatch;
}

/**
 * 基于规则构建争议焦点
 */
function buildRuleBasedFocus(
  id: string,
  category: DisputeFocusCategory,
  match: RegExpMatchArray,
  text: string,
  extractedData?: ExtractedData
): DisputeFocus | null {
  const matchedText = match[0];
  const matchIndex = match.index || 0;
  const positionA = extractPositionA(text, matchedText, matchIndex);
  const positionB = extractPositionB(text, matchedText, matchIndex);
  const coreIssue = extractCoreIssue(matchedText);
  const importance = calculateImportance(matchedText, category);
  const confidence = calculateConfidence(matchedText, positionA, positionB);
  const relatedClaims = extractRelatedClaims(matchedText, extractedData);

  return {
    id,
    category,
    description: matchedText,
    positionA,
    positionB,
    coreIssue,
    importance,
    confidence,
    relatedClaims,
    relatedFacts: [],
    evidence: [],
    legalBasis: extractLegalBasis(matchedText, text, matchIndex),
    _inferred: confidence < 0.7,
  };
}

/**
 * 提取原告观点
 */
function extractPositionA(
  text: string,
  matchedText: string,
  matchIndex: number
): string {
  const patterns = [/原告认为|原告主张|原告称/gi, /原告方面/gi, /起诉方认为/gi];

  for (const pattern of patterns) {
    const match = text.substring(0, matchIndex).match(pattern);
    if (match && match.index !== undefined) {
      const contextStart = Math.max(0, match.index - 20);
      const context = text.substring(contextStart, matchIndex);
      return context.trim();
    }
  }

  return '未明确';
}

/**
 * 提取被告观点
 */
function extractPositionB(
  text: string,
  matchedText: string,
  matchIndex: number
): string {
  const patterns = [
    /被告认为|被告主张|被告称/gi,
    /被告方面/gi,
    /答辩方认为/gi,
    /被告答辩|被告反驳/gi,
  ];

  for (const pattern of patterns) {
    const contextStart = matchIndex;
    const contextEnd = Math.min(
      text.length,
      contextStart + matchedText.length + 100
    );
    const context = text.substring(contextStart, contextEnd);

    const match = context.match(pattern);
    if (match) return match[0];
  }

  return '未明确';
}

/**
 * 提取核心争议点
 */
function extractCoreIssue(matchedText: string): string {
  const patterns = [
    /是否\s*违约/gi,
    /是否\s*承担\s*责任/gi,
    /是否\s*赔偿/gi,
    /是否\s*支付/gi,
    /是否\s*履行/gi,
    /争议.*焦点/gi,
  ];

  for (const pattern of patterns) {
    const match = matchedText.match(pattern);
    if (match) return match[0];
  }

  return matchedText.split(/[，。；；]/)[0]?.trim() || matchedText;
}

/**
 * 计算重要性评分
 */
function calculateImportance(
  text: string,
  category: DisputeFocusCategory
): number {
  let score = 5;

  const highImportanceKeywords = [
    '本金',
    '利息',
    '违约金',
    '赔偿',
    '损失',
    '履行',
    '解除',
  ];
  const hasKeyword = highImportanceKeywords.some(kw =>
    text.toLowerCase().includes(kw)
  );
  if (hasKeyword) score += 2;

  const categoryWeights: Record<DisputeFocusCategory, number> = {
    CONTRACT_BREACH: 8,
    PAYMENT_DISPUTE: 9,
    LIABILITY_ISSUE: 7,
    DAMAGES_CALCULATION: 6,
    PERFORMANCE_DISPUTE: 7,
    VALIDITY_ISSUE: 5,
    OTHER: 5,
  };
  score = (score + categoryWeights[category]) / 2;

  if (text.length > 50) score -= 1;
  if (text.length > 100) score -= 1;

  return Math.min(10, Math.max(1, Math.round(score)));
}

/**
 * 计算置信度
 */
function calculateConfidence(
  matchedText: string,
  positionA: string,
  positionB: string
): number {
  let confidence = 0.5;

  if (positionA !== '未明确' && positionB !== '未明确') {
    confidence += 0.2;
  }

  if (/争议|分歧|争执|异议/gi.test(matchedText)) {
    confidence += 0.15;
  }

  if (/法律|合同|民法典|条款/gi.test(matchedText)) {
    confidence += 0.15;
  }

  return Math.min(1, confidence);
}

/**
 * 提取关联的诉讼请求
 */
function extractRelatedClaims(
  text: string,
  extractedData?: ExtractedData
): string[] {
  const related: string[] = [];

  if (extractedData?.claims) {
    for (const claim of extractedData.claims) {
      if (isRelatedToClaim(text, claim.content)) {
        related.push(claim.type);
      }
    }
  }

  return related;
}

/**
 * 判断是否与诉讼请求相关
 */
function isRelatedToClaim(text: string, claimContent: string): boolean {
  const textKeywords = text.split(/[，。；；\s]/).map(k => k.trim());
  const claimKeywords = claimContent.split(/[，。；；\s]/).map(k => k.trim());

  return textKeywords.some(tk =>
    claimKeywords.some(ck => tk.includes(ck) || ck.includes(tk))
  );
}

/**
 * 提取法律依据
 */
function extractLegalBasis(
  matchedText: string,
  fullText: string,
  matchIndex: number
): string | undefined {
  const patterns = [
    /依据\s*《[^》]+》/gi,
    /根据\s*《[^》]+》/gi,
    /按照\s*《[^》]+》/gi,
    /违反\s*第.*?条/gi,
    /不符合\s*第.*?款/gi,
  ];

  for (const pattern of patterns) {
    const match = matchedText.match(pattern);
    if (match) return match[0];
  }

  const contextStart = matchIndex;
  const contextEnd = Math.min(fullText.length, contextStart + 200);
  const context = fullText.substring(contextStart, contextEnd);

  for (const pattern of patterns) {
    const match = context.match(pattern);
    if (match) return match[0];
  }

  return undefined;
}
