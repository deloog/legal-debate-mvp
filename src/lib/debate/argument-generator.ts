// 论点生成器：生成正反方论点

import { AIClient } from '@/lib/ai/clients';
import { PromptBuilder } from './prompt-builder';
import {
  Argument,
  DEBATE_MODE_PARAMS,
  DebateGenerationConfig,
  DebateInput,
  DEFAULT_DEBATE_CONFIG,
} from './types';

/**
 * AI生成的论点数据结构
 */
interface GeneratedArgumentData {
  type: string;
  content: string;
  reasoning: string;
  legalBasis: Array<{
    lawName: string;
    articleNumber: string;
    relevance: number;
    explanation: string;
  }>;
}

/**
 * AI响应格式
 */
interface AIResponseData {
  arguments: GeneratedArgumentData[];
}

/**
 * 论点生成器类
 */
export class ArgumentGenerator {
  private aiClient: AIClient;
  private config: DebateGenerationConfig;
  private seed: number = 0;

  constructor(
    aiClient: AIClient,
    config: Partial<DebateGenerationConfig> = {}
  ) {
    this.aiClient = aiClient;
    this.config = { ...DEFAULT_DEBATE_CONFIG, ...config };
  }

  /**
   * 生成正方论点
   */
  async generatePlaintiffArguments(input: DebateInput): Promise<Argument[]> {
    return this.generateArguments(input, 'plaintiff');
  }

  /**
   * 生成反方论点
   */
  async generateDefendantArguments(input: DebateInput): Promise<Argument[]> {
    return this.generateArguments(input, 'defendant');
  }

