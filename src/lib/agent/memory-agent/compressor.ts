/**
 * MemoryCompressor - 记忆压缩算法
 * 实现AI摘要生成、关键信息提取、压缩比例计算
 */

import { AIService } from '@/lib/ai/service-refactored';
import type { AIRequestConfig, AIResponse } from '@/types/ai-service';
import type { Memory, CompressionResult, KeyInfo } from './types';

/**
 * 压缩比配置
 */
const COMPRESSION_RATIO_CONFIG = {
  WORKING_TO_HOT: 0.7, // 70%（保留主要信息）
  HOT_TO_COLD: 0.1, // 10%（仅保留关键摘要）
};

/**
 * 重要性阈值（低于此值使用规则压缩）
 */
const IMPORTANCE_THRESHOLD_FOR_AI = 0.7;

/**
 * MemoryCompressor - 记忆压缩类
 */
export class MemoryCompressor {
  constructor(private aiService: AIService) {}

  /**
   * 压缩记忆
   */
  async compressMemory(memory: Memory): Promise<CompressionResult> {
    try {
      // 选择压缩策略
      const useAI = memory.importance >= IMPORTANCE_THRESHOLD_FOR_AI;

      if (useAI) {
        // AI压缩（高质量）
        const summary = await this.generateAISummary(memory.memoryValue);
        const keyInfo = await this.extractKeyInfo(memory.memoryValue);

        return {
          success: true,
          summary,
          keyInfo,
          ratio: this.calculateCompressionRatio(memory.memoryValue, {
            summary,
            keyInfo,
          }),
        };
      } else {
        // 规则压缩（低成本）
        return await this.ruleBasedCompression(memory.memoryValue);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 确定目标压缩比
   */
  private _determineTargetRatio(memory: Memory): number {
    // 根据记忆类型确定
    if (memory.memoryType === 'WORKING') {
      return COMPRESSION_RATIO_CONFIG.WORKING_TO_HOT;
    }
    if (memory.memoryType === 'HOT') {
      return COMPRESSION_RATIO_CONFIG.HOT_TO_COLD;
    }
    return 0.1; // Cold Memory最小化
  }

  /**
   * AI摘要生成
   */
  private async generateAISummary(data: unknown): Promise<string> {
    const prompt = this.buildSummaryPrompt(data);

    const requestConfig: AIRequestConfig = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的法律信息摘要助手，擅长提取关键信息和生成简洁摘要。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      maxTokens: 500,
    };

    const response: AIResponse =
      await this.aiService.chatCompletion(requestConfig);

    return response.choices[0]?.message?.content?.trim() || '';
  }

  /**
   * 构建摘要Prompt
   */
  private buildSummaryPrompt(data: unknown): string {
    const json = JSON.stringify(data, null, 2);

    return `请对以下JSON数据进行摘要，提取最关键的信息：

${json}

要求：
1. 摘要长度控制在100-200字
2. 保留所有关键数值和重要事实
3. 按重要性从高到低排列
4. 输出格式为纯文本`;
  }

  /**
   * 提取关键信息
   */
  private async extractKeyInfo(data: unknown): Promise<KeyInfo[]> {
    const prompt = this.buildKeyInfoPrompt(data);

    const requestConfig: AIRequestConfig = {
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content:
            '你是一个专业的信息提取助手，擅长从结构化数据中提取关键信息。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
      maxTokens: 800,
    };

    const response: AIResponse =
      await this.aiService.chatCompletion(requestConfig);

    // 解析AI返回的JSON
    const content = response.choices[0]?.message?.content || '';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        // JSON解析失败，使用规则提取
        return this.extractKeyInfoByRules(data);
      }
    }

    return this.extractKeyInfoByRules(data);
  }

  /**
   * 构建关键信息Prompt
   */
  private buildKeyInfoPrompt(data: unknown): string {
    const json = JSON.stringify(data, null, 2);

    return `请从以下JSON数据中提取最关键的3-5个信息项：

${json}

要求：
1. 返回JSON数组格式
2. 每个信息项包含：field（字段名）、value（值）、importance（重要性0-1）
3. 按重要性从高到低排序
4. 忽略元数据（如id、createdAt等）`;
  }

  /**
   * 规则提取关键信息（降级方案）
   */
  private extractKeyInfoByRules(data: unknown): KeyInfo[] {
    const keyInfo: KeyInfo[] = [];

    const extractValue = (
      obj: Record<string, unknown>,
      keys: string[],
      importance: number
    ) => {
      for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
          keyInfo.push({
            field: key,
            value: obj[key],
            importance,
          });
        }
      }
    };

    // 检查是否为对象类型
    if (typeof data === 'object' && data !== null) {
      const dataObj = data as Record<string, unknown>;

      // 高重要性字段
      extractValue(dataObj, ['amount', 'date', 'party', 'claim'], 1.0);

      // 中重要性字段
      extractValue(dataObj, ['fact', 'evidence', 'argument'], 0.8);

      // 低重要性字段
      extractValue(dataObj, ['description', 'note', 'comment'], 0.5);
    }

    // 按重要性排序
    return keyInfo.sort((a, b) => b.importance - a.importance).slice(0, 5);
  }

  /**
   * 计算压缩比
   */
  private calculateCompressionRatio(
    original: unknown,
    compressed: { summary: string; keyInfo: KeyInfo[] }
  ): number {
    const originalSize = JSON.stringify(original).length;
    const compressedSize =
      compressed.summary.length + JSON.stringify(compressed.keyInfo).length;

    return originalSize > 0 ? compressedSize / originalSize : 0;
  }

  /**
   * 基于规则的压缩（降级方案）
   */
  private async ruleBasedCompression(
    data: unknown
  ): Promise<CompressionResult> {
    const summary = this.generateRuleSummary(data);
    const keyInfo = this.extractKeyInfoByRules(data);

    return {
      success: true,
      summary,
      keyInfo,
      ratio: this.calculateCompressionRatio(data, { summary, keyInfo }),
    };
  }

  /**
   * 生成规则摘要（降级方案）
   */
  private generateRuleSummary(data: unknown): string {
    if (typeof data === 'string') {
      // 字符串直接截断
      return data.length > 100 ? data.slice(0, 100) + '...' : data;
    }

    if (typeof data === 'object' && data !== null) {
      // 对象提取关键字段
      const keys = Object.keys(data as Record<string, unknown>).slice(0, 3);
      const parts = keys.map(
        key =>
          `${key}:${JSON.stringify((data as Record<string, unknown>)[key])}`
      );
      return parts.join(', ');
    }

    return String(data).slice(0, 100);
  }
}
