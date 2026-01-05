/**
 * 测试数据加载器
 * 提供标准化的测试数据集
 */

interface DocumentTestCase {
  id: string;
  title: string;
  content: string;
  expected: {
    parties: Array<{
      type: "plaintiff" | "defendant";
      name: string;
      role?: string;
    }>;
    claims: Array<{
      type: string;
      content: string;
      amount?: number;
    }>;
    amounts: number[];
  };
}

interface LawRetrievalTestCase {
  id: string;
  query: string;
  caseType: string;
  keywords: string[];
  expectedArticles: string[];
}

interface DebateTestCase {
  id: string;
  caseTitle: string;
  caseDescription: string;
  plaintiffClaims: string[];
  defendantClaims: string[];
  expectedQuality: {
    argumentLogicScore: number;
    legalBasisAccuracy: number;
    balanceScore: number;
  };
}

interface ErrorScenario {
  id: string;
  scenario: string;
  trigger: () => Promise<unknown>;
  expectedBehavior: "retry" | "fallback" | "fail";
  expectedRecovery: boolean;
}

/**
 * 测试数据集类
 */
export class TestDataSet {
  private documentTestCases: DocumentTestCase[] = [];
  private lawRetrievalTestCases: LawRetrievalTestCase[] = [];
  private debateTestCases: DebateTestCase[] = [];
  private errorScenarios: ErrorScenario[] = [];

  /**
   * 初始化测试数据集
   */
  async initialize(): Promise<void> {
    this.loadDocumentTestCases();
    this.loadLawRetrievalTestCases();
    this.loadDebateTestCases();
    this.loadErrorScenarios();
  }

  /**
   * 获取文档解析测试用例
   */
  getDocumentTestCases(): DocumentTestCase[] {
    return this.documentTestCases;
  }

  /**
   * 获取法条检索测试用例
   */
  getLawRetrievalTestCases(): LawRetrievalTestCase[] {
    return this.lawRetrievalTestCases;
  }

  /**
   * 获取辩论生成测试用例
   */
  getDebateTestCases(): DebateTestCase[] {
    return this.debateTestCases;
  }

  /**
   * 获取错误场景
   */
  getErrorScenarios(): ErrorScenario[] {
    return this.errorScenarios;
  }

