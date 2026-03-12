/**
 * 争议焦点提取器 - 三层架构：AI识别+算法兜底+AI审查
 * 目标：争议焦点识别准确率>90%
 */

import { getUnifiedAIService } from '@/lib/ai/unified-service';
import type {
  DisputeFocus,
  DisputeFocusCategory,
  ExtractedData,
} from '../core/types';
import { logger } from '@/lib/logger';

// =============================================================================
// 接口定义
// =============================================================================

export interface DisputeFocusExtractionOptions {
  includeInferred?: boolean;
  minConfidence?: number;
  useAIExtraction?: boolean; // 是否启用AI提取
  useAIMatching?: boolean; // 是否启用AI审查
}

export interface DisputeFocusExtractionOutput {
  disputeFocuses: DisputeFocus[];
  summary: {
    total: number;
    byCategory: Record<DisputeFocusCategory, number>;
    avgImportance: number;
    avgConfidence: number;
    inferredCount: number;
    aiExtractedCount: number;
    ruleExtractedCount: number;
    aiReviewedCount: number;
  };
}

// =============================================================================
// 争议焦点提取器类 - 三层架构
// =============================================================================

export class DisputeFocusExtractor {
  private readonly rulePatterns: Map<DisputeFocusCategory, RegExp[]>;

  constructor() {
    this.rulePatterns = this.initializeRulePatterns();
  }

  /**
   * 从文本中提取争议焦点 - 三层架构
   * 第一层：AI识别
   * 第二层：规则匹配兜底
   * 第三层：AI审查修正
   */
  async extractFromText(
    text: string,
    extractedData?: ExtractedData,
    options: DisputeFocusExtractionOptions = {}
  ): Promise<DisputeFocusExtractionOutput> {
    let aiExtracted: DisputeFocus[] = [];
    let ruleExtracted: DisputeFocus[] = [];
    let aiReviewed: DisputeFocus[] = [];

    // 第一层：AI识别（如果启用）
    if (options.useAIExtraction !== false) {
      aiExtracted = await this.aiExtractLayer(text, extractedData);
    }

    // 第二层：规则匹配兜底
    ruleExtracted = this.ruleMatchLayer(text, extractedData, aiExtracted);

    // 合并第一层和第二层的结果，去重
    let mergedFocuses = this.mergeAndDeduplicate(aiExtracted, ruleExtracted);

    // 第三层：AI审查修正（如果启用）
    if (options.useAIMatching !== false && mergedFocuses.length > 0) {
      aiReviewed = await this.aiReviewLayer(mergedFocuses, text);
      mergedFocuses = aiReviewed;
    }

    // 过滤推断结果
    if (options.includeInferred === false) {
      mergedFocuses = mergedFocuses.filter(f => !f._inferred);
    }

    // 过滤低置信度结果
    if (options.minConfidence !== undefined) {
      const minConf = options.minConfidence;
      mergedFocuses = mergedFocuses.filter(f => f.confidence >= minConf);
    }

    const summary = this.generateSummary(
      mergedFocuses,
      aiExtracted,
      ruleExtracted,
      aiReviewed
    );

    return { disputeFocuses: mergedFocuses, summary };
  }

  // =============================================================================
  // 第一层：AI识别
  // =============================================================================

  /**
   * AI识别层 - 使用DeepSeek进行智能识别
   */
  private async aiExtractLayer(
    text: string,
    extractedData?: ExtractedData
  ): Promise<DisputeFocus[]> {
    try {
      const unifiedService = await getUnifiedAIService();

      const prompt = this.buildAIExtractionPrompt(text, extractedData);

      const response = await unifiedService.chatCompletion({
        model: 'deepseek-chat',
        provider: 'deepseek',
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的法律争议焦点识别专家。请从法律文档中准确识别争议焦点。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        maxTokens: 2000,
      });

      // 兼容多种响应格式
      const content = response?.choices?.[0]?.message?.content || '';
      if (content) {
        return this.parseAIExtractionResponse(content);
      }

      return [];
    } catch (error) {
      logger.error('AI识别层失败:', error);
      // AI失败时返回空数组，不影响规则匹配层
      return [];
    }
  }

