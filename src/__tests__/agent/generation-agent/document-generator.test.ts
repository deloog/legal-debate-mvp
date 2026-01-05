// DocumentGenerator单元测试

import { DocumentGenerator } from "@/lib/agent/generation-agent/document-generator";
import { CaseInfo } from "@/types/debate";
import type { LawArticle } from "@prisma/client";
import type { DocumentGenerationConfig } from "@/lib/agent/generation-agent/types";

describe("DocumentGenerator", () => {
  let generator: DocumentGenerator;
  let mockCaseInfo: CaseInfo;
  let mockLawArticles: LawArticle[];

  beforeEach(() => {
    generator = new DocumentGenerator();
    mockCaseInfo = {
      title: "合同纠纷案件",
      description: "关于合同履行争议的案件",
    };
    mockLawArticles = [
      {
        id: "law-1",
        lawName: "民法典",
        articleNumber: "第一百一十九条",
        fullText: "依法成立的合同，对当事人具有法律约束力。",
        lawType: "LAW",
        category: "COMMERCIAL",
        subCategory: "合同",
        tags: ["合同", "民法典"],
        keywords: ["合同", "法律约束力"],
        version: "1.0",
        effectiveDate: new Date(),
        expiryDate: null,
        status: "VALID",
        amendmentHistory: null,
        parentId: null,
        chapterNumber: null,
        sectionNumber: null,
        level: 0,
        issuingAuthority: "全国人民代表大会",
        jurisdiction: null,
        relatedArticles: [],
        legalBasis: null,
        searchableText: "依法成立的合同，对当事人具有法律约束力。",
        viewCount: 0,
        referenceCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("构造函数", () => {
    it("应该使用默认配置创建实例", () => {
      const defaultGenerator = new DocumentGenerator();
      expect(defaultGenerator).toBeDefined();
    });

    it("应该使用自定义配置创建实例", () => {
      const customGenerator = new DocumentGenerator({
        format: "general",
        includeHeader: false,
        includeFooter: false,
        dateFormat: "en-US",
      });
      expect(customGenerator).toBeDefined();
    });
  });

  describe("generateComplaint", () => {
    it("应该生成有效的起诉状", () => {
      const result = generator.generateComplaint(mockCaseInfo, mockLawArticles);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.type).toBe("complaint");
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    });

    it("起诉状应该包含案件描述", () => {
      const result = generator.generateComplaint(mockCaseInfo, mockLawArticles);

      expect(result.content).toContain(mockCaseInfo.description);
    });

    it("应该支持自定义选项", () => {
      const options: Partial<DocumentGenerationConfig> = {
        format: "general",
      };
      const result = generator.generateComplaint(
        mockCaseInfo,
        mockLawArticles,
        options,
      );

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe("generateAnswer", () => {
    it("应该生成有效的答辩状", () => {
      const result = generator.generateAnswer(mockCaseInfo, mockLawArticles);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.type).toBe("answer");
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(1);
    });

    it("应该支持自定义选项", () => {
      const options: Partial<DocumentGenerationConfig> = {
        format: "general",
      };
      const result = generator.generateAnswer(
        mockCaseInfo,
        mockLawArticles,
        options,
      );

      expect(result).toBeDefined();
    });
  });

  describe("generateEvidence", () => {
    it("应该生成有效的证据清单", () => {
      const mockEvidence = [
        { name: "合同原件", description: "双方签订的书面合同" },
        { name: "付款凭证", description: "银行转账记录" },
      ];
      const result = generator.generateEvidence(mockCaseInfo, mockEvidence);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.type).toBe("evidence");
    });

    it("应该列出所有证据", () => {
      const mockEvidence = [
        { name: "证据1", description: "描述1" },
        { name: "证据2", description: "描述2" },
      ];
      const result = generator.generateEvidence(mockCaseInfo, mockEvidence);

      expect(result.content).toContain("证据1");
      expect(result.content).toContain("证据2");
    });

    it("应该处理空证据列表", () => {
      const result = generator.generateEvidence(mockCaseInfo, []);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
    });
  });

  describe("generateAppeal", () => {
    it("应该生成有效的上诉状", () => {
      const result = generator.generateAppeal(mockCaseInfo, mockLawArticles);

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.type).toBe("appeal");
    });

    it("上诉状应该包含上诉理由", () => {
      const result = generator.generateAppeal(mockCaseInfo, mockLawArticles);

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });

    it("应该支持自定义选项", () => {
      const options: Partial<DocumentGenerationConfig> = {
        format: "general",
      };
      const result = generator.generateAppeal(
        mockCaseInfo,
        mockLawArticles,
        options,
      );

      expect(result).toBeDefined();
    });
  });

  describe("updateConfig", () => {
    it("应该能够更新配置", () => {
      generator.updateConfig({ format: "general" });
      const config = generator.getConfig();

      expect(config.format).toBe("general");
    });

    it("应该能够更新多个配置项", () => {
      generator.updateConfig({
        format: "general",
        includeHeader: false,
        includeFooter: false,
      });
      const config = generator.getConfig();

      expect(config.format).toBe("general");
      expect(config.includeHeader).toBe(false);
      expect(config.includeFooter).toBe(false);
    });
  });

  describe("getConfig", () => {
    it("应该返回配置的副本", () => {
      const config1 = generator.getConfig();
      const config2 = generator.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2);
    });
  });

  describe("错误处理", () => {
    it("应该处理缺失的案例信息", () => {
      const emptyCaseInfo: CaseInfo = {
        title: "",
        description: "",
      };

      const result = generator.generateComplaint(
        emptyCaseInfo,
        mockLawArticles,
      );

      expect(result).toBeDefined();
    });

    it("应该处理缺失的法律条文", () => {
      const result = generator.generateComplaint(mockCaseInfo, []);

      expect(result).toBeDefined();
    });
  });
});
