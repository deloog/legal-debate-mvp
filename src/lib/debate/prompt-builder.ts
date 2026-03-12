// Prompt构建器：构建辩论生成提示词

import { DebateInput, PromptOptions, DEFAULT_DEBATE_CONFIG } from './types';

/**
 * Prompt构建器类
 */
export class PromptBuilder {
  /**
   * 构建辩论生成提示词
   */
  static buildDebatePrompt(
    input: DebateInput,
    side: 'plaintiff' | 'defendant',
    options?: Partial<PromptOptions>,
    reasoningAnalysis?: string
  ): PromptOptions {
    const temperature =
      options?.temperature ??
      input.config?.temperature ??
      DEFAULT_DEBATE_CONFIG.temperature;
    const maxTokens =
      options?.maxTokens ??
      input.config?.maxTokens ??
      DEFAULT_DEBATE_CONFIG.maxTokens;

    const userPrompt = this.buildUserPrompt(input, side, input.config, reasoningAnalysis);

    return {
      systemPrompt: options?.systemPrompt || this.getSystemPrompt(),
      userPrompt,
      temperature,
      maxTokens,
      includeExamples: options?.includeExamples ?? true,
    };
  }

  /**
   * 构建系统提示词
   */
  private static getSystemPrompt(): string {
    return `你是一位经验丰富的专业律师，擅长法律辩论和诉讼策略。

你的任务是：
1. 生成清晰、有理有据的辩论论点
2. 确保论点逻辑严密、推理链条完整
3. 准确引用相关法条作为法律依据
4. 保持专业性，使用准确的法律术语

输出要求：
- 论点结构清晰（论点 -> 理由 -> 法律依据）
- 法律引用准确（明确法条号和内容）
- 逻辑推理完整（从前提到结论的完整链条）
- 语言简洁明了（避免冗余和模糊表述）

重要原则：
- 诚信原则：忠实于案件事实，不虚构
- 逻辑原则：论点之间逻辑一致，不自相矛盾
- 准确原则：法条引用准确，不误导
- 针对性：论点针对案件争议焦点`;
  }

  /**
   * 构建用户提示词
   * @param reasoningAnalysis 可选的推理链分析文本（来自知识图谱推理引擎）
   */
  private static buildUserPrompt(
    input: DebateInput,
    side: 'plaintiff' | 'defendant',
    config?: DebateInput['config'] | undefined,
    reasoningAnalysis?: string
  ): string {
    const { caseInfo, lawArticles } = input;
    const { includeLegalAnalysis } = config ?? DEFAULT_DEBATE_CONFIG;

    const promptParts: string[] = [];

    // 案件信息
    promptParts.push('## 案件信息\n');
    promptParts.push(`**案件名称**：${caseInfo.title}\n`);
    promptParts.push(`**案件类型**：${caseInfo.caseType}\n`);
    promptParts.push(`**案件描述**：\n${caseInfo.description}\n`);

    // 当事人信息
    promptParts.push('## 当事人信息\n');
    promptParts.push(`**原告**：${caseInfo.parties.plaintiff}\n`);
    promptParts.push(`**被告**：${caseInfo.parties.defendant}\n`);

    // 诉讼请求
    if (caseInfo.claims.length > 0) {
      promptParts.push('## 诉讼请求\n');
      caseInfo.claims.forEach(claim => {
        promptParts.push(`${claim}`);
      });
      promptParts.push('\n');
    }

    // 案件事实
    if (caseInfo.facts.length > 0) {
      promptParts.push('## 案件事实\n');
      caseInfo.facts.forEach(fact => {
        promptParts.push(`${fact}`);
      });
      promptParts.push('\n');
    }

    // 相关法条
    if (lawArticles.length > 0) {
      promptParts.push('## 相关法条\n');
      lawArticles.forEach(article => {
        promptParts.push(`**${article.lawName} ${article.articleNumber}**：`);
        promptParts.push(article.content);
        promptParts.push('\n');
      });
    }

    // 知识图谱推理链分析（如果有）
    if (reasoningAnalysis) {
      promptParts.push('\n');
      promptParts.push(reasoningAnalysis);
      promptParts.push('\n');
    }

    // 法律分析
    if (includeLegalAnalysis && lawArticles.length > 0) {
      const sideName = side === 'plaintiff' ? '原告' : '被告';
      promptParts.push('## 法律分析要点\n');
      promptParts.push(`请分析上述法条如何支持${sideName}的论点：\n`);
    }

    // 辩论要求
    const sideText = side === 'plaintiff' ? '原告方' : '被告方';
    promptParts.push(`## ${sideText}辩论要求\n`);
    promptParts.push(
      `请为${sideText}生成${this.getArgumentCountString(config?.balanceStrictness)}个论点。\n`
    );
    promptParts.push('每个论点应包含：\n');
    promptParts.push('1. **主要论点**：清晰陈述核心观点\n');
    promptParts.push('2. **推理过程**：详细说明从事实到结论的逻辑推理\n');
    promptParts.push('3. **法律依据**：引用相关法条，说明如何支持该论点\n');
    promptParts.push('4. **事实支撑**：引用案件事实作为论点支撑\n');

    // 输出格式
    promptParts.push('\n## 输出格式\n');
    promptParts.push('请严格按照以下JSON格式输出：\n');
    promptParts.push(this.getOutputFormat());

    // 示例
    if (config?.includeLegalAnalysis !== false) {
      promptParts.push('\n## 输出示例\n');
      promptParts.push(this.getExample(side));
    }

    return promptParts.join('\n');
  }

