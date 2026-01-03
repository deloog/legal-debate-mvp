/**
 * ActionLogger单元测试
 */

import { ActionLogger } from "@/lib/agent/action-tracker/action-logger";
import { prisma } from "@/lib/db/prisma";
import { ActionStatus, ActionLayer, ActionType } from "@prisma/client";

jest.mock("@/lib/db/prisma", () => ({
  prisma: {
    agentAction: {
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("@/lib/error/error-logger", () => ({
  ErrorLogger: jest.fn().mockImplementation(() => ({
    captureError: jest.fn().mockResolvedValue(undefined),
  })),
}));

describe("ActionLogger", () => {
  let logger: ActionLogger;

  beforeEach(() => {
    logger = new ActionLogger();
    jest.clearAllMocks();
  });

  describe("logActionStart", () => {
    it("应该成功记录行动开始", async () => {
      const mockAction = { id: "action-1" };
      (prisma.agentAction.create as jest.Mock).mockResolvedValue(mockAction);

      const input = {
        agentName: "TestAgent",
        actionType: ActionType.ANALYZE,
        actionName: "testAction",
        actionLayer: ActionLayer.CORE,
        parameters: { test: "value" },
        startedAt: new Date(),
      };

      const result = await logger.logActionStart(input);

      expect(result).toBe("action-1");
      expect(prisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentName: input.agentName,
          actionType: input.actionType,
          actionName: input.actionName,
          actionLayer: input.actionLayer,
          parameters: { test: "value" },
          status: ActionStatus.RUNNING,
        }),
      });
    });

    it("应该清理敏感参数", async () => {
      const mockAction = { id: "action-1" };
      (prisma.agentAction.create as jest.Mock).mockResolvedValue(mockAction);

      const input = {
        agentName: "TestAgent",
        actionType: ActionType.ANALYZE,
        actionName: "testAction",
        actionLayer: ActionLayer.CORE,
        parameters: {
          password: "secret123",
          apiKey: "key123",
          normal: "value",
        },
        startedAt: new Date(),
      };

      await logger.logActionStart(input);

      expect(prisma.agentAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          parameters: {
            password: "***REDACTED***",
            apiKey: "***REDACTED***",
            normal: "value",
          },
        }),
      });
    });
  });

  describe("logActionComplete", () => {
    it("应该成功记录行动完成", async () => {
      const mockAction = {
        id: "action-1",
        updatedAt: new Date(),
      };
      (prisma.agentAction.update as jest.Mock).mockResolvedValue(mockAction);

      const input = {
        actionId: "action-1",
        result: { success: true },
        executionTime: 100,
        completedAt: new Date(),
      };

      const result = await logger.logActionComplete(input);

      expect(result).toEqual({
        actionId: "action-1",
        recordedAt: mockAction.updatedAt,
        status: "SUCCESS",
      });
      expect(prisma.agentAction.update).toHaveBeenCalledWith({
        where: { id: "action-1" },
        data: expect.objectContaining({
          status: ActionStatus.COMPLETED,
          result: { success: true },
          executionTime: 100,
        }),
      });
    });
  });

  describe("logActionFailed", () => {
    it("应该成功记录行动失败", async () => {
      const mockAction = {
        id: "action-1",
        updatedAt: new Date(),
      };
      (prisma.agentAction.update as jest.Mock).mockResolvedValue(mockAction);

      const input = {
        actionId: "action-1",
        error: new Error("Test error"),
        executionTime: 50,
        failedAt: new Date(),
      };

      const result = await logger.logActionFailed(input);

      expect(result).toEqual({
        actionId: "action-1",
        recordedAt: mockAction.updatedAt,
        status: "FAILED",
        error: expect.stringContaining("Test error"),
      });
    });
  });

  describe("logAction", () => {
    it("应该记录完整的行动生命周期", async () => {
      const mockStartAction = { id: "action-1" };
      const mockCompleteAction = {
        id: "action-1",
        updatedAt: new Date(),
      };

      (prisma.agentAction.create as jest.Mock).mockResolvedValue(
        mockStartAction,
      );
      (prisma.agentAction.update as jest.Mock).mockResolvedValue(
        mockCompleteAction,
      );

      const input = {
        agentName: "TestAgent",
        actionType: ActionType.ANALYZE,
        actionName: "testAction",
        actionLayer: ActionLayer.CORE,
        parameters: {},
      };

      const executeFn = jest.fn().mockResolvedValue({ result: "success" });
      const result = await logger.logAction(input, executeFn);

      expect(result).toEqual({ result: "success" });
      expect(prisma.agentAction.create).toHaveBeenCalledTimes(1);
      expect(prisma.agentAction.update).toHaveBeenCalledTimes(1);
    });

    it("应该处理执行失败的情况", async () => {
      const mockStartAction = { id: "action-1" };
      const mockFailedAction = {
        id: "action-1",
        updatedAt: new Date(),
      };

      (prisma.agentAction.create as jest.Mock).mockResolvedValue(
        mockStartAction,
      );
      (prisma.agentAction.update as jest.Mock).mockResolvedValue(
        mockFailedAction,
      );

      const input = {
        agentName: "TestAgent",
        actionType: ActionType.ANALYZE,
        actionName: "testAction",
        actionLayer: ActionLayer.CORE,
        parameters: {},
      };

      const executeFn = jest
        .fn()
        .mockRejectedValue(new Error("Execution failed"));

      await expect(logger.logAction(input, executeFn)).rejects.toThrow(
        "Execution failed",
      );
      expect(prisma.agentAction.update).toHaveBeenCalledWith({
        where: { id: "action-1" },
        data: expect.objectContaining({
          status: ActionStatus.FAILED,
        }),
      });
    });
  });

  describe("buildActionChain", () => {
    it("应该构建行动链", async () => {
      const mockActions = [
        {
          id: "action-1",
          actionName: "root",
          agentName: "Agent1",
          executionTime: 100,
          status: ActionStatus.COMPLETED,
          parentActionId: null,
          childActions: ["action-2"],
        },
        {
          id: "action-2",
          actionName: "child",
          agentName: "Agent1",
          executionTime: 50,
          status: ActionStatus.COMPLETED,
          parentActionId: "action-1",
          childActions: [],
        },
      ];

      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue(mockActions);

      const result = await logger.buildActionChain("action-1");

      expect(result).toEqual({
        chainId: "action-1",
        rootActionId: "action-1",
        depth: 1,
        actions: expect.arrayContaining([
          expect.objectContaining({
            actionName: "root",
          }),
          expect.objectContaining({
            actionName: "child",
          }),
        ]),
        totalExecutionTime: 150,
      });
    });
  });

  describe("cleanupOldActions", () => {
    it("应该清理过期的行动记录", async () => {
      const mockResult = { count: 10 };
      (prisma.agentAction.deleteMany as jest.Mock).mockResolvedValue(
        mockResult,
      );

      const result = await logger.cleanupOldActions(30);

      expect(result).toBe(10);
      expect(prisma.agentAction.deleteMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: {
            in: [ActionStatus.COMPLETED, ActionStatus.FAILED],
          },
        }),
      });
    });
  });

  describe("queryActions", () => {
    it("应该根据过滤器查询行动", async () => {
      const mockActions = [
        {
          id: "action-1",
          agentName: "TestAgent",
          actionName: "testAction",
          status: ActionStatus.COMPLETED,
          executionTime: 100,
        },
      ];

      (prisma.agentAction.findMany as jest.Mock).mockResolvedValue(mockActions);

      const result = await logger.queryActions({
        agentName: "TestAgent",
        actionName: "testAction",
        limit: 10,
      });

      expect(result).toEqual(mockActions);
      expect(prisma.agentAction.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          agentName: "TestAgent",
          actionName: "testAction",
        }),
        orderBy: { updatedAt: "desc" },
        take: 10,
      });
    });
  });
});
