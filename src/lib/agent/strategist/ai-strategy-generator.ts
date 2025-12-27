/**
 * AI策略生成器
 * 
 * 使用DeepSeek API生成SWOT分析和策略建议
 */

import type { AIStrategyResponse } from './types';
import { logger } from '../security/logger';
import type { AIService } from '../../ai/service';

// =============================================================================
// AI策略生成器类
// =============================================================================

export class AIStrategyGenerator {
  private aiService: AIService | null = null;
  private config: {
    temperature: number;
    maxTokens: number;
    timeout: number;
  };

  constructor() {
    this.config = {
      temperature: 0.7,
      maxTokens: 2000,
      timeout: 30000
    };
  }

  /**
   * 初始化AI服务
   */
  async initialize(aiService: AIService): Promise<void> {
    this.aiService = aiService;
    logger.info('AIStrategyGenerator初始化成功', {
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    });
  }

  /**
   * 生成策略
   */
  async generateStrategy(
    caseInfo: string,
    legalAnalysis: string,
    context?: string
  ): Promise<AIStrategyResponse> {
    if (!this.aiService) {
      throw new Error('AI服务未初始化，请先调用initialize()方法');
    }

    const prompt = this.buildPrompt(caseInfo, legalAnalysis, context);
    const startTime = Date.now();

    try {
      logger.info('开始AI策略生成', {
        promptLength: prompt.length
      });

      const response = await this.aiService.chatCompletion({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        timeout: this.config.timeout
      });

      const processingTime = Date.now() - startTime;
      logger.info('AI策略生成完成', { processingTime });

      // 解析响应
      return this.parseResponse(response);
    } catch (error) {
      logger.error('AI策略生成失败', error);
      throw new Error(
        `AI策略生成失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 构建提示词
   */
  private buildPrompt(
    caseInfo: string,
    legalAnalysis: string,
    context?: string
  ): string {
    let prompt = `请基于以下案件信息和法条分析结果，生成详细的诉讼策略：

## 案件信息
${caseInfo}

## 法条分析结果
${legalAnalysis}
`;

    if (context) {
      prompt += `\n## 案件上下文\n${context}`;
    }

    prompt += `

请按照以下JSON格式生成策略：
{
  "swotAnalysis": {
    "strengths": ["优势1", "优势2", ...],
    "weaknesses": ["劣势1", "劣势2", ...],
    "opportunities": ["机会1", "机会2", ...],
    "threats": ["威胁1", "威胁2", ...]
  },
  "strategies": [
    {
      "strategy": "策略名称",
      "rationale": "策略理由",
      "implementationSteps": ["步骤1", "步骤2", ...],
      "expectedOutcome": "预期结果"
    }
  ],
  "risks": [
    {
      "factor": "风险因素",
      "impact": "high|medium|low",
      "probability": 0.0-1.0,
      "mitigation": "应对措施"
    }
  ]
}

要求：
1. SWOT分析要全面客观，每个类别至少3条
2. 策略建议要具体可行，至少提供3条策略
3. 实施步骤要清晰可操作，每条策略至少3个步骤
4. 风险评估要基于法律依据，至少识别3个风险因素
5. 概率值使用0.0-1.0的小数表示
6. 输出必须是有效的JSON格式
`;

    return prompt;
  }

  /**
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `你是一个专业的法律策略分析师，拥有丰富的诉讼策略制定经验。
你的任务是基于案件信息和法条分析结果，为律师制定全面、可操作的诉讼策略。

你的输出必须：
1. 基于事实和法律依据
2. 具体可行，避免空泛建议
3. 逻辑清晰，层次分明
4. 风险评估客观准确

输出格式必须是有效的JSON，不要包含任何其他文字说明。`;
  }

  /**
   * 解析AI响应
   */
  private parseResponse(response: any): AIStrategyResponse {
    try {
      const content = response?.output || response?.content || '';

      // 尝试提取JSON内容
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON格式');
      }

      const jsonResponse = JSON.parse(jsonMatch[0]);

      // 验证结构
      this.validateResponse(jsonResponse);

      return jsonResponse;
    } catch (error) {
      logger.error('AI响应解析失败', error);
      throw new Error(
        `AI响应解析失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 验证响应结构
   */
  private validateResponse(response: any): void {
    const errors: string[] = [];

    // 验证SWOT分析
    if (!response.swotAnalysis) {
      errors.push('缺少swotAnalysis字段');
    } else {
      if (!Array.isArray(response.swotAnalysis.strengths)) {
        errors.push('swotAnalysis.strengths必须是数组');
      }
      if (!Array.isArray(response.swotAnalysis.weaknesses)) {
        errors.push('swotAnalysis.weaknesses必须是数组');
      }
      if (!Array.isArray(response.swotAnalysis.opportunities)) {
        errors.push('swotAnalysis.opportunities必须是数组');
      }
      if (!Array.isArray(response.swotAnalysis.threats)) {
        errors.push('swotAnalysis.threats必须是数组');
      }
    }

    // 验证策略建议
    if (!Array.isArray(response.strategies)) {
      errors.push('strategies必须是数组');
    }

    // 验证风险评估
    if (!Array.isArray(response.risks)) {
      errors.push('risks必须是数组');
    }

    if (errors.length > 0) {
      throw new Error(`响应结构验证失败: ${errors.join(', ')}`);
    }
  }

  /**
   * 更新配置
   */
  configure(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config };
    logger.info('AIStrategyGenerator配置已更新', { config: this.config });
  }
}
