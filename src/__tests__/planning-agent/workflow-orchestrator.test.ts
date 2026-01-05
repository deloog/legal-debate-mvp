// WorkflowOrchestrator测试

import { describe, it, expect, beforeEach } from "@jest/globals";
import { WorkflowOrchestrator } from "../../lib/agent/planning-agent/workflow-orchestrator";
import { ExecutionMode } from "../../lib/agent/planning-agent/types";
import { AgentType, TaskPriority } from "../../types/agent";
import type {
  SubTask,
  ExecutionStep,
  OrchestrationConfig,
} from "../../lib/agent/planning-agent/types";

describe("WorkflowOrchestrator", () => {
  let orchestrator: WorkflowOrchestrator;

  beforeEach(() => {
    orchestrator = new WorkflowOrchestrator();
  });

  describe("构造函数", () => {
    it("应该使用默认配置创建实例", () => {
      expect(orchestrator).toBeInstanceOf(WorkflowOrchestrator);
    });

    it("应该支持自定义配置", () => {
      const config: OrchestrationConfig = {
        defaultExecutionMode: ExecutionMode.PARALLEL,
        maxConcurrentTasks: 5,
        enableOptimization: false,
      };
      const customOrchestrator = new WorkflowOrchestrator(config);

      expect(customOrchestrator).toBeInstanceOf(WorkflowOrchestrator);
    });
  });

  describe("orchestrate方法", () => {
    describe("顺序执行模式", () => {
      it("应该成功编排顺序执行任务", async () => {
        const tasks: SubTask[] = [
          {
            id: "task-1",
            name: "任务1",
            agent: AgentType.DOC_ANALYZER,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 100,
            dependencies: [],
          },
          {
            id: "task-2",
            name: "任务2",
            agent: AgentType.STRATEGIST,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 200,
            dependencies: ["task-1"],
          },
        ];

        const result = await orchestrator.orchestrate(
          tasks,
          ExecutionMode.SEQUENTIAL,
        );

        expect(result.workflow).toBeDefined();
        expect(result.workflow.executionMode).toBe(ExecutionMode.SEQUENTIAL);
        expect(result.executionPlan).toBeInstanceOf(Array);
        expect(result.executionPlan.length).toBe(2);
        expect(result.estimatedDuration).toBe(300);
      });
    });

    describe("并行执行模式", () => {
      it("应该成功编排并行执行任务", async () => {
        const tasks: SubTask[] = [
          {
            id: "task-1",
            name: "任务1",
            agent: AgentType.DOC_ANALYZER,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 100,
            dependencies: [],
          },
          {
            id: "task-2",
            name: "任务2",
            agent: AgentType.STRATEGIST,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 200,
            dependencies: [],
          },
          {
            id: "task-3",
            name: "任务3",
            agent: AgentType.REVIEWER,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 150,
            dependencies: ["task-1", "task-2"],
          },
        ];

        const result = await orchestrator.orchestrate(
          tasks,
          ExecutionMode.PARALLEL,
        );

        expect(result.workflow.executionMode).toBe(ExecutionMode.PARALLEL);
        expect(result.estimatedDuration).toBeLessThan(450); // 并行执行应该更快
      });

      it("应该处理无依赖的并行任务", async () => {
        const tasks: SubTask[] = [
          {
            id: "task-1",
            name: "任务1",
            agent: AgentType.DOC_ANALYZER,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 100,
            dependencies: [],
          },
          {
            id: "task-2",
            name: "任务2",
            agent: AgentType.STRATEGIST,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 200,
            dependencies: [],
          },
        ];

        const result = await orchestrator.orchestrate(
          tasks,
          ExecutionMode.PARALLEL,
        );

        const firstStep = result.executionPlan[0];
        expect(firstStep.mode).toBe("parallel");
      });
    });

    describe("混合执行模式", () => {
      it("应该成功编排混合执行任务", async () => {
        const tasks: SubTask[] = [
          {
            id: "task-1",
            name: "任务1",
            agent: AgentType.DOC_ANALYZER,
            priority: TaskPriority.HIGH,
            estimatedTime: 100,
            dependencies: [],
          },
          {
            id: "task-2",
            name: "任务2",
            agent: AgentType.STRATEGIST,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 200,
            dependencies: [],
          },
          {
            id: "task-3",
            name: "任务3",
            agent: AgentType.REVIEWER,
            priority: TaskPriority.LOW,
            estimatedTime: 150,
            dependencies: ["task-1"],
          },
        ];

        const result = await orchestrator.orchestrate(
          tasks,
          ExecutionMode.MIXED,
        );

        expect(result.workflow.executionMode).toBe(ExecutionMode.MIXED);
        expect(result.executionPlan.length).toBeGreaterThan(0);
      });

      it("应该按优先级排序任务", async () => {
        const tasks: SubTask[] = [
          {
            id: "task-1",
            name: "低优先级任务",
            agent: AgentType.DOC_ANALYZER,
            priority: TaskPriority.LOW,
            estimatedTime: 100,
            dependencies: [],
          },
          {
            id: "task-2",
            name: "高优先级任务",
            agent: AgentType.STRATEGIST,
            priority: TaskPriority.URGENT,
            estimatedTime: 200,
            dependencies: [],
          },
          {
            id: "task-3",
            name: "中优先级任务",
            agent: AgentType.REVIEWER,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 150,
            dependencies: [],
          },
        ];

        const result = await orchestrator.orchestrate(
          tasks,
          ExecutionMode.MIXED,
        );

        // 高优先级任务应该在前面
        const firstTaskId = result.executionPlan[0].taskId;
        expect(firstTaskId).toBe("task-2");
      });
    });

    describe("默认执行模式", () => {
      it("应该使用配置的默认执行模式", async () => {
        const defaultConfigOrchestrator = new WorkflowOrchestrator({
          defaultExecutionMode: ExecutionMode.PARALLEL,
          maxConcurrentTasks: 3,
          enableOptimization: true,
        });

        const tasks: SubTask[] = [
          {
            id: "task-1",
            name: "任务1",
            agent: AgentType.DOC_ANALYZER,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 100,
            dependencies: [],
          },
        ];

        const result = await defaultConfigOrchestrator.orchestrate(tasks);

        expect(result.workflow.executionMode).toBe(ExecutionMode.PARALLEL);
      });
    });

    describe("错误处理", () => {
      it("应该成功处理边界情况输入", async () => {
        // 测试边界情况：orchestrator会处理这些输入而不是抛出错误
        const edgeCaseTasks: SubTask[] = [
          {
            id: "edge-1",
            name: "边界测试任务",
            agent: AgentType.DOC_ANALYZER,
            priority: TaskPriority.MEDIUM,
            estimatedTime: 0,
            dependencies: [],
          },
        ];

        // 不应该抛出错误
        await expect(
          orchestrator.orchestrate(edgeCaseTasks),
        ).resolves.toBeDefined();
      });
    });
  });

  describe("依赖关系处理", () => {
    it("应该正确构建依赖关系", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: ["task-1"],
        },
        {
          id: "task-3",
          name: "任务3",
          agent: AgentType.REVIEWER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 150,
          dependencies: ["task-1", "task-2"],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);

      expect(result.workflow.dependencies).toBeInstanceOf(Array);
      expect(result.workflow.dependencies.length).toBe(2); // task-2和task-3有依赖
    });

    it("应该处理循环依赖", async () => {
      const tasksWithCycle: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: ["task-2"], // 循环依赖
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: ["task-1"], // 循环依赖
        },
      ];

      // 不应该抛出错误，而应该按照某种顺序处理
      const result = await orchestrator.orchestrate(
        tasksWithCycle,
        ExecutionMode.PARALLEL,
      );

      expect(result.executionPlan).toBeDefined();
      expect(result.executionPlan.length).toBe(2);
    });

    it("应该识别弱依赖（review任务）", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "review-1",
          name: "审查任务1",
          agent: AgentType.REVIEWER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 50,
          dependencies: ["task-1"],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);
      const reviewDep = result.workflow.dependencies.find(
        (dep) => dep.taskId === "review-1",
      );

      expect(reviewDep).toBeDefined();
      expect(reviewDep?.type).toBe("weak");
    });

    it("应该识别强依赖（非review任务）", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: ["task-1"],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);
      const taskDep = result.workflow.dependencies.find(
        (dep) => dep.taskId === "task-2",
      );

      expect(taskDep).toBeDefined();
      expect(taskDep?.type).toBe("strict");
    });
  });

  describe("执行计划生成", () => {
    it("应该生成有效的执行步骤", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);

      result.executionPlan.forEach((step: ExecutionStep) => {
        expect(step).toHaveProperty("step");
        expect(step).toHaveProperty("taskId");
        expect(step).toHaveProperty("taskName");
        expect(step).toHaveProperty("mode");
        expect(step).toHaveProperty("dependencies");
        expect(step).toHaveProperty("estimatedTime");
        expect(step.mode).toMatch(/^(execute|parallel|wait)$/);
      });
    });

    it("应该正确计算预估时长（顺序模式）", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: ["task-1"],
        },
      ];

      const result = await orchestrator.orchestrate(
        tasks,
        ExecutionMode.SEQUENTIAL,
      );

      // 顺序执行：总时间 = 100 + 200 = 300
      expect(result.estimatedDuration).toBe(300);
    });

    it("应该正确计算预估时长（并行模式）", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: [],
        },
      ];

      const result = await orchestrator.orchestrate(
        tasks,
        ExecutionMode.PARALLEL,
      );

      // 并行执行：取最大时间 = 200
      expect(result.estimatedDuration).toBe(200);
    });

    it("应该正确计算预估时长（混合模式）", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.HIGH,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: [],
        },
        {
          id: "task-3",
          name: "任务3",
          agent: AgentType.REVIEWER,
          priority: TaskPriority.LOW,
          estimatedTime: 150,
          dependencies: ["task-1"],
        },
      ];

      const result = await orchestrator.orchestrate(tasks, ExecutionMode.MIXED);

      // 混合模式：第一组并行(max(100,200)=200) + 第二组(150) = 350
      expect(result.estimatedDuration).toBe(350);
    });
  });

  describe("工作流属性", () => {
    it("应该正确设置工作流ID和名称", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);

      expect(result.workflow.id).toMatch(/^workflow-\d+$/);
      expect(result.workflow.name).toBe("自动化生成的工作流");
    });

    it("应该正确设置工作流任务", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: [],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);

      expect(result.workflow.tasks).toBe(tasks);
      expect(result.workflow.tasks.length).toBe(2);
    });

    it("应该正确设置预估总时间", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: [],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);

      // 所有任务的estimatedTime之和
      expect(result.workflow.estimatedTotalTime).toBe(300);
    });
  });

  describe("配置管理", () => {
    it("应该支持更新配置", () => {
      expect(() =>
        orchestrator.updateConfig({
          maxConcurrentTasks: 5,
          enableOptimization: false,
        }),
      ).not.toThrow();
    });

    it("应该获取当前配置", () => {
      const config = orchestrator.getConfig();

      expect(config).toHaveProperty("defaultExecutionMode");
      expect(config).toHaveProperty("maxConcurrentTasks");
      expect(config).toHaveProperty("enableOptimization");
    });

    it("应该正确应用配置更新", async () => {
      orchestrator.updateConfig({ maxConcurrentTasks: 2 });

      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: [],
        },
        {
          id: "task-3",
          name: "任务3",
          agent: AgentType.REVIEWER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 150,
          dependencies: [],
        },
      ];

      await orchestrator.orchestrate(tasks, ExecutionMode.MIXED);

      const config = orchestrator.getConfig();
      expect(config.maxConcurrentTasks).toBe(2);
    });
  });

  describe("计数器管理", () => {
    it("应该自动递增工作流计数器", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
      ];

      const result1 = await orchestrator.orchestrate(tasks);
      const result2 = await orchestrator.orchestrate(tasks);

      expect(result1.workflow.id).toBe("workflow-1");
      expect(result2.workflow.id).toBe("workflow-2");
    });

    it("应该支持重置计数器", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
      ];

      // 第一次编排
      await orchestrator.orchestrate(tasks);

      // 重置计数器
      orchestrator.resetCounter();

      // 再次编排应该从1开始
      const result = await orchestrator.orchestrate(tasks);

      expect(result.workflow.id).toBe("workflow-1");
    });

    it("resetCounter方法不应该抛出错误", () => {
      expect(() => orchestrator.resetCounter()).not.toThrow();
    });
  });

  describe("边界条件测试", () => {
    it("应该处理空任务数组", async () => {
      const result = await orchestrator.orchestrate([]);

      expect(result.workflow).toBeDefined();
      expect(result.executionPlan).toHaveLength(0);
      expect(result.estimatedDuration).toBe(0);
    });

    it("应该处理单个任务", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);

      expect(result.executionPlan.length).toBe(1);
      expect(result.executionPlan[0].taskId).toBe("task-1");
    });

    it("应该处理没有依赖的任务", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: [],
        },
      ];

      const result = await orchestrator.orchestrate(
        tasks,
        ExecutionMode.PARALLEL,
      );

      // 所有任务都应该在第一步并行执行
      expect(result.executionPlan[0].mode).toBe("parallel");
    });

    it("应该处理estimatedTime为0的任务", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 0,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: ["task-1"],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);

      expect(result.estimatedDuration).toBeGreaterThanOrEqual(0);
    });

    it("应该处理复杂的依赖链", async () => {
      const tasks: SubTask[] = [
        {
          id: "task-1",
          name: "任务1",
          agent: AgentType.DOC_ANALYZER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 100,
          dependencies: [],
        },
        {
          id: "task-2",
          name: "任务2",
          agent: AgentType.STRATEGIST,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 200,
          dependencies: ["task-1"],
        },
        {
          id: "task-3",
          name: "任务3",
          agent: AgentType.REVIEWER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 150,
          dependencies: ["task-2"],
        },
        {
          id: "task-4",
          name: "任务4",
          agent: AgentType.REVIEWER,
          priority: TaskPriority.MEDIUM,
          estimatedTime: 50,
          dependencies: ["task-3"],
        },
      ];

      const result = await orchestrator.orchestrate(tasks);

      expect(result.executionPlan.length).toBe(4);
      // 验证执行顺序
      expect(result.executionPlan[0].taskId).toBe("task-1");
      expect(result.executionPlan[1].taskId).toBe("task-2");
      expect(result.executionPlan[2].taskId).toBe("task-3");
      expect(result.executionPlan[3].taskId).toBe("task-4");
    });
  });

  describe("并发限制测试", () => {
    it("应该遵守maxConcurrentTasks配置", async () => {
      const limitedOrchestrator = new WorkflowOrchestrator({
        defaultExecutionMode: ExecutionMode.MIXED,
        maxConcurrentTasks: 2,
        enableOptimization: true,
      });

      const tasks: SubTask[] = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i + 1}`,
        name: `任务${i + 1}`,
        agent: AgentType.DOC_ANALYZER,
        priority: TaskPriority.MEDIUM,
        estimatedTime: 100,
        dependencies: [],
      }));

      const result = await limitedOrchestrator.orchestrate(tasks);

      // 第一步应该最多有2个任务并行
      const firstStepTasks = result.executionPlan.filter(
        (step) => step.step === 1,
      );
      expect(firstStepTasks.length).toBeLessThanOrEqual(2);
    });
  });
});
