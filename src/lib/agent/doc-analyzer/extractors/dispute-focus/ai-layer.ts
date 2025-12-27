/**
 * 争议焦点提取器 - AI识别层
 * 第一层：使用DeepSeek进行智能识别
 */

import { getUnifiedAIService } from '@/lib/ai/unified-service';
import type { DisputeFocus, DisputeFocusCategory, ExtractedData } from '../../core/types';

/**
 * AI识别层 - 使用DeepSeek进行智能识别
 */
export async function aiExtractLayer(
  text: string,
  extractedData?: ExtractedData,
  rulePatterns?: Map<DisputeFocusCategory, RegExp[]>
): Promise<DisputeFocus[]> {
  try {
    const unifiedService = await getUnifiedAIService();
    
    const prompt = buildAIExtractionPrompt(text, extractedData);
    
    const response = await unifiedService.chatCompletion({
      model: 'deepseek-chat',
      provider: 'deepseek',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的法律争议焦点识别专家。请从法律文档中准确识别争议焦点。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      maxTokens: 2000
    });

    if (response.choices && response.choices.length > 0) {
      return parseAIExtractionResponse(response.choices[0].message.content || '');
    }

    return [];
  } catch (error) {
    console.error('AI识别层失败:', error);
    return [];
  }
}

/**
 * 构建AI识别提示词
 */
function buildAIExtractionPrompt(
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
function parseAIExtractionResponse(aiResponse: string): DisputeFocus[] {
  try {
    let cleanedResponse = aiResponse.trim();
    
    // 移除代码块标记
    if (cleanedResponse.includes('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }
    if (cleanedResponse.includes('```')) {
      cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
    }
    
    const parsed = JSON.parse(cleanedResponse);
    
    if (!parsed.disputeFocuses || !Array.isArray(parsed.disputeFocuses)) {
      return [];
    }

    return parsed.disputeFocuses.map((item: any, index: number) => ({
      id: `ai_focus_${index}`,
      category: item.category,
      description: item.description || '',
      positionA: item.positionA || '未明确',
      positionB: item.positionB || '未明确',
      coreIssue: item.coreIssue || item.description?.split(/[，。；；]/)[0] || '',
      importance: Math.min(10, Math.max(1, Math.round(item.importance || 5))),
      confidence: Math.min(1, Math.max(0, item.confidence || 0.7)),
      relatedClaims: [],
      relatedFacts: [],
      evidence: item.evidence || [],
      legalBasis: item.legalBasis,
      _inferred: (item.confidence || 0.7) < 0.8
    }));
  } catch (error) {
    console.error('解析AI识别响应失败:', error);
    return [];
  }
}
