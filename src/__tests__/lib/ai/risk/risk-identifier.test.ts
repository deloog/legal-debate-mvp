/**
 * AIRiskIdentifier - 单元测试
 */

import { AIRiskIdentifier } from '../../../../lib/ai/risk/risk-identifier';
import type { RiskIdentificationInput } from '../../../../types/risk';
import { RiskType, RiskLevel } from '../../../../types/risk';
import type { AIResponse } from '../../../../types/ai-service';

/**
 * Mock AIService
 */
class MockAIService {
  async chatCompletion(): Promise<AIResponse> {
    return {
      id: 'test-response-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'deepseek-chat',
      provider: 'deepseek',
      duration: 100,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              risks: [
                {
                  riskType: RiskType.EVIDENCE_STRENGTH,
                  riskCategory: 'EVIDENTIARY',
                  score: 0.7,
                  confidence: 0.8,
                  description: '案件证据可能不足以支撑诉讼请求',
                  evidence: ['证据数量不足', '证据链不完整'],
                  suggestions: [
                    {
                      type: 'GATHER_EVIDENCE',
                      action: '补充收集相关证据',
                      reason: '增强证据链的完整性',
                      estimatedImpact: '显著提升胜诉概率',
                    },
                  ],
                },
              ],
            }),
          },
          finishReason: 'stop',
          logprobs: null,
        },
      ],
    };
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}

