/**
 * 争议焦点提取器测试
 * 测试目标：争议焦点识别准确率>90%
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import {
  DisputeFocusExtractor,
  createDisputeFocusExtractor,
  extractDisputeFocusesFromText,
} from "@/lib/agent/doc-analyzer/extractors/dispute-focus";

// =============================================================================
// 测试数据
// =============================================================================

const MOCK_LEGAL_TEXT = `
原告甲与被告乙于2023年1月15日签订《借款合同》，约定借款金额为人民币100万元，
借款期限为6个月，年利率为6%。原告于2023年1月20日通过银行转账向被告支付借款本金100万元。

借款到期后，被告未能按期偿还借款。原告认为被告已构成违约，应当承担违约责任，
要求被告偿还借款本金100万元并支付相应利息。

被告辩称已按照合同约定履行义务，不存在违约行为。被告认为本金数额应计算为80万元，
而非100万元。被告还主张不应承担违约责任，即便存在违约，也应减轻责任。

双方争议焦点包括：1. 被告是否违反合同约定；2. 应支付本金数额；3. 违约责任承担方式。
原告依据《民法典》第五百零九条、第五百七十七条、第五百七十九条提出诉讼请求。
`;

const MOCK_EXTRACTED_DATA = {
  claims: [
    {
      type: "PAY_PRINCIPAL" as const,
      content: "被告偿还借款本金100万元",
      amount: 1000000,
      currency: "人民币",
      _inferred: false,
    },
    {
      type: "PAY_INTEREST" as const,
      content: "被告支付借款利息",
      amount: null,
      currency: "人民币",
      _inferred: false,
    },
  ],
  parties: [
    { type: "plaintiff" as const, name: "原告甲", _inferred: false },
    { type: "defendant" as const, name: "被告乙", _inferred: false },
  ],
};

// =============================================================================
// Mock AI服务
// =============================================================================

// 必须在jest.mock之前声明mock函数
const mockChatCompletion = jest.fn() as any;

// Mock unified-service
jest.mock("@/lib/ai/unified-service", () => {
  const originalModule = jest.requireActual(
    "@/lib/ai/unified-service",
  ) as Record<string, unknown>;
  return {
    ...originalModule,
    getUnifiedAIService: (jest.fn() as any).mockResolvedValue({
      chatCompletion: mockChatCompletion,
    }),
  };
});

// =============================================================================
// 测试套件
// =============================================================================

describe("DisputeFocusExtractor", () => {
  let extractor: DisputeFocusExtractor;

  beforeEach(() => {
    extractor = createDisputeFocusExtractor();
    jest.clearAllMocks();
  });

  describe("createDisputeFocusExtractor", () => {
    it("应该创建提取器实例", () => {
      expect(extractor).toBeInstanceOf(DisputeFocusExtractor);
    });
  });

  describe("extractFromText", () => {
    it("应该使用默认配置提取争议焦点", async () => {
      // Mock AI响应
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify(
                {
                  disputeFocuses: [
                    {
                      category: "CONTRACT_BREACH",
                      description: "被告是否违反合同约定",
                      positionA:
                        "原告认为被告未按照合同约定履行义务，已构成违约",
                      positionB:
                        "被告辩称已按照合同约定履行义务，不存在违约行为",
                      coreIssue: "是否违约",
                      importance: 9,
                      confidence: 0.85,
                    },
                  ],
                },
                null,
                2,
              ),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      expect(result.disputeFocuses).toBeDefined();
      expect(result.disputeFocuses.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.summary.total).toBeGreaterThan(0);
    });

    it("应该正确处理AI提取层", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "PAYMENT_DISPUTE",
                    description: "应支付本金数额",
                    positionA: "原告主张支付本金100万元",
                    positionB: "被告认为本金数额为80万元",
                    coreIssue: "支付本金数额",
                    importance: 8,
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      expect(
        result.disputeFocuses.some((f) => f.category === "PAYMENT_DISPUTE"),
      ).toBe(true);
    });

    it("应该使用规则匹配作为兜底", async () => {
      // Mock AI返回空结果
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({ disputeFocuses: [] }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      // 规则匹配应该能找到至少一个争议焦点
      expect(result.disputeFocuses.length).toBeGreaterThan(0);
    });

    it("应该合并AI和规则匹配的结果并去重", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "CONTRACT_BREACH",
                    description: "被告是否违约",
                    positionA: "原告认为被告违约",
                    positionB: "被告称未违约",
                    coreIssue: "是否违约",
                    importance: 9,
                    confidence: 0.85,
                  },
                  {
                    category: "PAYMENT_DISPUTE",
                    description: "支付本金数额",
                    positionA: "原告主张100万元",
                    positionB: "被告认为80万元",
                    coreIssue: "支付本金数额",
                    importance: 8,
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      const focuses = result.disputeFocuses;
      const uniqueKeys = new Set(
        focuses.map((f) => `${f.category}_${f.coreIssue}`),
      );

      // 去重后应该没有重复
      expect(uniqueKeys.size).toBe(focuses.length);
    });

    it("应该正确过滤推断结果", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "CONTRACT_BREACH",
                    description: "被告是否违约",
                    positionA: "原告认为被告违约",
                    positionB: "被告称未违约",
                    coreIssue: "是否违约",
                    importance: 9,
                    confidence: 0.95, // 高置信度
                  },
                  {
                    category: "PAYMENT_DISPUTE",
                    description: "支付本金数额",
                    positionA: "原告主张100万元",
                    positionB: "被告认为80万元",
                    coreIssue: "支付本金数额",
                    importance: 8,
                    confidence: 0.6, // 低置信度
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
        { includeInferred: false },
      );

      // 应该只保留高置信度结果
      expect(result.disputeFocuses.every((f) => f.confidence >= 0.7)).toBe(
        true,
      );
    });

    it("应该根据最小置信度过滤结果", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "CONTRACT_BREACH",
                    description: "被告是否违约",
                    positionA: "原告认为被告违约",
                    positionB: "被告称未违约",
                    coreIssue: "是否违约",
                    importance: 9,
                    confidence: 0.9,
                  },
                  {
                    category: "LIABILITY_ISSUE",
                    description: "责任承担",
                    positionA: "原告要求承担全部责任",
                    positionB: "被告认为应减轻责任",
                    coreIssue: "责任承担方式",
                    importance: 7,
                    confidence: 0.65,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
        { minConfidence: 0.8 },
      );

      // 应该只保留置信度>=0.80的结果
      expect(result.disputeFocuses.every((f) => f.confidence >= 0.8)).toBe(
        true,
      );
    });

    it("应该生成正确的摘要", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "CONTRACT_BREACH",
                    description: "被告是否违约",
                    positionA: "原告认为被告违约",
                    positionB: "被告称未违约",
                    coreIssue: "是否违约",
                    importance: 9,
                    confidence: 0.85,
                  },
                  {
                    category: "PAYMENT_DISPUTE",
                    description: "支付本金数额",
                    positionA: "原告主张100万元",
                    positionB: "被告认为80万元",
                    coreIssue: "支付本金数额",
                    importance: 8,
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      expect(result.summary).toMatchObject({
        total: expect.any(Number),
        byCategory: expect.any(Object),
        avgImportance: expect.any(Number),
        avgConfidence: expect.any(Number),
        inferredCount: expect.any(Number),
        aiExtractedCount: expect.any(Number),
        ruleExtractedCount: expect.any(Number),
        aiReviewedCount: expect.any(Number),
      });

      expect(result.summary.total).toBeGreaterThan(0);
    });
  });

  describe("extractDisputeFocusesFromText", () => {
    it("应该快速提取争议焦点", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "CONTRACT_BREACH",
                    description: "被告是否违约",
                    positionA: "原告认为被告违约",
                    positionB: "被告称未违约",
                    coreIssue: "是否违约",
                    importance: 9,
                    confidence: 0.85,
                  },
                ],
              }),
            },
          },
        ],
      });

      const focuses = await extractDisputeFocusesFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      expect(Array.isArray(focuses)).toBe(true);
      expect(focuses.length).toBeGreaterThan(0);
    });
  });

  describe("错误处理", () => {
    it("应该处理AI服务错误", async () => {
      mockChatCompletion.mockRejectedValue(new Error("AI service error"));

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      // 应该返回规则匹配的结果
      expect(result.disputeFocuses).toBeDefined();
    });

    it("应该处理无效的AI响应", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: "invalid json",
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      // 应该返回规则匹配的结果
      expect(result.disputeFocuses).toBeDefined();
    });
  });

  describe("准确性验证", () => {
    it("应该识别CONTRACT_BREACH类别争议焦点", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "CONTRACT_BREACH",
                    description: "被告是否违反合同约定",
                    positionA: "原告认为被告未按照合同约定履行义务，已构成违约",
                    positionB: "被告辩称已按照合同约定履行义务，不存在违约行为",
                    coreIssue: "是否违约",
                    importance: 9,
                    confidence: 0.9,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      expect(
        result.disputeFocuses.some((f) => f.category === "CONTRACT_BREACH"),
      ).toBe(true);
    });

    it("应该识别PAYMENT_DISPUTE类别争议焦点", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "PAYMENT_DISPUTE",
                    description: "应支付本金数额",
                    positionA: "原告主张支付本金100万元",
                    positionB: "被告认为本金数额为80万元",
                    coreIssue: "支付本金数额",
                    importance: 8,
                    confidence: 0.85,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      expect(
        result.disputeFocuses.some((f) => f.category === "PAYMENT_DISPUTE"),
      ).toBe(true);
    });

    it("应该识别LIABILITY_ISSUE类别争议焦点", async () => {
      mockChatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              role: "assistant",
              content: JSON.stringify({
                disputeFocuses: [
                  {
                    category: "LIABILITY_ISSUE",
                    description: "违约责任承担方式",
                    positionA: "原告认为应承担全部违约责任",
                    positionB: "被告认为不应承担或减轻责任",
                    coreIssue: "责任承担方式",
                    importance: 7,
                    confidence: 0.8,
                  },
                ],
              }),
            },
          },
        ],
      });

      const result = await extractor.extractFromText(
        MOCK_LEGAL_TEXT,
        MOCK_EXTRACTED_DATA,
      );

      expect(
        result.disputeFocuses.some((f) => f.category === "LIABILITY_ISSUE"),
      ).toBe(true);
    });
  });
});
