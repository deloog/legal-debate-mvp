/**
 * 关键事实提取器 - 三层架构：AI识别+算法兜底+AI审查
 * 目标：关键事实识别准确
 */

import { getUnifiedAIService } from '@/lib/ai/unified-service';
import type {
  ExtractedData,
  FactCategory,
  FactType,
  KeyFact,
} from '../core/types';
import { logger } from '@/lib/logger';

// =============================================================================
// AI 响应的临时类型定义
// 用于处理 AI 返回的动态 JSON 数据
// =============================================================================

interface AIParsedKeyFact {
  category?: string;
  description?: string;
  details?: string;
  importance?: number;
  confidence?: number;
  factType?: string;
  evidence?: string[];
}

interface AIParsedReviewedFact {
  id?: string;
  category?: string;
  description?: string;
  details?: string;
  importance?: number;
  confidence?: number;
  factType?: string;
  evidence?: string[];
}

// =============================================================================
// 接口定义
// =============================================================================

export interface KeyFactExtractionOptions {
  includeInferred?: boolean;
  minConfidence?: number;
  minImportance?: number;
  useAIExtraction?: boolean; // 是否启用AI提取
  useAIMatching?: boolean; // 是否启用AI审查
}

export interface KeyFactExtractionOutput {
  facts: KeyFact[];
  summary: {
    total: number;
    byCategory: Record<FactCategory, number>;
    byType: Record<FactType, number>;
    avgImportance: number;
    avgConfidence: number;
    inferredCount: number;
    aiExtractedCount: number;
    ruleExtractedCount: number;
    aiReviewedCount: number;
  };
}

// =============================================================================
// 关键事实提取器类 - 三层架构
// =============================================================================

export class KeyFactExtractor {
  private readonly factPatterns: Map<FactCategory, RegExp[]>;
  private readonly factTypePatterns: Map<FactType, RegExp[]>;

  constructor() {
    this.factPatterns = this.initializeFactPatterns();
    this.factTypePatterns = this.initializeFactTypePatterns();
  }

  /**
   * 从文本中提取关键事实 - 三层架构
   * 第一层：AI识别
   * 第二层：规则匹配兜底
   * 第三层：AI审查修正
   */
  async extractFromText(
    text: string,
    extractedData?: ExtractedData,
    options: KeyFactExtractionOptions = {}
  ): Promise<KeyFactExtractionOutput> {
    let aiExtracted: KeyFact[] = [];
    let ruleExtracted: KeyFact[] = [];
    let aiReviewed: KeyFact[] = [];

    // 第一层：AI识别（如果启用）
    if (options.useAIExtraction !== false) {
      aiExtracted = await this.aiExtractLayer(text, extractedData);
    }

    // 第二层：规则匹配兜底
    ruleExtracted = this.ruleMatchLayer(text, extractedData, aiExtracted);

    // 合并第一层和第二层的结果，去重
    let mergedFacts = this.mergeAndDeduplicate(aiExtracted, ruleExtracted);

    // 第三层：AI审查修正（如果启用）
    if (options.useAIMatching !== false && mergedFacts.length > 0) {
      aiReviewed = await this.aiReviewLayer(mergedFacts, text);
      mergedFacts = aiReviewed;
    }

    // 关联提取的数据
    if (extractedData) {
      this.associateFacts(mergedFacts, extractedData);
    }

    // 过滤推断结果
    if (options.includeInferred === false) {
      mergedFacts = mergedFacts.filter(f => f.factType !== 'INFERRED');
    }

    // 过滤低置信度和低重要性结果
    if (options.minConfidence !== undefined) {
      const minConf = options.minConfidence;
      mergedFacts = mergedFacts.filter(f => f.confidence >= minConf);
    }

    if (options.minImportance !== undefined) {
      const minImp = options.minImportance;
      mergedFacts = mergedFacts.filter(f => f.importance >= minImp);
    }

    const summary = this.generateSummary(
      mergedFacts,
      aiExtracted,
      ruleExtracted,
      aiReviewed
    );

    return { facts: mergedFacts, summary };
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
  ): Promise<KeyFact[]> {
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
              '你是一个专业的法律关键事实识别专家。请从法律文档中准确提取关键事实。',
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
        return this.parseAIExtractionResponse(
          response.choices[0].message.content || ''
        );
      }

