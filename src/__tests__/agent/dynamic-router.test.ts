// 动态路由器测试

import {
  DynamicRouter,
  ConditionEvaluator,
  WorkflowRouteBuilder,
} from "@/lib/agent/coordinator/dynamic-router";
import type {
  WorkflowDefinition,
  WorkflowCondition,
  StepExecution,
  ConditionEvaluationContext,
} from "@/lib/agent/coordinator/types";

describe("ConditionEvaluator", () => {
  let evaluator: ConditionEvaluator;

  beforeEach(() => {
    evaluator = new ConditionEvaluator();
  });

  describe("简单条件评估", () => {
    test("应该正确评估等于条件", () => {
      const condition: WorkflowCondition = {
        conditionId: "test1",
        expression: '${shared:field} === "value"',
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map([["field", "value"]]),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test("应该正确评估不等于条件", () => {
      const condition: WorkflowCondition = {
        conditionId: "test2",
        expression: '${shared:field} !== "other"',
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map([["field", "value"]]),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test("应该正确评估大于条件", () => {
      const condition: WorkflowCondition = {
        conditionId: "test3",
        expression: "${shared:count} > 5",
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map([["count", 10]]),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test("应该正确评估小于条件", () => {
      const condition: WorkflowCondition = {
        conditionId: "test4",
        expression: "${shared:count} < 15",
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map([["count", 10]]),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });
  });

  describe("复杂条件评估", () => {
    test("应该正确评估包含条件（字符串）", () => {
      const condition: WorkflowCondition = {
        conditionId: "test5",
        expression: '${shared:message} contains "error"',
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map([["message", "this is an error message"]]),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test("应该正确评估包含条件（数组）", () => {
      const condition: WorkflowCondition = {
        conditionId: "test6",
        expression: '${shared:tags} contains "important"',
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map([["tags", ["normal", "important", "test"]]]),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test("应该正确评估in条件", () => {
      const condition: WorkflowCondition = {
        conditionId: "test7",
        expression: "${shared:status} in [200, 201, 204]",
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map([["status", 200]]),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });
  });

  describe("步骤结果引用", () => {
    test("应该正确引用步骤结果数据", () => {
      const condition: WorkflowCondition = {
        conditionId: "test8",
        expression: '__STEP_RESULT_step1 === "success"',
      };

      const stepResult: StepExecution = {
        stepId: "step1",
        status: "completed" as any,
        data: "success",
        startTime: Date.now(),
        endTime: Date.now(),
        retryCount: 0,
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map([["step1", stepResult]]),
        sharedData: new Map(),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test("应该正确引用共享数据", () => {
      const condition: WorkflowCondition = {
        conditionId: "test9",
        expression: "${shared:score} === 85",
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map([["score", 85]]),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });

    test("应该正确引用输入数据", () => {
      const condition: WorkflowCondition = {
        conditionId: "test10",
        expression: '${input:priority} === "high"',
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map(),
        currentStepId: "step1",
        inputData: { priority: "high" },
      };

      expect(evaluator.evaluate(condition, context)).toBe(true);
    });
  });

  describe("错误处理", () => {
    test("应该处理无效表达式", () => {
      const condition: WorkflowCondition = {
        conditionId: "test11",
        expression: "invalid expression",
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map(),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(false);
    });

    test("应该处理不存在的字段", () => {
      const condition: WorkflowCondition = {
        conditionId: "test12",
        expression: 'nonexistent === "value"',
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map(),
        sharedData: new Map(),
        currentStepId: "step1",
        inputData: {},
      };

      expect(evaluator.evaluate(condition, context)).toBe(false);
    });
  });
});

describe("DynamicRouter", () => {
  let router: DynamicRouter;
  let sampleWorkflow: WorkflowDefinition;

  beforeEach(() => {
    router = new DynamicRouter();

    sampleWorkflow = {
      workflowId: "test-workflow",
      name: "测试工作流",
      steps: [
        {
          stepId: "step1",
          agentType: "ANALYZER" as any,
          name: "步骤1",
          required: true,
        },
        {
          stepId: "step2",
          agentType: "STRATEGIST" as any,
          name: "步骤2",
          required: false,
        },
        {
          stepId: "step3",
          agentType: "COORDINATOR" as any,
          name: "步骤3",
          required: false,
        },
      ],
      executionMode: "sequential",
    };
  });

  describe("顺序路由", () => {
    test("应该路由到下一个顺序步骤", () => {
      const decision = router.route(
        "step1",
        sampleWorkflow,
        new Map(),
        new Map(),
        {},
      );

      expect(decision.targetStepId).toBe("step2");
      expect(decision.routeId).toBe("sequential");
      expect(decision.reason).toBe("顺序执行下一个步骤");
    });

    test("应该在最后一步时返回空路由", () => {
      const decision = router.route(
        "step3",
        sampleWorkflow,
        new Map(),
        new Map(),
        {},
      );

      expect(decision.targetStepId).toBe("");
      expect(decision.routeId).toBe("end");
      expect(decision.reason).toBe("工作流结束");
    });
  });

  describe("条件路由", () => {
    test("应该根据条件选择路由", () => {
      sampleWorkflow.conditions = [
        {
          conditionId: "condition1",
          expression: '${input:priority} === "high"',
        },
      ];

      sampleWorkflow.routes = [
        {
          routeId: "route1",
          conditionId: "condition1",
          targetStepId: "step3",
        },
        {
          routeId: "route2",
          targetStepId: "step2",
          isDefault: true,
        },
      ];

      const decision = router.route(
        "step1",
        sampleWorkflow,
        new Map(),
        new Map(),
        { priority: "high" },
      );

      expect(decision.targetStepId).toBe("step3");
      expect(decision.routeId).toBe("route1");
      expect(decision.reason).toBe("条件condition1匹配成功");
    });

    test("应该使用默认路由当条件不匹配时", () => {
      sampleWorkflow.conditions = [
        {
          conditionId: "condition1",
          expression: '${input:priority} === "high"',
        },
      ];

      sampleWorkflow.routes = [
        {
          routeId: "route1",
          conditionId: "condition1",
          targetStepId: "step3",
        },
        {
          routeId: "route2",
          targetStepId: "step2",
          isDefault: true,
        },
      ];

      const decision = router.route(
        "step1",
        sampleWorkflow,
        new Map(),
        new Map(),
        { priority: "low" },
      );

      expect(decision.targetStepId).toBe("step2");
      expect(decision.routeId).toBe("route2");
      expect(decision.reason).toBe("使用默认路由");
    });
  });

  describe("可路由步骤获取", () => {
    test("应该返回依赖已完成的步骤", () => {
      const step1Result: StepExecution = {
        stepId: "step1",
        status: "completed" as any,
        startTime: Date.now(),
        endTime: Date.now(),
        retryCount: 0,
      };

      const context: ConditionEvaluationContext = {
        stepResults: new Map([["step1", step1Result]]),
        sharedData: new Map(),
        currentStepId: "step1",
        inputData: {},
      };

      const routable = router.getRoutableSteps(
        "step1",
        sampleWorkflow,
        context,
      );

      expect(routable).toContain("step2");
      expect(routable).toContain("step3");
    });

    test("应该跳过依赖未完成的步骤", () => {
      const step1Result: StepExecution = {
        stepId: "step1",
        status: "completed" as any,
        startTime: Date.now(),
        endTime: Date.now(),
        retryCount: 0,
      };

      sampleWorkflow.steps[1].dependsOn = ["step1"];
      sampleWorkflow.steps[2].dependsOn = ["step1", "step2"];

      const context: ConditionEvaluationContext = {
        stepResults: new Map([["step1", step1Result]]),
        sharedData: new Map(),
        currentStepId: "step1",
        inputData: {},
      };

      const routable = router.getRoutableSteps(
        "step1",
        sampleWorkflow,
        context,
      );

      expect(routable).toContain("step2");
      expect(routable).not.toContain("step3");
    });
  });

  describe("自定义条件评估器", () => {
    test("应该支持自定义条件评估器", () => {
      const customEvaluator = {
        evaluate: jest.fn().mockReturnValue(true),
      };

      router.setConditionEvaluator(customEvaluator as any);

      sampleWorkflow.conditions = [
        {
          conditionId: "condition1",
          expression: "custom",
        },
      ];

      sampleWorkflow.routes = [
        {
          routeId: "route1",
          conditionId: "condition1",
          targetStepId: "step2",
        },
      ];

      router.route("step1", sampleWorkflow, new Map(), new Map(), {});

      expect(customEvaluator.evaluate).toHaveBeenCalled();
    });
  });
});

describe("WorkflowRouteBuilder", () => {
  let builder: WorkflowRouteBuilder;

  beforeEach(() => {
    builder = new WorkflowRouteBuilder();
  });

  describe("条件路由构建", () => {
    test("应该添加条件路由", () => {
      builder.addConditionalRoute(
        '${input:priority} === "high"',
        "step3",
        "高优先级路由",
      );

      const { routes, conditions } = builder.build();

      expect(routes).toHaveLength(1);
      expect(conditions).toHaveLength(1);
      expect(routes[0].targetStepId).toBe("step3");
      expect(conditions[0].expression).toBe('${input:priority} === "high"');
      expect(conditions[0].description).toBe("高优先级路由");
    });

    test("应该添加多个条件路由", () => {
      builder.addConditionalRoute(
        '${input:type} === "A"',
        "step2",
        "类型A路由",
      );
      builder.addConditionalRoute(
        '${input:type} === "B"',
        "step3",
        "类型B路由",
      );

      const { routes, conditions } = builder.build();

      expect(routes).toHaveLength(2);
      expect(conditions).toHaveLength(2);
    });
  });

  describe("默认路由构建", () => {
    test("应该添加默认路由", () => {
      builder.addDefaultRoute("step4");

      const { routes } = builder.build();

      expect(routes).toHaveLength(1);
      expect(routes[0].targetStepId).toBe("step4");
      expect(routes[0].isDefault).toBe(true);
    });
  });

  describe("组合路由构建", () => {
    test("应该构建条件路由和默认路由的组合", () => {
      builder.addConditionalRoute('${input:priority} === "high"', "step2");
      builder.addConditionalRoute('${input:priority} === "medium"', "step3");
      builder.addDefaultRoute("step4");

      const { routes, conditions } = builder.build();

      expect(routes).toHaveLength(3);
      expect(conditions).toHaveLength(2);
      expect(routes.filter((r) => r.isDefault)).toHaveLength(1);
    });
  });

  describe("重置构建器", () => {
    test("应该重置构建器状态", () => {
      builder.addConditionalRoute('${input:priority} === "high"', "step2");
      builder.addDefaultRoute("step3");

      expect(builder.build().routes).toHaveLength(2);

      builder.reset();

      expect(builder.build().routes).toHaveLength(0);
      expect(builder.build().conditions).toHaveLength(0);
    });
  });
});
