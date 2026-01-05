/**
 * ArgumentGenerator 单元测试
 *
 * 测试覆盖：
 * 1. 论点生成功能
 * 2. 主论点生成
 * 3. 支持论据生成
 * 4. 法律引用生成
 * 5. 反驳论点生成
 * 6. 论点强度计算
 * 7. 批量生成
 * 8. 过滤与排序
 */

import { describe, test, expect, beforeEach } from "@jest/globals";
import { ArgumentGenerator } from "@/lib/agent/legal-agent/argument-generator";
import type { LegalBasis } from "@/lib/agent/legal-agent/types";

describe("ArgumentGenerator", () => {
  let generator: ArgumentGenerator;
  let mockLegalBasis: LegalBasis;

  beforeEach(() => {
    generator = new ArgumentGenerator();
    mockLegalBasis = {
      articles: [
        {
          id: "1",
          lawName: "中华人民共和国合同法",
          articleNumber: "第107条",
          content:
            "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
          category: "民事",
          effectiveDate: "1999-10-01",
          relevanceScore: 0.95,
          deprecated: false,
          scope: ["民事纠纷", "合同纠纷"],
          level: "law",
          keywords: ["合同", "违约", "责任", "赔偿"],
        },
        {
          id: "2",
          lawName: "中华人民共和国民法典",
          articleNumber: "第577条",
          content:
            "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
          category: "民事",
          effectiveDate: "2021-01-01",
          relevanceScore: 0.98,
          deprecated: false,
          scope: ["民事纠纷", "合同纠纷"],
          level: "law",
          keywords: ["合同", "违约", "责任", "赔偿", "民法典"],
        },
      ],
      facts: [
        "被告未按时履行合同义务",
        "原告遭受了经济损失",
        "双方签订了有效的合同",
      ],
      parties: {
        plaintiff: { name: "张三", role: "原告" },
        defendant: { name: "李四", role: "被告" },
      },
    };
  });

  describe("基础功能", () => {
    test("应该成功创建ArgumentGenerator实例", () => {
      expect(generator).toBeInstanceOf(ArgumentGenerator);
    });

    test("应该有默认配置", () => {
      expect(generator["defaultOptions"]).toBeDefined();
      expect(generator["defaultOptions"].mainCount).toBe(3);
      expect(generator["defaultOptions"].supportingCount).toBe(5);
      expect(generator["defaultOptions"].legalReferenceCount).toBe(2);
    });
  });

  describe("论点生成", () => {
    test("应该能够生成论点", async () => {
      const result = await generator.generate(mockLegalBasis);
      expect(result).toBeDefined();
      expect(result.arguments).toBeDefined();
      expect(Array.isArray(result.arguments)).toBe(true);
    });

    test("生成的论点应该包含必要字段", async () => {
      const result = await generator.generate(mockLegalBasis);
      if (result.arguments.length > 0) {
        const arg = result.arguments[0];
        expect(arg.id).toBeDefined();
        expect(arg.type).toBeDefined();
        expect(arg.content).toBeDefined();
        expect(arg.legalBasis).toBeDefined();
        expect(arg.strength).toBeGreaterThanOrEqual(0);
        expect(arg.strength).toBeLessThanOrEqual(1);
        expect(arg.createdAt).toBeDefined();
      }
    });

    test("应该生成指定数量的论点", async () => {
      const options = {
        mainCount: 2,
        supportingCount: 3,
        legalReferenceCount: 1,
      };
      const result = await generator.generate(mockLegalBasis, options);
      expect(result.mainArgumentCount).toBeLessThanOrEqual(options.mainCount);
      expect(result.supportingArgumentCount).toBe(options.supportingCount);
      expect(result.legalReferenceCount).toBe(options.legalReferenceCount);
    });

    test("应该记录生成时间", async () => {
      const result = await generator.generate(mockLegalBasis);
      expect(result.generationTime).toBeGreaterThanOrEqual(0);
    });

    test("应该计算平均强度", async () => {
      const result = await generator.generate(mockLegalBasis);
      expect(result.averageStrength).toBeGreaterThanOrEqual(0);
      expect(result.averageStrength).toBeLessThanOrEqual(1);
    });
  });

  describe("主论点生成", () => {
    test("应该生成主论点", async () => {
      const result = await generator.generate(mockLegalBasis);
      expect(result.mainArgumentCount).toBeGreaterThan(0);
    });

    test("主论点类型应该为main", async () => {
      const result = await generator.generate(mockLegalBasis);
      const mainArgs = result.arguments.filter((arg) => arg.type === "main");
      expect(mainArgs.length).toBeGreaterThan(0);
    });

    test("主论点应该有法律依据", async () => {
      const result = await generator.generate(mockLegalBasis);
      const mainArgs = result.arguments.filter((arg) => arg.type === "main");
      mainArgs.forEach((arg) => {
        expect(arg.legalBasis.length).toBeGreaterThan(0);
      });
    });

    test("主论点应该有事实依据", async () => {
      const result = await generator.generate(mockLegalBasis);
      const mainArgs = result.arguments.filter((arg) => arg.type === "main");
      mainArgs.forEach((arg) => {
        expect(arg.factBasis).toBeDefined();
        expect(arg.factBasis?.length).toBeGreaterThan(0);
      });
    });
  });

  describe("支持论据生成", () => {
    test("应该生成支持论据", async () => {
      const result = await generator.generate(mockLegalBasis);
      expect(result.supportingArgumentCount).toBeGreaterThan(0);
    });

    test("支持论据类型应该为supporting", async () => {
      const result = await generator.generate(mockLegalBasis);
      const supportingArgs = result.arguments.filter(
        (arg) => arg.type === "supporting",
      );
      expect(supportingArgs.length).toBeGreaterThan(0);
    });

    test("支持论据应该有法律依据", async () => {
      const result = await generator.generate(mockLegalBasis);
      const supportingArgs = result.arguments.filter(
        (arg) => arg.type === "supporting",
      );
      supportingArgs.forEach((arg) => {
        expect(arg.legalBasis.length).toBeGreaterThan(0);
      });
    });

    test("支持论据应该有事实依据", async () => {
      const result = await generator.generate(mockLegalBasis);
      const supportingArgs = result.arguments.filter(
        (arg) => arg.type === "supporting",
      );
      supportingArgs.forEach((arg) => {
        expect(arg.factBasis).toBeDefined();
        expect(arg.factBasis?.length).toBeGreaterThan(0);
      });
    });
  });

  describe("法律引用生成", () => {
    test("应该生成法律引用", async () => {
      const result = await generator.generate(mockLegalBasis);
      expect(result.legalReferenceCount).toBeGreaterThan(0);
    });

    test("法律引用类型应该为legal_reference", async () => {
      const result = await generator.generate(mockLegalBasis);
      const legalRefs = result.arguments.filter(
        (arg) => arg.type === "legal_reference",
      );
      expect(legalRefs.length).toBeGreaterThan(0);
    });

    test("法律引用应该有法律依据", async () => {
      const result = await generator.generate(mockLegalBasis);
      const legalRefs = result.arguments.filter(
        (arg) => arg.type === "legal_reference",
      );
      legalRefs.forEach((arg) => {
        expect(arg.legalBasis.length).toBeGreaterThan(0);
      });
    });

    test("法律引用应该没有事实依据", async () => {
      const result = await generator.generate(mockLegalBasis);
      const legalRefs = result.arguments.filter(
        (arg) => arg.type === "legal_reference",
      );
      legalRefs.forEach((arg) => {
        expect(arg.factBasis).toEqual([]);
      });
    });

    test("法律引用强度应该为1.0", async () => {
      const result = await generator.generate(mockLegalBasis);
      const legalRefs = result.arguments.filter(
        (arg) => arg.type === "legal_reference",
      );
      legalRefs.forEach((arg) => {
        expect(arg.strength).toBe(1);
      });
    });
  });

  describe("反驳论点生成", () => {
    test("应该能够生成反驳论点", async () => {
      const counterArgs = await generator.generate(mockLegalBasis);
      const result = await generator.generateRebuttal(
        mockLegalBasis,
        counterArgs.arguments,
      );
      expect(result.arguments.length).toBeGreaterThan(0);
    });

    test("反驳论点类型应该为rebuttal", async () => {
      const counterArgs = await generator.generate(mockLegalBasis);
      const result = await generator.generateRebuttal(
        mockLegalBasis,
        counterArgs.arguments,
      );
      const rebuttals = result.arguments.filter(
        (arg) => arg.type === "rebuttal",
      );
      expect(rebuttals.length).toBeGreaterThan(0);
    });

    test("反驳论点方向应该与原论点相反", async () => {
      const counterArgs = await generator.generate(mockLegalBasis);
      const result = await generator.generateRebuttal(
        mockLegalBasis,
        counterArgs.arguments,
      );
      if (result.arguments.length > 0) {
        expect(result.arguments[0].side).toBe("DEFENDANT");
      }
    });

    test("反驳论点数量应该与对方论点相同", async () => {
      const counterArgs = await generator.generate(mockLegalBasis);
      const result = await generator.generateRebuttal(
        mockLegalBasis,
        counterArgs.arguments,
      );
      expect(result.arguments.length).toBe(counterArgs.arguments.length);
    });
  });

  describe("论点强度计算", () => {
    test("宪法级别的法条应该有更高强度", () => {
      const constitutionalArticle = {
        id: "1",
        lawName: "中华人民共和国宪法",
        articleNumber: "第33条",
        content: "中华人民共和国公民在法律面前一律平等。",
        category: "宪法",
        effectiveDate: "1982-12-04",
        relevanceScore: 0.95,
        deprecated: false,
        scope: ["基本权利", "平等"],
        level: "constitution" as const,
        keywords: ["宪法", "平等"],
      };
      const facts = ["原告受到不平等对待"];
      const strength = generator["calculateStrength"](
        constitutionalArticle,
        facts,
      );
      expect(strength).toBeGreaterThan(0.5);
    });

    test("普通法条的强度应该合理", () => {
      const lawArticle = {
        id: "1",
        lawName: "中华人民共和国合同法",
        articleNumber: "第107条",
        content:
          "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
        category: "民事",
        effectiveDate: "1999-10-01",
        relevanceScore: 0.95,
        deprecated: false,
        scope: ["民事纠纷", "合同纠纷"],
        level: "law" as const,
        keywords: ["合同", "违约", "责任", "赔偿"],
      };
      const facts = ["被告未履行合同"];
      const strength = generator["calculateStrength"](lawArticle, facts);
      expect(strength).toBeGreaterThan(0.5);
      expect(strength).toBeLessThanOrEqual(1);
    });

    test("更多事实应该增加论点强度", () => {
      const article = {
        id: "1",
        lawName: "中华人民共和国合同法",
        articleNumber: "第107条",
        content:
          "当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。",
        category: "民事",
        effectiveDate: "1999-10-01",
        relevanceScore: 0.95,
        deprecated: false,
        scope: ["民事纠纷", "合同纠纷"],
        level: "law" as const,
        keywords: ["合同", "违约", "责任", "赔偿"],
      };
      const strength1 = generator["calculateStrength"](article, ["事实1"]);
      const strength2 = generator["calculateStrength"](article, [
        "事实1",
        "事实2",
        "事实3",
      ]);
      expect(strength2).toBeGreaterThan(strength1);
    });
  });

  describe("论点方向", () => {
    test("默认应该生成原告论点", async () => {
      const result = await generator.generate(mockLegalBasis);
      result.arguments.forEach((arg) => {
        expect(arg.side).toBe("PLAINTIFF");
      });
    });

    test("应该能够生成被告论点", async () => {
      const result = await generator.generate(mockLegalBasis, {
        side: "DEFENDANT",
      });
      result.arguments.forEach((arg) => {
        expect(arg.side).toBe("DEFENDANT");
      });
    });
  });

  describe("批量生成", () => {
    test("应该能够批量生成论点", async () => {
      const legalBasisList = [mockLegalBasis, mockLegalBasis];
      const results = await generator.batchGenerate(legalBasisList);
      expect(results.length).toBe(2);
      results.forEach((result) => {
        expect(result.arguments).toBeDefined();
      });
    });

    test("批量生成应该处理空列表", async () => {
      const results = await generator.batchGenerate([]);
      expect(results).toEqual([]);
    });

    test("批量生成应该应用相同配置", async () => {
      const legalBasisList = [mockLegalBasis, mockLegalBasis];
      const options = {
        mainCount: 1,
        supportingCount: 2,
      };
      const results = await generator.batchGenerate(legalBasisList, options);
      results.forEach((result) => {
        expect(result.mainArgumentCount).toBeLessThanOrEqual(options.mainCount);
        expect(result.supportingArgumentCount).toBe(options.supportingCount);
      });
    });
  });

  describe("过滤论点", () => {
    test("应该能够按类型过滤", async () => {
      const result = await generator.generate(mockLegalBasis);
      const filtered = generator.filterArguments(result.arguments, {
        type: "main",
      });
      expect(filtered.every((arg) => arg.type === "main")).toBe(true);
    });

    test("应该能够按方向过滤", async () => {
      const result = await generator.generate(mockLegalBasis);
      const filtered = generator.filterArguments(result.arguments, {
        side: "PLAINTIFF",
      });
      expect(filtered.every((arg) => arg.side === "PLAINTIFF")).toBe(true);
    });

    test("应该能够按最小强度过滤", async () => {
      const result = await generator.generate(mockLegalBasis);
      const filtered = generator.filterArguments(result.arguments, {
        minStrength: 0.7,
      });
      expect(filtered.every((arg) => arg.strength >= 0.7)).toBe(true);
    });

    test("应该能够组合过滤条件", async () => {
      const result = await generator.generate(mockLegalBasis);
      const filtered = generator.filterArguments(result.arguments, {
        type: "main",
        minStrength: 0.5,
      });
      expect(filtered.every((arg) => arg.type === "main")).toBe(true);
      expect(filtered.every((arg) => arg.strength >= 0.5)).toBe(true);
    });

    test("空过滤条件应该返回所有论点", async () => {
      const result = await generator.generate(mockLegalBasis);
      const filtered = generator.filterArguments(result.arguments, {});
      expect(filtered.length).toBe(result.arguments.length);
    });
  });

  describe("排序论点", () => {
    test("应该能够按强度排序", async () => {
      const result = await generator.generate(mockLegalBasis);
      const sorted = generator.sortArguments(result.arguments, "strength");
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].strength).toBeGreaterThanOrEqual(
          sorted[i + 1].strength,
        );
      }
    });

    test("应该能够按创建时间排序", async () => {
      const result = await generator.generate(mockLegalBasis);
      const sorted = generator.sortArguments(result.arguments, "createdAt");
      for (let i = 0; i < sorted.length - 1; i++) {
        expect(sorted[i].createdAt).toBeGreaterThanOrEqual(
          sorted[i + 1].createdAt,
        );
      }
    });

    test("排序应该返回新数组", async () => {
      const result = await generator.generate(mockLegalBasis);
      const sorted = generator.sortArguments(result.arguments);
      expect(sorted).not.toBe(result.arguments);
      expect(sorted.length).toBe(result.arguments.length);
    });
  });

  describe("边界条件", () => {
    test("处理空法条列表应该正常工作", async () => {
      const emptyBasis: LegalBasis = {
        articles: [],
        facts: ["事实1", "事实2"],
      };
      const result = await generator.generate(emptyBasis);
      expect(result.arguments).toBeDefined();
      expect(result.mainArgumentCount).toBe(0);
    });

    test("处理空事实列表应该正常工作", async () => {
      const emptyFactsBasis: LegalBasis = {
        articles: mockLegalBasis.articles,
        facts: [],
      };
      const result = await generator.generate(emptyFactsBasis);
      expect(result.arguments).toBeDefined();
    });

    test("处理大量法条应该正常工作", async () => {
      const largeBasis: LegalBasis = {
        articles: Array(50)
          .fill(null)
          .map((_, i) => ({
            id: i.toString(),
            lawName: `测试法${i}`,
            articleNumber: `第${i}条`,
            content: `测试内容${i}`,
            category: "民事",
            effectiveDate: "2020-01-01",
            relevanceScore: 0.8,
            deprecated: false,
            scope: ["测试"],
            level: "law" as const,
            keywords: ["测试"],
          })),
        facts: ["事实1", "事实2"],
      };
      const result = await generator.generate(largeBasis);
      expect(result.arguments).toBeDefined();
    });

    test("处理大量事实应该正常工作", async () => {
      const largeFactsBasis: LegalBasis = {
        articles: mockLegalBasis.articles,
        facts: Array(100)
          .fill(null)
          .map((_, i) => `事实${i}`),
      };
      const result = await generator.generate(largeFactsBasis);
      expect(result.arguments).toBeDefined();
    });

    test("数量为0应该正常工作", async () => {
      const result = await generator.generate(mockLegalBasis, {
        mainCount: 0,
        supportingCount: 0,
        legalReferenceCount: 0,
      });
      expect(result.arguments).toBeDefined();
      expect(result.mainArgumentCount).toBe(0);
      expect(result.supportingArgumentCount).toBe(0);
      expect(result.legalReferenceCount).toBe(0);
    });
  });

  describe("性能测试", () => {
    test("生成论点应该在合理时间内完成", async () => {
      const startTime = Date.now();
      const result = await generator.generate(mockLegalBasis);
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(100);
      expect(result.generationTime).toBeLessThan(100);
    });

    test("批量生成应该在合理时间内完成", async () => {
      const legalBasisList = Array(10)
        .fill(null)
        .map(() => mockLegalBasis);
      const startTime = Date.now();
      await generator.batchGenerate(legalBasisList);
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(1000);
    });
  });

  describe("ID生成", () => {
    test("每个论点应该有唯一ID", async () => {
      const result = await generator.generate(mockLegalBasis);
      const ids = result.arguments.map((arg) => arg.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test("ID应该是固定长度", async () => {
      const result = await generator.generate(mockLegalBasis);
      result.arguments.forEach((arg) => {
        expect(arg.id.length).toBe(16);
      });
    });
  });

  describe("内容截断", () => {
    test("应该能够截断过长内容", () => {
      const content = "这是一段很长的内容，应该被截断";
      const truncated = generator["truncateContent"](content, 10);
      expect(truncated.length).toBeLessThanOrEqual(13); // 10 + "..."
      expect(truncated.endsWith("...")).toBe(true);
    });

    test("短内容不应该被截断", () => {
      const content = "短内容";
      const truncated = generator["truncateContent"](content, 10);
      expect(truncated).toBe(content);
    });

    test("空内容应该正常处理", () => {
      const truncated = generator["truncateContent"]("", 10);
      expect(truncated).toBe("");
    });
  });
});