      return [];
    } catch (error) {
      logger.error('AI识别层失败:', error);
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

    if (extractedData?.timeline && extractedData.timeline.length > 0) {
      contextInfo += `\n时间线信息：\n${extractedData.timeline.map(t => `${t.date}: ${t.event}`).join('\n')}`;
    }

    return `请从以下法律文档中准确提取关键事实。

文档内容：
${text}
${contextInfo}

请按照以下JSON格式返回关键事实列表：

{
  "keyFacts": [
    {
      "category": "CONTRACT_TERM|PERFORMANCE_ACT|BREACH_BEHAVIOR|DAMAGE_OCCURRENCE|LEGAL_RELATION|OTHER",
      "description": "事实描述",
      "details": "详细信息",
      "importance": 8,
      "confidence": 0.85,
      "factType": "EXPLICIT|INFERRED|ADMITTED|DISPUTED",
      "evidence": ["证据1", "证据2"]
    }
  ]
}

事实分类说明：
- CONTRACT_TERM: 合同条款约定
- PERFORMANCE_ACT: 履行行为事实
- BREACH_BEHAVIOR: 违约行为事实
- DAMAGE_OCCURRENCE: 损害发生事实
- LEGAL_RELATION: 法律关系事实
- OTHER: 其他事实

事实类型说明：
- EXPLICIT: 明确陈述的事实
- INFERRED: 推断的事实
- ADMITTED: 当事人承认的事实
- DISPUTED: 存在争议的事实

注意事项：
1. 仔细提取文档中的关键事实
2. 事实描述要准确完整
3. 重要性评分范围1-10，数值越大越重要
4. 置信度范围0-1，数值越大越确定
5. 只返回JSON格式，不要包含其他说明文字`;
  }

  /**
   * 解析AI识别响应
   */
  private parseAIExtractionResponse(aiResponse: string): KeyFact[] {
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

      if (!parsed.keyFacts || !Array.isArray(parsed.keyFacts)) {
        return [];
      }

      return parsed.keyFacts.map((item: unknown, index: number) => {
        const fact = item as AIParsedKeyFact;
        return {
          id: `ai_fact_${index}`,
          category: fact.category || 'OTHER',
          description: fact.description || '',
          details: fact.details || fact.description || '',
          importance: Math.min(
            10,
            Math.max(1, Math.round(fact.importance || 5))
          ),
          confidence: Math.min(1, Math.max(0, fact.confidence || 0.8)),
          evidence: fact.evidence || [],
          relatedTimeline: [],
          relatedDisputes: [],
          factType: fact.factType || 'EXPLICIT',
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
    aiExtracted?: KeyFact[]
  ): KeyFact[] {
    const facts: KeyFact[] = [];
    let idCounter = aiExtracted ? aiExtracted.length : 0;

    for (const [category, patterns] of this.factPatterns) {
      for (const pattern of patterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          // 检查是否已被AI提取层覆盖
          const isAlreadyExtracted = aiExtracted?.some(aiFact =>
            this.isSimilarFact(aiFact, match[0], category)
          );

          if (!isAlreadyExtracted) {
            const id = `rule_fact_${idCounter++}`;
            const fact = this.buildRuleBasedFact(id, category, match, text);
            if (fact) facts.push(fact);
          }
        }
      }
    }

    return facts;
  }

  /**
   * 判断两个事实是否相似
   */
  private isSimilarFact(
    aiFact: KeyFact,
    matchedText: string,
    category: FactCategory
  ): boolean {
    if (aiFact.category !== category) return false;

    const aiDesc = aiFact.description.toLowerCase();
    const matchedLower = matchedText.toLowerCase();

    return (
      aiDesc.includes(matchedLower.substring(0, 10)) ||
      matchedLower.includes(aiDesc.substring(0, 10))
    );
  }

  /**
   * 基于规则构建关键事实
   */
  private buildRuleBasedFact(
    id: string,
    category: FactCategory,
    match: RegExpMatchArray,
    fullText: string
  ): KeyFact | null {
    const matchedText = match[0];
    const description = this.extractDescription(matchedText);
    const details = this.extractDetails(matchedText, fullText);
    const importance = this.calculateImportance(matchedText, category);
    const confidence = this.calculateConfidence(matchedText);
    const factType = this.determineFactType(matchedText);
    const evidence = this.extractEvidence(matchedText, fullText);

    return {
      id,
      category,
      description,
      details,
      importance,
      confidence,
      evidence,
      relatedTimeline: [],
      relatedDisputes: [],
      factType,
    };
  }

  /**
   * 提取描述
   */
  private extractDescription(matchedText: string): string {
    const cleaned = matchedText
      .replace(/^(根据|依据|按照)\s*/g, '')
      .replace(/证据\d+[:：]\s*/g, '')
      .trim();

    return cleaned.length > 50 ? cleaned.substring(0, 50) + '...' : cleaned;
  }

  /**
   * 提取详细信息
   */
  private extractDetails(matchedText: string, fullText: string): string {
    const index = fullText.indexOf(matchedText);
    if (index === -1) return matchedText;

    const contextStart = Math.max(0, index - 50);
    const contextEnd = Math.min(
      fullText.length,
      index + matchedText.length + 100
    );
    const context = fullText.substring(contextStart, contextEnd);

    return context.trim();
  }

  /**
   * 判断事实类型
   */
  private determineFactType(matchedText: string): FactType {
    for (const [type, patterns] of this.factTypePatterns) {
      for (const pattern of patterns) {
        if (pattern.test(matchedText)) {
          return type;
        }
      }
    }
    return 'EXPLICIT';
  }

  /**
   * 计算重要性评分
   */
  private calculateImportance(
    matchedText: string,
    category: FactCategory
  ): number {
    let score = 5;

    const categoryWeights: Record<FactCategory, number> = {
      CONTRACT_TERM: 6,
      PERFORMANCE_ACT: 8,
      BREACH_BEHAVIOR: 9,
      DAMAGE_OCCURRENCE: 7,
      LEGAL_RELATION: 5,
      OTHER: 5,
    };
    score = (score + categoryWeights[category]) / 2;

    const highImportanceKeywords = [
      '违约',
      '未履行',
      '逾期',
      '损失',
      '赔偿',
      '违约金',
      '本金',
      '利息',
      '签订',
      '履行',
      '拒绝',
      '停止',
    ];
    const hasKeyword = highImportanceKeywords.some(kw =>
      matchedText.toLowerCase().includes(kw)
    );
    if (hasKeyword) score += 1;

    const factCount = matchedText.split(/[，。；；]/).length;
    if (factCount > 3) score -= 1;

    return Math.min(10, Math.max(1, Math.round(score)));
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(matchedText: string): number {
    let confidence = 0.6;

    if (/根据|依据|按照|证据/gi.test(matchedText)) {
      confidence += 0.2;
    }

    if (/\d+|年|月|日|万元|元/g.test(matchedText)) {
      confidence += 0.1;
    }

    if (/《[^》]+》|第.*条|第.*款/gi.test(matchedText)) {
      confidence += 0.1;
    }

    return Math.min(1, confidence);
  }

  /**
   * 提取证据
   */
  private extractEvidence(matchedText: string, fullText: string): string[] {
    const evidence: string[] = [];

    const patterns = [
      /证据\d+[:：]\s*([^。，]+)/gi,
      /根据\s*《([^》]+)》/gi,
      /依据\s*([^。，]+)/gi,
      /合同\s*第.*?款/gi,
      /协议\s*第.*?条/gi,
    ];

    const index = fullText.indexOf(matchedText);
    if (index !== -1) {
      const contextStart = Math.max(0, index - 100);
      const contextEnd = Math.min(
        fullText.length,
        index + matchedText.length + 100
      );
      const context = fullText.substring(contextStart, contextEnd);

      for (const pattern of patterns) {
        const matches = context.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && !evidence.includes(match[1].trim())) {
            evidence.push(match[1].trim());
          }
        }
      }
    }

    return evidence;
  }

  // =============================================================================
  // 合并和去重
  // =============================================================================

  /**
   * 合并AI和规则匹配结果，去重
   */
  private mergeAndDeduplicate(
    aiFacts: KeyFact[],
    ruleFacts: KeyFact[]
  ): KeyFact[] {
    const seen = new Set<string>();
    const unique: KeyFact[] = [];

    // 先添加AI识别的结果（置信度更高）
    for (const fact of aiFacts) {
      const key = `${fact.category}_${fact.description.substring(0, 20)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(fact);
      }
    }

    // 再添加规则匹配的结果（去重）
    for (const fact of ruleFacts) {
      const key = `${fact.category}_${fact.description.substring(0, 20)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(fact);
      }
    }

    return unique;
  }

  // =============================================================================
  // 第三层：AI审查
  // =============================================================================

  /**
   * AI审查层 - 对关键事实进行审查和修正
   */
  private async aiReviewLayer(
    facts: KeyFact[],
    originalText: string
  ): Promise<KeyFact[]> {
    try {
      const unifiedService = await getUnifiedAIService();

      const prompt = this.buildAIReviewPrompt(facts, originalText);

      const response = await unifiedService.chatCompletion({
        model: 'deepseek-chat',
        provider: 'deepseek',
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的法律关键事实审查专家。请审查和修正关键事实识别结果。',
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
          facts
        );
      }

      return facts;
    } catch (error) {
      logger.error('AI审查层失败:', error);
      return facts;
    }
  }

  /**
   * 构建AI审查提示词
   */
  private buildAIReviewPrompt(facts: KeyFact[], originalText: string): string {
    const factList = facts
      .map(
        (f, index) =>
          `${index + 1}. [${f.category}] ${f.description}
   - 详细信息: ${f.details.substring(0, 30)}...
   - 重要性: ${f.importance}
   - 置信度: ${f.confidence}
   - 事实类型: ${f.factType}`
      )
      .join('\n');

    return `请审查以下从法律文档中识别的关键事实列表，确保其准确性和完整性。

原始文档内容：
${originalText.substring(0, 1000)}...

已识别的关键事实：
${factList}

请按照以下JSON格式返回审查后的关键事实列表：

{
  "reviewedFacts": [
    {
      "id": "原ID",
      "category": "修正后的事实分类",
      "description": "修正后的事实描述",
      "details": "修正后的详细信息",
      "importance": 9,
      "confidence": 0.95,
      "factType": "修正后的事实类型",
      "evidence": ["补充证据"]
    }
  ],
  "invalidIds": ["需要删除的ID列表"]
}

审查要点：
1. 检查每个关键事实是否真实存在
2. 修正不准确的分类和描述
3. 补充缺失的详细信息
4. 调整重要性和置信度评分
5. 修正事实类型判断
6. 删除重复或不存在的事实
7. 补充遗漏的关键事实（如有）
8. 确保关键事实准确反映文档内容

注意事项：
1. 保持原有的ID，以便追溯
2. 只返回JSON格式，不要包含其他说明文字`;
  }

  /**
   * 解析AI审查响应
   */
  private parseAIReviewResponse(
    aiResponse: string,
    originalFacts: KeyFact[]
  ): KeyFact[] {
    try {
      let cleanedResponse = aiResponse.trim();

      // 尝试从响应中提取JSON
      const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResponse = jsonMatch[0];
      }

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
      const reviewedItems = parsed.reviewedFacts || [];

      return reviewedItems
        .map((item: unknown) => {
          const fact = item as AIParsedReviewedFact;
          const original = originalFacts.find(f => f.id === fact.id);

          return {
            id: fact.id || '',
            category: fact.category || 'OTHER',
            description: fact.description || original?.description || '',
            details: fact.details || original?.details || '',
            importance: Math.min(
              10,
              Math.max(1, Math.round(fact.importance || 5))
            ),
            confidence: Math.min(1, Math.max(0, fact.confidence || 0.8)),
            evidence: fact.evidence || original?.evidence || [],
            relatedTimeline: original?.relatedTimeline || [],
            relatedDisputes: original?.relatedDisputes || [],
            factType: fact.factType || original?.factType || 'EXPLICIT',
          };
        })
        .filter((item: { id: string }) => !invalidIds.has(item.id));
    } catch (error) {
      logger.error('解析AI审查响应失败:', error);
      return originalFacts;
    }
  }

  // =============================================================================
  // 辅助方法
  // =============================================================================

  /**
   * 关联提取的数据
   */
  private associateFacts(facts: KeyFact[], extractedData: ExtractedData): void {
    for (const fact of facts) {
      if (extractedData.timeline) {
        for (const event of extractedData.timeline) {
          if (this.isFactRelatedToEvent(fact, event)) {
            const timeline = fact.relatedTimeline ?? [];
            if (!timeline.includes(event.id || '')) {
              timeline.push(event.id || '');
              fact.relatedTimeline = timeline;
            }
          }
        }
      }

      if (extractedData.disputeFocuses) {
        for (const focus of extractedData.disputeFocuses) {
          if (this.isFactRelatedToFocus(fact, focus)) {
            if (!fact.relatedDisputes.includes(focus.id)) {
              fact.relatedDisputes.push(focus.id);
            }
          }
        }
      }
    }
  }

  /**
   * 判断事实是否与事件相关
   */
  private isFactRelatedToEvent(
    fact: KeyFact,
    event: { id?: string; event: string }
  ): boolean {
    const factKeywords = fact.description
      .split(/[，。；\s]/)
      .map(k => k.trim());
    const eventKeywords = event.event.split(/[，。；\s]/).map(k => k.trim());

    return factKeywords.some(fk =>
      eventKeywords.some(ek => ek.includes(fk) || fk.includes(ek))
    );
  }

  /**
   * 判断事实是否与争议焦点相关
   */
  private isFactRelatedToFocus(
    fact: KeyFact,
    focus: { id?: string; description: string }
  ): boolean {
    const factKeywords = fact.description
      .split(/[，。；\s]/)
      .map(k => k.trim());
    const focusKeywords = focus.description
      .split(/[，。；\s]/)
      .map(k => k.trim());

    return factKeywords.some(fk =>
      focusKeywords.some(fok => fok.includes(fk) || fk.includes(fok))
    );
  }

  /**
   * 生成摘要
   */
  private generateSummary(
    facts: KeyFact[],
    aiExtracted: KeyFact[],
    ruleExtracted: KeyFact[],
    aiReviewed: KeyFact[]
  ): {
    total: number;
    byCategory: Record<FactCategory, number>;
    byType: Record<FactType, number>;
    avgImportance: number;
    avgConfidence: number;
    inferredCount: number;
    aiExtractedCount: number;
    ruleExtractedCount: number;
    aiReviewedCount: number;
  } {
    const byCategory: Record<FactCategory, number> = {} as Record<
      FactCategory,
      number
    >;
    const byType: Record<FactType, number> = {} as Record<FactType, number>;
    let totalImportance = 0;
    let totalConfidence = 0;
    let inferredCount = 0;

    const allCategories: FactCategory[] = [
      'CONTRACT_TERM',
      'PERFORMANCE_ACT',
      'BREACH_BEHAVIOR',
      'DAMAGE_OCCURRENCE',
      'LEGAL_RELATION',
      'OTHER',
    ];

    for (const category of allCategories) {
      byCategory[category] = facts.filter(f => f.category === category).length;
    }

    const allTypes: FactType[] = [
      'EXPLICIT',
      'INFERRED',
      'ADMITTED',
      'DISPUTED',
    ];

    for (const type of allTypes) {
      byType[type] = facts.filter(f => f.factType === type).length;
    }

    for (const fact of facts) {
      totalImportance += fact.importance;
      totalConfidence += fact.confidence;
      if (fact.factType === 'INFERRED') inferredCount++;
    }

    return {
      total: facts.length,
      byCategory,
      byType,
      avgImportance:
        facts.length > 0 ? Math.round(totalImportance / facts.length) : 0,
      avgConfidence:
        facts.length > 0
          ? Math.round((totalConfidence / facts.length) * 100) / 100
          : 0,
      inferredCount,
      aiExtractedCount: aiExtracted.length,
      ruleExtractedCount: ruleExtracted.length,
      aiReviewedCount: aiReviewed.length,
    };
  }

  /**
   * 初始化事实模式
   */
  private initializeFactPatterns(): Map<FactCategory, RegExp[]> {
    const patterns = new Map<FactCategory, RegExp[]>();

    patterns.set('CONTRACT_TERM', [
      /合同.*约定|协议.*约定|双方.*约定/gi,
      /合同第.*?款|协议第.*?条/gi,
      /约定.*履行|约定.*支付/gi,
      /合同期限|协议期限|履行期限/gi,
    ]);

    patterns.set('PERFORMANCE_ACT', [
      /已履行.*义务|已完成.*交付|已支付.*款项/gi,
      /履行情况|交付情况|支付情况/gi,
      /原告.*履行|被告.*履行/gi,
    ]);

    patterns.set('BREACH_BEHAVIOR', [
      /未履行.*义务|未.*交付|未.*支付/gi,
      /逾期.*履行|逾期.*交付|逾期.*支付/gi,
      /拒绝.*履行|拒绝.*交付|拒绝.*支付/gi,
      /停止.*履行|终止.*履行/gi,
      /违约.*行为|违约.*事实/gi,
    ]);

    patterns.set('DAMAGE_OCCURRENCE', [
      /造成.*损失|产生.*损失|导致.*损失/gi,
      /损失.*数额|损失.*金额/gi,
      /损害.*结果|损害.*程度/gi,
    ]);

    patterns.set('LEGAL_RELATION', [
      /双方.*关系|建立.*关系|形成.*关系/gi,
      /合同关系|买卖关系|借贷关系|服务关系/gi,
      /法律关系|权利义务/gi,
    ]);

    patterns.set('OTHER', [
      /事实\s*[:：]|情况\s*[:：]/gi,
      /根据.*证据|依据.*证明/gi,
    ]);

    return patterns;
  }

  /**
   * 初始化事实类型模式
   */
  private initializeFactTypePatterns(): Map<FactType, RegExp[]> {
    const patterns = new Map<FactType, RegExp[]>();

    patterns.set('EXPLICIT', [
      /根据.*证据|依据.*证明/gi,
      /合同.*约定|协议.*约定/gi,
    ]);
    patterns.set('INFERRED', [/推断|推测|判断/gi]);
    patterns.set('ADMITTED', [/承认|认可|确认/gi]);
    patterns.set('DISPUTED', [/争议|分歧|否认|反驳/gi]);

    return patterns;
  }
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 创建默认关键事实提取器实例
 */
export function createKeyFactExtractor(): KeyFactExtractor {
  return new KeyFactExtractor();
}

/**
 * 从文本中快速提取关键事实
 */
export async function extractKeyFactsFromText(
  text: string,
  extractedData?: ExtractedData,
  options?: KeyFactExtractionOptions
): Promise<KeyFact[]> {
  const extractor = createKeyFactExtractor();
  const result = await extractor.extractFromText(text, extractedData, options);
  return result.facts;
}