  /**
   * 获取论点数量说明
   */
  private static getArgumentCountString(
    strictness?: 'low' | 'medium' | 'high' | undefined
  ): string {
    switch (strictness) {
      case 'low':
        return '3-5';
      case 'medium':
        return '4-6';
      case 'high':
        return '5-7';
      default:
        return '4-6';
    }
  }

  /**
   * 获取输出格式
   */
  private static getOutputFormat(): string {
    return `{
  "arguments": [
    {
      "type": "main_point",
      "content": "论点内容",
      "reasoning": "推理过程",
      "legalBasis": [
        {
          "lawName": "法律名称",
          "articleNumber": "条款号",
          "relevance": 0.9,
          "explanation": "法条如何支持论点"
        }
      ]
    }
  ]
}`;
  }

  /**
   * 获取示例
   */
  private static getExample(side: 'plaintiff' | 'defendant'): string {
    const sideText = side === 'plaintiff' ? '原告' : '被告';
    return `${sideText}论点示例：

{
  "arguments": [
    {
      "type": "main_point",
      "content": "${sideText}主张被告违约，应当承担违约责任",
      "reasoning": "根据合同约定，被告应在2024年6月30日前支付尾款。但被告至今未支付，构成违约行为。根据民法典相关规定，违约方应承担违约责任。",
      "legalBasis": [
        {
          "lawName": "中华人民共和国民法典",
          "articleNumber": "第五百七十七条",
          "relevance": 0.95,
          "explanation": "该条款规定了违约责任的承担方式，支持${sideText}的违约责任主张"
        }
      ]
    },
    {
      "type": "main_point",
      "content": "${sideText}有权要求被告支付违约金",
      "reasoning": "合同中约定了违约金条款，被告违约${sideText}有权主张。违约金是双方约定的违约后果，具有法律效力。",
      "legalBasis": [
        {
          "lawName": "中华人民共和国民法典",
          "articleNumber": "第五百八十五条",
          "relevance": 0.9,
          "explanation": "该条款规定了违约金的约定和执行，支持${sideText}的违约金主张"
        }
      ]
    }
  ]
}`;
  }

  /**
   * 构建审查提示词
   */
  static buildReviewPrompt(
    argumentList: string[],
    originalInput: DebateInput
  ): string {
    const promptParts: string[] = [];

    promptParts.push('## 辩论论点审查任务\n');
    promptParts.push('请对以下生成的辩论论点进行审查和优化。\n');

    promptParts.push('### 生成的论点\n');
    argumentList.forEach((arg, index) => {
      promptParts.push(`\n**论点 ${index + 1}**：\n${arg}`);
    });

    promptParts.push('\n### 案件背景\n');
    promptParts.push(`**案件名称**：${originalInput.caseInfo.title}\n`);
    promptParts.push(`**案件类型**：${originalInput.caseInfo.caseType}\n`);

    promptParts.push('\n### 审查要点\n');
    promptParts.push('请从以下维度审查论点：\n');
    promptParts.push('1. **逻辑清晰度**：论点推理是否清晰完整\n');
    promptParts.push('2. **法律准确性**：法条引用是否准确相关\n');
    promptParts.push('3. **事实依据**：论点是否基于案件事实\n');
    promptParts.push('4. **表达质量**：语言是否简洁准确\n');

    promptParts.push('\n### 输出要求\n');
    promptParts.push('- 列出需要修正的问题\n');
    promptParts.push('- 提供改进建议\n');
    promptParts.push('- 如有需要，提供优化后的论点\n');

    return promptParts.join('\n');
  }
}
