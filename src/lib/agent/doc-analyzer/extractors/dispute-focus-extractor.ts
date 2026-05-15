/**
 * 争议焦点提取器 - AI识别 + AI审查双层架构
 * AI 失败时直接抛出错误，不降级为关键词兜底。
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
  useAIExtraction?: boolean;
  useAIMatching?: boolean;
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
    ruleExtractedCount: number; // 保留字段兼容性，固定为 0
    aiReviewedCount: number;
  };
}

// =============================================================================
// 争议焦点提取器类
// =============================================================================

export class DisputeFocusExtractor {
  async extractFromText(
    text: string,
    extractedData?: ExtractedData,
    options: DisputeFocusExtractionOptions = {}
  ): Promise<DisputeFocusExtractionOutput> {
    let aiExtracted: DisputeFocus[] = [];
    let aiReviewed: DisputeFocus[] = [];

    if (options.useAIExtraction !== false) {
      aiExtracted = await this.aiExtractLayer(text, extractedData);
    }

    let mergedFocuses = aiExtracted;

    if (options.useAIMatching !== false && mergedFocuses.length > 0) {
      aiReviewed = await this.aiReviewLayer(mergedFocuses, text);
      mergedFocuses = aiReviewed;
    }

    if (options.includeInferred === false) {
      mergedFocuses = mergedFocuses.filter(f => !f._inferred);
    }

    if (options.minConfidence !== undefined) {
      const minConf = options.minConfidence;
      mergedFocuses = mergedFocuses.filter(f => f.confidence >= minConf);
    }

    const summary = this.generateSummary(
      mergedFocuses,
      aiExtracted,
      aiReviewed
    );
    return { disputeFocuses: mergedFocuses, summary };
  }

  // =============================================================================
  // 第一层：AI识别
  // =============================================================================

  private async aiExtractLayer(
    text: string,
    extractedData?: ExtractedData
  ): Promise<DisputeFocus[]> {
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
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
      maxTokens: 2000,
    });

    const content = response?.choices?.[0]?.message?.content || '';
    if (!content) return [];
    return this.parseAIExtractionResponse(content);
  }

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

  private parseAIExtractionResponse(aiResponse: string): DisputeFocus[] {
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
  // 第二层：AI审查
  // =============================================================================

  private async aiReviewLayer(
    focuses: DisputeFocus[],
    originalText: string
  ): Promise<DisputeFocus[]> {
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
        { role: 'user', content: prompt },
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
  }

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
  // 摘要生成
  // =============================================================================

  private generateSummary(
    finalFocuses: DisputeFocus[],
    aiExtracted: DisputeFocus[],
    aiReviewed: DisputeFocus[]
  ): DisputeFocusExtractionOutput['summary'] {
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
      ruleExtractedCount: 0,
      aiReviewedCount: aiReviewed.length,
    };
  }
}

// =============================================================================
// 工具函数
// =============================================================================

export function createDisputeFocusExtractor(): DisputeFocusExtractor {
  return new DisputeFocusExtractor();
}

export async function extractDisputeFocusesFromText(
  text: string,
  extractedData?: ExtractedData,
  options?: DisputeFocusExtractionOptions
): Promise<DisputeFocus[]> {
  const extractor = createDisputeFocusExtractor();
  const result = await extractor.extractFromText(text, extractedData, options);
  return result.disputeFocuses;
}
