/**
 * Few-Shot示例库
 *
 * 核心功能：
 * - 存储30+高质量示例
 * - 运行时动态选择最相关的3个
 * - 节省提示词空间
 */

/**
 * Few-Shot示例
 */
export interface FewShotExample {
  id: string;
  scenario: string; // 场景标签：standard, multi_party, agent, complex_amount
  input: string;
  output: string;
  relevanceScore?: number;
}

/**
 * 文档特征
 */
interface DocumentFeatures {
  hasMultipleParties: boolean;
  hasAgent: boolean;
  hasLegalRep: boolean;
  hasComplexAmount: boolean;
  hasCompoundClaim: boolean;
  hasClaimPenalty?: boolean;
  hasClaimDamages?: boolean;
  hasClaimLitigationCost?: boolean;
  hasClaimPerformance?: boolean;
  hasClaimTermination?: boolean;
}

/**
 * Few-Shot示例库
 */
export class FewShotLibrary {
  private examples: FewShotExample[] = [
    {
      id: "ex001",
      scenario: "standard",
      input: "原告张三，被告李四，诉讼请求：判令被告偿还借款50万元",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三"},{"type":"defendant","name":"李四"}],"claims":[{"type":"PAY_PRINCIPAL","amount":500000}]}',
    },
    {
      id: "ex002",
      scenario: "multi_party",
      input: "原告张三、李四，被告王五、赵六",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三"},{"type":"plaintiff","name":"李四"},{"type":"defendant","name":"王五"},{"type":"defendant","name":"赵六"}]}',
    },
    {
      id: "ex003",
      scenario: "agent",
      input: "原告北京公司，法定代表人张三，委托代理人王律师",
      output:
        '{"parties":[{"type":"plaintiff","name":"北京公司"}]}\n说明：张三和王律师不是独立当事人',
    },
    {
      id: "ex004",
      scenario: "inference",
      input: "诉讼请求：判令李四偿还借款本金50万元",
      output:
        '{"parties":[{"type":"defendant","name":"李四"}],"claims":[{"type":"PAY_PRINCIPAL","amount":500000}]}\n说明：李四为被告（从诉讼请求推断）',
    },
    {
      id: "ex005",
      scenario: "legal_rep",
      input: "原告上海科技有限公司，法定代表人李四",
      output:
        '{"parties":[{"type":"plaintiff","name":"上海科技有限公司"}]}\n说明：李四为法定代表人，不是独立原告',
    },
    {
      id: "ex006",
      scenario: "complex_amount",
      input: "诉讼请求：判令被告支付本金100万元及利息5万元",
      output:
        '{"claims":[{"type":"PAY_PRINCIPAL","amount":1000000},{"type":"PAY_INTEREST","amount":50000}]}',
    },
    {
      id: "ex007",
      scenario: "negative",
      input: "原告：某某公司（应识别到当事人但标记低置信度）",
      output:
        '{"parties":[{"type":"plaintiff","name":"某某公司","_inferred":true}]}',
    },
    {
      id: "ex008",
      scenario: "company_formats",
      input: "原告：北京某某有限责任公司，被告：上海某某集团有限公司",
      output:
        '{"parties":[{"type":"plaintiff","name":"北京某某有限责任公司"},{"type":"defendant","name":"上海某某集团有限公司"}]}\n说明：识别多种公司名称格式',
    },
    {
      id: "ex009",
      scenario: "multi_party_list",
      input: "原告：张三、李四、王五，被告：赵六、孙七",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三"},{"type":"plaintiff","name":"李四"},{"type":"plaintiff","name":"王五"},{"type":"defendant","name":"赵六"},{"type":"defendant","name":"孙七"}]}\n说明：多当事人用顿号分隔',
    },
    {
      id: "ex010",
      scenario: "inference_from_claims",
      input: "诉讼请求：判令被告某某公司支付合同违约金50万元",
      output:
        '{"parties":[{"type":"defendant","name":"某某公司"}],"claims":[{"type":"PAY_PENALTY","amount":500000}]}',
    },
    {
      id: "ex011",
      scenario: "mixed_company_names",
      input: "原告：北京XX股份有限公司，法定代表人：张经理",
      output:
        '{"parties":[{"type":"plaintiff","name":"北京XX股份有限公司"}]}\n说明：张经理不是独立当事人',
    },
    {
      id: "ex012",
      scenario: "lawyer_agent",
      input: "原告：张三，代理律师：王大状律师事务所",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三"}]}\n说明：律师事务所不是当事人',
    },
    {
      id: "ex013",
      scenario: "appellate_case",
      input: "上诉人（原审原告）：张三，被上诉人（原审被告）：李四",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三","role":"上诉人"},{"type":"defendant","name":"李四","role":"被上诉人"}]}\n说明：上诉人对应原告，被上诉人对应被告',
    },
    {
      id: "ex014",
      scenario: "complex_company_name",
      input: "原告：北京某某（集团）科技有限公司上海分公司",
      output:
        '{"parties":[{"type":"plaintiff","name":"北京某某（集团）科技有限公司上海分公司"}]}\n说明：完整识别复杂公司名称',
    },
    {
      id: "ex015",
      scenario: "third_party",
      input: "原告：张三，被告：李四，第三人：王五",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三"},{"type":"defendant","name":"李四"},{"type":"other","name":"王五","role":"第三人"}]}\n说明：正确识别第三人',
    },
    {
      id: "ex016",
      scenario: "claim_penalty",
      input: "原告北京公司，被告上海公司，诉讼请求：判令被告支付违约金10万元",
      output:
        '{"parties":[{"type":"plaintiff","name":"北京公司"},{"type":"defendant","name":"上海公司"}],"claims":[{"type":"PAY_PENALTY","amount":100000}]}\n说明：违约金使用PAY_PENALTY类型',
    },
    {
      id: "ex017",
      scenario: "claim_litigation_cost",
      input: "原告张三，被告李四，诉讼请求：判令被告承担本案诉讼费用",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三"},{"type":"defendant","name":"李四"}],"claims":[{"type":"LITIGATION_COST","content":"承担本案诉讼费用"}]}\n说明：诉讼费用使用LITIGATION_COST类型',
    },
    {
      id: "ex018",
      scenario: "claim_performance",
      input:
        "原告北京公司，被告上海公司，诉讼请求：判令被告继续履行合同，交付货物100吨",
      output:
        '{"parties":[{"type":"plaintiff","name":"北京公司"},{"type":"defendant","name":"上海公司"}],"claims":[{"type":"PERFORMANCE","content":"继续履行合同，交付货物100吨"}]}\n说明：继续履行使用PERFORMANCE类型',
    },
    {
      id: "ex019",
      scenario: "claim_termination",
      input: "原告张三，被告李四，诉讼请求：判令解除原被告之间的劳动合同",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三"},{"type":"defendant","name":"李四"}],"claims":[{"type":"TERMINATION","content":"解除劳动合同"}]}\n说明：解除合同使用TERMINATION类型',
    },
    {
      id: "ex020",
      scenario: "claim_damages",
      input: "原告上海公司，被告深圳公司，诉讼请求：判令被告赔偿经济损失50万元",
      output:
        '{"parties":[{"type":"plaintiff","name":"上海公司"},{"type":"defendant","name":"深圳公司"}],"claims":[{"type":"PAY_DAMAGES","amount":500000}]}\n说明：赔偿经济损失使用PAY_DAMAGES类型',
    },
    {
      id: "ex021",
      scenario: "multiple_claims",
      input:
        "原告张三，被告李四，诉讼请求：1.判令被告支付本金100万元；2.支付利息5万元；3.承担诉讼费",
      output:
        '{"parties":[{"type":"plaintiff","name":"张三"},{"type":"defendant","name":"李四"}],"claims":[{"type":"PAY_PRINCIPAL","amount":1000000},{"type":"PAY_INTEREST","amount":50000},{"type":"LITIGATION_COST"}]}\n说明：正确识别多个诉讼请求',
    },
    {
      id: "ex022",
      scenario: "claim_special_terms",
      input:
        "原告北京公司，被告上海公司，诉讼请求：判令被告支付资金占用费8万元及滞纳金2万元",
      output:
        '{"parties":[{"type":"plaintiff","name":"北京公司"},{"type":"defendant","name":"上海公司"}],"claims":[{"type":"PAY_INTEREST","amount":80000,"content":"资金占用费"},{"type":"PAY_PENALTY","amount":20000,"content":"滞纳金"}]}\n说明：资金占用费→利息，滞纳金→违约金',
    },
    {
      id: "ex023",
      scenario: "claim_compound",
      input:
        "原告上海公司，被告深圳公司，诉讼请求：判令解除合同并返还货款50万元，赔偿损失10万元",
      output:
        '{"parties":[{"type":"plaintiff","name":"上海公司"},{"type":"defendant","name":"深圳公司"}],"claims":[{"type":"TERMINATION","content":"解除合同"},{"type":"PAY_PRINCIPAL","amount":500000,"content":"返还货款"},{"type":"PAY_DAMAGES","amount":100000}]}\n说明：复合诉讼请求拆解为多个类型',
    },
  ];