  /**
   * 构建AI识别提示词
   */
  private buildAIExtractionPrompt(
    text: string,
    extractedData?: ExtractedData
  ): string {
    let contextInfo = '';

    if (extractedData?.claims && extractedData.claims.length > 0) {
      contextInfo += `\n诉讼请求信息：\n${extractedData.claims.map(c => `${c.type}: ${c.content}`).join('\n')}`;
    }

    return `请从以下法律文档中准确识别争议焦点。

文档内容：
${text}
${contextInfo}

请按照以下JSON格式返回争议焦点列表，确保每个争议点都包含完整的原告观点、被告观点和核心争议点：

{
  "disputeFocuses": [
    {
      "category": "CONTRACT_BREACH|PAYMENT_DISPUTE|LIABILITY_ISSUE|DAMAGES_CALCULATION|PERFORMANCE_DISPUTE|VALIDITY_ISSUE|OTHER",
      "description": "争议焦点描述",
      "positionA": "原告观点",
      "positionB": "被告观点",
      "coreIssue": "核心争议点",
      "importance": 8,
      "confidence": 0.85,
      "evidence": ["证据1", "证据2"],
      "legalBasis": "法律依据"
    }
  ]
}

争议焦点分类说明：
- CONTRACT_BREACH: 合同违约争议
- PAYMENT_DISPUTE: 支付数额争议
- LIABILITY_ISSUE: 责任认定争议
- DAMAGES_CALCULATION: 损害赔偿计算争议
- PERFORMANCE_DISPUTE: 履行争议
- VALIDITY_ISSUE: 合同效力争议
- OTHER: 其他争议

注意事项：
1. 仔细阅读文档，准确识别真正的争议焦点
2. 每个争议点必须包含原告观点和被告观点
3. 重要性评分范围1-10，数值越大越重要
4. 置信度范围0-1，数值越大越确定
5. 只返回JSON格式，不要包含其他说明文字`;
  }

