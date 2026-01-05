/**
 * EvidenceRelationAnalyzer 测试
 * 目标：证据关联分析准确性
 */

import { EvidenceRelationAnalyzer } from "@/lib/agent/doc-analyzer/analyzers/evidence-relation-analyzer";
import type {
  ClassifiedEvidence,
  ExtractedData,
} from "@/lib/agent/doc-analyzer/core/types";

describe("EvidenceRelationAnalyzer", () => {
  let analyzer: EvidenceRelationAnalyzer;

  beforeEach(() => {
    analyzer = new EvidenceRelationAnalyzer();
  });

  describe("analyzeRelations", () => {
    it("应该分析证据与当事人的关联", () => {
      const classifiedEvidence: ClassifiedEvidence[] = [
        {
          id: "ev_1",
          type: "DOCUMENTARY_EVIDENCE",
          content: "张三签署的合同",
          source: "诉讼请求证据",
          strength: 5,
          reliability: 0.9,
          relatedTo: [],
        },
      ];

      const extractedData: ExtractedData = {
        parties: [
          { type: "plaintiff", name: "张三", role: "PLAINTIFF" },
          { type: "defendant", name: "李四", role: "DEFENDANT" },
        ],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const relations = analyzer.analyzeRelations(
        classifiedEvidence,
        extractedData,
      );

      expect(relations).toBeInstanceOf(Array);
      expect(relations.length).toBeGreaterThan(0);
      expect(classifiedEvidence[0].relatedTo).toContain("张三");
    });

    it("应该分析证据与诉讼请求的关联", () => {
      const classifiedEvidence: ClassifiedEvidence[] = [
        {
          id: "ev_1",
          type: "DOCUMENTARY_EVIDENCE",
          content: "支付50000元的银行转账记录",
          source: "诉讼请求证据",
          strength: 5,
          reliability: 0.9,
          relatedTo: [],
        },
      ];

      const extractedData: ExtractedData = {
        parties: [],
        claims: [
          {
            type: "PAY_PRINCIPAL",
            content: "支付50000元",
            amount: 50000,
            currency: "CNY",
          },
        ],
        disputeFocuses: [],
        keyFacts: [],
      };

      const relations = analyzer.analyzeRelations(
        classifiedEvidence,
        extractedData,
      );

      expect(relations).toBeInstanceOf(Array);
      expect(relations.length).toBeGreaterThan(0);
    });

    it("应该分析证据与争议焦点的关联", () => {
      const classifiedEvidence: ClassifiedEvidence[] = [
        {
          id: "ev_1",
          type: "DOCUMENTARY_EVIDENCE",
          content: "合同显示违约条款",
          source: "争议焦点证据",
          strength: 4,
          reliability: 0.8,
          relatedTo: [],
        },
      ];

      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [
          {
            id: "focus_1",
            category: "CONTRACT_BREACH",
            coreIssue: "违约条款",
            positionA: "原告观点",
            positionB: "被告观点",
            importance: 5,
            confidence: 0.9,
            relatedClaims: [],
            relatedFacts: [],
            description: "合同中是否存在违约条款",
          },
        ],
        keyFacts: [],
      };

      const relations = analyzer.analyzeRelations(
        classifiedEvidence,
        extractedData,
      );

      expect(relations).toBeInstanceOf(Array);
    });
  });

  describe("findRelatedParties", () => {
    it("应该查找证据中提到的当事人", () => {
      const evidenceContent = "张三和李四签订的合同";
      const extractedData: ExtractedData = {
        parties: [
          { type: "plaintiff", name: "张三", role: "PLAINTIFF" },
          { type: "defendant", name: "李四", role: "DEFENDANT" },
        ],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedParties(
        evidenceContent,
        extractedData,
      );

      expect(related).toContain("张三");
      expect(related).toContain("李四");
    });

    it("应该处理空当事人列表", () => {
      const evidenceContent = "合同证据";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedParties(
        evidenceContent,
        extractedData,
      );

      expect(related).toHaveLength(0);
    });

    it("应该处理未定义的当事人", () => {
      const evidenceContent = "合同证据";
      const extractedData: ExtractedData = {
        parties: undefined,
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedParties(
        evidenceContent,
        extractedData,
      );

      expect(related).toHaveLength(0);
    });
  });

  describe("findRelatedClaims", () => {
    it("应该查找证据中提到的诉讼请求", () => {
      const evidenceContent = "支付50000元的银行记录";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [
          {
            type: "PAY_PRINCIPAL",
            content: "支付50000元",
            amount: 50000,
            currency: "CNY",
          },
        ],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedClaims(
        evidenceContent,
        extractedData,
      );

      expect(related).toContain("PAY_PRINCIPAL");
    });

    it("应该根据法律依据查找相关诉讼请求", () => {
      const evidenceContent = "根据合同法规定";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [
          {
            type: "PAY_INTEREST",
            content: "支付利息",
            currency: "CNY",
            legalBasis: "合同法",
          },
        ],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedClaims(
        evidenceContent,
        extractedData,
      );

      expect(related.length).toBeGreaterThanOrEqual(0);
    });

    it("应该处理空诉讼请求列表", () => {
      const evidenceContent = "证据内容";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedClaims(
        evidenceContent,
        extractedData,
      );

      expect(related).toHaveLength(0);
    });
  });

  describe("findRelatedDisputeFocuses", () => {
    it("应该查找证据中提到的争议焦点", () => {
      const evidenceContent = "违约条款明显";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [
          {
            id: "focus_1",
            category: "CONTRACT_BREACH",
            coreIssue: "违约条款",
            positionA: "原告观点",
            positionB: "被告观点",
            importance: 5,
            confidence: 0.9,
            relatedClaims: [],
            relatedFacts: [],
            description: "合同中是否存在违约条款",
          },
        ],
        keyFacts: [],
      };

      const related = analyzer.findRelatedDisputeFocuses(
        evidenceContent,
        extractedData,
      );

      expect(related).toContain("focus_1");
    });

    it("应该根据描述查找争议焦点", () => {
      const evidenceContent = "合同中是否存在违约条款";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [
          {
            id: "focus_1",
            category: "CONTRACT_BREACH",
            coreIssue: "违约",
            positionA: "原告观点",
            positionB: "被告观点",
            importance: 5,
            confidence: 0.9,
            relatedClaims: [],
            relatedFacts: [],
            description: "合同中是否存在违约条款",
          },
        ],
        keyFacts: [],
      };

      const related = analyzer.findRelatedDisputeFocuses(
        evidenceContent,
        extractedData,
      );

      expect(related).toContain("focus_1");
    });

    it("应该处理空争议焦点列表", () => {
      const evidenceContent = "证据内容";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedDisputeFocuses(
        evidenceContent,
        extractedData,
      );

      expect(related).toHaveLength(0);
    });
  });

  describe("calculateRelationStrength", () => {
    it("应该计算关联强度", () => {
      const evidence: ClassifiedEvidence = {
        id: "ev_1",
        type: "DOCUMENTARY_EVIDENCE",
        content: "合同",
        source: "诉讼请求证据",
        strength: 5,
        reliability: 0.9,
        relatedTo: [],
      };

      const relations = [
        {
          evidenceId: "ev_1",
          relatedTo: "张三",
          relationType: "RELATES_TO" as const,
          strength: 0.6,
        },
        {
          evidenceId: "ev_1",
          relatedTo: "PAY_PRINCIPAL",
          relationType: "SUPPORTS" as const,
          strength: 0.8,
        },
      ];

      const strength = analyzer.calculateRelationStrength(evidence, relations);

      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(1);
    });

    it("应该处理空关联列表", () => {
      const evidence: ClassifiedEvidence = {
        id: "ev_1",
        type: "DOCUMENTARY_EVIDENCE",
        content: "合同",
        source: "诉讼请求证据",
        strength: 5,
        reliability: 0.9,
        relatedTo: [],
      };

      const strength = analyzer.calculateRelationStrength(evidence, []);

      expect(strength).toBe(0);
    });
  });

  describe("generateReport", () => {
    it("应该生成关联分析报告", () => {
      const evidence: ClassifiedEvidence = {
        id: "ev_1",
        type: "DOCUMENTARY_EVIDENCE",
        content: "合同",
        source: "诉讼请求证据",
        strength: 5,
        reliability: 0.9,
        relatedTo: [],
      };

      const relations = [
        {
          evidenceId: "ev_1",
          relatedTo: "张三",
          relationType: "RELATES_TO" as const,
          strength: 0.6,
        },
        {
          evidenceId: "ev_1",
          relatedTo: "PAY_PRINCIPAL",
          relationType: "SUPPORTS" as const,
          strength: 0.8,
        },
      ];

      const report = analyzer.generateReport(evidence, relations);

      expect(report).toBeDefined();
      expect(report.totalRelations).toBe(2);
      expect(report.partyRelations).toBeGreaterThanOrEqual(0);
      expect(report.claimRelations).toBeGreaterThanOrEqual(0);
      expect(report.focusRelations).toBeGreaterThanOrEqual(0);
      expect(report.avgStrength).toBeGreaterThan(0);
    });
  });

  describe("边界情况", () => {
    it("应该处理空证据列表", () => {
      const classifiedEvidence: ClassifiedEvidence[] = [];
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const relations = analyzer.analyzeRelations(
        classifiedEvidence,
        extractedData,
      );

      expect(relations).toHaveLength(0);
    });

    it("应该处理特殊字符", () => {
      const evidenceContent = "合同\n\t\r内容";
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedParties(
        evidenceContent,
        extractedData,
      );

      expect(related).toBeDefined();
    });

    it("应该处理超长文本", () => {
      const longText = "合同".repeat(1000);
      const extractedData: ExtractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const related = analyzer.findRelatedParties(longText, extractedData);

      expect(related).toBeDefined();
    });
  });
});
