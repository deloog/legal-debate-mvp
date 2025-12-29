/**
 * 辩论流式生成器单元测试
 * 测试流式事件发送、进度追踪、错误处理等功能
 */

import { DebateStreamGenerator } from "@/lib/debate/stream/debate-stream-generator";
import type { ArgumentEventData } from "@/lib/debate/stream/types";

describe("DebateStreamGenerator", () => {
  let generator: DebateStreamGenerator;
  const sessionId = "test-session-001";
  const config = {
    debateId: "debate-123",
    roundId: "round-456",
    roundNumber: 1,
    totalArguments: 4,
    progressInterval: 1000,
  };
  const outputChunks: string[] = [];

  beforeEach(() => {
    outputChunks.length = 0;
    const writeCallback = (data: string) => {
      outputChunks.push(data);
    };
    generator = new DebateStreamGenerator(sessionId, config, writeCallback);
  });

  afterEach(() => {
    generator.cleanup();
  });

  describe("连接事件", () => {
    it("应该发送连接确认事件", () => {
      generator.sendConnected();

      expect(outputChunks.length).toBe(1);
      expect(outputChunks[0]).toContain("event: connected");
      expect(outputChunks[0]).toContain(config.debateId);
      expect(outputChunks[0]).toContain(config.roundId);
      expect(outputChunks[0]).toContain(sessionId);
    });

    it("应该发送轮次开始事件", () => {
      generator.sendRoundStart();

      expect(outputChunks.length).toBe(1);
      expect(outputChunks[0]).toContain("event: round-start");
      expect(outputChunks[0]).toContain('"roundNumber":1');
    });

    it("应该发送断开连接事件", () => {
      generator.sendDisconnected("正常关闭", 1000);

      expect(outputChunks.length).toBe(1);
      expect(outputChunks[0]).toContain("event: disconnected");
      expect(outputChunks[0]).toContain('"reason":"正常关闭"');
      expect(outputChunks[0]).toContain('"code":1000');
    });
  });

  describe("论点事件", () => {
    it("应该发送论点生成事件", () => {
      const argument: ArgumentEventData = {
        argumentId: "arg-1",
        roundId: config.roundId,
        side: "PLAINTIFF",
        content: "这是原告的论点",
        type: "MAIN_POINT",
        timestamp: new Date().toISOString(),
      };

      generator.sendArgument(argument);

      expect(outputChunks.length).toBe(1);
      expect(outputChunks[0]).toContain("event: argument");
      expect(outputChunks[0]).toContain('"argumentId":"arg-1"');
      expect(outputChunks[0]).toContain('"side":"PLAINTIFF"');
      expect(outputChunks[0]).toContain("这是原告的论点");
    });

    it("应该正确跟踪生成的论点", () => {
      const argument1: ArgumentEventData = {
        argumentId: "arg-1",
        roundId: config.roundId,
        side: "PLAINTIFF",
        content: "论点1",
        type: "MAIN_POINT",
        timestamp: new Date().toISOString(),
      };

      const argument2: ArgumentEventData = {
        argumentId: "arg-2",
        roundId: config.roundId,
        side: "DEFENDANT",
        content: "论点2",
        type: "REBUTTAL",
        timestamp: new Date().toISOString(),
      };

      generator.sendArgument(argument1);
      generator.sendArgument(argument2);

      expect(outputChunks.length).toBe(2);
      expect(outputChunks[0]).toContain('"side":"PLAINTIFF"');
      expect(outputChunks[1]).toContain('"side":"DEFENDANT"');
    });
  });

  describe("进度事件", () => {
    it("应该发送进度更新事件", () => {
      generator.sendProgress("生成原告论点", 4);

      expect(outputChunks.length).toBe(1);
      expect(outputChunks[0]).toContain("event: progress");
      expect(outputChunks[0]).toContain('"currentStep":"生成原告论点"');
      expect(outputChunks[0]).toContain('"totalSteps":4');
      expect(outputChunks[0]).toContain('"progress":0'); // 没有论点时为0
    });

    it("应该基于生成的论点计算进度", () => {
      const argument: ArgumentEventData = {
        argumentId: "arg-1",
        roundId: config.roundId,
        side: "PLAINTIFF",
        content: "论点1",
        type: "MAIN_POINT",
        timestamp: new Date().toISOString(),
      };

      generator.sendArgument(argument);
      generator.sendProgress("生成原告论点", 4);

      expect(outputChunks[1]).toContain('"progress":25'); // 1/4 = 25%
    });

    it("应该支持自定义进度值", () => {
      generator.sendProgress("初始化中", 10, 50);

      expect(outputChunks.length).toBe(1);
      expect(outputChunks[0]).toContain('"progress":50');
    });

    it("应该估算剩余时间", () => {
      const argument: ArgumentEventData = {
        argumentId: "arg-1",
        roundId: config.roundId,
        side: "PLAINTIFF",
        content: "论点1",
        type: "MAIN_POINT",
        timestamp: new Date().toISOString(),
      };

      generator.sendArgument(argument);
      generator.sendProgress("生成原告论点", 4);

      // 等待一小段时间以进行估算
      setTimeout(() => {
        const chunk = outputChunks[1];
        expect(chunk).toContain("estimatedRemainingTime");
      }, 100);
    });
  });

  describe("自动进度更新", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("应该启动自动进度更新", () => {
      const steps = ["初始化", "生成原告论点", "生成被告论点", "完成"];

      generator.startProgressUpdates(steps);

      jest.advanceTimersByTime(2500);

      // 应该至少发送2次进度更新
      expect(outputChunks.length).toBeGreaterThanOrEqual(2);

      generator.stopProgressUpdates();
    });

    it("应该停止自动进度更新", () => {
      const steps = ["初始化", "生成原告论点", "生成被告论点", "完成"];

      generator.startProgressUpdates(steps);

      jest.advanceTimersByTime(2000);
      const countAfter2Sec = outputChunks.length;

      generator.stopProgressUpdates();
      jest.advanceTimersByTime(2000);

      expect(outputChunks.length).toBe(countAfter2Sec);
    });

    it("应该使用当前步骤名称", () => {
      const steps = ["初始化", "生成原告论点", "生成被告论点", "完成"];

      generator.startProgressUpdates(steps);

      jest.advanceTimersByTime(1000);

      expect(outputChunks[0]).toContain('"currentStep":"初始化"');

      generator.stopProgressUpdates();
    });
  });

  describe("完成事件", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("应该发送完成事件", () => {
      // 添加一些论点
      for (let i = 0; i < 4; i++) {
        const argument: ArgumentEventData = {
          argumentId: `arg-${i}`,
          roundId: config.roundId,
          side: i % 2 === 0 ? "PLAINTIFF" : "DEFENDANT",
          content: `论点${i}`,
          type: "MAIN_POINT",
          timestamp: new Date().toISOString(),
        };
        generator.sendArgument(argument);
      }

      generator.sendCompleted();

      expect(outputChunks.length).toBe(5); // 4个论点 + 1个完成事件
      expect(outputChunks[4]).toContain("event: completed");
      expect(outputChunks[4]).toContain('"totalArguments":4');
      expect(outputChunks[4]).toContain('"plaintiffArguments":2');
      expect(outputChunks[4]).toContain('"defendantArguments":2');
      expect(outputChunks[4]).toContain("generationTime");
    });

    it("应该在发送完成事件后停止进度更新", () => {
      const steps = ["初始化", "生成原告论点", "生成被告论点", "完成"];
      generator.startProgressUpdates(steps);

      generator.sendCompleted();

      // 不需要推进定时器，因为没有定时器在运行
      expect(outputChunks.length).toBe(1);
    });
  });

  describe("错误处理", () => {
    it("应该发送错误事件", () => {
      generator.sendError("AI_ERROR", "AI服务不可用", { retryable: true });

      expect(outputChunks.length).toBe(1);
      expect(outputChunks[0]).toContain("event: error");
      expect(outputChunks[0]).toContain('"code":"AI_ERROR"');
      expect(outputChunks[0]).toContain('"message":"AI服务不可用"');
      expect(outputChunks[0]).toContain('"retryable":true');
    });

    it("应该支持指定轮次ID", () => {
      generator.sendError(
        "VALIDATION_ERROR",
        "输入无效",
        undefined,
        "custom-round-id",
      );

      expect(outputChunks[0]).toContain('"roundId":"custom-round-id"');
    });

    it("应该设置错误重试间隔", () => {
      generator.sendError("NETWORK_ERROR", "网络超时");

      expect(outputChunks[0]).toContain("retry: 3000");
    });
  });

  describe("心跳机制", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("应该启动心跳", () => {
      generator.startHeartbeat(1000);

      jest.advanceTimersByTime(3000);

      expect(outputChunks.length).toBe(3);
      outputChunks.forEach((chunk) => {
        expect(chunk).toContain("event: ping");
      });

      generator.stopHeartbeat();
    });

    it("应该停止心跳", () => {
      generator.startHeartbeat(1000);

      jest.advanceTimersByTime(2000);
      const countAfter2Sec = outputChunks.length;

      generator.stopHeartbeat();
      jest.advanceTimersByTime(2000);

      expect(outputChunks.length).toBe(countAfter2Sec);
    });

    it("心跳应该包含时间戳", () => {
      generator.startHeartbeat(1000);

      jest.advanceTimersByTime(1000);

      expect(outputChunks[0]).toContain("event: ping");
      expect(outputChunks[0]).toContain("timestamp");
      expect(outputChunks[0]).toContain("serverTime");

      generator.stopHeartbeat();
    });
  });

  describe("统计信息", () => {
    it("应该返回会话统计信息", () => {
      const stats = generator.getStats();

      expect(stats.sessionId).toBe(sessionId);
      expect(stats.totalEventsSent).toBe(0);
      expect(stats.totalBytesSent).toBe(0);
    });

    it("应该跟踪发送的事件数量", () => {
      generator.sendConnected();
      generator.sendRoundStart();

      const stats = generator.getStats();
      expect(stats.totalEventsSent).toBe(2);
    });

    it("应该跟踪发送的字节数", () => {
      generator.sendConnected();

      const stats = generator.getStats();
      expect(stats.totalBytesSent).toBeGreaterThan(0);
    });
  });

  describe("清理资源", () => {
    it("应该清理所有资源", () => {
      jest.useFakeTimers();
      const steps = ["初始化", "完成"];
      generator.startProgressUpdates(steps);
      generator.startHeartbeat(1000);

      generator.cleanup();

      jest.advanceTimersByTime(5000);

      // 清理后不应该有新的心跳或进度更新
      const lastChunkCount = outputChunks.length;
      expect(outputChunks.length).toBe(lastChunkCount);

      jest.useRealTimers();
    });
  });

  describe("边缘情况", () => {
    it("应该处理没有论点的情况", () => {
      generator.sendCompleted();

      expect(outputChunks[0]).toContain('"totalArguments":0');
      expect(outputChunks[0]).toContain('"plaintiffArguments":0');
      expect(outputChunks[0]).toContain('"defendantArguments":0');
    });

    it("应该处理只有原告论点的情况", () => {
      for (let i = 0; i < 4; i++) {
        const argument: ArgumentEventData = {
          argumentId: `arg-${i}`,
          roundId: config.roundId,
          side: "PLAINTIFF",
          content: `论点${i}`,
          type: "MAIN_POINT",
          timestamp: new Date().toISOString(),
        };
        generator.sendArgument(argument);
      }

      generator.sendCompleted();

      expect(outputChunks[4]).toContain('"plaintiffArguments":4');
      expect(outputChunks[4]).toContain('"defendantArguments":0');
    });

    it("应该处理进度为0时的剩余时间计算", () => {
      generator.sendProgress("初始化中", 10, 0);

      // 当进度为0时，estimatedRemainingTime应为null且不包含在输出中
      expect(outputChunks[0]).not.toContain("estimatedRemainingTime");
    });

    it("应该正确计算100%进度", () => {
      const argument: ArgumentEventData = {
        argumentId: "arg-1",
        roundId: config.roundId,
        side: "PLAINTIFF",
        content: "论点",
        type: "MAIN_POINT",
        timestamp: new Date().toISOString(),
      };

      generator.sendArgument(argument);
      generator.sendProgress("完成", 4, 100);

      expect(outputChunks[1]).toContain('"progress":100');
    });
  });
});