  /**
   * 解析AI识别响应
   */
  private parseAIExtractionResponse(aiResponse: string): DisputeFocus[] {
    try {
      let cleanedResponse = aiResponse.trim();

      // 移除代码块标记
      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse
          .replace(/```json\s*/, '')
          .replace(/```\s*$/, '');
      }
      if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse
          .replace(/```\s*/, '')
          .replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleanedResponse);

      if (!parsed.disputeFocuses || !Array.isArray(parsed.disputeFocuses)) {
        return [];
      }

      return parsed.disputeFocuses.map((item: unknown, index: number) => {
        const disputeItem = item as Record<string, unknown>;
        const description = (disputeItem.description as string) || '';
        return {
          id: `ai_focus_${index}`,
          category: disputeItem.category as DisputeFocusCategory,
          description,
          positionA: (disputeItem.positionA as string) || '未明确',
          positionB: (disputeItem.positionB as string) || '未明确',
          coreIssue:
            (disputeItem.coreIssue as string) ||
            description.split(/[,。；]/)[0] ||
            '',
          importance: Math.min(
            10,
            Math.max(1, Math.round((disputeItem.importance as number) || 5))
          ),
          confidence: Math.min(
            1,
            Math.max(0, (disputeItem.confidence as number) || 0.7)
          ),
          relatedClaims: [],
          relatedFacts: [],
          evidence: (disputeItem.evidence as string[]) || [],
          legalBasis: disputeItem.legalBasis as string | undefined,
          _inferred: ((disputeItem.confidence as number) || 0.7) < 0.8,
        };
      });
    } catch (error) {
      logger.error('解析AI识别响应失败:', error);
      return [];
    }
  }

  // =============================================================================
  // 第二层：规则匹配兜底
  // =============================================================================

  /**
   * 规则匹配层 - 使用多种规则模式进行匹配
   */
  private ruleMatchLayer(
    text: string,
    extractedData?: ExtractedData,
    aiExtracted?: DisputeFocus[]
  ): DisputeFocus[] {
    const focuses: DisputeFocus[] = [];
    let idCounter = aiExtracted ? aiExtracted.length : 0;

    for (const [category, patterns] of this.rulePatterns) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          // 检查是否已被AI提取层覆盖
          const isAlreadyExtracted = aiExtracted?.some(aiFocus =>
            this.isSimilarFocus(aiFocus, match[0], category)
          );

          if (!isAlreadyExtracted) {
            const id = `rule_focus_${idCounter++}`;
            const focus = this.buildRuleBasedFocus(
              id,
              category,
              match,
              text,
              extractedData
            );
            if (focus) {
              focuses.push(focus);
            }
          }
        }
      }
    }

    // 如果规则匹配为空，尝试从文本中提取通用争议模式
    if (focuses.length === 0) {
      const genericFocuses = this.extractGenericDisputes(text);
      genericFocuses.forEach((f, idx) => {
        focuses.push({
          ...f,
          id: `generic_focus_${idx}`,
        });
      });
    }

    return focuses;
  }

  /**
   * 提取通用争议模式（当规则匹配为空时的兜底）
   */
  private extractGenericDisputes(text: string): DisputeFocus[] {
    const disputes: DisputeFocus[] = [];

    // 查找"争议焦点"开头的条目
    const focusPattern = /争议焦点[：:]\s*([^\n]+)/g;
    let match;
    while ((match = focusPattern.exec(text)) !== null) {
      const content = match[1].trim();
      const items = content.split(/[；;]\s*/);
      for (const item of items) {
        if (item.trim()) {
          disputes.push({
            id: '',
            category: this.classifyDisputeText(item),
            description: item.trim(),
            positionA: this.extractPositionFromText(text, '原告'),
            positionB: this.extractPositionFromText(text, '被告'),
            coreIssue: item.trim(),
            importance: 7,
            confidence: 0.6,
            relatedClaims: [],
            relatedFacts: [],
            evidence: [],
            legalBasis: undefined,
            _inferred: true,
          });
        }
      }
    }

    return disputes;
  }

  /**
   * 从文本中提取原告/被告观点
   */
  private extractPositionFromText(text: string, side: '原告' | '被告'): string {
    const patterns =
      side === '原告'
        ? [/原告认为([^。\n]+)/g, /原告主张([^。\n]+)/g, /原告称([^。\n]+)/g]
        : [/被告认为([^。\n]+)/g, /被告主张([^。\n]+)/g, /被告辩称([^。\n]+)/g];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return '未明确';
  }

  /**
   * 根据文本内容分类争议
   */
  private classifyDisputeText(text: string): DisputeFocusCategory {
    const lowerText = text.toLowerCase();

    if (/违约|未履行|违反合同/gi.test(lowerText)) {
      return 'CONTRACT_BREACH';
    }
    if (/支付|本金|金额|数额|欠款/gi.test(lowerText)) {
      return 'PAYMENT_DISPUTE';
    }
    if (/责任|承担/gi.test(lowerText)) {
      return 'LIABILITY_ISSUE';
    }
    if (/损失|赔偿|违约金/gi.test(lowerText)) {
      return 'DAMAGES_CALCULATION';
    }
    if (/履行/gi.test(lowerText)) {
      return 'PERFORMANCE_DISPUTE';
    }
    if (/效力|有效|成立/gi.test(lowerText)) {
      return 'VALIDITY_ISSUE';
    }

    return 'OTHER';
  }

  /**
   * 判断两个争议焦点是否相似
   */
  private isSimilarFocus(
    aiFocus: DisputeFocus,
    matchedText: string,
    category: DisputeFocusCategory
  ): boolean {
    if (aiFocus.category !== category) return false;

    // 检查描述相似度（简单包含判断）
    const aiDesc = aiFocus.description.toLowerCase();
    const matchedLower = matchedText.toLowerCase();

    return (
      aiDesc.includes(matchedLower.substring(0, 10)) ||
      matchedLower.includes(aiDesc.substring(0, 10))
    );
  }

  /**
   * 基于规则构建争议焦点
   */
  private buildRuleBasedFocus(
    id: string,
    category: DisputeFocusCategory,
    match: RegExpMatchArray,
    text: string,
    extractedData?: ExtractedData
  ): DisputeFocus | null {
    const matchedText = match[0];
    const matchIndex = match.index || 0;
    const positionA = this.extractPositionA(text, matchedText, matchIndex);
    const positionB = this.extractPositionB(text, matchedText, matchIndex);
    const coreIssue = this.extractCoreIssue(matchedText);
    const importance = this.calculateImportance(matchedText, category);
    const confidence = this.calculateConfidence(
      matchedText,
      positionA,
      positionB
    );

    const relatedClaims = this.extractRelatedClaims(matchedText, extractedData);

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
      legalBasis: this.extractLegalBasis(matchedText, text, matchIndex),
      _inferred: confidence < 0.7,
    };
  }

  /**
   * 提取原告观点
   */
  private extractPositionA(
    text: string,
    _matchedText: string,
    matchIndex: number
  ): string {
    const patterns = [
      /原告认为|原告主张|原告称/gi,
      /原告方面/gi,
      /起诉方认为/gi,
    ];

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
  private extractPositionB(
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
  private extractCoreIssue(matchedText: string): string {
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
  private calculateImportance(
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
  private calculateConfidence(
    matchedText: string,
    positionA: string,
    positionB: string
  ): number {
    let confidence = 0.5; // 规则匹配的基础置信度较低

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
  private extractRelatedClaims(
    text: string,
    extractedData?: ExtractedData
  ): string[] {
    const related: string[] = [];

    if (extractedData?.claims) {
      for (const claim of extractedData.claims) {
        if (this.isRelatedToClaim(text, claim.content)) {
          related.push(claim.type);
        }
      }
    }

    return related;
  }

  /**
   * 判断是否与诉讼请求相关
   */
  private isRelatedToClaim(text: string, claimContent: string): boolean {
    const textKeywords = text.split(/[，。；；\s]/).map(k => k.trim());
    const claimKeywords = claimContent.split(/[，。；；\s]/).map(k => k.trim());

    return textKeywords.some(tk =>
      claimKeywords.some(ck => tk.includes(ck) || ck.includes(tk))
    );
  }

  /**
   * 提取法律依据
   */
  private extractLegalBasis(
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

  // =============================================================================
  // 合并和去重
  // =============================================================================

  /**
   * 合并AI和规则匹配结果，去重
   */
  private mergeAndDeduplicate(
    aiFocuses: DisputeFocus[],
    ruleFocuses: DisputeFocus[]
  ): DisputeFocus[] {
    const seen = new Set<string>();
    const unique: DisputeFocus[] = [];

    // 先添加AI识别的结果（置信度更高）
    for (const focus of aiFocuses) {
      const key = `${focus.category}_${focus.coreIssue}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(focus);
      }
    }

