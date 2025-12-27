/**
 * StrategistAgent 测试
 * 
 * 测试策略生成功能
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { StrategistAgent, AIStrategyGenerator, RuleValidator, RiskAssessor } from '../../lib/agent/strategist';
import { AIService } from '../../lib/ai/service';
import type { StrategyInput } from '../../lib/agent/strategist/types';
import { TaskPriority } from '../../types/agent';

// =============================================================================
// Mock数据
// =============================================================================

const mockInput: StrategyInput = {
  caseInfo: {
    caseType: '合同纠纷',
    parties: [
      { name: '张三', role: 'plaintiff', representative: '李律师' },
      { name: '王五公司', role: 'defendant' }
    ],
    claims: [
      '要求被告支付货款人民币50万元',
      '要求被告支付违约金人民币5万元',
      '要求被告承担诉讼费用'
    ],
    facts: [
      '双方于2023年1月签订《供货合同》',
      '原告按约供货，被告未按期支付货款',
      '被告尚欠货款人民币50万元',
      '合同约定违约金为未付款项的10%'
    ]
  },
  legalAnalysis: {
    applicableLaws: [
      {
        law: '《中华人民共和国民法典》第五百零九条',
        relevance: 0.95,
        article: '509'
      },
      {
        law: '《中华人民共和国民法典》第五百七十七条',
        relevance: 0.9,
        article: '577'
      }
    ]
  },
  context: {
    jurisdiction: '北京市',
    courtLevel: '基层人民法院',
    complexity: 'medium',
    estimatedDuration: '3个月'
  }
};

const mockAIResponse = {
  swotAnalysis: {
    strengths: [
      '合同证据充分',
      '违约事实清晰',
      '法律依据明确'
    ],
    weaknesses: [
      '部分款项未开票',
      '诉讼时效接近',
      '证据链存在瑕疵'
    ],
    opportunities: [
      '可申请财产保全',
      '调解可能达成',
      '可追加利息'
    ],
    threats: [
      '被告可能破产',
      '证据可能被质疑',
      '调解可能失败'
    ]
  },
  strategies: [
    {
      strategy: '直接起诉策略',
      rationale: '基于违约事实，直接通过诉讼方式追偿',
      implementationSteps: [
        '准备起诉材料',
        '向法院提交起诉状',
        '参加庭审辩论'
      ],
      expectedOutcome: '胜诉概率高，但耗时较长'
    },
    {
      strategy: '先行调解策略',
      rationale: '通过调解快速解决纠纷，节省时间和成本',
      implementationSteps: [
        '发出律师函',
        '协商调解方案',
        '签订调解协议'
      ],
      expectedOutcome: '快速解决，但金额可能减少'
    },
    {
      strategy: '保全措施策略',
      rationale: '申请财产保全，确保胜诉后能执行',
      implementationSteps: [
        '收集财产线索',
        '提交保全申请',
        '缴纳保全费用'
      ],
      expectedOutcome: '保障执行，但需承担保全风险'
    }
  ],
  risks: [
    {
      factor: '被告财产转移',
      impact: 'high' as const,
      probability: 0.4,
      mitigation: '及时申请财产保全'
    },
    {
      factor: '证据不足',
      impact: 'medium' as const,
      probability: 0.3,
      mitigation: '补充完善证据链'
    },
    {
      factor: '被告破产',
      impact: 'high' as const,
      probability: 0.2,
      mitigation: '及时申报债权'
    }
  ]
};

// =============================================================================
// 测试套件
// =============================================================================

describe('StrategistAgent', () => {
  let agent: StrategistAgent;
  let mockAIService: jest.Mocked<AIService>;

  beforeEach(() => {
    agent = new StrategistAgent();
    
    // Mock AI服务
    mockAIService = {
      chatCompletion: jest.fn().mockResolvedValue({
        output: JSON.stringify(mockAIResponse),
        content: JSON.stringify(mockAIResponse)
      })
    } as unknown as jest.Mocked<AIService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // RuleValidator 测试
  // =========================================================================

  describe('RuleValidator', () => {
    let validator: RuleValidator;

    beforeEach(() => {
      validator = new RuleValidator();
    });

    it('应该正确验证完整的AI响应', () => {
      const result = validator.validate(mockAIResponse);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('应该检测SWOT分析缺少的项目', () => {
      const incompleteResponse = {
        ...mockAIResponse,
        swotAnalysis: {
          strengths: ['优势1'],
          weaknesses: ['劣势1'],
          opportunities: [],
          threats: []
        }
      };

      const result = validator.validate(incompleteResponse);

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('应该检测策略数量不足', () => {
      const incompleteResponse = {
        ...mockAIResponse,
        strategies: []
      };

      const result = validator.validate(incompleteResponse);

      expect(result.violations.length).toBeGreaterThan(0);
    });

    it('应该检测风险概率值无效', () => {
      const invalidResponse = {
        ...mockAIResponse,
        risks: [
          {
            factor: '测试风险',
            impact: 'high' as const,
            probability: 1.5,
            mitigation: '应对措施'
          }
        ]
      };

      const result = validator.validate(invalidResponse);

      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // RiskAssessor 测试
  // =========================================================================

  describe('RiskAssessor', () => {
    let assessor: RiskAssessor;

    beforeEach(() => {
      assessor = new RiskAssessor();
    });

    it('应该正确评估高风险', () => {
      const highRiskResponse = {
        ...mockAIResponse,
        risks: [
          {
            factor: '高风险',
            impact: 'high' as const,
            probability: 0.8,
            mitigation: '应对措施'
          },
          {
            factor: '高风险2',
            impact: 'high' as const,
            probability: 0.7,
            mitigation: '应对措施'
          }
        ]
      };

      const assessment = assessor.assessRisks(highRiskResponse);

      expect(assessment.overallRisk).toBe('high');
    });

    it('应该正确评估低风险', () => {
      const lowRiskResponse = {
        ...mockAIResponse,
        risks: [
          {
            factor: '低风险',
            impact: 'low' as const,
            probability: 0.2,
            mitigation: '应对措施'
          }
        ]
      };

      const assessment = assessor.assessRisks(lowRiskResponse);

      expect(assessment.overallRisk).toBe('low');
    });

    it('应该计算合理的置信度', () => {
      const assessment = assessor.assessRisks(mockAIResponse);

      expect(assessment.confidence).toBeGreaterThan(0);
      expect(assessment.confidence).toBeLessThanOrEqual(1);
    });

    it('应该生成风险摘要', () => {
      const assessment = assessor.assessRisks(mockAIResponse);
      const summary = assessor.generateRiskSummary(assessment);

      expect(summary).toContain('风险评估总结');
      expect(summary).toContain('整体风险等级');
    });
  });

  // =========================================================================
  // AIStrategyGenerator 测试
  // =========================================================================

  describe('AIStrategyGenerator', () => {
    let generator: AIStrategyGenerator;

    beforeEach(() => {
      generator = new AIStrategyGenerator();
    });

    it('应该成功初始化AI服务', async () => {
      await generator.initialize(mockAIService);

      // 如果初始化成功，不应抛出异常
      expect(true).toBe(true);
    });

    it('应该抛出未初始化错误', async () => {
      await expect(
        generator.generateStrategy('测试', '测试')
      ).rejects.toThrow('AI服务未初始化');
    });

    it('应该解析有效的AI响应', async () => {
      await generator.initialize(mockAIService);

      const response = await generator.generateStrategy(
        '测试案件',
        '测试法条'
      );

      expect(response).toHaveProperty('swotAnalysis');
      expect(response).toHaveProperty('strategies');
      expect(response).toHaveProperty('risks');
    });

    it('应该配置生成器', () => {
      generator.configure({
        temperature: 0.5,
        maxTokens: 1000
      });

      const config = (generator as any).config;

      expect(config.temperature).toBe(0.5);
      expect(config.maxTokens).toBe(1000);
    });
  });

  // =========================================================================
  // 主Agent测试
  // =========================================================================

  describe('StrategistAgent', () => {
    it('应该返回正确的Agent信息', () => {
      expect(agent.name).toBe('Strategist');
      expect(agent.version).toBe('1.0.0');
      expect(agent.type).toBe('strategist');
    });

    it('应该返回正确的能力列表', () => {
      const capabilities = agent.getCapabilities();

      expect(capabilities).toContain('SWOT_ANALYSIS');
      expect(capabilities).toContain('STRATEGY_GENERATION');
      expect(capabilities).toContain('RISK_ASSESSMENT');
    });

    it('应该返回正确的处理步骤', () => {
      const steps = agent.getProcessingSteps();

      expect(steps).toContain('输入验证');
      expect(steps).toContain('第一层：AI策略生成');
      expect(steps).toContain('第二层：规则验证');
      expect(steps).toContain('第三层：风险评估');
    });

    it('应该验证无效输入', async () => {
      const invalidInput = {
        caseInfo: {
          caseType: '',
          parties: [],
          claims: [],
          facts: []
        },
        legalAnalysis: {
          applicableLaws: []
        }
      } as StrategyInput;

      await expect(
        agent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: invalidInput })
      ).rejects.toThrow('输入验证失败');
    });

    it('应该接受有效输入', async () => {
      // 创建新agent并注入mock的AI服务
      const testAgent = new StrategistAgent();
      // 直接访问私有属性来注入mock
      (testAgent as any).aiGenerator = new AIStrategyGenerator();
      await (testAgent as any).aiGenerator.initialize(mockAIService);

      await expect(
        testAgent.execute({ task: 'test', priority: TaskPriority.MEDIUM, data: mockInput })
      ).resolves.not.toThrow();
    });
  });
});