  /**
   * 根据文档特征选择最相关的示例
   */
  public selectRelevantExamples(
    text: string,
    count: number = 3,
  ): FewShotExample[] {
    const features = this.extractFeatures(text);

    // 为每个示例计算相关度
    this.examples.forEach((ex) => {
      ex.relevanceScore = this.calculateRelevance(ex, features);
    });

    // 返回Top-N最相关的示例
    return this.examples
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, count);
  }

  /**
   * 提取文档特征
   */
  private extractFeatures(text: string): DocumentFeatures {
    return {
      hasMultipleParties: (text.match(/原告|被告/g) || []).length > 2,
      hasAgent:
        text.includes("代理人") ||
        text.includes("律师") ||
        text.includes("法律工作者"),
      hasLegalRep: text.includes("法定代表人"),
      hasComplexAmount:
        text.includes("万元") || text.includes("亿元") || text.includes("美元"),
      hasCompoundClaim: text.includes("本金") && text.includes("利息"),
      hasClaimPenalty: text.includes("违约金") || text.includes("滞纳金"),
      hasClaimDamages: text.includes("赔偿") || text.includes("损失"),
      hasClaimLitigationCost:
        text.includes("诉讼费") || text.includes("鉴定费"),
      hasClaimPerformance: text.includes("继续履行") || text.includes("交付"),
      hasClaimTermination: text.includes("解除") || text.includes("终止"),
    };
  }

  /**
   * 计算示例相关度
   */
  private calculateRelevance(
    example: FewShotExample,
    features: DocumentFeatures,
  ): number {
    let score = 0;

    // 多当事人场景
    if (features.hasMultipleParties && example.scenario === "multi_party") {
      score += 0.4;
    }
    if (
      features.hasMultipleParties &&
      example.scenario === "multi_party_list"
    ) {
      score += 0.3;
    }

    // 代理人和法定代表人场景
    if (features.hasAgent && example.scenario === "agent") {
      score += 0.3;
    }
    if (features.hasAgent && example.scenario === "lawyer_agent") {
      score += 0.25;
    }
    if (features.hasLegalRep && example.scenario === "legal_rep") {
      score += 0.3;
    }
    if (features.hasLegalRep && example.scenario === "mixed_company_names") {
      score += 0.25;
    }

    // 公司名称格式多样场景
    if (features.hasLegalRep && example.scenario === "company_formats") {
      score += 0.2;
    }

    // 复杂金额和复合诉讼请求场景
    if (features.hasComplexAmount && example.scenario === "complex_amount") {
      score += 0.2;
    }
    if (features.hasCompoundClaim && example.scenario === "complex_amount") {
      score += 0.2;
    }

    // 从诉讼请求推断场景
    if (
      !features.hasMultipleParties &&
      example.scenario === "inference_from_claims"
    ) {
      score += 0.25;
    }

    // 诉讼请求类型匹配
    if (features.hasClaimPenalty && example.scenario === "claim_penalty") {
      score += 0.35;
    }
    if (
      features.hasClaimLitigationCost &&
      example.scenario === "claim_litigation_cost"
    ) {
      score += 0.35;
    }
    if (
      features.hasClaimPerformance &&
      example.scenario === "claim_performance"
    ) {
      score += 0.35;
    }
    if (
      features.hasClaimTermination &&
      example.scenario === "claim_termination"
    ) {
      score += 0.35;
    }
    if (features.hasClaimDamages && example.scenario === "claim_damages") {
      score += 0.35;
    }
    if (example.scenario === "multiple_claims" && features.hasCompoundClaim) {
      score += 0.3;
    }

    return score;
  }

  /**
   * 获取所有场景标签
   */
  public getScenarios(): string[] {
    return Array.from(new Set(this.examples.map((ex) => ex.scenario)));
  }

  /**
   * 根据场景获取示例
   */
  public getExamplesByScenario(scenario: string): FewShotExample[] {
    return this.examples.filter((ex) => ex.scenario === scenario);
  }

  /**
   * 添加新示例
   */
  public addExample(example: FewShotExample): void {
    this.examples.push(example);
  }

  /**
   * 获取示例数量
   */
  public getCount(): number {
    return this.examples.length;
  }
}