    // 再添加规则匹配的结果（去重）
    for (const focus of ruleFocuses) {
      const key = `${focus.category}_${focus.coreIssue}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(focus);
      }
    }

    return unique;
  }

  // =============================================================================
  // 第三层：AI审查
  // =============================================================================

  /**
   * AI审查层 - 对争议焦点进行审查和修正
   */
  private async aiReviewLayer(
    focuses: DisputeFocus[],
    originalText: string
  ): Promise<DisputeFocus[]> {
    try {
      const unifiedService = await getUnifiedAIService();

      const prompt = this.buildAIReviewPrompt(focuses, originalText);

      const response = await unifiedService.chatCompletion({
        model: 'deepseek-chat',
        provider: 'deepseek',
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的法律争议焦点审查专家。请审查和修正争议焦点识别结果。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        maxTokens: 2000,
      });

      if (response.choices && response.choices.length > 0) {
        return this.parseAIReviewResponse(
          response.choices[0].message.content || '',
          focuses
        );
      }

      return focuses;
    } catch (error) {
      logger.error('AI审查层失败:', error);
      // 审查失败时返回原始结果
      return focuses;
    }
  }

  /**
   * 构建AI审查提示词
   */
  private buildAIReviewPrompt(
    focuses: DisputeFocus[],
    originalText: string
  ): string {
    const focusList = focuses
      .map(
        (f, index) =>
          `${index + 1}. [${f.category}] ${f.description}
   - 原告观点: ${f.positionA}
   - 被告观点: ${f.positionB}
   - 核心争议: ${f.coreIssue}
   - 重要性: ${f.importance}
   - 置信度: ${f.confidence}`
      )
      .join('\n');

    return `请审查以下从法律文档中识别的争议焦点列表，确保其准确性和完整性。

原始文档内容：
${originalText.substring(0, 1000)}...

已识别的争议焦点：
${focusList}

请按照以下JSON格式返回审查后的争议焦点列表：

{
  "reviewedFocuses": [
    {
      "id": "原ID",
      "category": "CONTRACT_BREACH|PAYMENT_DISPUTE|LIABILITY_ISSUE|DAMAGES_CALCULATION|PERFORMANCE_DISPUTE|VALIDITY_ISSUE|OTHER",
      "description": "修正后的描述",
      "positionA": "修正后的原告观点",
      "positionB": "修正后的被告观点",
      "coreIssue": "修正后的核心争议",
      "importance": 9,
      "confidence": 0.95,
      "evidence": ["补充证据"],
      "legalBasis": "补充法律依据"
    }
  ],
  "invalidIds": ["需要删除的ID列表"]
}

审查要点：
1. 检查每个争议焦点是否真实存在
2. 修正不准确的分类和描述
3. 补充缺失的原告观点和被告观点
4. 调整重要性和置信度评分
5. 删除重复或不存在的争议焦点
6. 补充遗漏的争议焦点（如有）
7. 确保争议焦点准确反映文档内容

注意事项：
1. 保持原有的ID，以便追溯
2. 只返回JSON格式，不要包含其他说明文字`;
  }

  /**
   * 解析AI审查响应
   */
  private parseAIReviewResponse(
    aiResponse: string,
    originalFocuses: DisputeFocus[]
  ): DisputeFocus[] {
    try {
      let cleanedResponse = aiResponse.trim();

      if (cleanedResponse.includes('```json')) {
        cleanedResponse = cleanedResponse
          .replace(/```json\s*/, '')
          .replace(/```\s*$/, '');
      }
      if (cleanedResponse.includes('```')) {
        cleanedResponse = cleanedResponse
          .replace(/```\s*/, '')
          .replace(/```\s*$/, '');
      }

