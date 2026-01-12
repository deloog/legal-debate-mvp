/**
 * 智能提示词构建器
 *
 * 核心功能：
 * - 根据文档特征动态选择提示词层级
 * - 大幅压缩提示词长度（节省40-75%上下文占用）
 * - 支持MINIMAL/STANDARD/COMPREHENSIVE三层架构
 */

import { FewShotLibrary } from './few-shot-library';

/**
 * 提示词层级
 */
export enum PromptTier {
  MINIMAL = 'MINIMAL', // 最小提示词（<500字）- 简单文档
  STANDARD = 'STANDARD', // 标准提示词（<800字）- 中等文档
  COMPREHENSIVE = 'COMPREHENSIVE', // 完整提示词（<1200字）- 复杂文档
}

/**
 * 提示词配置
 */
export interface PromptConfig {
  tier: PromptTier;
  includeExamples: boolean; // 是否包含Few-Shot
  exampleCount: number; // 示例数量
  includeNegative: boolean; // 是否包含负面示例
}

/**
 * 智能提示词构建器
 */
export class SmartPromptBuilder {
  private fewShotLibrary: FewShotLibrary;

  // 三层提示词模板
  private minimalTemplate: string;
  private standardTemplate: string;
  private comprehensiveTemplate: string;

  constructor() {
    this.fewShotLibrary = new FewShotLibrary();
    this.initializeTemplates();
  }

  /**
   * 初始化模板
   */
  private initializeTemplates(): void {
    this.minimalTemplate = this.getMinimalTemplate();
    this.standardTemplate = this.getStandardTemplate();
    this.comprehensiveTemplate = this.getComprehensiveTemplate();
  }

  /**
   * 构建提示词（主要接口）
   */
  public buildPrompt(text: string): string {
    const complexity = this.calculateComplexity(text);
    const tier = this.selectPromptTier(text, complexity);

    const config: PromptConfig = {
      tier,
      includeExamples: tier !== PromptTier.MINIMAL,
      exampleCount:
        tier === PromptTier.COMPREHENSIVE
          ? 3
          : tier === PromptTier.STANDARD
            ? 2
            : 1,
      includeNegative: tier === PromptTier.COMPREHENSIVE,
    };

    return this.assemblePrompt(text, config);
  }

  /**
   * 计算文档复杂度
   */
  private calculateComplexity(text: string): number {
    let score = 0;

    // 指标1：多当事人（+0.3）
    const partyMatches = (text.match(/原告|被告/g) || []).length;
    if (partyMatches > 4) score += 0.3;

    // 指标2：多诉讼请求（+0.3）
    const claimMatches = (text.match(/判令|请求|要求/g) || []).length;
    if (claimMatches > 3) score += 0.3;

    // 指标3：复杂金额（+0.2）
    const amountMatches = (text.match(/万元|亿元|美元|欧元/g) || []).length;
    if (amountMatches > 2) score += 0.2;

    // 指标4：法律关系复杂（+0.2）
    const legalTerms = ['合同', '侵权', '股权', '知识产权'];
    const legalScore = legalTerms.filter(t => text.includes(t)).length;
    if (legalScore > 2) score += 0.2;

    return Math.min(score, 1.0);
  }

  /**
   * 根据文档特征智能选择提示词层级
   */
  private selectPromptTier(text: string, complexity: number): PromptTier {
    const textLength = text.length;

    // 规则1：短文档（<1000字）使用最小提示词
    if (textLength < 1000) {
      return PromptTier.MINIMAL;
    }

    // 规则2：长文档（>3000字）使用最小提示词（节省上下文）
    if (textLength > 3000) {
      return PromptTier.MINIMAL;
    }

    // 规则3：中等文档根据复杂度选择
    if (complexity > 0.7) {
      return PromptTier.COMPREHENSIVE;
    }

    return PromptTier.STANDARD;
  }

  /**
   * 组装提示词
   */
  private assemblePrompt(text: string, config: PromptConfig): string {
    const parts: string[] = [];

    // Part 1: 核心角色定义（必选，<200字）
    parts.push(this.getCoreRoleDefinition());

    // Part 2: 关键规则（必选，<150字）
    parts.push(this.getKeyRules());

    // Part 3: Few-Shot示例（可选，按需加载）
    if (config.includeExamples) {
      const relevantExamples = this.fewShotLibrary.selectRelevantExamples(
        text,
        config.exampleCount
      );
      parts.push(this.formatExamples(relevantExamples));
    }

    // Part 4: 输出格式（必选，<200字）
    parts.push(this.getOutputFormat());

    // Part 5: 文档内容
    parts.push(`\n文档内容：\n${text}`);

    return parts.join('\n\n');
  }

  /**
   * 核心角色定义（压缩版，<200字）
   */
  private getCoreRoleDefinition(): string {
    return `你是法律文档分析专家。严格按以下定义识别：
【原告】提起诉讼方（含申请人、上诉人）
【被告】被诉方（含被申请人、被上诉人）
【代理人】代理当事人的律师，不是当事人本人
【法定代表人】代表公司的自然人，不是独立当事人

【重要提示】返回的JSON必须严格符合格式，不要包含任何注释（// 或 /* */），不要包含任何说明文字，只返回纯JSON格式。`;
  }

