/**
 * AI Mock服务 - 用于测试和离线模式
 * 模拟DeepSeek API响应，用于测试和开发阶段
 */

import type { DisputeFocus, KeyFact, TimelineEvent } from '../../core/types';

// =============================================================================
// 类型定义
// =============================================================================

export interface MockAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface MockAIRequest {
  model: string;
  provider: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
}

// =============================================================================
// Mock AI服务类
// =============================================================================

export class MockAIService {
  private readonly delayMs: number;

  constructor(delayMs: number = 100) {
    this.delayMs = delayMs;
  }

  async chatCompletion(request: MockAIRequest): Promise<MockAIResponse> {
    // 模拟网络延迟
    await this.delay(this.delayMs);

    const systemContent = request.messages.find(m => m.role === 'system')?.content || '';
    const userContent = request.messages.find(m => m.role === 'user')?.content || '';

    // 根据请求内容返回相应的Mock响应
    if (systemContent.includes('争议焦点') || userContent.includes('争议焦点')) {
      return this.getDisputeFocusMockResponse();
    }

    if (systemContent.includes('关键事实') || userContent.includes('关键事实')) {
      return this.getKeyFactMockResponse();
    }

    if (systemContent.includes('时间线') || userContent.includes('时间线')) {
      return this.getTimelineMockResponse();
    }

    return this.getDefaultMockResponse();
  }

  // =============================================================================
  // Mock响应生成器
  // =============================================================================

