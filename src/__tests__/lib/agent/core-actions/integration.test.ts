/**
 * 核心原子函数集成测试
 * 测试与MemoryManager和PrismaClient的实际集成
 */

import { PrismaClient } from "@prisma/client";
import { MemoryManager } from "@/lib/agent/memory-agent/memory-manager";
import * as core from "@/lib/agent/core-actions/index";
import type {
  ValidationRule,
  HandleErrorParams,
  RetryOperationParams,
  MergeResultsParams,
} from "@/lib/agent/core-actions/types";

describe("核心原子函数 - 集成测试", () => {
  let prisma: PrismaClient;
  let memoryManager: MemoryManager;

  beforeAll(() => {
    // 使用实际PrismaClient和MemoryManager进行集成测试
    prisma = new PrismaClient();
    memoryManager = new MemoryManager(prisma);
  });

  afterAll(async () => {
    // 清理测试数据
    // 注意：MemoryManager没有clearAllMemory方法，跳过清理
    await prisma.$disconnect();
  });

  describe("与MemoryManager的集成测试", () => {
    it("应该成功存储和检索记忆", async () => {
      const memoryKey = "integration-test-key";
      const memoryValue = { data: "test", timestamp: Date.now() };

      // 存储记忆
      const storeResult = await core.update_memory(
        memoryManager,
        {
          memoryType: "WORKING",
          memoryKey,
          memoryValue,
          importance: 0.5,
        },
        "test-user",
      );

      expect(storeResult.success).toBe(true);

      // 检索记忆
      const retrieveResult = await memoryManager.getMemory({
        memoryType: "WORKING",
        memoryKey,
      });

      expect(retrieveResult).toBeDefined();
      expect(retrieveResult?.memoryValue).toMatchObject(memoryValue);
    });

    it("应该正确缓存和检索结果", async () => {
      const cacheKey = "integration-cache-key";
      const cacheData = { result: "cached", time: Date.now() };

      // 缓存结果
      const cacheResult = await core.cache_result(
        memoryManager,
        cacheKey,
        cacheData,
        3600,
        "test-user",
      );

      expect(cacheResult.success).toBe(true);

      // 检索缓存
      const cachedMemory = await memoryManager.getMemory({
        memoryType: "WORKING",
        memoryKey: cacheKey,
      });

      expect(cachedMemory).toBeDefined();
      expect(cachedMemory?.memoryValue).toMatchObject(cacheData);
    });

    it("应该在多次调用中复用缓存", async () => {
      const cacheKey = "integration-reuse-key";
      const cacheData = { value: 42, calculated: true };

      // 第一次调用：存储缓存
      const firstCall = await core.cache_result(
        memoryManager,
        cacheKey,
        cacheData,
        60,
        "test-user",
      );

      expect(firstCall.success).toBe(true);

      // 第二次调用：从缓存读取
      const cachedMemory = await memoryManager.getMemory({
        memoryType: "WORKING",
        memoryKey: cacheKey,
      });

      expect(cachedMemory?.memoryValue).toEqual(cacheData);
    });

    it("应该正确更新已存在的记忆", async () => {
      const memoryKey = "integration-update-key";
      const initialValue = { step: 1, data: "initial" };
      const updatedValue = { step: 2, data: "updated" };

      // 存储初始值
      await core.update_memory(
        memoryManager,
        {
          memoryType: "HOT",
          memoryKey,
          memoryValue: initialValue,
          importance: 0.5,
        },
        "test-user",
      );

      // 更新记忆
      const updateResult = await core.update_memory(
        memoryManager,
        {
          memoryType: "HOT",
          memoryKey,
          memoryValue: updatedValue,
          importance: 0.7,
        },
        "test-user",
      );

      expect(updateResult.action).toBe("updated");

      // 验证更新
      const updatedMemory = await memoryManager.getMemory({
        memoryType: "HOT",
        memoryKey,
      });

      expect(updatedMemory?.memoryValue).toEqual(updatedValue);
    });
  });

  describe("与PrismaClient的集成测试", () => {
    it("应该正确记录行动日志", async () => {
      const params = {
        actionType: "ANALYZE" as const, // 使用有效的ActionType枚举值
        actionName: "integration_test_action",
        agentName: "IntegrationTestAgent",
        input: { testData: "value" },
        output: { result: "success" },
        status: "success" as const,
        executionTime: 100,
      };

      const result = await core.log_action(prisma, params);

      expect(result.success).toBe(true);
      expect(result.recordId).toBeDefined();
      expect(typeof result.recordId).toBe("string");
    });

    it("应该正确记录错误日志", async () => {
      const error = new Error("Integration test error");
      const params: HandleErrorParams = {
        error,
        actionName: "integration_error_test",
        context: { testContext: "integration" }, // context是必填字段
        metadata: {},
      };

      const result = await core.handle_error(prisma, params);

      expect(result.handled).toBe(true);
      expect(result.errorId).toBeDefined();
      expect(typeof result.errorId).toBe("string");
    });

    it("应该正确标记可重试错误", async () => {
      const networkError = new Error("Network timeout");
      const params: HandleErrorParams = {
        error: networkError,
        actionName: "network_test",
        context: {}, // context是必填字段
      };

      const result = await core.handle_error(prisma, params);

      expect(result.retryable).toBe(true);
    });

    it("应该正确标记不可重试错误", async () => {
      // 创建一个name为ValidationError的自定义错误类
      class ValidationError extends Error {
        name = "ValidationError" as const;
      }

      const validationError = new ValidationError("Invalid input");
      const params: HandleErrorParams = {
        error: validationError,
        actionName: "validation_test",
        context: {}, // context是必填字段
      };

      const result = await core.handle_error(prisma, params);

      expect(result.retryable).toBe(false);
    });
  });

  describe("端到端流程测试", () => {
    it("应该完整执行分析-验证-存储流程", async () => {
      // 1. 分析文本
      const text = "张三于2024年1月1日支付了50万元违约金。";
      const analysisResult = await core.analyze_text(text);

      expect(analysisResult).toBeDefined();
      expect(analysisResult.containsChinese).toBe(true);
      expect(analysisResult.containsNumbers).toBe(true);

      // 2. 提取实体
      const entityResult = await core.extract_entities(text, [
        "PERSON",
        "DATE",
        "AMOUNT",
      ]);

      expect(entityResult.entities.length).toBeGreaterThan(0);

      // 3. 存储到记忆
      const memoryKey = "e2e-analysis-key";
      const storeResult = await core.update_memory(
        memoryManager,
        {
          memoryType: "HOT",
          memoryKey,
          memoryValue: {
            analysis: analysisResult,
            entities: entityResult.entities,
          },
          importance: 0.8,
        },
        "e2e-user",
      );

      expect(storeResult.success).toBe(true);

      // 4. 从记忆检索
      const retrievedMemory = await memoryManager.getMemory({
        memoryType: "HOT",
        memoryKey,
      });

      expect(retrievedMemory).toBeDefined();
      const memoryValue = retrievedMemory?.memoryValue as unknown as {
        analysis: unknown;
        entities: unknown;
      };
      expect(memoryValue.analysis).toBeDefined();
      expect(memoryValue.entities).toBeDefined();

      // 5. 记录行动日志
      const logResult = await core.log_action(prisma, {
        actionType: "ANALYZE" as const, // 使用有效的ActionType枚举值
        actionName: "e2e_test",
        agentName: "E2ETestAgent",
        input: { text },
        output: {
          analysisResult,
          entityResult,
        },
        status: "success",
        executionTime: 100,
      });

      expect(logResult.success).toBe(true);
    });

    it("应该正确执行重试机制并记录错误", async () => {
      let attemptCount = 0;
      const flakyOperation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Temporary failure");
        }
        return { success: true };
      });

      const params: RetryOperationParams = {
        operation: flakyOperation,
        maxAttempts: 3,
        baseDelay: 10,
        maxDelay: 50,
      };

      const result = await core.retry_operation(params);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(flakyOperation).toHaveBeenCalledTimes(3);

      // 记录成功日志
      await core.log_action(prisma, {
        actionType: "ANALYZE" as const, // 使用有效的ActionType枚举值
        actionName: "retry_with_success",
        agentName: "RetryTestAgent",
        input: { attempts: result.attempts }, // parameters是必填字段
        status: "success",
        executionTime: result.executionTime,
      });
    });

    it("应该在重试失败时记录错误", async () => {
      const failingOperation = jest
        .fn()
        .mockRejectedValue(new Error("Persistent failure"));

      const params: RetryOperationParams = {
        operation: failingOperation,
        maxAttempts: 2,
        baseDelay: 5,
      };

      const result = await core.retry_operation(params);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(2);

      // 记录错误
      const errorResult = await core.handle_error(prisma, {
        error: result.error || new Error("Unknown error"),
        actionName: "retry_failed_test",
        context: { attempts: result.attempts },
      });

      expect(errorResult.handled).toBe(true);
      expect(errorResult.errorId).toBeDefined();
    });
  });

  describe("数据流集成测试", () => {
    it("应该正确验证、转换和存储数据", async () => {
      const rawData = {
        name: "  测试名称  ", // 有空格
        email: "test@example.com",
        age: "25", // 字符串而非数字
      };

      // 验证数据
      const validationRules: ValidationRule[] = [
        {
          field: "name",
          type: "string",
          required: true,
          minLength: 2,
          maxLength: 50,
          customValidator: (value) =>
            typeof value === "string" && value.trim().length > 0,
        },
        {
          field: "email",
          type: "string",
          required: true,
          pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
        {
          field: "age",
          type: "number",
          required: true,
          customValidator: (value) => typeof value === "number" && value > 0,
        },
      ];

      const validationResult = await core.validate_data(
        rawData,
        validationRules,
      );

      // 应该有验证错误（name有空格，age是字符串）
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors.length).toBeGreaterThan(0);

      // 清理数据
      const cleanedData = {
        name: rawData.name.trim(),
        email: rawData.email,
        age: parseInt(rawData.age, 10),
      };

      // 重新验证
      const cleanedValidationResult = await core.validate_data(
        cleanedData,
        validationRules,
      );

      expect(cleanedValidationResult.valid).toBe(true);

      // 存储到记忆
      const memoryKey = "data-flow-test-key";
      const storeResult = await core.update_memory(
        memoryManager,
        {
          memoryType: "HOT",
          memoryKey,
          memoryValue: cleanedData,
          importance: 0.6,
        },
        "data-flow-user",
      );

      expect(storeResult.success).toBe(true);
    });

    it("应该正确合并、排序和缓存结果", async () => {
      // 准备多个结果集
      const results1 = [
        { id: 1, score: 70, name: "Item 1" },
        { id: 2, score: 90, name: "Item 2" },
      ];
      const results2 = [
        { id: 3, score: 85, name: "Item 3" },
        { id: 4, score: 65, name: "Item 4" },
      ];

      // 合并结果
      const mergeParams: MergeResultsParams<{
        id: number;
        score: number;
        name: string;
      }> = {
        results: [results1, results2],
        deduplicate: false,
      };

      const mergeResult = await core.merge_results(mergeParams);

      expect(mergeResult.merged).toHaveLength(4);
      expect(mergeResult.totalItems).toBe(4);

      // 排序结果
      const rankResult = await core.rank_items(
        mergeResult.merged,
        (item) => item.score,
        "desc",
      );

      expect(rankResult.ranked[0].score).toBe(90);
      expect(rankResult.ranked[1].score).toBe(85);
      expect(rankResult.ranked[2].score).toBe(70);
      expect(rankResult.ranked[3].score).toBe(65);

      // 缓存结果
      const cacheKey = "merged-results-key";
      const cacheResult = await core.cache_result(
        memoryManager,
        cacheKey,
        {
          merged: mergeResult.merged,
          ranked: rankResult.ranked,
        },
        1800,
        "data-flow-user",
      );

      expect(cacheResult.success).toBe(true);

      // 验证缓存
      const cached = await memoryManager.getMemory({
        memoryType: "WORKING",
        memoryKey: cacheKey,
      });

      const cachedValue = cached?.memoryValue as unknown as {
        ranked: Array<{ score: number }>;
      };
      expect(cachedValue.ranked).toBeDefined();
      expect(cachedValue.ranked[0].score).toBe(90);
    });
  });

  describe("错误恢复集成测试", () => {
    it("应该正确处理并从错误中恢复", async () => {
      let attempt = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempt++;
        if (attempt === 1) {
          throw new Error("First attempt failed");
        }
        return { success: true, data: "recovered" };
      });

      // 执行重试
      const retryParams: RetryOperationParams = {
        operation,
        maxAttempts: 2,
        baseDelay: 10,
      };

      const retryResult = await core.retry_operation(retryParams);

      expect(retryResult.success).toBe(true);

      // 记录恢复
      const logResult = await core.log_action(prisma, {
        actionType: "ANALYZE" as const, // 使用有效的ActionType枚举值
        actionName: "error_recovery_test",
        agentName: "RecoveryAgent",
        input: { attempts: retryResult.attempts },
        output: { recovered: true },
        status: "success",
        executionTime: retryResult.executionTime,
      });

      expect(logResult.success).toBe(true);
    });

    it("应该在最终失败时记录详细信息", async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error("All attempts failed"));

      const retryParams: RetryOperationParams = {
        operation,
        maxAttempts: 3,
        baseDelay: 5,
      };

      const retryResult = await core.retry_operation(retryParams);

      expect(retryResult.success).toBe(false);

      // 记录错误
      const errorParams: HandleErrorParams = {
        error: retryResult.error || new Error("Unknown error"),
        actionName: "all_failed_test",
        context: {
          attempts: retryResult.attempts,
          lastError: "All attempts failed",
        },
        metadata: {}, // metadata确保类型正确
      };

      const errorResult = await core.handle_error(prisma, errorParams);

      expect(errorResult.handled).toBe(true);
      expect(errorResult.errorId).toBeDefined();
      expect(errorResult.retryable).toBe(true);
    });
  });
});
