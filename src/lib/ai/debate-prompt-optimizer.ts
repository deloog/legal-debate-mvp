/**
 * 辩论提示词优化器
 *
 * 用于提升AI生成的辩论论点逻辑性
 * 使用Chain-of-Thought推理、Few-Shot示例和结构化提示
 */

import type { AIService } from '@/lib/ai/service-refactored';
import type { Argument, CaseInfo } from '@/types/debate';
import { logger } from '@/lib/logger';

// =============================================================================
// 类型定义
// =============================================================================

export interface OptimizedDebatePrompt {
  systemPrompt: string;
  userPrompt: string;
  reasoningSteps?: string[];
  examples?: DebateExample[];
}

export interface DebateExample {
  case: CaseInfo;
  plaintiff: Argument;
  defendant: Argument;
  evaluation: {
    logicalScore: number;
    factualAccuracy: number;
    completeness: number;
  };
}

export interface OptimizationConfig {
  enableCoT: boolean;
  enableFewShot: boolean;
  maxExamples: number;
  complexityLevel: 'basic' | 'intermediate' | 'advanced';
}

// =============================================================================
// 提示词优化器类
// =============================================================================

export class DebatePromptOptimizer {
  private aiService: AIService;
  private config: OptimizationConfig;
  private successExamples: DebateExample[];

  constructor(aiService: AIService, config: Partial<OptimizationConfig> = {}) {
    this.aiService = aiService;
    this.config = {
      enableCoT: true,
      enableFewShot: true,
      maxExamples: 2,
      complexityLevel: 'advanced',
      ...config,
    };
    this.successExamples = this.loadSuccessExamples();
  }

  /**
   * 加载成功案例（Few-Shot示例）
   */
  private loadSuccessExamples(): DebateExample[] {
    return [
      {
        case: {
          title: '合同纠纷案例',
          description:
            '原告张三与被告李四签订买卖合同，约定货款10万元，被告未按期付款',
          type: 'contract',
        },
        plaintiff: {
          side: 'plaintiff',
          content:
            '根据《民法典》第509条，当事人应当按照约定全面履行自己的义务。被告未按期付款，构成违约，应承担继续履行、赔偿损失等违约责任。',
          legalBasis: '民法典第509条',
          reasoning: '合同约定了付款义务，被告违反约定构成违约行为',
          score: 0.95,
        },
        defendant: {
          side: 'defendant',
          content:
            '双方已协商延期付款，原告予以同意，不构成违约。且货物存在质量问题，我方有权行使先履行抗辩权。',
          legalBasis: '民法典第527条',
          reasoning: '协商变更了履行期限，且货物质量存在瑕疵',
          score: 0.93,
        },
        evaluation: {
          logicalScore: 0.94,
          factualAccuracy: 0.95,
          completeness: 0.93,
        },
      },
      {
        case: {
          title: '劳动纠纷案例',
          description: '员工王某因公司拖欠工资申请劳动仲裁',
          type: 'labor',
        },
        plaintiff: {
          side: 'plaintiff',
          content:
            '根据《劳动合同法》第30条，用人单位应当按照劳动合同约定和国家规定，向劳动者及时足额支付劳动报酬。公司拖欠3个月工资，严重违法。',
          legalBasis: '劳动合同法第30条',
          reasoning: '公司未按时支付劳动报酬，违反法律规定',
          score: 0.96,
        },
        defendant: {
          side: 'defendant',
          content:
            '员工未完成工作任务，公司有权暂缓支付工资。且员工擅自离职，给公司造成损失，应予赔偿。',
          legalBasis: '劳动合同法第39条',
          reasoning: '员工未完成任务且擅自离职，公司存在正当抗辩理由',
          score: 0.91,
        },
        evaluation: {
          logicalScore: 0.93,
          factualAccuracy: 0.95,
          completeness: 0.94,
        },
      },
    ];
  }

  /**
   * 生成优化后的提示词
   */
  public async generateOptimizedPrompt(
    caseInfo: CaseInfo,
    legalReferences: string[] = []
  ): Promise<OptimizedDebatePrompt> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = await this.buildUserPrompt(caseInfo, legalReferences);

