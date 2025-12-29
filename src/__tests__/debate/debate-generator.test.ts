// 辩论生成器单元测试

import {
  DebateGenerator,
  LogicValidator,
  LawValidator,
  QualityAssessor,
} from "@/lib/debate";
import { AIClient, AIMessage } from "@/lib/ai/clients";

/**
 * 模拟AI客户端
 */
class MockAIClient implements AIClient {
  async chat(messages: AIMessage[]): Promise<string> {
    const prompt = messages.map((m) => m.content).join("\n");
    // 返回模拟的AI响应
    if (prompt.includes("原告")) {
      return JSON.stringify([
        {
          id: "p1",
          type: "main_point",
          content: "原告主张被告应承担违约责任",
          reasoning:
            "根据合同法规定，当事人应当全面履行合同义务。被告未按约定履行义务，构成违约。",
          legalBasis: [
            {
              lawName: "中华人民共和国合同法",
              articleNumber: "第一百零七条",
              relevance: 0.9,
              explanation: "该条文规定了当事人违约时的责任承担方式",
            },
          ],
          logicScore: 8.5,
          legalAccuracyScore: 9.0,
          overallScore: 8.75,
          generatedBy: "ai",
          aiProvider: "deepseek",
          generationTime: 500,
        },
      ]);
    } else if (prompt.includes("被告")) {
      return JSON.stringify([
        {
          id: "d1",
          type: "main_point",
          content: "被告主张已履行合同义务，不应承担责任",
          reasoning: "被告已按合同约定完成全部义务，原告所称违约情况不存在。",
          legalBasis: [
            {
              lawName: "中华人民共和国合同法",
              articleNumber: "第六十条",
              relevance: 0.85,
              explanation: "该条文规定了当事人履行合同义务的标准",
            },
          ],
          logicScore: 8.0,
          legalAccuracyScore: 8.5,
          overallScore: 8.25,
          generatedBy: "ai",
          aiProvider: "deepseek",
          generationTime: 500,
        },
      ]);
    }
    return "[]";
  }