  private getDisputeFocusMockResponse(): MockAIResponse {
    const disputeFocuses = [
      {
        id: 'ai_focus_0',
        category: 'CONTRACT_BREACH',
        description: '被告是否违反合同约定',
        positionA: '原告认为被告未按照合同约定履行义务，已构成违约',
        positionB: '被告辩称已按照合同约定履行义务，不存在违约行为',
        coreIssue: '是否违约',
        importance: 9,
        confidence: 0.85,
        relatedClaims: [],
        relatedFacts: [],
        evidence: ['合同条款', '履行记录'],
        legalBasis: '《民法典》第五百零九条'
      },
      {
        id: 'ai_focus_1',
        category: 'PAYMENT_DISPUTE',
        description: '应支付本金数额的争议',
        positionA: '原告主张被告应支付本金人民币100万元',
        positionB: '被告认为本金数额应计算为80万元，而非100万元',
        coreIssue: '支付本金数额',
        importance: 8,
        confidence: 0.80,
        relatedClaims: [],
        relatedFacts: [],
        evidence: ['付款凭证', '银行流水'],
        legalBasis: '《民法典》第五百七十九条'
      },
      {
        id: 'ai_focus_2',
        category: 'LIABILITY_ISSUE',
        description: '违约责任承担方式',
        positionA: '原告认为被告应承担继续履行、赔偿损失等违约责任',
        positionB: '被告认为不应承担违约责任，即便存在违约，也应减轻责任',
        coreIssue: '责任承担方式',
        importance: 7,
        confidence: 0.75,
        relatedClaims: [],
        relatedFacts: [],
        evidence: ['违约通知', '损失清单'],
        legalBasis: '《民法典》第五百七十七条'
      }
    ];

    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({ disputeFocuses }, null, 2)
          }
        }
      ],
      usage: {
        promptTokens: 500,
        completionTokens: 300,
        totalTokens: 800
      }
    };
  }

  private getKeyFactMockResponse(): MockAIResponse {
    const keyFacts: KeyFact[] = [
      {
        id: 'fact_0',
        category: 'CONTRACT_TERM',
        description: '双方于2023年1月15日签订《借款合同》',
        details: '合同编号为XX-2023-001，约定借款期限6个月，年利率6%',
        importance: 9,
        confidence: 0.95,
        relatedDisputes: [],
        factType: 'EXPLICIT',
        evidence: ['借款合同'],
        relatedTimeline: []
      },
      {
        id: 'fact_1',
        category: 'CONTRACT_TERM',
        description: '合同约定借款金额为人民币100万元',
        details: '借款用途为经营周转，还款方式为到期一次性还本付息',
        importance: 9,
        confidence: 0.95,
        relatedDisputes: [],
        factType: 'EXPLICIT',
        evidence: ['借款合同条款'],
        relatedTimeline: []
      },
      {
        id: 'fact_2',
        category: 'PERFORMANCE_ACT',
        description: '原告已按约定向被告支付借款本金',
        details: '原告于2023年1月20日通过银行转账向被告支付100万元',
        importance: 8,
        confidence: 0.90,
        relatedDisputes: [],
        factType: 'EXPLICIT',
        evidence: ['银行转账凭证'],
        relatedTimeline: []
      },
      {
        id: 'fact_3',
        category: 'BREACH_BEHAVIOR',
        description: '被告未按约定时间偿还借款',
        details: '截至2023年8月1日，被告仍未偿还借款本金及利息',
        importance: 9,
        confidence: 0.90,
        relatedDisputes: [],
        factType: 'EXPLICIT',
        evidence: ['催款通知回复'],
        relatedTimeline: []
      }
    ];

    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({ keyFacts }, null, 2)
          }
        }
      ],
      usage: {
        promptTokens: 400,
        completionTokens: 250,
        totalTokens: 650
      }
    };
  }

  private getTimelineMockResponse(): MockAIResponse {
    const timelineEvents: TimelineEvent[] = [
      {
        id: 'event_0',
        date: '2023-01-15',
        event: '签订《借款合同》',
        description: '双方签订借款合同，约定借款金额100万元，期限6个月',
        eventType: 'CONTRACT_SIGNED',
        importance: 5,
        evidence: ['借款合同'],
        source: 'explicit'
      },
      {
        id: 'event_1',
        date: '2023-01-20',
        event: '原告支付借款本金',
        description: '原告通过银行转账向被告支付借款本金100万元',
        eventType: 'PERFORMANCE_START',
        importance: 5,
        evidence: ['银行转账凭证'],
        source: 'explicit'
      },
      {
        id: 'event_2',
        date: '2023-07-15',
        event: '借款到期日',
        description: '借款合同约定的还款期限到期',
        eventType: 'PERFORMANCE_START',
        importance: 4,
        evidence: ['借款合同'],
        source: 'explicit'
      },
      {
        id: 'event_3',
        date: '2023-07-20',
        event: '原告发送催款通知',
        description: '原告向被告发送书面催款通知，要求偿还借款',
        eventType: 'DEMAND_SENT',
        importance: 3,
        evidence: ['催款通知'],
        source: 'explicit'
      },
      {
        id: 'event_4',
        date: '2023-08-10',
        event: '原告提起诉讼',
        description: '原告向法院提起诉讼，要求被告偿还借款及支付违约金',
        eventType: 'LAWSUIT_FILED',
        importance: 4,
        evidence: ['起诉状'],
        source: 'explicit'
      }
    ];

    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({ timelineEvents }, null, 2)
          }
        }
      ],
      usage: {
        promptTokens: 450,
        completionTokens: 350,
        totalTokens: 800
      }
    };
  }

  private getDefaultMockResponse(): MockAIResponse {
    return {
      choices: [
        {
          message: {
            role: 'assistant',
            content: JSON.stringify({ result: 'Mock response' }, null, 2)
          }
        }
      ]
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

let mockAIServiceInstance: MockAIService | null = null;

export function getMockAIService(): MockAIService {
  if (!mockAIServiceInstance) {
    mockAIServiceInstance = new MockAIService();
  }
  return mockAIServiceInstance;
}

export function createMockAIService(delayMs?: number): MockAIService {
  return new MockAIService(delayMs);
}

/**
 * 启用Mock模式
 * @returns 清除Mock模式的函数
 */
export function enableMockMode(): () => void {
  const originalUnifiedService = require('@/lib/ai/unified-service');
  
  // 临时替换unified-service
  const mockService = getMockAIService();
  
  return () => {
    // 恢复原始服务
    mockAIServiceInstance = null;
  };
}
