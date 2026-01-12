/**
 * AI Helpers - AI辅助功能
 * 生成学习笔记、提取预防措施、生成建议操作
 */

import { v4 as uuidv4 } from 'uuid';
import { AIService } from '@/lib/ai/service-refactored';
import type { AIRequestConfig, AIResponse } from '@/types/ai-service';
import type { ErrorPattern, PreventionMeasure } from '../types';

/**
 * AI Helpers - AI辅助功能类
 */
export class AIHelpers {
  constructor(private aiService: AIService) {}

  /**
   * 生成学习笔记
   */
  async generateLearningNotes(
    error: {
      errorType: string;
      errorCode: string;
      errorMessage: string;
    },
    pattern: ErrorPattern
  ): Promise<string> {
    const prompt = `请为以下错误生成学习笔记：

错误类型：${error.errorType}
错误代码：${error.errorCode}
错误消息：${error.errorMessage}
根本原因：${pattern.rootCause}
频率：${pattern.frequency}
常见原因：
${pattern.commonCauses.map((c, i) => `${i + 1}. ${c}`).join('\n')}

要求：
1. 笔记长度100-200字
2. 包含关键教训
3. 列出2-3个避免方法
4. 使用简洁、易懂的语言`;

    const requestConfig: AIRequestConfig = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的错误学习助手，擅长生成简洁有用的学习笔记。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.4,
      maxTokens: 400,
    };

    const response: AIResponse =
      await this.aiService.chatCompletion(requestConfig);

    return response.choices[0]?.message?.content?.trim() || '';
  }

  /**
   * 提取预防措施
   */
  async extractPreventionMeasures(
    learningNotes: string
  ): Promise<PreventionMeasure[]> {
    const prompt = `请从以下学习笔记中提取3-5个预防措施：

${learningNotes}

返回格式：JSON数组
每个措施包含：
- measureId: 唯一ID（生成）
- description: 措施描述
- priority: 优先级（1-5，5最高）
- implementation: 实施方法（简短）
- estimatedEffectiveness: 预估效果（0-1）`;

    const requestConfig: AIRequestConfig = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的预防措施提取助手，擅长从学习笔记中提取可行的预防措施。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      maxTokens: 600,
    };

    const response: AIResponse =
      await this.aiService.chatCompletion(requestConfig);

    // 解析AI返回的JSON
    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const measures = JSON.parse(jsonMatch[0]);
        return Array.isArray(measures)
          ? measures.map(m => ({
              ...m,
              measureId: m.measureId || uuidv4(),
              priority: m.priority || 3,
              estimatedEffectiveness: m.estimatedEffectiveness || 0.8,
            }))
          : [];
      } catch {
        // JSON解析失败，返回空数组
        return [];
      }
    }

    return [];
  }

  /**
   * 生成建议操作
   */
  async generateSuggestedActions(
    error: {
      errorType: string;
      errorCode: string;
      errorMessage: string;
    },
    pattern: ErrorPattern
  ): Promise<string[]> {
    const prompt = `基于以下错误信息，生成3-5个建议操作：

错误类型：${error.errorType}
错误代码：${error.errorCode}
错误消息：${error.errorMessage}
根本原因：${pattern.rootCause}

要求：返回可操作的建议，每行一条`;

    const requestConfig: AIRequestConfig = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的错误处理助手，擅长生成可操作的解决建议。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      maxTokens: 400,
    };

    const response: AIResponse =
      await this.aiService.chatCompletion(requestConfig);

    const content = response.choices[0]?.message?.content || '';
    return content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 5);
  }
}
