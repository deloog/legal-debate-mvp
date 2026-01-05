// ContentOptimizer单元测试

import { ContentOptimizer } from "@/lib/agent/generation-agent/content-optimizer";

describe("ContentOptimizer", () => {
  let optimizer: ContentOptimizer;

  beforeEach(() => {
    optimizer = new ContentOptimizer();
  });

  describe("构造函数", () => {
    it("应该使用默认配置创建实例", () => {
      const defaultOptimizer = new ContentOptimizer();
      expect(defaultOptimizer).toBeDefined();
    });

    it("应该使用自定义配置创建实例", () => {
      const customOptimizer = new ContentOptimizer({
        clarityLevel: "high",
        logicCheck: false,
        formatStandard: "general",
        maxLength: 1000,
      });
      expect(customOptimizer).toBeDefined();
    });
  });

  describe("optimize", () => {
    it("应该优化内容", () => {
      const content = "这是一个测试内容，用于优化器的测试。";
      const result = optimizer.optimize(content);

      expect(result).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
      expect(typeof result.originalScore).toBe("number");
      expect(typeof result.optimizedScore).toBe("number");
      expect(Array.isArray(result.improvements)).toBe(true);
    });

    it("应该提高质量分数", () => {
      const content = "重复的文本重复的文本";
      const result = optimizer.optimize(content);

      expect(result.optimizedScore).toBeGreaterThanOrEqual(
        result.originalScore,
      );
    });

    it("应该返回改进建议", () => {
      const content = "这是一个测试内容";
      const result = optimizer.optimize(content);

      expect(Array.isArray(result.improvements)).toBe(true);
    });

    it("应该处理空内容", () => {
      const content = "";
      const result = optimizer.optimize(content);

      expect(result).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
    });

    it("应该应用maxLength限制", () => {
      const content = "a".repeat(200);
      const limitedOptimizer = new ContentOptimizer({
        maxLength: 100,
      });
      const result = limitedOptimizer.optimize(content);

      expect(result.optimizedContent.length).toBeLessThanOrEqual(100);
    });
  });

  describe("assessQuality", () => {
    it("应该评估内容质量", () => {
      const content =
        "这是一个完整的法律文书，包含了清晰的事实描述、明确的诉讼请求和相关的法律依据。";
      const assessment = optimizer.assessQuality(content);

      expect(assessment).toBeDefined();
      expect(assessment.metrics).toBeDefined();
      expect(assessment.passed).toBeDefined();
      expect(Array.isArray(assessment.issues)).toBe(true);
      expect(Array.isArray(assessment.suggestions)).toBe(true);
    });

    it("应该计算所有质量指标", () => {
      const content = "测试内容";
      const assessment = optimizer.assessQuality(content);

      expect(assessment.metrics).toHaveProperty("clarity");
      expect(assessment.metrics).toHaveProperty("logic");
      expect(assessment.metrics).toHaveProperty("completeness");
      expect(assessment.metrics).toHaveProperty("format");
      expect(assessment.metrics).toHaveProperty("overall");
    });

    it("质量分数应该在有效范围内", () => {
      const content = "测试内容";
      const assessment = optimizer.assessQuality(content);

      expect(assessment.metrics.clarity).toBeGreaterThanOrEqual(0);
      expect(assessment.metrics.clarity).toBeLessThanOrEqual(1);
      expect(assessment.metrics.logic).toBeGreaterThanOrEqual(0);
      expect(assessment.metrics.logic).toBeLessThanOrEqual(1);
      expect(assessment.metrics.completeness).toBeGreaterThanOrEqual(0);
      expect(assessment.metrics.completeness).toBeLessThanOrEqual(1);
      expect(assessment.metrics.format).toBeGreaterThanOrEqual(0);
      expect(assessment.metrics.format).toBeLessThanOrEqual(1);
      expect(assessment.metrics.overall).toBeGreaterThanOrEqual(0);
      expect(assessment.metrics.overall).toBeLessThanOrEqual(1);
    });

    it("低质量内容应该返回问题", () => {
      const content = "短";
      const assessment = optimizer.assessQuality(content);

      expect(assessment.passed).toBe(false);
      expect(assessment.issues.length).toBeGreaterThan(0);
    });

    it("高质量内容应该通过评估", () => {
      const content =
        "民事起诉状\n\n诉讼请求：请求法院判令被告支付货款10000元及利息。\n\n事实与理由：原告与被告于2023年1月1日签订货物买卖合同，约定原告向被告供应货物，被告应于收到货物后30日内支付货款。原告已按约交付货物，但被告至今未支付货款。根据民法典相关规定，被告应当承担违约责任。\n\n具状人：张三\n2024年1月1日";
      const assessment = optimizer.assessQuality(content);

      expect(assessment.passed).toBe(true);
    });
  });

  describe("batchOptimize", () => {
    it("应该批量优化多个内容", () => {
      const contents = ["第一个内容", "第二个内容", "第三个内容"];
      const results = optimizer.batchOptimize(contents);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveProperty("optimizedContent");
      expect(results[1]).toHaveProperty("optimizedContent");
      expect(results[2]).toHaveProperty("optimizedContent");
    });

    it("应该处理空数组", () => {
      const results = optimizer.batchOptimize([]);

      expect(results).toHaveLength(0);
    });
  });

  describe("updateOptions", () => {
    it("应该能够更新配置", () => {
      optimizer.updateOptions({ clarityLevel: "high" });
      const options = optimizer.getOptions();

      expect(options.clarityLevel).toBe("high");
    });

    it("应该能够更新多个配置项", () => {
      optimizer.updateOptions({
        clarityLevel: "low",
        logicCheck: false,
        formatStandard: "general",
      });
      const options = optimizer.getOptions();

      expect(options.clarityLevel).toBe("low");
      expect(options.logicCheck).toBe(false);
      expect(options.formatStandard).toBe("general");
    });
  });

  describe("getOptions", () => {
    it("应该返回配置的副本", () => {
      const options1 = optimizer.getOptions();
      const options2 = optimizer.getOptions();

      expect(options1).toEqual(options2);
      expect(options1).not.toBe(options2);
    });
  });

  describe("resetOptions", () => {
    it("应该重置配置为默认值", () => {
      optimizer.updateOptions({
        clarityLevel: "high",
        maxLength: 500,
      });
      optimizer.resetOptions();

      const options = optimizer.getOptions();

      expect(options.clarityLevel).toBe("medium");
      expect(options.logicCheck).toBe(true);
      expect(options.formatStandard).toBe("legal");
      expect(options.maxLength).toBeUndefined();
    });
  });

  describe("质量指标计算", () => {
    it("清晰度应该基于内容结构", () => {
      const simpleContent = "清晰的句子结构。逻辑连接词使用正确。";
      const complexContent = "短。";

      const simpleAssessment = optimizer.assessQuality(simpleContent);
      const complexAssessment = optimizer.assessQuality(complexContent);

      expect(simpleAssessment.metrics.clarity).toBeGreaterThanOrEqual(
        complexAssessment.metrics.clarity,
      );
    });

    it("逻辑性应该基于逻辑连接词", () => {
      const logicalContent =
        "原告主张被告违约，因此请求法院判令被告承担违约责任。";
      const illogicalContent = "原告主张被告违约。被告应该承担责任。";

      const logicalAssessment = optimizer.assessQuality(logicalContent);
      const illogicalAssessment = optimizer.assessQuality(illogicalContent);

      expect(logicalAssessment.metrics.logic).toBeGreaterThanOrEqual(
        illogicalAssessment.metrics.logic,
      );
    });

    it("完整性应该基于内容要素", () => {
      const completeContent =
        "民事起诉状\n诉讼请求：请求法院判令被告支付货款。\n事实与理由：...\n具状人：张三\n2024年1月1日";
      const incompleteContent = "这是不完整的文书";

      const completeAssessment = optimizer.assessQuality(completeContent);
      const incompleteAssessment = optimizer.assessQuality(incompleteContent);

      expect(completeAssessment.metrics.completeness).toBeGreaterThan(
        incompleteAssessment.metrics.completeness,
      );
    });

    it("格式应该基于法律文书规范", () => {
      const formattedContent = "...\n具状人：张三\n2024年1月1日";
      const unformattedContent = "没有格式的文本";

      const formattedAssessment = optimizer.assessQuality(formattedContent);
      const unformattedAssessment = optimizer.assessQuality(unformattedContent);

      expect(formattedAssessment.metrics.format).toBeGreaterThanOrEqual(
        unformattedAssessment.metrics.format,
      );
    });
  });

  describe("边界情况", () => {
    it("应该处理非常短的内容", () => {
      const content = "短";
      const result = optimizer.optimize(content);

      expect(result).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
    });

    it("应该处理特殊字符", () => {
      const content = "特殊字符：@#$%^&*";
      const result = optimizer.optimize(content);

      expect(result).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
    });

    it("应该处理大量重复内容", () => {
      const content = "重复 ".repeat(100);
      const result = optimizer.optimize(content);

      expect(result).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
    });

    it("应该处理没有标点的内容", () => {
      const content = "这是没有标点符号的内容只有文字没有符号";
      const result = optimizer.optimize(content);

      expect(result).toBeDefined();
      expect(result.optimizedContent).toBeDefined();
    });
  });

  describe("改进检测", () => {
    it("应该检测内容增加", () => {
      const content = "短";
      const result = optimizer.optimize(content);

      if (result.optimizedContent.length > content.length) {
        expect(result.improvements).toContain("增加了内容完整性");
      }
    });

    it("应该检测重复减少", () => {
      const content = "重复 重复 重复";
      const result = optimizer.optimize(content);

      if (result.optimizedContent !== content) {
        expect(result.improvements.length).toBeGreaterThan(0);
      }
    });
  });
});
