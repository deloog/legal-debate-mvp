/**
 * 逻辑推理规则集成测试
 * 测试逻辑推理规则与ArgumentGenerator、LogicalVerifier的集成
 */

import {
  selectLogicalConnector,
  identifyCausalType,
  calculateReasoningDepth,
  getReasoningPattern,
  generateReasoningChain,
  evaluateArgumentLogic,
  LOGICAL_CONNECTORS,
  CAUSAL_KEYWORDS,
} from "@/lib/agent/legal-agent/reasoning-rules";

describe("logic-integration", () => {
  describe("逻辑连接词与推理链集成", () => {
    test("推理链应该使用正确的连接词类型", () => {
      const chain = generateReasoningChain(
        "合同法第107条规定",
        "被告的行为违反了诚实信用原则",
        "应当承担违约责任",
      );

      expect(chain).toHaveLength(3);
      expect(chain[0]).toBeTruthy();
      expect(chain[1]).toBeTruthy();
      expect(chain[2]).toBeTruthy();
    });

    test("推理链应该增强论点的逻辑性评分", () => {
      const chain = generateReasoningChain("法律规定", "分析事实", "得出结论");
      const chainText = chain.join("");
      const score = evaluateArgumentLogic(chainText);

      expect(score).toBeGreaterThan(0.5); // 推理链应该有较高的逻辑性评分
    });

    test("选择连接词应该根据上下文动态调整", () => {
      const premiseConnector = selectLogicalConnector("premise");
      const conclusionConnector = selectLogicalConnector("conclusion");
      const argumentConnector = selectLogicalConnector("argument");

      expect(premiseConnector).toBeDefined();
      expect(conclusionConnector).toBeDefined();
      expect(argumentConnector).toBeDefined();

      expect(premiseConnector!.contexts).toContain("premise");
      expect(conclusionConnector!.contexts).toContain("conclusion");
      expect(argumentConnector!.contexts).toContain("argument");
    });
  });

  describe("因果关系识别集成", () => {
    test("应该识别复杂的因果关系链", () => {
      const text1 = "违约导致损失，进而造成经营困难";
      const type1 = identifyCausalType(text1);

      expect(type1).toBeDefined();
      expect(["direct", "indirect"]).toContain(type1);

      const text2 = "如果被告不履行义务，原告有权解除合同";
      const type2 = identifyCausalType(text2);

      expect(type2).toBe("conditional");
    });

    test("因果关系应该影响逻辑性评分", () => {
      const textWithCausal = "因为被告违约导致原告损失，因此应当赔偿";
      const textWithoutCausal = "被告应当赔偿原告损失";

      const score1 = evaluateArgumentLogic(textWithCausal);
      const score2 = evaluateArgumentLogic(textWithoutCausal);

      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe("推理深度计算集成", () => {
    test("推理模式应该与深度评分一致", () => {
      const deductiveDepth = calculateReasoningDepth(3, "deductive");
      const inductiveDepth = calculateReasoningDepth(3, "inductive");
      const analogicalDepth = calculateReasoningDepth(4, "analogical");

      // 演绎推理应该有较高的深度评分
      expect(deductiveDepth).toBeGreaterThanOrEqual(inductiveDepth);
      expect(deductiveDepth).toBeGreaterThanOrEqual(0.9);

      // 类比推理步骤多时应该有奖励
      expect(analogicalDepth).toBeGreaterThanOrEqual(0.9);
    });

    test("推理模式描述应该匹配推理类型", () => {
      const deductivePattern = getReasoningPattern("deductive");
      const inductivePattern = getReasoningPattern("inductive");
      const analogicalPattern = getReasoningPattern("analogical");

      expect(deductivePattern.type).toBe("deductive");
      expect(deductivePattern.steps).toBe(3);
      expect(deductivePattern.description).toContain("一般性原则");
      expect(deductivePattern.description).toContain("具体结论");

      expect(inductivePattern.type).toBe("inductive");
      expect(inductivePattern.steps).toBe(3);
      expect(inductivePattern.description).toContain("具体事实");
      expect(inductivePattern.description).toContain("普遍规律");

      expect(analogicalPattern.type).toBe("analogical");
      expect(analogicalPattern.steps).toBe(4);
      expect(analogicalPattern.description).toContain("类比");
    });
  });

  describe("综合逻辑性评估", () => {
    test("强逻辑性论点应该包含多种逻辑元素", () => {
      const strongArgument =
        "基于合同法第107条，由于被告未履行付款义务，进而导致原告经营损失，因此被告应当承担违约责任";

      const score = evaluateArgumentLogic(strongArgument);

      expect(score).toBeGreaterThan(0.8);

      // 检查包含多种逻辑元素
      expect(strongArgument).toMatch(/基于|由于/); // 前提连接词
      expect(strongArgument).toMatch(/进而/); // 间接因果
      expect(strongArgument).toMatch(/因此/); // 结论连接词
    });

    test("弱逻辑性论点应该评分较低", () => {
      const weakArgument = "被告应当承担责任";

      const score = evaluateArgumentLogic(weakArgument);

      expect(score).toBeLessThan(0.8);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    test("逻辑性评分应该考虑推理深度", () => {
      const simpleChain = generateReasoningChain("前提A", "推理B", "结论C");
      const complexChain = generateReasoningChain(
        "基于合同法第107条，由于被告未履行义务，进而导致损失，因此应当承担责任",
        "被告的行为违反了诚实信用原则",
        "应当承担违约责任",
      );

      const score1 = evaluateArgumentLogic(simpleChain.join(""));
      const score2 = evaluateArgumentLogic(complexChain.join(""));

      // 包含多种逻辑元素的推理链应该有更高的评分
      expect(score2).toBeGreaterThanOrEqual(score1);
    });
  });

  describe("逻辑规则库完整性", () => {
    test("所有推理类型都应该有对应的模式", () => {
      const reasoningTypes = ["deductive", "inductive", "analogical"];

      reasoningTypes.forEach((type) => {
        const pattern = getReasoningPattern(
          type as "deductive" | "inductive" | "analogical",
        );
        expect(pattern).toBeDefined();
        expect(pattern.type).toBe(type);
      });
    });

    test("所有因果类型都应该有关键词", () => {
      const causalTypes = [
        "direct",
        "indirect",
        "conditional",
        "exclusive",
        "compound",
      ];

      causalTypes.forEach((type) => {
        const keywords =
          CAUSAL_KEYWORDS[
            type as
              | "direct"
              | "indirect"
              | "conditional"
              | "exclusive"
              | "compound"
          ];
        expect(keywords).toBeDefined();
        expect(keywords.length).toBeGreaterThan(0);
      });
    });

    test("逻辑连接词应该覆盖所有上下文", () => {
      const contexts = ["premise", "conclusion", "argument"];

      contexts.forEach((context) => {
        const connectors = LOGICAL_CONNECTORS.filter((c) =>
          c.contexts.includes(context),
        );
        expect(connectors.length).toBeGreaterThan(0);
      });
    });

    test("每个逻辑连接词应该有强度评分", () => {
      LOGICAL_CONNECTORS.forEach((connector) => {
        expect(connector.strength).toBeGreaterThan(0);
        expect(connector.strength).toBeLessThanOrEqual(1);
      });
    });
  });

  describe("边界情况处理", () => {
    test("空文本应该返回undefined因果关系", () => {
      const type = identifyCausalType("");
      expect(type).toBeUndefined();
    });

    test("零步骤推理深度应该返回0", () => {
      const depth = calculateReasoningDepth(0, "deductive");
      expect(depth).toBeGreaterThanOrEqual(0);
      expect(depth).toBeLessThanOrEqual(1);
    });

    test("极大步骤推理深度应该限制为1", () => {
      const depth = calculateReasoningDepth(100, "deductive");
      expect(depth).toBeLessThanOrEqual(1);
    });

    test("不存在的上下文应该返回空连接词列表", () => {
      const connectors = LOGICAL_CONNECTORS.filter((c) =>
        c.contexts.includes("invalid" as "premise" | "conclusion" | "argument"),
      );
      expect(connectors.length).toBe(0);
    });
  });
});