      const parsed = JSON.parse(cleanedResponse);

      const invalidIds = new Set(parsed.invalidIds || []);
      const reviewedItems = parsed.reviewedFocuses || [];

      return reviewedItems
        .map((item: Record<string, unknown>) => {
          // 查找原始焦点，继承其属性
          const original = originalFocuses.find(f => f.id === item.id);

          return {
            id: item.id as string,
            category: item.category as DisputeFocusCategory,
            description:
              (item.description as string) || original?.description || '',
            positionA:
              (item.positionA as string) || original?.positionA || '未明确',
            positionB:
              (item.positionB as string) || original?.positionB || '未明确',
            coreIssue: (item.coreIssue as string) || original?.coreIssue || '',
            importance: Math.min(
              10,
              Math.max(1, Math.round((item.importance as number) || 5))
            ),
            confidence: Math.min(
              1,
              Math.max(0, (item.confidence as number) || 0.8)
            ),
            relatedClaims: original?.relatedClaims || [],
            relatedFacts: original?.relatedFacts || [],
            evidence: (item.evidence as string[]) || original?.evidence || [],
            legalBasis:
              (item.legalBasis as string | undefined) || original?.legalBasis,
            _inferred: ((item.confidence as number) || 0.8) < 0.9,
          };
        })
        .filter((item: { id: string }) => !invalidIds.has(item.id));
    } catch (error) {
      logger.error('解析AI审查响应失败:', error);
      return originalFocuses;
    }
  }

  // =============================================================================
  // 初始化规则模式
  // =============================================================================

  /**
   * 初始化规则模式
   */
  private initializeRulePatterns(): Map<DisputeFocusCategory, RegExp[]> {
    const patterns = new Map<DisputeFocusCategory, RegExp[]>();

    patterns.set('CONTRACT_BREACH', [
      /违约/gi,
      /未履行\s*(合同|义务)/gi,
      /解除\s*合同/gi,
      /终止\s*合同/gi,
      /违反\s*合同/gi,
      /履行\s*合同/gi,
      /未\s*按.*履行/gi,
    ]);

    patterns.set('PAYMENT_DISPUTE', [
      /支付\s*本金/gi,
      /偿还\s*欠款/gi,
      /金额.*争议/gi,
      /支付\s*数额/gi,
      /支付\s*金额/gi,
      /本金.*数额/gi,
      /数额.*争议/gi,
    ]);

    patterns.set('LIABILITY_ISSUE', [
      /承担\s*责任/gi,
      /责任\s*认定/gi,
      /责任\s*划分/gi,
      /责任.*分歧/gi,
      /责任.*争议/gi,
      /承担.*责任/gi,
    ]);

    patterns.set('DAMAGES_CALCULATION', [
      /损失.*计算/gi,
      /赔偿\s*数额/gi,
      /违约金.*计算/gi,
      /损害.*赔偿/gi,
      /赔偿.*方式/gi,
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

  // =============================================================================
  // 生成摘要
  // =============================================================================

  /**
   * 生成摘要
   */
  private generateSummary(
    finalFocuses: DisputeFocus[],
    aiExtracted: DisputeFocus[],
    ruleExtracted: DisputeFocus[],
    aiReviewed: DisputeFocus[]
  ): {
    total: number;
    byCategory: Record<DisputeFocusCategory, number>;
    avgImportance: number;
    avgConfidence: number;
    inferredCount: number;
    aiExtractedCount: number;
    ruleExtractedCount: number;
    aiReviewedCount: number;
  } {
    const byCategory: Record<DisputeFocusCategory, number> = {} as Record<
      DisputeFocusCategory,
      number
    >;
    let totalImportance = 0;
    let totalConfidence = 0;
    let inferredCount = 0;

    const allCategories: DisputeFocusCategory[] = [
      'CONTRACT_BREACH',
      'PAYMENT_DISPUTE',
      'LIABILITY_ISSUE',
      'DAMAGES_CALCULATION',
      'PERFORMANCE_DISPUTE',
      'VALIDITY_ISSUE',
      'OTHER',
    ];

    for (const category of allCategories) {
      byCategory[category] = finalFocuses.filter(
        f => f.category === category
      ).length;
    }

    for (const focus of finalFocuses) {
      totalImportance += focus.importance;
      totalConfidence += focus.confidence;
      if (focus._inferred) inferredCount++;
    }

    return {
      total: finalFocuses.length,
      byCategory,
      avgImportance:
        finalFocuses.length > 0
          ? Math.round(totalImportance / finalFocuses.length)
          : 0,
      avgConfidence:
        finalFocuses.length > 0
          ? Math.round((totalConfidence / finalFocuses.length) * 100) / 100
          : 0,
      inferredCount,
      aiExtractedCount: aiExtracted.length,
      ruleExtractedCount: ruleExtracted.length,
      aiReviewedCount: aiReviewed.length,
    };
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建默认争议焦点提取器实例
 */
export function createDisputeFocusExtractor(): DisputeFocusExtractor {
  return new DisputeFocusExtractor();
}

/**
 * 从文本中快速提取争议焦点（使用完整三层架构）
 */
export async function extractDisputeFocusesFromText(
  text: string,
  extractedData?: ExtractedData,
  options?: DisputeFocusExtractionOptions
): Promise<DisputeFocus[]> {
  const extractor = createDisputeFocusExtractor();
  const result = await extractor.extractFromText(text, extractedData, options);
  return result.disputeFocuses;
}