  /**
   * 生成论点（通用方法）
   */
  private async generateArguments(
    input: DebateInput,
    side: 'plaintiff' | 'defendant'
  ): Promise<Argument[]> {
    const startTime = Date.now();

    // 构建提示词
    const promptOptions = PromptBuilder.buildDebatePrompt(input, side, {
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    // 调用AI生成
    const aiResponse = await this.callAI(promptOptions);

    // 解析AI响应
    const generatedData = this.parseAIResponse(aiResponse);

    // 转换为Argument格式
    const arguments_ = this.convertToArguments(
      generatedData,
      side,
      Date.now() - startTime
    );

    // 确保平衡
    this.ensureBalance(arguments_, side);

    return arguments_;
  }

  /**
   * 调用AI服务
   */
  private async callAI(promptOptions: {
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string> {
    const messages = [
      { role: 'system' as const, content: promptOptions.systemPrompt || '' },
      { role: 'user' as const, content: promptOptions.userPrompt },
    ];

    try {
      return await this.aiClient.chat(messages, {
        temperature: promptOptions.temperature ?? this.config.temperature,
        maxTokens: promptOptions.maxTokens ?? this.config.maxTokens,
      });
    } catch (error) {
      console.error('AI调用失败:', error);
      throw new Error(
        `论点生成失败: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 解析AI响应
   */
  private parseAIResponse(response: string): AIResponseData {
    try {
      // 尝试直接解析JSON
      const parsed = JSON.parse(response);

      // 兼容两种格式：{ arguments: [...] } 或 [...]
      if (Array.isArray(parsed)) {
        return { arguments: parsed };
      }

      return parsed as AIResponseData;
    } catch {
      // 如果直接解析失败，尝试提取JSON代码块
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1]) as AIResponseData;
        } catch {
          // JSON代码块也解析失败，继续尝试其他方式
        }
      }

      // 尝试提取花括号内的内容
      const braceMatch = response.match(/\{[\s\S]*\}/);
      if (braceMatch) {
        try {
          return JSON.parse(braceMatch[0]) as AIResponseData;
        } catch {
          // 花括号内容也解析失败
        }
      }

      // 所有解析方式都失败，返回默认空数组
      console.warn('AI响应解析失败，返回空数组');
      return { arguments: [] };
    }
  }

  /**
   * 转换为Argument格式
   */
  private convertToArguments(
    data: AIResponseData,
    side: 'plaintiff' | 'defendant',
    generationTime: number
  ): Argument[] {
    if (!data.arguments || !Array.isArray(data.arguments)) {
      console.warn('AI响应中缺少有效的arguments数组');
      return [];
    }

    return data.arguments.map((arg, index) => {
      // 验证法条引用
      const legalBasis = arg.legalBasis.map(basis => ({
        ...basis,
        relevance: Math.min(1, Math.max(0, basis.relevance || 0.8)),
      }));

      // 计算质量分数
      const logicScore = this.calculateLogicScore(arg);
      const legalAccuracyScore = this.calculateLegalAccuracyScore(arg);

      return {
        id: `arg_${side}_${Date.now()}_${index}`,
        side,
        type: this.validateArgumentType(arg.type),
        content: arg.content,
        reasoning: arg.reasoning,
        legalBasis,
        logicScore,
        legalAccuracyScore,
        overallScore: (logicScore + legalAccuracyScore) / 2,
        generatedBy: 'ai',
        aiProvider: this.config.aiProvider,
        generationTime,
      };
    });
  }

  /**
   * 验证论点类型
   */
  private validateArgumentType(type: string): Argument['type'] {
    const validTypes = [
      'main_point',
      'supporting',
      'rebuttal',
      'evidence',
      'conclusion',
    ];

    if (validTypes.includes(type)) {
      return type as Argument['type'];
    }

    return 'main_point'; // 默认为主论点
  }

  /**
   * 计算逻辑分数
   */
  private calculateLogicScore(arg: GeneratedArgumentData): number {
    let score = 5.0; // 基础分

    // 论点内容长度（适当长度表明有足够推理）
    if (arg.content.length >= 50 && arg.content.length <= 200) {
      score += 1.5;
    } else if (arg.content.length > 20) {
      score += 1.0;
    }

    // 推理过程长度
    if (arg.reasoning.length >= 100 && arg.reasoning.length <= 500) {
      score += 2.0;
    } else if (arg.reasoning.length > 50) {
      score += 1.0;
    }

    // 有法律依据
    if (arg.legalBasis.length > 0) {
      score += 1.5;
    }

    return Math.min(10, Math.max(0, score));
  }

  /**
   * 计算法律准确性分数
   */
  private calculateLegalAccuracyScore(arg: GeneratedArgumentData): number {
    let score = 5.0; // 基础分

    // 法条数量
    if (arg.legalBasis.length >= 1 && arg.legalBasis.length <= 3) {
      score += 2.0;
    } else if (arg.legalBasis.length > 0) {
      score += 1.0;
    }

    // 法条相关性平均分
    if (arg.legalBasis.length > 0) {
      const avgRelevance =
        arg.legalBasis.reduce((sum, b) => sum + (b.relevance || 0), 0) /
        arg.legalBasis.length;
      score += avgRelevance * 3;
    }

    // 法条说明长度
    const hasExplanation = arg.legalBasis.some(
      b => b.explanation && b.explanation.length > 20
    );
    if (hasExplanation) {
      score += 0.5;
    }

    return Math.min(10, Math.max(0, score));
  }

  /**
   * 确保正反方平衡
   */
  private ensureBalance(
    arguments_: Argument[],
    side: 'plaintiff' | 'defendant'
  ): void {
    // 根据平衡严格度确定目标论点数量
    const targetCount = this.getTargetArgumentCount();

    // 如果论点数量不足，补充论点
    if (arguments_.length < targetCount) {
      console.warn(
        `${side}论点数量不足（${arguments_.length}/${targetCount}），建议增加`
      );
    }

    // 如果论点数量过多，截断
    if (arguments_.length > targetCount + 1) {
      arguments_.length = targetCount + 1;
    }
  }

  /**
   * 获取模式参数
   */
  private getModeConfig() {
    return DEBATE_MODE_PARAMS[this.config.debateMode || 'standard'];
  }

  /**
   * 获取目标论点数量
   */
  private getTargetArgumentCount(): number {
    const modeConfig = this.getModeConfig();
    switch (this.config.balanceStrictness) {
      case 'low':
        return Math.round(modeConfig.mainPointCount * 0.8);
      case 'medium':
        return modeConfig.mainPointCount;
      case 'high':
        return Math.round(modeConfig.mainPointCount * 1.2);
    }
  }

  /**
   * 获取推理长度限制
   */
  private getMaxReasoningLength(): number {
    const modeConfig = this.getModeConfig();
    return Math.round(400 * modeConfig.reasoningLengthFactor);
  }

  /**
   * 获取目标法律依据数量
   */
  private getTargetLegalBasisCount(): number {
    const modeConfig = this.getModeConfig();
    return Math.round(2 * modeConfig.legalBasisFactor);
  }

  /**
   * 生成随机ID
   */
  private generateId(): string {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return `arg_${this.seed}`;
  }
}