  async embedding(): Promise<number[]> {
    return [];
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe("辩论生成器测试", () => {
  let debateGenerator: DebateGenerator;
  let mockAIClient: MockAIClient;

  beforeEach(() => {
    mockAIClient = new MockAIClient();
    debateGenerator = new DebateGenerator(mockAIClient, {
      aiProvider: "deepseek",
      temperature: 0.7,
      maxTokens: 2000,
      balanceStrictness: "medium",
      includeLegalAnalysis: true,
      enableReview: false, // 测试时禁用审查以加快速度
    });
  });

  describe("DebateGenerator", () => {
    test("应该成功生成单轮辩论", async () => {
      const input = {
        caseInfo: {
          title: "买卖合同纠纷",
          description: "原告与被告签订买卖合同，被告未按约定交付货物",
          caseType: "民事",
          parties: {
            plaintiff: "张三",
            defendant: "李四",
          },
          claims: ["要求被告履行交付义务"],
          facts: [
            "双方于2023年1月签订买卖合同",
            "约定被告应在2023年3月前交付货物",
          ],
        },
        lawArticles: [
          {
            lawName: "中华人民共和国合同法",
            articleNumber: "第一百零七条",
            content:
              "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
          },
        ],
      };

      const result = await debateGenerator.generate(input);

      // 验证基本结构
      expect(result).toBeDefined();
      expect(result.id).toMatch(/^debate_\d+$/);
      expect(result.generatedAt).toBeDefined();
      expect(result.input).toEqual(input);

      // 验证论点生成
      expect(result.plaintiffArguments).toHaveLength(1);
      expect(result.defendantArguments).toHaveLength(1);

      // 验证质量指标
      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics.overallQuality).toBeGreaterThanOrEqual(0);
      expect(result.qualityMetrics.overallQuality).toBeLessThanOrEqual(10);

      // 验证生成统计
      expect(result.generationStats).toBeDefined();
      expect(result.generationStats.argumentCount).toBe(2);
      expect(result.generationStats.aiProvider).toBe("deepseek");
    });

    test("应该正确验证输入", async () => {
      // 测试缺少案件信息
      await expect(
        debateGenerator.generate({
          caseInfo: null as unknown as {
            title: string;
            description: string;
            caseType: string;
            parties: {
              plaintiff: string;
              defendant: string;
            };
            claims: string[];
            facts: string[];
          },
          lawArticles: [],
        }),
      ).rejects.toThrow("案件信息不能为空");

      // 测试缺少当事人
      await expect(
        debateGenerator.generate({
          caseInfo: {
            title: "测试案件",
            description: "测试描述",
            caseType: "民事",
            parties: null as unknown as {
              plaintiff: string;
              defendant: string;
            },
            claims: [],
            facts: [],
          },
          lawArticles: [],
        }),
      ).rejects.toThrow("当事人信息不能为空");

      // 测试缺少法条
      await expect(
        debateGenerator.generate({
          caseInfo: {
            title: "测试案件",
            description: "测试描述",
            caseType: "民事",
            parties: {
              plaintiff: "张三",
              defendant: "李四",
            },
            claims: [],
            facts: [],
          },
          lawArticles: [],
        }),
      ).rejects.toThrow("法条列表不能为空");
    });

    test("应该正确计算生成统计", async () => {
      const input = {
        caseInfo: {
          title: "测试案件",
          description: "测试描述",
          caseType: "民事",
          parties: {
            plaintiff: "张三",
            defendant: "李四",
          },
          claims: [],
          facts: [],
        },
        lawArticles: [
          {
            lawName: "中华人民共和国合同法",
            articleNumber: "第一百零七条",
            content: "测试内容",
          },
        ],
      };

      const result = await debateGenerator.generate(input);

      expect(result.generationStats.totalGenerationTime).toBeGreaterThan(0);
      expect(result.generationStats.averageArgumentTime).toBeGreaterThan(0);
      expect(result.generationStats.totalGenerationTime).toBe(
        result.generationStats.averageArgumentTime *
          result.generationStats.argumentCount,
      );
    });

    test("应该支持配置更新", () => {
      const config = debateGenerator.getConfig();
      expect(config.temperature).toBe(0.7);

      debateGenerator.updateConfig({ temperature: 0.8 });

      const newConfig = debateGenerator.getConfig();
      expect(newConfig.temperature).toBe(0.8);
    });
  });

  describe("LogicValidator", () => {
    test("应该验证论点逻辑", () => {
      const validArgument = {
        id: "test1",
        side: "plaintiff" as const,
        type: "main_point" as const,
        content: "这是一条有效的论点，内容长度适中",
        reasoning: "这是详细的推理过程，解释了为什么论点成立，推理过程较长",
        legalBasis: [
          {
            lawName: "测试法",
            articleNumber: "第一条",
            relevance: 0.8,
            explanation: "法条说明",
          },
        ],
        logicScore: 8.5,
        legalAccuracyScore: 9.0,
        overallScore: 8.75,
        generatedBy: "ai" as const,
        generationTime: 500,
      };

      const result = LogicValidator.validateArgument(validArgument);
      expect(result.valid).toBe(true);
    });

    test("应该检测推理过短的论点", () => {
      const invalidArgument = {
        id: "test1",
        side: "plaintiff" as const,
        type: "main_point" as const,
        content: "论点",
        reasoning: "推理", // 过短
        legalBasis: [],
        logicScore: 3.0,
        legalAccuracyScore: 3.0,
        overallScore: 3.0,
        generatedBy: "ai" as const,
        generationTime: 500,
      };

      const result = LogicValidator.validateArgument(invalidArgument);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: "missing_reasoning",
          severity: "error",
        }),
      );
    });

    test("应该正确计算逻辑清晰度评分", () => {
      const argument = {
        id: "test1",
        side: "plaintiff" as const,
        type: "main_point" as const,
        content: "这是一条长度适中的论点内容，长度适中",
        reasoning: "这是详细的推理过程，包含了充分的论证，推理过程长度也适中",
        legalBasis: [
          {
            lawName: "测试法",
            articleNumber: "第一条",
            relevance: 0.8,
            explanation: "法条说明",
          },
        ],
        logicScore: 8.5,
        legalAccuracyScore: 9.0,
        overallScore: 8.75,
        generatedBy: "ai" as const,
        generationTime: 500,
      };

      const score = LogicValidator.calculateLogicClarityScore(argument);
      // 基础分5 + 推理1 + 内容1 + 法条1 = 8分左右
      expect(score).toBeGreaterThan(6);
      expect(score).toBeLessThanOrEqual(10);
    });
  });

  describe("LawValidator", () => {
    test("应该验证法条引用", () => {
      const argument = {
        id: "test1",
        side: "plaintiff" as const,
        type: "main_point" as const,
        content: "论点",
        reasoning: "推理过程",
        legalBasis: [
          {
            lawName: "测试法",
            articleNumber: "第一条",
            relevance: 0.8,
            explanation: "这是法条说明",
          },
        ],
        logicScore: 8.5,
        legalAccuracyScore: 9.0,
        overallScore: 8.75,
        generatedBy: "ai" as const,
        generationTime: 500,
      };

      const validator = new LawValidator({
        caseInfo: {
          title: "测试",
          description: "测试",
          caseType: "民事",
          parties: { plaintiff: "A", defendant: "B" },
          claims: [],
          facts: [],
        },
        lawArticles: [
          {
            lawName: "测试法",
            articleNumber: "第一条",
            content: "内容",
          },
        ],
      });

      const result = validator.validateArgument(argument);
      expect(result.valid).toBe(true);
    });

    test("应该检测缺少法条的论点", () => {
      const argument = {
        id: "test1",
        side: "plaintiff" as const,
        type: "main_point" as const,
        content: "论点",
        reasoning: "推理过程",
        legalBasis: [], // 缺少法条
        logicScore: 5.0,
        legalAccuracyScore: 5.0,
        overallScore: 5.0,
        generatedBy: "ai" as const,
        generationTime: 500,
      };

      const validator = new LawValidator({
        caseInfo: {
          title: "测试",
          description: "测试",
          caseType: "民事",
          parties: { plaintiff: "A", defendant: "B" },
          claims: [],
          facts: [],
        },
        lawArticles: [
          {
            lawName: "测试法",
            articleNumber: "第一条",
            content: "内容",
          },
        ],
      });

      const result = validator.validateArgument(argument);
      // LawValidator对缺少法条的论点，如果score >= 0.6仍然会返回true
      // 这里检查是否有错误信息
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.field === "missing_law")).toBe(true);
    });

    test("应该正确计算法律准确性评分", () => {
      const argument = {
        id: "test1",
        side: "plaintiff" as const,
        type: "main_point" as const,
        content: "论点",
        reasoning: "推理过程",
        legalBasis: [
          {
            lawName: "测试法",
            articleNumber: "第一条",
            relevance: 0.9,
            explanation: "详细的法条说明解释了如何支持论点",
          },
        ],
        logicScore: 8.5,
        legalAccuracyScore: 9.0,
        overallScore: 8.75,
        generatedBy: "ai" as const,
        generationTime: 500,
      };

      const score = LawValidator.calculateLegalAccuracyScore(argument);
      expect(score).toBeGreaterThan(7);
    });
  });

  describe("QualityAssessor", () => {
    test("应该评估辩论质量", () => {
      const plaintiffArguments = [
        {
          id: "p1",
          side: "plaintiff" as const,
          type: "main_point" as const,
          content: "论点内容",
          reasoning: "推理过程",
          legalBasis: [
            {
              lawName: "测试法",
              articleNumber: "第一条",
              relevance: 0.8,
              explanation: "说明",
            },
          ],
          logicScore: 8.0,
          legalAccuracyScore: 8.5,
          overallScore: 8.25,
          generatedBy: "ai" as const,
          generationTime: 500,
        },
      ];

      const defendantArguments = [
        {
          id: "d1",
          side: "defendant" as const,
          type: "main_point" as const,
          content: "论点内容",
          reasoning: "推理过程",
          legalBasis: [
            {
              lawName: "测试法",
              articleNumber: "第一条",
              relevance: 0.8,
              explanation: "说明",
            },
          ],
          logicScore: 8.0,
          legalAccuracyScore: 8.5,
          overallScore: 8.25,
          generatedBy: "ai" as const,
          generationTime: 500,
        },
      ];

      const assessment = QualityAssessor.assessDebate(
        plaintiffArguments,
        defendantArguments,
      );

      expect(assessment).toBeDefined();
      expect(assessment.overallScore).toBeGreaterThan(0);
      expect(assessment.metrics).toBeDefined();
      expect(assessment.suggestions).toBeDefined();
    });

    test("应该正确计算质量指标", () => {
      const plaintiffArguments = [
        {
          id: "p1",
          side: "plaintiff" as const,
          type: "main_point" as const,
          content: "论点内容",
          reasoning: "推理过程",
          legalBasis: [
            {
              lawName: "测试法",
              articleNumber: "第一条",
              relevance: 0.8,
              explanation: "说明",
            },
          ],
          logicScore: 8.0,
          legalAccuracyScore: 8.5,
          overallScore: 8.25,
          generatedBy: "ai" as const,
          generationTime: 500,
        },
      ];

      const defendantArguments = [
        {
          id: "d1",
          side: "defendant" as const,
          type: "main_point" as const,
          content: "论点内容",
          reasoning: "推理过程",
          legalBasis: [
            {
              lawName: "测试法",
              articleNumber: "第一条",
              relevance: 0.8,
              explanation: "说明",
            },
          ],
          logicScore: 8.0,
          legalAccuracyScore: 8.5,
          overallScore: 8.25,
          generatedBy: "ai" as const,
          generationTime: 500,
        },
      ];

      const metrics = QualityAssessor.createQualityMetrics(
        plaintiffArguments,
        defendantArguments,
      );

      expect(metrics.overallQuality).toBeGreaterThan(0);
      expect(metrics.logicClarity).toBeGreaterThan(0);
      expect(metrics.legalAccuracy).toBeGreaterThan(0);
      expect(metrics.balanceScore).toBeGreaterThan(0);
      expect(metrics.argumentCount.plaintiff).toBe(1);
      expect(metrics.argumentCount.defendant).toBe(1);
    });
  });
});
