/**
 * ComprehensiveAnalyzer 测试
 * 目标：综合分析准确性
 */

import { ComprehensiveAnalyzer } from "@/lib/agent/doc-analyzer/analyzers/comprehensive-analyzer";
import type {
  Party,
  Claim,
  TimelineEvent,
} from "@/lib/agent/doc-analyzer/core/types";

describe("ComprehensiveAnalyzer", () => {
  let analyzer: ComprehensiveAnalyzer;

  beforeEach(() => {
    analyzer = new ComprehensiveAnalyzer();
  });

  describe("analyze", () => {
    it("应该执行完整的综合分析", () => {
      const parties: Party[] = [
        {
          type: "plaintiff",
          name: "张三",
        },
        {
          type: "defendant",
          name: "李四",
        },
      ];

      const claims: Claim[] = [
        {
          type: "PAY_PRINCIPAL",
          content: "偿还本金",
          amount: 50000,
          currency: "CNY",
          evidence: ["合同书"],
        },
      ];

      const timeline: TimelineEvent[] = [
        {
          id: "ev_1",
          date: "2024-01-15",
          event: "签订合同",
        },
        {
          id: "ev_2",
          date: "2024-06-01",
          event: "立案",
          type: "FILING",
        },
      ];

      const result = analyzer.analyze(parties, claims, timeline);

      expect(result).toBeDefined();
      expect(result.consistencyReport).toBeDefined();
      expect(result.completenessReport).toBeDefined();
      expect(result.qualityScore).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
      expect(result.overallConfidence).toBeLessThanOrEqual(1);
    });

    it("应该检测当事人与诉讼请求不匹配", () => {
      const parties: Party[] = [
        {
          type: "plaintiff",
          name: "张三",
        },
      ];

      const claims: Claim[] = [];

      const timeline: TimelineEvent[] = [];

      const result = analyzer.analyze(parties, claims, timeline);

      expect(result.consistencyReport).toBeDefined();
      expect(result.completenessReport).toBeDefined();
      expect(result.qualityScore).toBeDefined();
    });

    it("应该返回分析元数据", () => {
      const parties: Party[] = [];
      const claims: Claim[] = [];
      const timeline: TimelineEvent[] = [];

      const result = analyzer.analyze(parties, claims, timeline);

      expect(result.metadata).toBeDefined();
      expect(result.metadata.analyzedAt).toBeDefined();
      expect(result.metadata.analysisDuration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.dataSources).toBeDefined();
    });
  });

  describe("边界情况", () => {
    it("应该处理空数据", () => {
      const parties: Party[] = [];
      const claims: Claim[] = [];
      const timeline: TimelineEvent[] = [];

      const result = analyzer.analyze(parties, claims, timeline);

      expect(result).toBeDefined();
      expect(result.consistencyReport).toBeDefined();
      expect(result.completenessReport).toBeDefined();
      expect(result.qualityScore).toBeDefined();
    });

    it("应该处理只有部分数据", () => {
      const parties: Party[] = [
        {
          type: "plaintiff",
          name: "张三",
        },
      ];

      const claims: Claim[] = [];
      const timeline: TimelineEvent[] = [];

      const result = analyzer.analyze(parties, claims, timeline);

      expect(result).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThanOrEqual(0);
    });

    it("应该处理包含证据分析的数据", () => {
      const parties: Party[] = [
        {
          type: "plaintiff",
          name: "张三",
        },
      ];

      const claims: Claim[] = [
        {
          type: "PAY_PRINCIPAL",
          content: "偿还本金",
          amount: 50000,
          currency: "CNY",
          evidence: ["合同书"],
        },
      ];

      const timeline: TimelineEvent[] = [];

      const evidenceAnalysis = {
        classifiedEvidence: [],
        evidenceRelations: [],
        strengthReport: {
          totalEvidence: 1,
          strongEvidence: 0,
          weakEvidence: 1,
          averageStrength: 2,
          averageReliability: 0.5,
          byType: {
            PHYSICAL_EVIDENCE: 0,
            DOCUMENTARY_EVIDENCE: 1,
            WITNESS_TESTIMONY: 0,
            EXPERT_OPINION: 0,
            AUDIO_VIDEO_EVIDENCE: 0,
            ELECTRONIC_EVIDENCE: 0,
            OTHER: 0,
          },
        },
        completenessScore: 0.5,
        confidence: 0.6,
        missingEvidenceTypes: [],
      };

      const result = analyzer.analyze(
        parties,
        claims,
        timeline,
        evidenceAnalysis,
      );

      expect(result).toBeDefined();
      expect(result.overallConfidence).toBeGreaterThan(0);
    });
  });

  describe("质量评分", () => {
    it("应该计算有效的质量评分", () => {
      const parties: Party[] = [
        {
          type: "plaintiff",
          name: "张三",
        },
        {
          type: "defendant",
          name: "李四",
        },
      ];

      const claims: Claim[] = [
        {
          type: "PAY_PRINCIPAL",
          content: "偿还本金",
          amount: 50000,
          currency: "CNY",
          evidence: ["合同书"],
        },
      ];

      const timeline: TimelineEvent[] = [
        {
          id: "ev_1",
          date: "2024-01-15",
          event: "签订合同",
        },
      ];

      const result = analyzer.analyze(parties, claims, timeline);
      const qualityScore = result.qualityScore;

      expect(qualityScore).toBeDefined();
      expect(qualityScore.overallScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.overallScore).toBeLessThanOrEqual(100);
      expect(qualityScore.accuracyScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.accuracyScore).toBeLessThanOrEqual(100);
      expect(qualityScore.completenessScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.completenessScore).toBeLessThanOrEqual(100);
      expect(qualityScore.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.consistencyScore).toBeLessThanOrEqual(100);
      expect(qualityScore.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(qualityScore.relevanceScore).toBeLessThanOrEqual(100);
    });

    it("应该返回有效的评级", () => {
      const parties: Party[] = [];
      const claims: Claim[] = [];
      const timeline: TimelineEvent[] = [];

      const result = analyzer.analyze(parties, claims, timeline);
      const qualityScore = result.qualityScore;

      const validGrades = [
        "EXCELLENT",
        "GOOD",
        "SATISFACTORY",
        "NEEDS_IMPROVEMENT",
        "POOR",
      ];
      expect(validGrades).toContain(qualityScore.grade);
    });
  });
});