    return {
      systemPrompt,
      userPrompt,
      reasoningSteps: this.buildReasoningSteps(),
      examples: this.config.enableFewShot
        ? this.selectRelevantExamples()
        : undefined,
    };
  }

  /**
   * 构建系统提示词（增强版）
   */
  private buildSystemPrompt(): string {
    const basePrompt =
      '你是一个专业的法律辩论助手，擅长生成逻辑清晰、法律依据准确的辩论论点。';

    const logicRequirements = `
逻辑要求：
1. 每个论点必须包含明确的主张、事实依据和法律依据
2. 使用清晰逻辑连接词（因此、基于此、根据、由于、因为、所以、鉴于、由此可见、综上所述、从而、进而、故此）
3. 确保推理链条完整，至少包含2个推理步骤
4. 主张与依据之间必须有强因果关系（使用"导致"、"引起"、"造成"、"基于...所以"、"因为...因此"等表达）
5. 避免逻辑矛盾和循环论证
6. 推理过程应遵循：分析→判断→结论的逻辑顺序
`;

    const structureRequirements = `
结构要求：
1. 每个论点包含3-4个核心论据
2. 按重要性排序，先主后次
3. 使用专业法律术语，避免口语化表达
4. 确保正反方论点数量和长度平衡（各3-4个论点）
5. 论点格式：主张（核心观点）→事实依据（引用案情）→法律依据（具体法条）→推理过程（因果分析）
`;

    const qualityRequirements = `
质量要求：
1. 法律依据准确，必须引用具体法条号（如"第509条"）
2. 事实依据与案情一致，不虚构事实
3. 推理过程清晰，包含因果关系分析（至少50字）
4. 语言简洁，避免冗余
5. 确保每个论点都有独立的价值，避免重复
`;

    return `${basePrompt}${logicRequirements}${structureRequirements}${qualityRequirements}`;
  }

  /**
   * 构建用户提示词
   */
  private async buildUserPrompt(
    caseInfo: CaseInfo,
    legalReferences: string[]
  ): Promise<string> {
    let prompt = '';

    if (this.config.enableFewShot && this.successExamples.length > 0) {
      const examples = this.selectRelevantExamples();
      prompt += '以下是一些高质量辩论论点示例：\n\n';
      for (const example of examples) {
        prompt += this.formatExample(example);
        prompt += '\n---\n';
      }
      prompt += '\n';
    }

    prompt += `当前案件：${caseInfo.title}\n`;
    prompt += `案情描述：${caseInfo.description}\n`;

    if (legalReferences.length > 0) {
      prompt += `\n相关法条：${legalReferences.join('、')}\n`;
    }

    if (this.config.enableCoT) {
      prompt += `\n请按照以下推理步骤生成论点：\n`;
      prompt += `1. 分析案件争议焦点\n`;
      prompt += `2. 识别关键事实\n`;
      prompt += `3. 匹配适用法条\n`;
      prompt += `4. 构建论证逻辑链\n`;
      prompt += `5. 形成完整论点\n`;
    }

    prompt += `\n请分别列出原告和被告的3-4个核心论点，每个论点包含：主张、法律依据、事实依据、推理过程。`;

    return prompt;
  }

  /**
   * 选择相关示例
   */
  private selectRelevantExamples(): DebateExample[] {
    return this.successExamples.slice(0, this.config.maxExamples);
  }

  /**
   * 格式化示例
   */
  private formatExample(example: DebateExample): string {
    return `案件：${example.case.title}
案情：${example.case.description}

原告论点：
${example.plaintiff.content}
- 法律依据：${example.plaintiff.legalBasis}
- 推理过程：${example.plaintiff.reasoning}

被告论点：
${example.defendant.content}
- 法律依据：${example.defendant.legalBasis}
- 推理过程：${example.defendant.reasoning}`;
  }

  /**
   * 构建推理步骤
   */
  private buildReasoningSteps(): string[] {
    return [
      '分析案件类型和争议焦点',
      '提取关键事实信息',
      '检索相关法律法规',
      '匹配适用的法条',
      '构建论证逻辑链',
      '形成完整论点',
    ];
  }

  /**
   * 使用AI验证论点逻辑性
   */
  public async verifyLogicalConsistency(
    argument: Argument,
    caseInfo: CaseInfo
  ): Promise<{
    score: number;
    issues: string[];
    suggestions: string[];
  }> {
    const prompt = `请验证以下论点的逻辑一致性：

案件：${caseInfo.title}
案情：${caseInfo.description}

论点：${argument.content}
法律依据：${argument.legalBasis || '未提供'}
推理过程：${argument.reasoning || '未提供'}

请从以下方面评估：
1. 主张是否清晰明确
2. 事实依据是否准确
3. 法律依据是否适用
4. 推理过程是否完整
5. 是否存在逻辑矛盾

请以JSON格式返回：
{
  "score": 0-1之间的分数,
  "issues": ["问题1", "问题2"],
  "suggestions": ["建议1", "建议2"]
}`;

    try {
      const response = await this.aiService.chatCompletion({
        model: 'deepseek-chat',
        provider: 'deepseek',
        messages: [
          {
            role: 'system',
            content:
              '你是法律论点逻辑性验证专家，擅长识别逻辑问题和提供改进建议。',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        maxTokens: 1000,
      });

      const content = response.choices[0].message.content;
      const jsonMatch = content?.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {
        score: 0.75,
        issues: ['无法解析验证结果'],
        suggestions: ['请确保论点结构完整'],
      };
    } catch (error) {
      logger.error('论点验证失败:', error);
      return {
        score: 0.7,
        issues: ['验证服务不可用'],
        suggestions: ['请检查论点格式'],
      };
    }
  }

  public configure(newConfig: Partial<OptimizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): OptimizationConfig {
    return { ...this.config };
  }

  public addSuccessExample(example: DebateExample): void {
    this.successExamples.push(example);
  }

  public clearSuccessExamples(): void {
    this.successExamples = [];
  }
}

export function createDebatePromptOptimizer(
  aiService: AIService,
  config?: Partial<OptimizationConfig>
): DebatePromptOptimizer {
  return new DebatePromptOptimizer(aiService, config);
}
