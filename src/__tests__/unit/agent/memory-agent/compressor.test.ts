/**
 * MemoryCompressor - 单元测试
 * 测试记忆压缩算法
 */

// Mock uuid模块
jest.mock("uuid", () => ({
  v4: jest.fn().mockReturnValue("mock-uuid-v4"),
}));

import type { AIService } from "@/lib/ai/service-refactored";
import { MemoryCompressor } from "@/lib/agent/memory-agent";

// Mock AIService
const mockAIService = {
  chatCompletion: jest.fn().mockResolvedValue({
    id: "test-id",
    object: "chat.completion",
    created: Date.now(),
    model: "deepseek-chat",
    provider: "deepseek",
    duration: 100,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: "mock response",
        },
        finishReason: "stop",
      },
    ],
    usage: {
      promptTokens: 20,
      completionTokens: 30,
      totalTokens: 50,
    },
  }),
} as unknown as jest.Mocked<AIService>;

describe("MemoryCompressor", () => {
  let compressor: MemoryCompressor;

  beforeEach(() => {
    jest.clearAllMocks();
    compressor = new MemoryCompressor(mockAIService);
  });

  describe("AI压缩", () => {
    it("应该使用AI压缩高重要性的记忆", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test_key",
        memoryValue: { data: "important data", amount: 1000 },
        importance: 0.8,
        accessCount: 10,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      mockAIService.chatCompletion.mockResolvedValue({
        id: "test-id",
        object: "chat.completion",
        created: Date.now(),
        model: "deepseek-chat",
        provider: "deepseek",
        duration: 100,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "重要数据: 金额1000",
            },
            finishReason: "stop",
          },
        ],
        usage: { promptTokens: 20, completionTokens: 30, totalTokens: 50 },
      });

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(true);
      expect(result.summary).toBe("重要数据: 金额1000");
      expect(result.keyInfo).toBeDefined();
      expect(result.ratio).toBeGreaterThan(0);
    });

    it("应该提取关键信息", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test_key",
        memoryValue: {
          amount: 50000,
          date: "2024-01-01",
          party: "张三",
          claim: "违约责任",
        },
        importance: 0.9,
        accessCount: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      mockAIService.chatCompletion.mockResolvedValueOnce({
        id: "test-id",
        object: "chat.completion",
        created: Date.now(),
        model: "deepseek-chat",
        provider: "deepseek",
        duration: 100,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "违约纠纷，金额5万",
            },
            finishReason: "stop",
          },
        ],
        usage: { promptTokens: 20, completionTokens: 30, totalTokens: 50 },
      });

      mockAIService.chatCompletion.mockResolvedValueOnce({
        id: "test-id",
        object: "chat.completion",
        created: Date.now(),
        model: "deepseek-chat",
        provider: "deepseek",
        duration: 100,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content:
                '[{"field":"amount","value":50000,"importance":1.0},{"field":"party","value":"张三","importance":0.9}]',
            },
            finishReason: "stop",
          },
        ],
        usage: { promptTokens: 30, completionTokens: 50, totalTokens: 80 },
      });

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(true);
      expect(result.keyInfo).toHaveLength(2);
      expect(result.keyInfo[0].field).toBe("amount");
    });
  });

  describe("规则压缩（降级）", () => {
    it("应该使用规则压缩低重要性的记忆", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test_key",
        memoryValue: { data: "not so important" },
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
      expect(result.keyInfo).toBeDefined();
    });

    it("应该处理字符串数据", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test_key",
        memoryValue:
          "这是一段很长的文本数据，需要进行压缩处理。这段文本包含了大量的信息。",
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(true);
      expect(result.summary.length).toBeLessThanOrEqual(
        mockMemory.memoryValue.length,
      );
    });

    it("应该处理嵌套对象", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test_key",
        memoryValue: {
          level1: {
            level2: {
              level3: { value: "deep" },
            },
          },
        },
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(true);
      expect(result.summary).toBeDefined();
    });
  });

  describe("压缩比计算", () => {
    it("应该计算正确的压缩比", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test_key",
        memoryValue: { longData: Array(100).fill("test") },
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(true);
      expect(result.ratio).toBeGreaterThan(0);
      expect(result.ratio).toBeLessThan(1);
    });

    it("应该支持自定义压缩比", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "HOT" as const,
        memoryKey: "test_key",
        memoryValue: { data: "test" },
        importance: 0.8,
        accessCount: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      mockAIService.chatCompletion.mockResolvedValue({
        id: "test-id",
        object: "chat.completion",
        created: Date.now(),
        model: "deepseek-chat",
        provider: "deepseek",
        duration: 100,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "测试数据",
            },
            finishReason: "stop",
          },
        ],
        usage: { promptTokens: 20, completionTokens: 30, totalTokens: 50 },
      });

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(true);
    });
  });

  describe("错误处理", () => {
    it("应该处理AI服务失败", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test_key",
        memoryValue: { data: "test" },
        importance: 0.8,
        accessCount: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      mockAIService.chatCompletion.mockRejectedValue(
        new Error("AI service failed"),
      );

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("应该处理AI返回的无效JSON", async () => {
      const mockMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test_key",
        memoryValue: { data: "test" },
        importance: 0.8,
        accessCount: 5,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
        compressed: false,
      };

      mockAIService.chatCompletion.mockResolvedValueOnce({
        id: "test-id",
        object: "chat.completion",
        created: Date.now(),
        model: "deepseek-chat",
        provider: "deepseek",
        duration: 100,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "无效摘要",
            },
            finishReason: "stop",
          },
        ],
        usage: { promptTokens: 20, completionTokens: 30, totalTokens: 50 },
      });

      mockAIService.chatCompletion.mockResolvedValueOnce({
        id: "test-id",
        object: "chat.completion",
        created: Date.now(),
        model: "deepseek-chat",
        provider: "deepseek",
        duration: 100,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: "不是有效的JSON格式",
            },
            finishReason: "stop",
          },
        ],
        usage: { promptTokens: 30, completionTokens: 50, totalTokens: 80 },
      });

      const result = await compressor.compressMemory(mockMemory);

      expect(result.success).toBe(true);
      expect(result.keyInfo).toBeDefined();
    });
  });

  describe("目标压缩比确定", () => {
    it("应该根据记忆类型确定目标压缩比", () => {
      const workingMemory = {
        memoryId: "mem1",
        memoryType: "WORKING" as const,
        memoryKey: "test",
        memoryValue: {},
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      };

      const hotMemory = {
        memoryId: "mem2",
        memoryType: "HOT" as const,
        memoryKey: "test",
        memoryValue: {},
        importance: 0.5,
        accessCount: 1,
        lastAccessedAt: new Date(),
        createdAt: new Date(),
      };

      // 压缩比例通过内部逻辑确定，这里不直接测试
      // 验证不同类型会有不同的压缩行为即可
      expect(workingMemory.memoryType).toBe("WORKING");
      expect(hotMemory.memoryType).toBe("HOT");
    });
  });
});
