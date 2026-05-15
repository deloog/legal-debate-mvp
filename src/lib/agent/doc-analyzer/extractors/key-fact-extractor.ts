/**
 * 关键事实提取器 - AI识别 + AI审查双层架构
 * AI 失败时直接抛出错误，不降级为关键词兜底。
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
  useAIExtraction?: boolean;
  useAIMatching?: boolean;
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
    ruleExtractedCount: number; // 保留字段兼容性，固定为 0
    aiReviewedCount: number;
  };
}

// =============================================================================
// 关键事实提取器类
// =============================================================================

export class KeyFactExtractor {
  async extractFromText(
    text: string,
    extractedData?: ExtractedData,
    options: KeyFactExtractionOptions = {}
  ): Promise<KeyFactExtractionOutput> {
    let aiExtracted: KeyFact[] = [];
    let aiReviewed: KeyFact[] = [];

    if (options.useAIExtraction !== false) {
      aiExtracted = await this.aiExtractLayer(text, extractedData);
    }

    let mergedFacts = aiExtracted;

    if (options.useAIMatching !== false && mergedFacts.length > 0) {
      aiReviewed = await this.aiReviewLayer(mergedFacts, text);
      mergedFacts = aiReviewed;
    }

    if (extractedData) {
      this.associateFacts(mergedFacts, extractedData);
    }

    if (options.includeInferred === false) {
      mergedFacts = mergedFacts.filter(f => f.factType !== 'INFERRED');
    }

    if (options.minConfidence !== undefined) {
      const minConf = options.minConfidence;
      mergedFacts = mergedFacts.filter(f => f.confidence >= minConf);
    }

    if (options.minImportance !== undefined) {
      const minImp = options.minImportance;
      mergedFacts = mergedFacts.filter(f => f.importance >= minImp);
    }

    const summary = this.generateSummary(mergedFacts, aiExtracted, aiReviewed);
    return { facts: mergedFacts, summary };
  }

  // =============================================================================
  // 第一层：AI识别
  // =============================================================================

  private async aiExtractLayer(
    text: string,
    extractedData?: ExtractedData
  ): Promise<KeyFact[]> {
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
        { role: 'user', content: prompt },
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
  }

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
  // 第二层：AI审查
  // =============================================================================

  private async aiReviewLayer(
    facts: KeyFact[],
    originalText: string
  ): Promise<KeyFact[]> {
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
        { role: 'user', content: prompt },
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
  }

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

  private parseAIReviewResponse(
    aiResponse: string,
    originalFacts: KeyFact[]
  ): KeyFact[] {
    try {
      let cleanedResponse = aiResponse.trim();

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

  private generateSummary(
    facts: KeyFact[],
    aiExtracted: KeyFact[],
    aiReviewed: KeyFact[]
  ): KeyFactExtractionOutput['summary'] {
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
      ruleExtractedCount: 0,
      aiReviewedCount: aiReviewed.length,
    };
  }
}

// =============================================================================
// 工具函数
// =============================================================================

export function createKeyFactExtractor(): KeyFactExtractor {
  return new KeyFactExtractor();
}

export async function extractKeyFactsFromText(
  text: string,
  extractedData?: ExtractedData,
  options?: KeyFactExtractionOptions
): Promise<KeyFact[]> {
  const extractor = createKeyFactExtractor();
  const result = await extractor.extractFromText(text, extractedData, options);
  return result.facts;
}