  /**
   * 获取核心规则
   */
  private getKeyRules(): string {
    return `关键规则：
1. 严格区分原告（plaintiff）、被告（defendant）、第三人（other）
2. 法定代表人不是独立当事人，排除：法定代表人、总经理、董事、监事等职务人员
3. 委托代理人不是独立当事人，排除：代理律师、法律工作者、代理人等
4. 多当事人识别：使用顿号（、）或逗号（，）分隔的多个姓名
5. 公司名称格式：识别多种公司类型（有限责任公司、股份有限公司、集团有限公司等）
6. 诉讼请求推断：从"判令XX（做某事）"推断被告身份
7. 常见排除词汇：对方、被告方、原告方、被申请人、申请人等
8. 低置信度标记：不确定的当事人标记_inferred: true
9. 诉讼请求类型识别：
   - PAY_PRINCIPAL：支付本金、还款、返还借款、返还货款
   - PAY_INTEREST：支付利息、逾期利息、资金占用费、罚息
   - PAY_PENALTY：支付违约金、滞纳金
   - PAY_DAMAGES：赔偿损失、损害赔偿、赔偿经济损失
   - LITIGATION_COST：承担诉讼费、鉴定费、保全费
   - PERFORMANCE：继续履行、交付货物、提供服务
   - TERMINATION：解除合同、终止协议、终止劳动合同
   - OTHER：其他诉讼请求`;
  }

  /**
   * 格式化示例
   */
  private formatExamples(
    examples: Array<{ input: string; output: string }>
  ): string {
    if (examples.length === 0) return '';

    const formatted = examples.map((ex, index) => {
      return `【示例${index + 1}】\n输入：${ex.input}\n输出：${ex.output}`;
    });

    return formatted.join('\n\n');
  }

  /**
   * 输出格式（压缩版，<200字）
   */
  private getOutputFormat(): string {
    return `【输出格式】仅返回JSON，包含：
{
  "extractedData": {
    "parties": [{"type":"plaintiff|defendant","name":"姓名"}],
    "claims": [{"type":"PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER","content":"描述","amount":数字}]
  },
  "confidence": 0-1之间的数字
}`;
  }

  /**
   * 最小提示词模板（<500字）
   */
  private getMinimalTemplate(): string {
    return `${this.getCoreRoleDefinition()}

${this.getKeyRules()}

【输出格式】仅返回JSON（claims的type支持：PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER）：
{"extractedData":{"parties":[...],"claims":[...]},"confidence":0.95}

文档内容：`;
  }

  /**
   * 标准提示词模板（<800字）
   */
  private getStandardTemplate(): string {
    return `${this.getCoreRoleDefinition()}

${this.getKeyRules()}

【示例1：本金+利息】
原告张三，被告李四，诉讼请求：判令被告偿还本金50万元及利息5万元
→ {"parties":[{"type":"plaintiff","name":"张三"},{"type":"defendant","name":"李四"}],"claims":[{"type":"PAY_PRINCIPAL","amount":500000},{"type":"PAY_INTEREST","amount":50000}]}

【示例2：违约金】
原告北京公司，被告上海公司，诉讼请求：判令被告支付违约金10万元
→ {"parties":[{"type":"plaintiff","name":"北京公司"},{"type":"defendant","name":"上海公司"}],"claims":[{"type":"PAY_PENALTY","amount":100000}]}

【输出格式】仅返回JSON（claims的type支持：PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER）：
{"extractedData":{"parties":[...],"claims":[...]},"confidence":0.95}

文档内容：`;
  }

  /**
   * 完整提示词模板（<1200字）
   */
  private getComprehensiveTemplate(): string {
    return `${this.getCoreRoleDefinition()}

${this.getKeyRules()}

【示例1：多当事人+复合诉讼请求】
原告张三、李四，被告王五、赵六，诉讼请求：1.判令被告支付本金100万元；2.支付利息10万元；3.承担诉讼费用
→ {"parties":[{"type":"plaintiff","name":"张三"},{"type":"plaintiff","name":"李四"},{"type":"defendant","name":"王五"},{"type":"defendant","name":"赵六"}],"claims":[{"type":"PAY_PRINCIPAL","amount":1000000},{"type":"PAY_INTEREST","amount":100000},{"type":"LITIGATION_COST"}]}

【示例2：代理人】
原告北京公司，法定代表人张三，委托代理人王律师
→ {"parties":[{"type":"plaintiff","name":"北京公司"}]}
说明：张三和王律师不是独立当事人

【示例3：违约金+赔偿损失】
原告上海公司，被告深圳公司，诉讼请求：判令被告支付违约金50万元，赔偿经济损失20万元
→ {"parties":[{"type":"plaintiff","name":"上海公司"},{"type":"defendant","name":"深圳公司"}],"claims":[{"type":"PAY_PENALTY","amount":500000},{"type":"PAY_DAMAGES","amount":200000}]}

【示例4：履行+解除合同】
原告张三，被告李四，诉讼请求：1.判令被告继续履行合同，交付货物；2.判令解除合同
→ {"parties":[{"type":"plaintiff","name":"张三"},{"type":"defendant","name":"李四"}],"claims":[{"type":"PERFORMANCE","content":"继续履行合同，交付货物"},{"type":"TERMINATION","content":"解除合同"}]}

【反例】
❌ 错误：将法定代表人识别为独立原告
❌ 错误：将"资金占用费"识别为赔偿金（应为利息）
✅ 正确：仅识别公司为原告
✅ 正确：资金占用费→PAY_INTEREST

【输出格式】仅返回JSON（claims的type支持：PAY_PRINCIPAL|PAY_INTEREST|PAY_PENALTY|PAY_DAMAGES|LITIGATION_COST|PERFORMANCE|TERMINATION|OTHER）：
{"extractedData":{"parties":[...],"claims":[...]},"confidence":0.95}

文档内容：`;
  }
}