describe('AIRiskIdentifier', () => {
  let riskIdentifier: AIRiskIdentifier;
  let mockAIService: MockAIService;

  beforeEach(() => {
    mockAIService = new MockAIService();
    riskIdentifier = new AIRiskIdentifier({
      aiService: mockAIService as any,
      enableFallback: true,
      confidenceThreshold: 0.6,
    });
  });

  describe('identify', () => {
    it('应该成功识别案件风险', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case_001',
        caseTitle: '合同纠纷案',
        caseType: '民事案件',
        facts: [
          '原告与被告签订了一份买卖合同',
          '被告未按约定支付货款',
          '原告多次催讨未果',
        ],
        claims: ['要求被告支付货款', '要求被告支付违约金'],
        evidence: [
          {
            name: '买卖合同',
            type: 'DOCUMENT',
            description: '双方签订的买卖合同原件',
          },
        ],
        legalBasis: [
          {
            lawName: '民法典',
            articleNumber: '第509条',
          },
        ],
        parties: {
          plaintiff: '某公司',
          defendant: '某个人',
        },
      };

      const risks = await riskIdentifier.identify(input);

      expect(risks).toBeDefined();
      expect(Array.isArray(risks)).toBe(true);
      expect(risks.length).toBeGreaterThan(0);
    });

    it('应该在AI失败时使用规则引擎', async () => {
      const mockFailingAIService = {
        async chatCompletion() {
          throw new Error('AI服务失败');
        },
        async healthCheck() {
          return false;
        },
      };

      const fallbackIdentifier = new AIRiskIdentifier({
        aiService: mockFailingAIService as any,
        enableFallback: true,
        confidenceThreshold: 0.6,
      });

      const input: RiskIdentificationInput = {
        caseId: 'case_002',
        caseTitle: '事实不足案',
        facts: ['只有一条事实'],
      };

      const risks = await fallbackIdentifier.identify(input);

      expect(risks).toBeDefined();
      expect(risks.length).toBeGreaterThan(0);
      expect(risks[0].riskType).toBe(RiskType.FACT_VERIFICATION);
    });

    it('应该过滤低置信度风险', async () => {
      const lowConfidenceAIService = {
        async chatCompletion(): Promise<AIResponse> {
          return {
            id: 'test-response-id',
            object: 'chat.completion',
            created: Date.now(),
            model: 'deepseek-chat',
            provider: 'deepseek',
            duration: 100,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({
                    risks: [
                      {
                        riskType: RiskType.EVIDENCE_STRENGTH,
                        riskCategory: 'EVIDENTIARY',
                        score: 0.7,
                        confidence: 0.5,
                        description: '低置信度风险',
                        evidence: [],
                        suggestions: [],
                      },
                    ],
                  }),
                },
                finishReason: 'stop',
                logprobs: null,
              },
            ],
          };
        },
        async healthCheck() {
          return true;
        },
      };

      const highThresholdIdentifier = new AIRiskIdentifier({
        aiService: lowConfidenceAIService as any,
        enableFallback: true,
        confidenceThreshold: 0.9,
      });

      const input: RiskIdentificationInput = {
        caseId: 'case_003',
        caseTitle: '低置信度风险案',
        facts: ['测试事实1', '测试事实2', '测试事实3'],
      };

      const risks = await highThresholdIdentifier.identify(input);

      // 由于AI返回的置信度为0.5，低于阈值0.9，应该被过滤
      expect(risks.length).toBe(0);
    });

    it('应该验证输入数据', async () => {
      const invalidInput: RiskIdentificationInput = {
        caseId: '',
        caseTitle: '',
        facts: [],
      };

      await expect(riskIdentifier.identify(invalidInput)).rejects.toThrow(
        '无效的风险识别输入'
      );
    });

    it('应该处理包含完整信息的输入', async () => {
      const completeInput: RiskIdentificationInput = {
        caseId: 'case_004',
        caseTitle: '完整信息案',
        caseType: '民事案件',
        facts: ['事实1', '事实2', '事实3', '事实4', '事实5'],
        claims: ['请求1', '请求2'],
        evidence: [
          {
            name: '证据1',
            type: 'DOCUMENT',
            description: '证据描述',
          },
          {
            name: '证据2',
            type: 'PHYSICAL',
          },
        ],
        legalBasis: [
          {
            lawName: '民法典',
            articleNumber: '第509条',
          },
          {
            lawName: '民法典',
            articleNumber: '第577条',
          },
        ],
        parties: {
          plaintiff: '原告方',
          defendant: '被告方',
        },
      };

      const risks = await riskIdentifier.identify(completeInput);

      expect(risks).toBeDefined();
      expect(Array.isArray(risks)).toBe(true);
    });
  });

  describe('identifyByRules', () => {
    it('应该识别事实不足风险', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case_005',
        caseTitle: '事实不足案',
        facts: ['只有一条事实'],
      };

      const mockFailingAIService = {
        async chatCompletion() {
          throw new Error('AI失败');
        },
        async healthCheck() {
          return false;
        },
      };

      const identifier = new AIRiskIdentifier({
        aiService: mockFailingAIService as any,
        enableFallback: true,
        confidenceThreshold: 0.6,
      });

      const risks = await identifier.identify(input);

      expect(risks.length).toBeGreaterThan(0);
      const factRisk = risks.find(
        r => r.riskType === RiskType.FACT_VERIFICATION
      );
      expect(factRisk).toBeDefined();
    });

    it('应该识别证据不足风险', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case_006',
        caseTitle: '证据不足案',
        facts: ['事实1', '事实2', '事实3'],
      };

      const mockFailingAIService = {
        async chatCompletion() {
          throw new Error('AI失败');
        },
        async healthCheck() {
          return false;
        },
      };

      const identifier = new AIRiskIdentifier({
        aiService: mockFailingAIService as any,
        enableFallback: true,
        confidenceThreshold: 0.6,
      });

      const risks = await identifier.identify(input);

      expect(risks.length).toBeGreaterThan(0);
      const evidenceRisk = risks.find(
        r => r.riskType === RiskType.EVIDENCE_STRENGTH
      );
      expect(evidenceRisk).toBeDefined();
      expect(evidenceRisk?.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('应该识别法律依据不足风险', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case_007',
        caseTitle: '法律依据不足案',
        facts: ['事实1', '事实2', '事实3'],
        evidence: [
          {
            name: '证据1',
            type: 'DOCUMENT',
          },
        ],
      };

      const mockFailingAIService = {
        async chatCompletion() {
          throw new Error('AI失败');
        },
        async healthCheck() {
          return false;
        },
      };

      const identifier = new AIRiskIdentifier({
        aiService: mockFailingAIService as any,
        enableFallback: true,
        confidenceThreshold: 0.6,
      });

      const risks = await identifier.identify(input);

      expect(risks.length).toBeGreaterThan(0);
      const basisRisk = risks.find(r => r.riskType === RiskType.LEGAL_BASIS);
      expect(basisRisk).toBeDefined();
      expect(basisRisk?.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('应该识别多个风险', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case_008',
        caseTitle: '多重风险案',
        facts: ['只有少量事实'],
      };

      const mockFailingAIService = {
        async chatCompletion() {
          throw new Error('AI失败');
        },
        async healthCheck() {
          return false;
        },
      };

      const identifier = new AIRiskIdentifier({
        aiService: mockFailingAIService as any,
        enableFallback: true,
        confidenceThreshold: 0.6,
      });

      const risks = await identifier.identify(input);

      expect(risks.length).toBeGreaterThan(1);
    });
  });

  describe('buildIdentificationPrompt', () => {
    it('应该正确构建案件识别提示词', async () => {
      const input: RiskIdentificationInput = {
        caseId: 'case_009',
        caseTitle: '测试案件',
        caseType: '民事案件',
        facts: ['事实1', '事实2'],
        claims: ['请求1'],
        evidence: [
          {
            name: '证据1',
            type: 'DOCUMENT',
            description: '证据描述',
          },
        ],
        legalBasis: [
          {
            lawName: '民法典',
            articleNumber: '第509条',
          },
        ],
        parties: {
          plaintiff: '原告',
          defendant: '被告',
        },
      };

      let capturedPrompt = '';

      const mockAIServiceWithSpy = {
        async chatCompletion(request: unknown): Promise<AIResponse> {
          const messages = (request as { messages: unknown[] }).messages;
          const lastMessage = messages[messages.length - 1] as {
            content: string;
          };
          capturedPrompt = lastMessage.content;

          return {
            id: 'test-response-id',
            object: 'chat.completion',
            created: Date.now(),
            model: 'deepseek-chat',
            provider: 'deepseek',
            duration: 100,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: JSON.stringify({ risks: [] }),
                },
                finishReason: 'stop',
                logprobs: null,
              },
            ],
          };
        },
        async healthCheck() {
          return true;
        },
      };

      const identifier = new AIRiskIdentifier({
        aiService: mockAIServiceWithSpy as any,
        enableFallback: false,
        confidenceThreshold: 0.6,
      });

      await identifier.identify(input);

      expect(capturedPrompt).toContain('案件标题：测试案件');
      expect(capturedPrompt).toContain('案件类型：民事案件');
      expect(capturedPrompt).toContain('案件事实：');
      expect(capturedPrompt).toContain('事实1');
      expect(capturedPrompt).toContain('事实2');
      expect(capturedPrompt).toContain('诉讼请求：');
      expect(capturedPrompt).toContain('请求1');
      expect(capturedPrompt).toContain('证据信息：');
      expect(capturedPrompt).toContain('证据1');
      expect(capturedPrompt).toContain('法律依据：');
      expect(capturedPrompt).toContain('民法典');
      expect(capturedPrompt).toContain('第509条');
      expect(capturedPrompt).toContain('当事人信息：');
      expect(capturedPrompt).toContain('原告');
      expect(capturedPrompt).toContain('被告');
    });
  });
});
