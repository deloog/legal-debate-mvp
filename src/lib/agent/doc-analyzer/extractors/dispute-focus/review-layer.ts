/**
 * 争议焦点提取器 - AI审查层
 * 第三层：对争议焦点进行审查和修正
 */

import { getUnifiedAIService } from '@/lib/ai/unified-service';
import type { DisputeFocus, DisputeFocusCategory } from '../../core/types';
import { logger } from '../../../security/logger';

/**
 * AI审查层 - 对争议焦点进行审查和修正
 */
export async function aiReviewLayer(
  focuses: DisputeFocus[],
  originalText: string
): Promise<DisputeFocus[]> {
  try {
    const unifiedService = await getUnifiedAIService();

    const prompt = buildAIReviewPrompt(focuses, originalText);

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
      return parseAIReviewResponse(
        response.choices[0].message.content || '',
        focuses
      );
    }

    return focuses;
  } catch (error) {
    logger.error('AI审查层失败', error instanceof Error ? error : new Error(String(error)));
    return focuses;
  }
}

/**
 * 构建AI审查提示词
 */
function buildAIReviewPrompt(
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
function parseAIReviewResponse(
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
        const importance =
          typeof item.importance === 'number' ? item.importance : 5;
        const confidence =
          typeof item.confidence === 'number' ? item.confidence : 0.8;

        return {
          id: item.id as string,
          category: item.category as DisputeFocusCategory,
          description:
            (item.description as string) || original?.description || '',
          positionA:
            (item.positionA as string) || original?.positionA || '未明确',
          positionB:
            (item.positionB as string) || original?.positionB || '未明确',
          coreIssue:
            (item.coreIssue as string) || original?.coreIssue || '',
          importance: Math.min(10, Math.max(1, Math.round(importance))),
          confidence: Math.min(1, Math.max(0, confidence)),
          relatedClaims: original?.relatedClaims || [],
          relatedFacts: original?.relatedFacts || [],
          evidence:
            (item.evidence as string[]) || original?.evidence || [],
          legalBasis:
            (item.legalBasis as string | undefined) || original?.legalBasis,
          _inferred: confidence < 0.9,
        };
      })
      .filter(item => !invalidIds.has(item.id));
  } catch (error) {
    logger.error('解析AI审查响应失败', error instanceof Error ? error : new Error(String(error)));
    return originalFocuses;
  }
}
