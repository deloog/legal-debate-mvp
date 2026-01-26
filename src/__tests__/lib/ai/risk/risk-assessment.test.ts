import { AIRiskAdvisor } from '@/lib/ai/risk/risk-advisor';
import { RiskScorer } from '@/lib/ai/risk/risk-scorer';
import { AIRiskIdentifier } from '@/lib/ai/risk/risk-identifier';
import type {
  RiskAssessmentResult,
  RiskIdentificationInput,
} from '@/types/risk';
import {
  RiskLevel,
  RiskType,
  RiskCategory,
  MitigationSuggestionType,
  SuggestionPriority,
} from '@/types/risk';

describe('AIRiskAdvisor', () => {
  let mockAIService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAIService = {
      chatCompletion: jest.fn(),
    };
  });

  describe('advise', () => {
    it('应该基于高风险生成规避建议', async () => {
      const assessment: RiskAssessmentResult = {
        caseId: 'case-001',
        overallRiskLevel: RiskLevel.HIGH,
        overallRiskScore: 0.8,
        risks: [
          {
            id: 'risk-001',
            riskType: RiskType.EVIDENCE_STRENGTH,
            riskCategory: RiskCategory.EVIDENTIARY,
            riskLevel: RiskLevel.HIGH,
            score: 0.8,
            confidence: 0.9,
            description: '证据强度不足',
            evidence: ['证据材料数量少', '证据链不完整'],
            suggestions: [],
            identifiedAt: new Date(),
          },
        ],
        statistics: {
          totalRisks: 1,
          byLevel: {
            [RiskLevel.LOW]: 0,
            [RiskLevel.MEDIUM]: 0,
            [RiskLevel.HIGH]: 1,
            [RiskLevel.CRITICAL]: 0,
          },
          byCategory: {
            [RiskCategory.PROCEDURAL]: 0,
            [RiskCategory.EVIDENTIARY]: 1,
            [RiskCategory.SUBSTANTIVE]: 0,
            [RiskCategory.STRATEGIC]: 0,
          },
          byType: {
            [RiskType.LEGAL_PROCEDURE]: 0,
            [RiskType.EVIDENCE_STRENGTH]: 1,
            [RiskType.STATUTE_LIMITATION]: 0,
            [RiskType.JURISDICTION]: 0,
            [RiskType.COST_BENEFIT]: 0,
            [RiskType.FACT_VERIFICATION]: 0,
            [RiskType.LEGAL_BASIS]: 0,
            [RiskType.CONTRADICTION]: 0,
            [RiskType.PROOF_BURDEN]: 0,
          },
          criticalRisks: 0,
          highRisks: 1,
          mediumRisks: 0,
          lowRisks: 0,
        },
        suggestions: [],
        assessmentTime: 100,
        assessedAt: new Date(),
      };

      mockAIService.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestions: [
                  {
                    suggestionType: 'GATHER_EVIDENCE',
                    priority: 'URGENT',
                    action: '收集更多证据材料',
                    reason: '当前证据强度不足，需要补充',
                    estimatedImpact: '显著提升胜诉概率',
                    estimatedEffort: '1-2周',
                    relatedRisks: ['evidence_strength'],
                  },
                ],
              }),
            },
          },
        ],
      });

      const advisor = new AIRiskAdvisor({
        aiService: mockAIService,
        enableFallback: false,
        confidenceThreshold: 0.6,
      });

      const suggestions = await advisor.advise(assessment);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('应该在无风险时返回空建议', async () => {
      const assessment: RiskAssessmentResult = {
        caseId: 'case-001',
        overallRiskLevel: RiskLevel.LOW,
        overallRiskScore: 0.2,
        risks: [],
        statistics: {
          totalRisks: 0,
          byLevel: {
            [RiskLevel.LOW]: 0,
            [RiskLevel.MEDIUM]: 0,
            [RiskLevel.HIGH]: 0,
            [RiskLevel.CRITICAL]: 0,
          },
          byCategory: {
            [RiskCategory.PROCEDURAL]: 0,
            [RiskCategory.EVIDENTIARY]: 0,
            [RiskCategory.SUBSTANTIVE]: 0,
            [RiskCategory.STRATEGIC]: 0,
          },
          byType: {
            [RiskType.LEGAL_PROCEDURE]: 0,
            [RiskType.EVIDENCE_STRENGTH]: 0,
            [RiskType.STATUTE_LIMITATION]: 0,
            [RiskType.JURISDICTION]: 0,
            [RiskType.COST_BENEFIT]: 0,
            [RiskType.FACT_VERIFICATION]: 0,
            [RiskType.LEGAL_BASIS]: 0,
            [RiskType.CONTRADICTION]: 0,
            [RiskType.PROOF_BURDEN]: 0,
          },
          criticalRisks: 0,
          highRisks: 0,
          mediumRisks: 0,
          lowRisks: 0,
        },
        suggestions: [],
        assessmentTime: 50,
        assessedAt: new Date(),
      };

      const advisor = new AIRiskAdvisor({
        aiService: mockAIService,
        enableFallback: false,
        confidenceThreshold: 0.6,
      });

      const suggestions = await advisor.advise(assessment);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(0);
    });

    it('应该在AI失败时返回原始建议', async () => {
      const assessment: RiskAssessmentResult = {
        caseId: 'case-001',
        overallRiskLevel: RiskLevel.MEDIUM,
        overallRiskScore: 0.5,
        risks: [
          {
            id: 'risk-001',
            riskType: RiskType.FACT_VERIFICATION,
            riskCategory: RiskCategory.EVIDENTIARY,
            riskLevel: RiskLevel.MEDIUM,
            score: 0.5,
            confidence: 0.7,
            description: '事实需要进一步核实',
            evidence: ['存在矛盾描述'],
            suggestions: [
              {
                id: 'sug-001',
                riskType: RiskType.FACT_VERIFICATION,
                suggestionType: MitigationSuggestionType.VERIFY_FACTS,
                priority: SuggestionPriority.HIGH,
                action: '核实案件事实',
                reason: '事实不清楚',
                estimatedImpact: '提高准确性',
                estimatedEffort: '2-3天',
              },
            ],
            identifiedAt: new Date(),
          },
        ],
        statistics: {
          totalRisks: 1,
          byLevel: {
            [RiskLevel.LOW]: 0,
            [RiskLevel.MEDIUM]: 1,
            [RiskLevel.HIGH]: 0,
            [RiskLevel.CRITICAL]: 0,
          },
          byCategory: {
            [RiskCategory.PROCEDURAL]: 0,
            [RiskCategory.EVIDENTIARY]: 1,
            [RiskCategory.SUBSTANTIVE]: 0,
            [RiskCategory.STRATEGIC]: 0,
          },
          byType: {
            [RiskType.LEGAL_PROCEDURE]: 0,
            [RiskType.EVIDENCE_STRENGTH]: 0,
            [RiskType.STATUTE_LIMITATION]: 0,
            [RiskType.JURISDICTION]: 0,
            [RiskType.COST_BENEFIT]: 0,
            [RiskType.FACT_VERIFICATION]: 1,
            [RiskType.LEGAL_BASIS]: 0,
            [RiskType.CONTRADICTION]: 0,
            [RiskType.PROOF_BURDEN]: 0,
          },
          criticalRisks: 0,
          highRisks: 0,
          mediumRisks: 1,
          lowRisks: 0,
        },
        suggestions: [],
        assessmentTime: 100,
        assessedAt: new Date(),
      };

      mockAIService.chatCompletion.mockRejectedValue(
        new Error('AI service failed')
      );

      const advisor = new AIRiskAdvisor({
        aiService: mockAIService,
        enableFallback: true,
        confidenceThreshold: 0.6,
      });

      const suggestions = await advisor.advise(assessment);

      expect(suggestions).toBeDefined();
      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBe(1);
      expect(suggestions[0].action).toContain('核实');
    });
  });
});

