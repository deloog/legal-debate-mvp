/**
 * 统一辩论生成器集成测试
 *
 * 测试增强的辩论生成器是否能够提升论点逻辑性
 */

import { UnifiedAIService } from "@/lib/ai/unified-service";
import type { CaseInfo, LegalReference } from "@/types/debate";

process.env.AI_SERVICE_PROVIDER = "deepseek";
process.env.DEEPSEEK_API_KEY = "test-key";
process.env.DEEPSEEK_API_URL = "https://api.deepseek.com";

describe("UnifiedAIService - Enhanced Debate Generation", () => {
  let unifiedService: UnifiedAIService;

  const mockCaseInfo: CaseInfo = {
    title: "合同纠纷测试案例",
    description:
      "原告张三与被告李四签订买卖合同，约定货款10万元，被告未按期付款",
    type: "contract",
    cause: "违约责任",
    amount: 100000,
  };

  const mockLegalReferences: LegalReference[] = [
    {
      lawName: "民法典",
      articleNumber: "第509条",
      fullText: "当事人应当按照约定全面履行自己的义务。",
      relevanceScore: 0.95,
      applicabilityScore: 0.92,
    },
    {
      lawName: "民法典",
      articleNumber: "第577条",
      fullText:
        "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
      relevanceScore: 0.94,
      applicabilityScore: 0.91,
    },
  ];

  const mockAIResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify({
            plaintiffArguments: [
              {
                side: "plaintiff",
                content:
                  "根据《民法典》第509条，当事人应当按照约定全面履行自己的义务。被告未按期付款，构成违约，应承担继续履行、赔偿损失等违约责任。",
                legalBasis: "民法典第509条",
                reasoning: "合同约定了付款义务，被告违反约定构成违约行为",
                score: 0.95,
              },
              {
                side: "plaintiff",
                content:
                  "基于《民法典》第577条，当事人一方不履行合同义务，应当承担继续履行、赔偿损失等违约责任。因此，被告应赔偿原告的损失。",
                legalBasis: "民法典第577条",
                reasoning: "被告未履行付款义务，根据法律规定应承担违约责任",
                score: 0.93,
              },
              {
                side: "plaintiff",
                content:
                  "合同明确约定付款金额和期限，被告未按期付款，导致原告资金周转困难，应当支付违约金。",
                legalBasis: "民法典第509条",
                reasoning: "被告违约造成原告实际损失，应承担赔偿责任",
                score: 0.91,
              },
            ],
            defendantArguments: [
              {
                side: "defendant",
                content:
                  "双方已协商延期付款，原告予以同意，不构成违约。且货物存在质量问题，我方有权行使先履行抗辩权。",
                legalBasis: "民法典第527条",
                reasoning: "协商变更了履行期限，且货物质量存在瑕疵",
                score: 0.93,
              },
              {
                side: "defendant",
                content:
                  "原告提供的货物部分不符合质量标准，根据合同约定，我方有权暂缓付款直至问题解决。",
                legalBasis: "民法典第582条",
                reasoning: "货物质量问题构成履行抗辩理由",
                score: 0.91,
              },
              {
                side: "defendant",
                content:
                  "原告未按照合同约定时间发货，导致我方销售延迟，实际上原告也存在违约行为。",
                legalBasis: "民法典第577条",
                reasoning: "原告违约在先，我方行使同时履行抗辩权",
                score: 0.92,
              },
            ],
          }),
        },
      },
    ],
  };

  beforeEach(() => {
    unifiedService = new UnifiedAIService(undefined, {
      usePromptOptimizer: true,
      enableLogicalVerification: true,
      minLogicalScore: 0.9,
      maxRetries: 3,
    });
    unifiedService["generalAIService"] = {
      chatCompletion: jest.fn().mockResolvedValue(mockAIResponse),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
    unifiedService["initialized"] = true;

    // Mock promptOptimizer to return proper object
    unifiedService["promptOptimizer"] = {
      generateOptimizedPrompt: jest.fn().mockResolvedValue({
        systemPrompt:
          "你是专业的法律辩论生成助手，擅长生成逻辑清晰、法律依据准确的辩论论点。",
        userPrompt: "请根据以下案情和法条生成辩论论点...",
      }),
      verifyLogicalConsistency: jest.fn().mockResolvedValue({
        score: 0.95,
        issues: [],
        suggestions: [],
      }),
    } as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("基础功能测试", () => {
    test("应该成功生成辩论论点", async () => {
      const result = await unifiedService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      expect(result.plaintiffArguments).toBeDefined();
      expect(result.defendantArguments).toBeDefined();
      expect(result.plaintiffArguments.length).toBeGreaterThanOrEqual(3);
      expect(result.defendantArguments.length).toBeGreaterThanOrEqual(3);
      expect(result.metadata).toBeDefined();
      expect(result.metadata.model).toBe("deepseek-chat");
      expect(result.metadata.confidence).toBeGreaterThan(0);
    });

    test("每个论点应该包含必要的字段", async () => {
      const result = await unifiedService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      const allArguments = [
        ...result.plaintiffArguments,
        ...result.defendantArguments,
      ];

      for (const arg of allArguments) {
        expect(arg).toHaveProperty("side");
        expect(arg).toHaveProperty("content");
        expect(arg.content).toBeTruthy();
      }
    });

    test("应该使用正确的AI配置调用服务", async () => {
      await unifiedService.generateDebate(mockCaseInfo, mockLegalReferences);

      const aiService = unifiedService["generalAIService"] as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      expect(aiService.chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "deepseek-chat",
          provider: "deepseek",
          messages: expect.any(Array),
          temperature: expect.any(Number),
          maxTokens: expect.any(Number),
        }),
      );
    });
  });

  describe("逻辑性评分测试", () => {
    test("生成的论点逻辑性应该达到90%以上", async () => {
      const result = await unifiedService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      const plaintiffAvgScore =
        result.plaintiffArguments.reduce(
          (sum, arg) => sum + (arg.score || 0),
          0,
        ) / result.plaintiffArguments.length;

      const defendantAvgScore =
        result.defendantArguments.reduce(
          (sum, arg) => sum + (arg.score || 0),
          0,
        ) / result.defendantArguments.length;

      const avgScore = (plaintiffAvgScore + defendantAvgScore) / 2;

      expect(avgScore).toBeGreaterThanOrEqual(0.9);
    });

    test("论点应该包含逻辑连接词", async () => {
      const result = await unifiedService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      const allArguments = [
        ...result.plaintiffArguments,
        ...result.defendantArguments,
      ];

      let hasLogicalConnectives = false;

      for (const arg of allArguments) {
        if (
          arg.content.includes("因此") ||
          arg.content.includes("基于此") ||
          arg.content.includes("根据")
        ) {
          hasLogicalConnectives = true;
          break;
        }
      }

      expect(hasLogicalConnectives).toBe(true);
    });

    test("论点应该包含推理过程", async () => {
      const result = await unifiedService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      const allArguments = [
        ...result.plaintiffArguments,
        ...result.defendantArguments,
      ];

      for (const arg of allArguments) {
        expect(arg.reasoning).toBeTruthy();
        expect(arg.reasoning!.length).toBeGreaterThan(10);
      }
    });
  });

  describe("配置测试", () => {
    test("应该支持自定义配置", () => {
      const customService = new UnifiedAIService(undefined, {
        minLogicalScore: 0.85,
        maxRetries: 2,
      });

      const config = customService.getDebateGeneratorConfig();

      expect(config.minLogicalScore).toBe(0.85);
      expect(config.maxRetries).toBe(2);
    });

    test("应该支持动态更新配置", () => {
      unifiedService.configureDebateGenerator({ maxRetries: 5 });

      const config = unifiedService.getDebateGeneratorConfig();

      expect(config.maxRetries).toBe(5);
    });
  });

  describe("错误处理测试", () => {
    test("AI服务失败时应该重试", async () => {
      const failingService = {
        chatCompletion: jest
          .fn()
          .mockRejectedValueOnce(new Error("Service unavailable"))
          .mockRejectedValueOnce(new Error("Service unavailable"))
          .mockResolvedValueOnce(mockAIResponse),
      };

      const retryService = new UnifiedAIService(undefined, {
        maxRetries: 3,
      });
      retryService["generalAIService"] = failingService as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      retryService["initialized"] = true;
      retryService["promptOptimizer"] = {
        generateOptimizedPrompt: jest.fn().mockResolvedValue({
          systemPrompt:
            "你是专业的法律辩论生成助手，擅长生成逻辑清晰、法律依据准确的辩论论点。",
          userPrompt: "请根据以下案情和法条生成辩论论点...",
        }),
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      const result = await retryService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      expect(result).toBeDefined();
      expect(failingService.chatCompletion).toHaveBeenCalledTimes(3);
    });

    test("超过重试次数应该抛出错误", async () => {
      const alwaysFailingService = {
        chatCompletion: jest.fn().mockRejectedValue(new Error("Failed")),
      };

      const failService = new UnifiedAIService(undefined, {
        maxRetries: 2,
      });
      failService["generalAIService"] = alwaysFailingService as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      failService["initialized"] = true;
      failService["promptOptimizer"] = {
        generateOptimizedPrompt: jest.fn().mockResolvedValue({
          systemPrompt:
            "你是专业的法律辩论生成助手，擅长生成逻辑清晰、法律依据准确的辩论论点。",
          userPrompt: "请根据以下案情和法条生成辩论论点...",
        }),
      } as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      await expect(
        failService.generateDebate(mockCaseInfo, mockLegalReferences),
      ).rejects.toThrow();
    });
  });

  describe("质量评估测试", () => {
    test("综合评分应该计算正确", async () => {
      const result = await unifiedService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      expect(result.metadata.confidence).toBeGreaterThan(0);
      expect(result.metadata.confidence).toBeLessThanOrEqual(1);
    });

    test("应该正确计算事实准确性", async () => {
      const result = await unifiedService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      const allArguments = [
        ...result.plaintiffArguments,
        ...result.defendantArguments,
      ];

      const hasLegalBasis = allArguments.every((arg) => arg.legalBasis);
      const hasReasoning = allArguments.every((arg) => arg.reasoning);

      expect(hasLegalBasis).toBe(true);
      expect(hasReasoning).toBe(true);
    });

    test("应该保证正反方平衡", async () => {
      const result = await unifiedService.generateDebate(
        mockCaseInfo,
        mockLegalReferences,
      );

      const plaintiffCount = result.plaintiffArguments.length;
      const defendantCount = result.defendantArguments.length;

      const countDifference = Math.abs(plaintiffCount - defendantCount);
      expect(countDifference).toBeLessThanOrEqual(1);
    });
  });
});
