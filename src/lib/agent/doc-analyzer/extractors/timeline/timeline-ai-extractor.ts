/**
 * 时间线AI提取器
 * 第一层：AI识别提取
 */

import type { ExtractedData, TimelineEvent } from '../../core/types';
import { getUnifiedAIService } from '@/lib/ai/unified-service';
import { parseAIExtractionResponse } from './timeline-parser';
import { logger } from '@/lib/logger';

/**
 * AI识别层 - 使用DeepSeek进行智能识别
 */
export async function aiExtractLayer(
  text: string,
  extractedData?: ExtractedData
): Promise<TimelineEvent[]> {
  try {
    const unifiedService = await getUnifiedAIService();

    const prompt = buildAIExtractionPrompt(text, extractedData);

    const response = await unifiedService.chatCompletion({
      model: 'deepseek-chat',
      provider: 'deepseek',
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的法律事件时间线识别专家。请从法律文档中准确提取事件时间线。',
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
      return parseAIExtractionResponse(
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
 * 优化提示词，强制JSON格式输出
 */
function buildAIExtractionPrompt(
  text: string,
  extractedData?: ExtractedData
): string {
  let contextInfo = '';

  if (
    extractedData?.disputeFocuses &&
    extractedData.disputeFocuses.length > 0
  ) {
    contextInfo += `\n争议焦点信息：\n${extractedData.disputeFocuses.map(d => d.description).join('\n')}`;
  }

  return `请从以下法律文档中准确提取事件时间线，并严格按照指定的JSON格式返回结果。

文档内容：
${text}
${contextInfo}

【重要】你必须严格按照以下JSON格式返回结果，不要包含任何其他文字、说明或解释：

{
  "timelineEvents": [
    {
      "date": "YYYY-MM-DD",
      "event": "事件描述",
      "eventType": "CONTRACT_SIGNED|PERFORMANCE_START|BREACH_OCCURRED|DEMAND_SENT|LAWSUIT_FILED|OTHER",
      "importance": 5,
      "evidence": ["证据1", "证据2"]
    }
  ]
}

事件类型说明：
- CONTRACT_SIGNED: 合同签订/签署
- PERFORMANCE_START: 开始履行
- BREACH_OCCURRED: 发生违约
- DEMAND_SENT: 发送催告/通知
- LAWSUIT_FILED: 提起诉讼
- OTHER: 其他事件

示例输出格式（请严格参考）：
{
  "timelineEvents": [
    {
      "date": "2024-01-15",
      "event": "双方签订合同",
      "eventType": "CONTRACT_SIGNED",
      "importance": 5,
      "evidence": ["合同文本"]
    },
    {
      "date": "2024-02-01",
      "event": "被告违约",
      "eventType": "BREACH_OCCURRED",
      "importance": 4,
      "evidence": []
    }
  ]
}

提取要点：
1. 仔细提取文档中的所有日期和对应事件
2. 事件描述要简洁准确
3. 重要性评分范围1-5，数值越大越重要
4. 【关键】只返回上面的JSON格式，绝对不要包含其他任何说明文字、引言、解释或总结`;
}
