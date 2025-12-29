// 工作流执行器测试

import { describe, it, expect, beforeEach } from "@jest/globals";

import type {
  WorkflowDefinition,
  WorkflowStep,
} from "@/lib/agent/coordinator/types";

import { WorkflowExecutor } from "@/lib/agent/coordinator/workflow-executor";
import type { Agent, AgentResult } from "@/types/agent";
import { agentRegistry } from "@/lib/agent/registry";

// 模拟Agent
class MockAgent implements Agent {
  readonly version: string = "1.0.0";
  readonly description: string = "Mock Agent for testing";

  constructor(
    public readonly name: string,
    public readonly type: any,
    private shouldFail: boolean = false,
  ) {}

  async execute(context: any): Promise<AgentResult> {
    if (this.shouldFail) {
      throw new Error(`Agent ${this.name} 执行失败`);
    }

    return {
      success: true,
      agentName: this.name,
      executionTime: 100,
      data: {
        stepId: this.name,
        result: `Result from ${this.name}`,
      },
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe("WorkflowExecutor", () => {
  beforeEach(() => {
    // 清空Agent注册表
  });

  describe("串行执行", () => {
    it("应该成功执行串行工作流", async () => {
      // 注册模拟Agent
      const agent1 = new MockAgent("agent1", "doc_analyzer" as any);
      const agent2 = new MockAgent("agent2", "doc_analyzer" as any);
      const agent3 = new MockAgent("agent3", "doc_analyzer" as any);

      agentRegistry.registerAgent(agent1);
      agentRegistry.registerAgent(agent2);
      agentRegistry.registerAgent(agent3);

      // 创建工作流定义
      const workflow: WorkflowDefinition = {
        workflowId: "test-workflow",
        name: "测试工作流",
        executionMode: "sequential",
        steps: [
          {
            stepId: "step1",
            agentType: "doc_analyzer" as any,
            name: "步骤1",
            required: true,
            outputKey: "result1",
          },
          {
            stepId: "step2",
            agentType: "doc_analyzer" as any,
            name: "步骤2",
            required: true,
            dependsOn: ["step1"],
            outputKey: "result2",
          },
          {
            stepId: "step3",
            agentType: "doc_analyzer" as any,
            name: "步骤3",
            required: true,
            dependsOn: ["step2"],
            outputKey: "result3",
          },
        ],
      };

      // 执行工作流
      const executor = new WorkflowExecutor(workflow, {});
      const result = await executor.execute();

      // 验证结果
      expect(result.status).toBe("completed");
      expect(result.stats.totalSteps).toBe(3);
      expect(result.stats.completedSteps).toBe(3);
      expect(result.stats.failedSteps).toBe(0);
      expect(result.stepResults).toHaveLength(3);

      // 清理
      agentRegistry.unregisterAgent("agent1");
      agentRegistry.unregisterAgent("agent2");
      agentRegistry.unregisterAgent("agent3");
    });

    it("应该正确处理步骤依赖", async () => {
      const agent = new MockAgent("dep-agent", "doc_analyzer" as any);
      agentRegistry.registerAgent(agent);

      const workflow: WorkflowDefinition = {
        workflowId: "dependency-test",
        name: "依赖测试",
        executionMode: "sequential",
        steps: [
          {
            stepId: "step-a",
            agentType: "doc_analyzer" as any,
            name: "步骤A",
            required: true,
            priority: 1,
          },
          {
            stepId: "step-b",
            agentType: "doc_analyzer" as any,
            name: "步骤B",
            required: true,
            dependsOn: ["step-a"],
            priority: 2,
          },
          {
            stepId: "step-c",
            agentType: "doc_analyzer" as any,
            name: "步骤C",
            required: true,
            dependsOn: ["step-a", "step-b"],
            priority: 3,
          },
        ],
      };

      const executor = new WorkflowExecutor(workflow, {});
      const result = await executor.execute();

      expect(result.status).toBe("completed");
      expect(result.stats.completedSteps).toBe(3);

      // 验证执行顺序
      const stepOrder = result.stepResults.map((r) => r.stepId);
      const aIndex = stepOrder.indexOf("step-a");
      const bIndex = stepOrder.indexOf("step-b");
      const cIndex = stepOrder.indexOf("step-c");

      expect(aIndex).toBeLessThan(bIndex);
      expect(bIndex).toBeLessThan(cIndex);

      agentRegistry.unregisterAgent("dep-agent");
    });
  });

  describe("并行执行", () => {
    it("应该成功执行并行工作流", async () => {
      const agents = [
        new MockAgent("parallel-1", "doc_analyzer" as any),
        new MockAgent("parallel-2", "doc_analyzer" as any),
        new MockAgent("parallel-3", "doc_analyzer" as any),
      ];

      agents.forEach((agent) => agentRegistry.registerAgent(agent));

      const workflow: WorkflowDefinition = {
        workflowId: "parallel-workflow",
        name: "并行测试",
        executionMode: "parallel",
        steps: [
          {
            stepId: "p1",
            agentType: "doc_analyzer" as any,
            name: "并行1",
            required: true,
          },
          {
            stepId: "p2",
            agentType: "doc_analyzer" as any,
            name: "并行2",
            required: true,
          },
          {
            stepId: "p3",
            agentType: "doc_analyzer" as any,
            name: "并行3",
            required: true,
          },
        ],
      };

      const executor = new WorkflowExecutor(workflow, {});
      const result = await executor.execute();

      expect(result.status).toBe("completed");
      expect(result.stats.completedSteps).toBe(3);

      agents.forEach((agent) => agentRegistry.unregisterAgent(agent.name));
    });
  });

  describe("混合模式执行", () => {
    it("应该支持混合模式执行", async () => {
      const agents = [
        new MockAgent("mixed-1", "doc_analyzer" as any),
        new MockAgent("mixed-2", "doc_analyzer" as any),
        new MockAgent("mixed-3", "doc_analyzer" as any),
      ];

      agents.forEach((agent) => agentRegistry.registerAgent(agent));

      const workflow: WorkflowDefinition = {
        workflowId: "mixed-workflow",
        name: "混合模式测试",
        executionMode: "mixed",
        steps: [
          {
            stepId: "m1",
            agentType: "doc_analyzer" as any,
            name: "阶段1",
            required: true,
            priority: 1,
          },
          {
            stepId: "m2",
            agentType: "doc_analyzer" as any,
            name: "阶段2-1",
            required: true,
            dependsOn: ["m1"],
            priority: 2,
          },
          {
            stepId: "m3",
            agentType: "doc_analyzer" as any,
            name: "阶段2-2",
            required: true,
            dependsOn: ["m1"],
            priority: 2,
          },
        ],
      };

      const executor = new WorkflowExecutor(workflow, {});
      const result = await executor.execute();

      expect(result.status).toBe("completed");
      expect(result.stats.completedSteps).toBe(3);

      agents.forEach((agent) => agentRegistry.unregisterAgent(agent.name));
    });
  });

  describe("错误处理", () => {
    it("应该正确处理必须步骤失败", async () => {
      const failingAgent = new MockAgent(
        "fail-agent",
        "doc_analyzer" as any,
        true,
      );
      agentRegistry.registerAgent(failingAgent);

      const workflow: WorkflowDefinition = {
        workflowId: "fail-workflow",
        name: "失败测试",
        executionMode: "sequential",
        steps: [
          {
            stepId: "fail-step",
            agentType: "doc_analyzer" as any,
            name: "失败步骤",
            required: true,
          },
        ],
      };

      const executor = new WorkflowExecutor(workflow, {});
      const result = await executor.execute();

      expect(result.status).toBe("failed");
      expect(result.stats.failedSteps).toBe(1);

      agentRegistry.unregisterAgent("fail-agent");
    });
  });

  describe("数据流", () => {
    it("应该正确传递步骤输出数据", async () => {
      const agent = new MockAgent("data-agent", "doc_analyzer" as any);
      agentRegistry.registerAgent(agent);

      const workflow: WorkflowDefinition = {
        workflowId: "data-workflow",
        name: "数据流测试",
        executionMode: "sequential",
        steps: [
          {
            stepId: "data-step1",
            agentType: "doc_analyzer" as any,
            name: "步骤1",
            required: true,
            outputKey: "step1Data",
          },
          {
            stepId: "data-step2",
            agentType: "doc_analyzer" as any,
            name: "步骤2",
            required: true,
            dependsOn: ["data-step1"],
            inputData: { previous: "step1Data" },
            outputKey: "step2Data",
          },
        ],
      };

      const executor = new WorkflowExecutor(workflow, {});
      const result = await executor.execute();

      expect(result.outputData).toBeDefined();
      expect(result.outputData?.step1Data).toBeDefined();

      agentRegistry.unregisterAgent("data-agent");
    });
  });
});