  /**
   * 加载文档解析测试用例
   */
  private loadDocumentTestCases(): void {
    // 案例1: 借款合同纠纷
    this.documentTestCases.push({
      id: "DOC-001",
      title: "借款合同纠纷",
      content: `民事起诉状

原告：张三，男，汉族，1980年1月1日出生，住北京市朝阳区。

被告：李四，女，汉族，1985年5月15日出生，住北京市海淀区。

诉讼请求：
1. 判令被告偿还借款本金500000元；
2. 判令被告支付利息（按年利率6%计算）；
3. 诉讼费用由被告承担。

事实与理由：
被告于2022年6月15日向原告借款500000元，约定年利率6%，期限6个月。借款到期后，被告未按时还款。`,
      expected: {
        parties: [
          { type: "plaintiff", name: "张三" },
          { type: "defendant", name: "李四" },
        ],
        claims: [
          {
            type: "PAY_PRINCIPAL",
            content: "判令被告偿还借款本金500000元",
            amount: 500000,
          },
          {
            type: "PAY_INTEREST",
            content: "判令被告支付利息（按年利率6%计算）",
          },
          {
            type: "LITIGATION_COST",
            content: "诉讼费用由被告承担",
          },
        ],
        amounts: [500000],
      },
    });

    // 案例2: 劳动争议纠纷
    this.documentTestCases.push({
      id: "DOC-002",
      title: "劳动争议纠纷",
      content: `劳动仲裁申请书

申请人：王五，男，汉族，1990年3月10日出生，身份证号：110101199003101234，住北京市西城区。

被申请人：XX科技有限公司，住所地：北京市东城区XX路XX号，法定代表人：赵六。

仲裁请求：
1. 确认申请人与被申请人之间的劳动关系于2023年12月31日解除；
2. 裁决被申请人支付违法解除劳动合同赔偿金80000元；
3. 裁决被申请人支付未休年休假工资3000元；
4. 本案仲裁费用由被申请人承担。

事实与理由：
申请人于2021年1月1日入职被申请人处，担任软件工程师，月工资20000元。2023年12月31日，被申请人无故解除劳动合同。`,
      expected: {
        parties: [
          { type: "plaintiff", name: "王五" },
          { type: "defendant", name: "XX科技有限公司" },
        ],
        claims: [
          { type: "CONFIRM_RELATIONSHIP", content: "确认劳动关系解除" },
          {
            type: "PAY_COMPENSATION",
            content: "支付违法解除劳动合同赔偿金80000元",
            amount: 80000,
          },
          {
            type: "PAY_ANNUAL_LEAVE",
            content: "支付未休年休假工资3000元",
            amount: 3000,
          },
          { type: "LITIGATION_COST", content: "仲裁费用由被申请人承担" },
        ],
        amounts: [80000, 3000],
      },
    });

    // 案例3: 买卖合同纠纷
    this.documentTestCases.push({
      id: "DOC-003",
      title: "买卖合同纠纷",
      content: `起诉状

原告：XX贸易公司，住所地：上海市浦东新区XX路XX号，法定代表人：孙七。

被告：YY制造公司，住所地：江苏省苏州市XX区XX路XX号，法定代表人：周八。

诉讼请求：
1. 判令被告支付货款350000元；
2. 判令被告支付逾期付款违约金（按日万分之五计算）；
3. 本案诉讼费用由被告承担。

事实与理由：
原告于2023年3月20日与被告签订《货物买卖合同》，约定原告向被告供应一批电子元器件，总货款350000元。原告已按约交付货物，但被告未支付货款。`,
      expected: {
        parties: [
          { type: "plaintiff", name: "XX贸易公司" },
          { type: "defendant", name: "YY制造公司" },
        ],
        claims: [
          {
            type: "PAY_GOODS_MONEY",
            content: "判令被告支付货款350000元",
            amount: 350000,
          },
          {
            type: "PAY_PENALTY",
            content: "判令被告支付逾期付款违约金",
          },
          { type: "LITIGATION_COST", content: "本案诉讼费用由被告承担" },
        ],
        amounts: [350000],
      },
    });

    // 案例4: 交通事故赔偿纠纷
    this.documentTestCases.push({
      id: "DOC-004",
      title: "交通事故赔偿纠纷",
      content: `民事起诉状

原告：吴九，男，汉族，1975年8月20日出生，住广州市天河区。

被告：郑十，男，汉族，1988年11月25日出生，住广州市越秀区。

诉讼请求：
1. 判令被告赔偿医疗费5000元；
2. 判令被告赔偿误工费8000元；
3. 判令被告赔偿车辆损失费12000元；
4. 本案诉讼费用由被告承担。

事实与理由：
2023年10月5日，被告驾驶机动车在广州市XX路与原告驾驶的机动车发生碰撞，造成原告受伤、车辆受损。交警部门认定被告负全部责任。`,
      expected: {
        parties: [
          { type: "plaintiff", name: "吴九" },
          { type: "defendant", name: "郑十" },
        ],
        claims: [
          {
            type: "COMPENSATE_MEDICAL",
            content: "判令被告赔偿医疗费5000元",
            amount: 5000,
          },
          {
            type: "COMPENSATE_LOST_WAGES",
            content: "判令被告赔偿误工费8000元",
            amount: 8000,
          },
          {
            type: "COMPENSATE_VEHICLE",
            content: "判令被告赔偿车辆损失费12000元",
            amount: 12000,
          },
          { type: "LITIGATION_COST", content: "本案诉讼费用由被告承担" },
        ],
        amounts: [5000, 8000, 12000],
      },
    });

    // 案例5: 房屋租赁合同纠纷
    this.documentTestCases.push({
      id: "DOC-005",
      title: "房屋租赁合同纠纷",
      content: `起诉状

原告：陈十一，男，汉族，1982年4月12日出生，住深圳市福田区。

被告：XX房地产经纪公司，住所地：深圳市南山区XX路XX号，法定代表人：林十二。

诉讼请求：
1. 判令解除原被告签订的《房屋租赁合同》；
2. 判令被告返还押金15000元；
3. 判令被告赔偿违约金3000元；
4. 本案诉讼费用由被告承担。

事实与理由：
原告于2023年6月1日与被告签订《房屋租赁合同》，租赁被告管理的房屋，租期一年，押金15000元。现被告因房屋需要收回，单方面解除合同。`,
      expected: {
        parties: [
          { type: "plaintiff", name: "陈十一" },
          { type: "defendant", name: "XX房地产经纪公司" },
        ],
        claims: [
          { type: "TERMINATE_CONTRACT", content: "解除房屋租赁合同" },
          {
            type: "REFUND_DEPOSIT",
            content: "返还押金15000元",
            amount: 15000,
          },
          {
            type: "COMPENSATE_PENALTY",
            content: "赔偿违约金3000元",
            amount: 3000,
          },
          { type: "LITIGATION_COST", content: "本案诉讼费用由被告承担" },
        ],
        amounts: [15000, 3000],
      },
    });

    // 添加更多案例...
    for (let i = 6; i <= 30; i++) {
      this.documentTestCases.push(this.generateMockTestCase(i));
    }
  }