describe('RiskScorer', () => {
  let scorer: RiskScorer;

  beforeEach(() => {
    scorer = new RiskScorer();
  });

  describe('assess', () => {
    it('应该计算低风险评估', () => {
      const risks = [
        {
          id: 'risk-001',
          riskType: RiskType.EVIDENCE_STRENGTH,
          riskCategory: RiskCategory.EVIDENTIARY,
          riskLevel: RiskLevel.LOW,
          score: 0.2,
          confidence: 0.8,
          description: '证据轻微不足',
          evidence: [],
          suggestions: [],
          identifiedAt: new Date(),
        },
      ];

      const assessment = scorer.assess('case-001', risks);

      expect(assessment.caseId).toBe('case-001');
      expect(assessment.overallRiskLevel).toBe(RiskLevel.LOW);
      expect(assessment.overallRiskScore).toBeLessThan(0.3);
      expect(assessment.statistics.totalRisks).toBe(1);
    });

    it('应该计算严重风险评估', () => {
      const risks = [
        {
          id: 'risk-001',
          riskType: RiskType.EVIDENCE_STRENGTH,
          riskCategory: RiskCategory.EVIDENTIARY,
          riskLevel: RiskLevel.CRITICAL,
          score: 0.9,
          confidence: 0.9,
          description: '完全没有证据',
          evidence: [],
          suggestions: [],
          identifiedAt: new Date(),
        },
      ];

      const assessment = scorer.assess('case-001', risks);

      expect(assessment.overallRiskLevel).toBe(RiskLevel.CRITICAL);
      expect(assessment.overallRiskScore).toBeGreaterThan(0.85);
      expect(assessment.statistics.criticalRisks).toBe(1);
    });

    it('应该正确处理空风险列表', () => {
      const assessment = scorer.assess('case-001', []);

      expect(assessment.caseId).toBe('case-001');
      expect(assessment.overallRiskLevel).toBe(RiskLevel.LOW);
      expect(assessment.overallRiskScore).toBe(0);
      expect(assessment.statistics.totalRisks).toBe(0);
    });

    it('应该计算混合风险的加权平均', () => {
      const risks = [
        {
          id: 'risk-001',
          riskType: RiskType.EVIDENCE_STRENGTH,
          riskCategory: RiskCategory.EVIDENTIARY,
          riskLevel: RiskLevel.HIGH,
          score: 0.8,
          confidence: 0.9,
          description: '证据不足',
          evidence: [],
          suggestions: [],
          identifiedAt: new Date(),
        },
        {
          id: 'risk-002',
          riskType: RiskType.LEGAL_PROCEDURE,
          riskCategory: RiskCategory.PROCEDURAL,
          riskLevel: RiskLevel.MEDIUM,
          score: 0.5,
          confidence: 0.8,
          description: '程序问题',
          evidence: [],
          suggestions: [],
          identifiedAt: new Date(),
        },
      ];

      const assessment = scorer.assess('case-001', risks);

      // 加权平均: (0.8*0.35 + 0.5*0.25) / (0.35+0.25) = 0.405/0.6 = 0.675
      // 0.675 >= 0.5 (medium) 且 < 0.7 (high), 所以是MEDIUM
      expect(assessment.overallRiskLevel).toBe(RiskLevel.MEDIUM);
      expect(assessment.statistics.totalRisks).toBe(2);
      expect(assessment.statistics.highRisks).toBe(1);
      expect(assessment.statistics.mediumRisks).toBe(1);
    });
  });

  describe('getRiskLevelDescription', () => {
    it('应该返回正确的风险等级描述', () => {
      expect(scorer.getRiskLevelDescription(RiskLevel.LOW)).toContain('安全');
      expect(scorer.getRiskLevelDescription(RiskLevel.MEDIUM)).toContain(
        '关注'
      );
      expect(scorer.getRiskLevelDescription(RiskLevel.HIGH)).toContain('策略');
      expect(scorer.getRiskLevelDescription(RiskLevel.CRITICAL)).toContain(
        '立即'
      );
    });
  });

  describe('getRiskHandlingSuggestions', () => {
    it('应该返回低风险的处理建议', () => {
      const suggestions = scorer.getRiskHandlingSuggestions(RiskLevel.LOW);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].action).toContain('监控');
    });

    it('应该返回严重风险的处理建议', () => {
      const suggestions = scorer.getRiskHandlingSuggestions(RiskLevel.CRITICAL);
      expect(suggestions.length).toBeGreaterThan(2);
      expect(suggestions.some(s => s.action.includes('评估'))).toBe(true);
      expect(suggestions.some(s => s.action.includes('暂停'))).toBe(true);
    });
  });
});

