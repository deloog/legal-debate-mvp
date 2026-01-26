/**
 * RiskScorer - 单元测试
 */

import { RiskScorer } from '../../../../lib/ai/risk/risk-scorer';
import type {
  RiskIdentificationResult,
  RiskAssessmentResult,
} from '../../../../types/risk';
import {
  RiskLevel,
  RiskCategory,
  RiskType,
  DEFAULT_RISK_SCORING_CONFIG,
  generateRiskId,
} from '../../../../types/risk';

// 辅助函数：创建测试风险数据
function createTestRisk(
  overrides?: Partial<RiskIdentificationResult>
): RiskIdentificationResult {
  return {
    id: generateRiskId(),
    riskType: RiskType.EVIDENCE_STRENGTH,
    riskCategory: RiskCategory.EVIDENTIARY,
    riskLevel: RiskLevel.LOW,
    score: 0.3,
    confidence: 0.8,
    description: '测试风险',
    evidence: [],
    suggestions: [],
    metadata: {},
    identifiedAt: new Date(),
    ...overrides,
  };
}

describe('RiskScorer', () => {
  let riskScorer: RiskScorer;

  beforeEach(() => {
    riskScorer = new RiskScorer();
  });

  describe('assess', () => {
    it('应该评估空风险列表', () => {
      const result = riskScorer.assess('case_001', []);

      expect(result.caseId).toBe('case_001');
      expect(result.overallRiskLevel).toBe(RiskLevel.LOW);
      expect(result.overallRiskScore).toBe(0);
      expect(result.risks).toEqual([]);
      expect(result.statistics.totalRisks).toBe(0);
    });

    it('应该评估单个高风险', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '证据不足',
        }),
      ];

      const result = riskScorer.assess('case_002', risks);

      expect(result.caseId).toBe('case_002');
      expect(result.overallRiskLevel).toBe(RiskLevel.HIGH);
      expect(result.overallRiskScore).toBeGreaterThan(0.6);
      expect(result.risks.length).toBe(1);
      expect(result.statistics.totalRisks).toBe(1);
      expect(result.statistics.highRisks).toBe(1);
    });

    it('应该评估多个不同类型的风险', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '证据不足',
        }),
        createTestRisk({
          riskType: RiskType.LEGAL_BASIS,
          riskCategory: RiskCategory.PROCEDURAL,
          riskLevel: RiskLevel.MEDIUM,
          score: 0.6,
          confidence: 0.8,
          description: '法律依据薄弱',
        }),
        createTestRisk({
          riskType: RiskType.FACT_VERIFICATION,
          riskLevel: RiskLevel.LOW,
          score: 0.3,
          confidence: 0.7,
          description: '事实待验证',
        }),
      ];

      const result = riskScorer.assess('case_003', risks);

      expect(result.caseId).toBe('case_003');
      expect(result.risks.length).toBe(3);
      expect(result.statistics.totalRisks).toBe(3);
      expect(result.statistics.highRisks).toBe(1);
      expect(result.statistics.mediumRisks).toBe(1);
      expect(result.statistics.lowRisks).toBe(1);
    });

    it('应该评估严重风险为CRITICAL等级', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.CRITICAL,
          score: 0.9,
          confidence: 0.95,
          description: '严重证据问题',
        }),
      ];

      const result = riskScorer.assess('case_004', risks);

      expect(result.overallRiskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.overallRiskScore).toBeGreaterThanOrEqual(
        DEFAULT_RISK_SCORING_CONFIG.thresholds.critical
      );
    });

    it('应该为每个风险添加元数据', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '证据不足',
          suggestions: [
            {
              id: 'test-suggestion-1',
              riskType: RiskType.EVIDENCE_STRENGTH,
              suggestionType: 'GATHER_EVIDENCE' as any,
              priority: 'HIGH' as any,
              action: '收集更多证据',
              reason: '增强证据链',
              estimatedImpact: '提升证据链强度',
              estimatedEffort: '1-2天',
            },
          ],
        }),
      ];

      const result = riskScorer.assess('case_005', risks);

      expect(result.risks.length).toBe(1);
      expect(result.risks[0].metadata).toBeDefined();
      expect(result.risks[0].metadata?.categoryWeight).toBeGreaterThan(0);
      expect(result.risks[0].metadata?.categoryScore).toBeGreaterThan(0);
      expect(result.risks[0].metadata?.impact).toBeDefined();
    });
  });

  describe('calculateCategoryScores', () => {
    it('应该正确计算类别评分', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '证据不足',
        }),
        createTestRisk({
          riskType: RiskType.LEGAL_BASIS,
          riskCategory: RiskCategory.PROCEDURAL,
          riskLevel: RiskLevel.MEDIUM,
          score: 0.6,
          confidence: 0.8,
          description: '法律依据薄弱',
        }),
      ];

      const result = riskScorer.assess('case_006', risks);

      expect(result.statistics.byCategory[RiskCategory.EVIDENTIARY]).toBe(1);
      expect(result.statistics.byCategory[RiskCategory.PROCEDURAL]).toBe(1);
    });
  });

  describe('calculateStatistics', () => {
    it('应该正确统计风险数量', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.CRITICAL,
          score: 0.9,
          confidence: 0.95,
          description: '严重证据问题',
        }),
        createTestRisk({
          riskType: RiskType.LEGAL_BASIS,
          riskCategory: RiskCategory.PROCEDURAL,
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '法律依据薄弱',
        }),
        createTestRisk({
          riskType: RiskType.FACT_VERIFICATION,
          riskLevel: RiskLevel.MEDIUM,
          score: 0.6,
          confidence: 0.8,
          description: '事实待验证',
        }),
        createTestRisk({
          riskType: RiskType.STATUTE_LIMITATION,
          riskCategory: RiskCategory.PROCEDURAL,
          riskLevel: RiskLevel.LOW,
          score: 0.3,
          confidence: 0.7,
          description: '时效问题',
        }),
      ];

      const result = riskScorer.assess('case_007', risks);

      expect(result.statistics.totalRisks).toBe(4);
      expect(result.statistics.criticalRisks).toBe(1);
      expect(result.statistics.highRisks).toBe(1);
      expect(result.statistics.mediumRisks).toBe(1);
      expect(result.statistics.lowRisks).toBe(1);
    });

    it('应该正确统计按类型的风险', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '证据不足',
        }),
        createTestRisk({
          riskType: RiskType.LEGAL_BASIS,
          riskCategory: RiskCategory.PROCEDURAL,
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '法律依据薄弱',
        }),
      ];

      const result = riskScorer.assess('case_008', risks);

      expect(result.statistics.byType[RiskType.EVIDENCE_STRENGTH]).toBe(1);
      expect(result.statistics.byType[RiskType.LEGAL_BASIS]).toBe(1);
    });
  });

  describe('getRiskLevelDescription', () => {
    it('应该返回正确的风险等级描述', () => {
      expect(riskScorer.getRiskLevelDescription(RiskLevel.LOW)).toContain(
        '较低'
      );
      expect(riskScorer.getRiskLevelDescription(RiskLevel.MEDIUM)).toContain(
        '中等'
      );
      expect(riskScorer.getRiskLevelDescription(RiskLevel.HIGH)).toContain(
        '较高'
      );
      expect(riskScorer.getRiskLevelDescription(RiskLevel.CRITICAL)).toContain(
        '严重'
      );
    });
  });

  describe('getRiskHandlingSuggestions', () => {
    it('应该返回低风险的处理建议', () => {
      const suggestions = riskScorer.getRiskHandlingSuggestions(RiskLevel.LOW);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].action).toContain('监控');
      expect(suggestions[0].reason).toBeDefined();
    });

    it('应该返回中风险的处理建议', () => {
      const suggestions = riskScorer.getRiskHandlingSuggestions(
        RiskLevel.MEDIUM
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.action.includes('应对计划'))).toBe(true);
    });

    it('应该返回高风险的处理建议', () => {
      const suggestions = riskScorer.getRiskHandlingSuggestions(RiskLevel.HIGH);

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.action.includes('评估'))).toBe(true);
    });

    it('应该返回严重风险的处理建议', () => {
      const suggestions = riskScorer.getRiskHandlingSuggestions(
        RiskLevel.CRITICAL
      );

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.action.includes('重新评估'))).toBe(true);
    });
  });

  describe('generateSummary', () => {
    it('应该生成完整的风险摘要', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '证据不足',
        }),
        createTestRisk({
          riskType: RiskType.LEGAL_BASIS,
          riskCategory: RiskCategory.PROCEDURAL,
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '法律依据薄弱',
        }),
      ];

      const assessment: RiskAssessmentResult = riskScorer.assess(
        'case_009',
        risks
      );

      const summary = riskScorer.generateSummary(assessment);

      expect(summary.title).toBeDefined();
      expect(summary.summary).toContain('case_009');
      expect(summary.summary).toContain('2个风险');
      expect(summary.keyPoints.length).toBeGreaterThan(0);
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });

    it('应该包含类别分析', () => {
      const risks: RiskIdentificationResult[] = [
        createTestRisk({
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '证据不足',
        }),
        createTestRisk({
          riskType: RiskType.LEGAL_BASIS,
          riskCategory: RiskCategory.PROCEDURAL,
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '法律依据薄弱',
        }),
      ];

      const assessment: RiskAssessmentResult = riskScorer.assess(
        'case_010',
        risks
      );

      const summary = riskScorer.generateSummary(assessment);

      expect(summary.keyPoints).toContainEqual(
        expect.stringContaining('EVIDENTIARY')
      );
      expect(summary.keyPoints).toContainEqual(
        expect.stringContaining('PROCEDURAL')
      );
    });
  });

  describe('updateConfig', () => {
    it('应该更新评分器配置', () => {
      const newThresholds = {
        low: 0.2,
        medium: 0.65,
        high: 0.85,
        critical: 0.95,
      };

      riskScorer.updateConfig({
        thresholds: newThresholds,
      });

      const config = riskScorer.getConfig();
      expect(config.thresholds.critical).toBe(0.95);
      expect(config.thresholds.high).toBe(0.85);
      expect(config.thresholds.medium).toBe(0.65);
      expect(config.thresholds.low).toBe(0.2);
    });

    it('应该更新权重配置', () => {
      const newWeights = {
        procedural: 0.4,
        evidentiary: 0.3,
        substantive: 0.2,
        strategic: 0.1,
      };

      riskScorer.updateConfig({
        weights: newWeights,
      });

      const config = riskScorer.getConfig();
      expect(config.weights.procedural).toBe(0.4);
      expect(config.weights.evidentiary).toBe(0.3);
      expect(config.weights.substantive).toBe(0.2);
      expect(config.weights.strategic).toBe(0.1);
    });
  });

  describe('getConfig', () => {
    it('应该返回配置的副本', () => {
      const config = riskScorer.getConfig();

      expect(config).toBeDefined();
      expect(config.thresholds).toBeDefined();
      expect(config.weights).toBeDefined();

      // 修改返回的配置不应影响内部配置
      config.thresholds.critical = 0.99;

      const newConfig = riskScorer.getConfig();
      expect(newConfig.thresholds.critical).not.toBe(0.99);
    });
  });

  describe('performance', () => {
    it('应该快速评估大量风险', () => {
      const risks: RiskIdentificationResult[] = Array.from(
        { length: 100 },
        (_, index) => {
          let riskLevel: RiskLevel;
          if (index % 4 === 0) riskLevel = RiskLevel.CRITICAL;
          else if (index % 3 === 0) riskLevel = RiskLevel.HIGH;
          else if (index % 2 === 0) riskLevel = RiskLevel.MEDIUM;
          else riskLevel = RiskLevel.LOW;

          return createTestRisk({
            riskLevel,
            score: Math.random(),
            confidence: 0.9,
            description: `风险${index}`,
          });
        }
      );

      const startTime = Date.now();
      const result = riskScorer.assess('case_011', risks);
      const duration = Date.now() - startTime;

      expect(result.risks.length).toBe(100);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});