  /**
   * 加载法条检索测试用例
   */
  private loadLawRetrievalTestCases(): void {
    // 案例1: 借款合同相关法条
    this.lawRetrievalTestCases.push({
      id: "LAW-001",
      query: "借款合同违约责任",
      caseType: "合同纠纷",
      keywords: ["借款", "合同", "违约", "责任"],
      expectedArticles: [
        "中华人民共和国民法典 第六百七十四条",
        "中华人民共和国民法典 第六百七十五条",
        "中华人民共和国民法典 第六百七十六条",
      ],
    });

    // 案例2: 劳动争议相关法条
    this.lawRetrievalTestCases.push({
      id: "LAW-002",
      query: "违法解除劳动合同赔偿",
      caseType: "劳动争议",
      keywords: ["解除", "劳动合同", "赔偿", "违法"],
      expectedArticles: [
        "中华人民共和国劳动合同法 第四十七条",
        "中华人民共和国劳动合同法 第四十八条",
        "中华人民共和国劳动合同法 第八十七条",
      ],
    });

    // 添加更多案例...
    for (let i = 3; i <= 30; i++) {
      this.lawRetrievalTestCases.push(this.generateMockLawTestCase(i));
    }
  }

  /**
   * 加载辩论生成测试用例
   */
  private loadDebateTestCases(): void {
    this.debateTestCases.push({
      id: "DEBATE-001",
      caseTitle: "借款合同纠纷",
      caseDescription:
        "被告于2022年6月15日向原告借款500000元，约定年利率6%，期限6个月。借款到期后，被告未按时还款。",
      plaintiffClaims: ["要求被告偿还借款本金500000元", "要求被告支付利息"],
      defendantClaims: ["借款已部分偿还"],
      expectedQuality: {
        argumentLogicScore: 0.92,
        legalBasisAccuracy: 0.95,
        balanceScore: 0.9,
      },
    });

    // 添加更多案例...
    for (let i = 2; i <= 20; i++) {
      this.debateTestCases.push(this.generateMockDebateTestCase(i));
    }
  }

  /**
   * 加载错误场景
   */
  private loadErrorScenarios(): void {
    this.errorScenarios.push({
      id: "ERROR-001",
      scenario: "AI服务超时",
      trigger: async () => {
        throw new Error("AI服务调用超时");
      },
      expectedBehavior: "retry",
      expectedRecovery: true,
    });

    this.errorScenarios.push({
      id: "ERROR-002",
      scenario: "数据库连接失败",
      trigger: async () => {
        throw new Error("数据库连接失败");
      },
      expectedBehavior: "fallback",
      expectedRecovery: true,
    });

    // 添加更多错误场景...
    for (let i = 3; i <= 20; i++) {
      this.errorScenarios.push(this.generateMockErrorScenario(i));
    }
  }

  /**
   * 生成模拟文档测试用例
   */
  private generateMockTestCase(id: number): DocumentTestCase {
    return {
      id: `DOC-${String(id).padStart(3, "0")}`,
      title: `测试案例${id}`,
      content: `测试文档内容${id}`,
      expected: {
        parties: [
          { type: "plaintiff", name: `原告${id}` },
          { type: "defendant", name: `被告${id}` },
        ],
        claims: [
          { type: "CLAIM_TYPE_1", content: `诉讼请求内容${id}` },
          { type: "LITIGATION_COST", content: "诉讼费用由被告承担" },
        ],
        amounts: [id * 1000],
      },
    };
  }

  /**
   * 生成模拟法条测试用例
   */
  private generateMockLawTestCase(id: number): LawRetrievalTestCase {
    return {
      id: `LAW-${String(id).padStart(3, "0")}`,
      query: `测试查询${id}`,
      caseType: "合同纠纷",
      keywords: ["测试", "关键词"],
      expectedArticles: ["中华人民共和国民法典 测试条目"],
    };
  }

  /**
   * 生成模拟辩论测试用例
   */
  private generateMockDebateTestCase(id: number): DebateTestCase {
    return {
      id: `DEBATE-${String(id).padStart(3, "0")}`,
      caseTitle: `辩论案例${id}`,
      caseDescription: `辩论案例描述${id}`,
      plaintiffClaims: [`原告主张${id}`],
      defendantClaims: [`被告主张${id}`],
      expectedQuality: {
        argumentLogicScore: 0.85 + Math.random() * 0.1,
        legalBasisAccuracy: 0.9 + Math.random() * 0.05,
        balanceScore: 0.85 + Math.random() * 0.1,
      },
    };
  }

  /**
   * 生成模拟错误场景
   */
  private generateMockErrorScenario(id: number): ErrorScenario {
    return {
      id: `ERROR-${String(id).padStart(3, "0")}`,
      scenario: `错误场景${id}`,
      trigger: async () => {
        throw new Error(`测试错误${id}`);
      },
      expectedBehavior: "fail",
      expectedRecovery: id % 2 === 0,
    };
  }
}

/**
 * 单例实例
 */
let testDataSetInstance: TestDataSet | null = null;

export function getTestDataSet(): TestDataSet {
  if (!testDataSetInstance) {
    testDataSetInstance = new TestDataSet();
  }
  return testDataSetInstance;
}