describe('AIRiskIdentifier', () => {
  let mockAIService: any;
  let identifier: AIRiskIdentifier;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAIService = {
      chatCompletion: jest.fn(),
    };
    identifier = new AIRiskIdentifier({
      aiService: mockAIService,
      enableFallback: true,
      confidenceThreshold: 0.6,
    });
  });

  describe('identify', () => {
    it('应该识别证据不足风险', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case-001',
        caseTitle: '合同纠纷案',
        caseType: 'contract',
        facts: ['甲方未按时付款', '乙方已履行合同义务'],
      };

      mockAIService.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                risks: [
                  {
                    riskType: 'evidence_strength',
                    riskCategory: 'evidentiary',
                    score: 0.8,
                    confidence: 0.9,
                    description: '缺乏付款凭证等关键证据',
                    evidence: ['没有银行转账记录'],
                    suggestions: [],
                  },
                ],
              }),
            },
          },
        ],
      });

      const risks = await identifier.identify(input);

      expect(risks).toBeDefined();
      expect(Array.isArray(risks)).toBe(true);
      expect(risks.length).toBeGreaterThan(0);
      expect(risks[0].riskType).toBe(RiskType.EVIDENCE_STRENGTH);
    });

    it('应该使用规则引擎作为回退', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case-001',
        caseTitle: '简单纠纷',
        facts: ['单方面陈述'],
      };

      mockAIService.chatCompletion.mockRejectedValue(new Error('AI failed'));

      const risks = await identifier.identify(input);

      expect(risks).toBeDefined();
      expect(Array.isArray(risks)).toBe(true);
      expect(risks.length).toBeGreaterThan(0);
    });

    it('应该验证输入参数', async () => {
      const invalidInput = {
        caseId: '',
        caseTitle: '',
        facts: [],
      } as RiskIdentificationInput;

      await expect(identifier.identify(invalidInput)).rejects.toThrow(
        '无效的风险识别输入'
      );
    });

    it('应该过滤低置信度风险', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case-001',
        caseTitle: '复杂纠纷',
        facts: ['详细案件事实'],
      };

      mockAIService.chatCompletion.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                risks: [
                  {
                    riskType: 'legal_procedure',
                    riskCategory: 'procedural',
                    score: 0.5,
                    confidence: 0.4,
                    description: '可能存在程序问题',
                    evidence: [],
                    suggestions: [],
                  },
                ],
              }),
            },
          },
        ],
      });

      const risks = await identifier.identify(input);

      expect(risks.length).toBe(0);
    });
  });
});
