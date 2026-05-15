// =============================================================================
// DocAnalyzer 关键事实提取器测试 — AI-only 契约
// 所有测试通过 mock AI 服务驱动，不依赖真实 AI 调用
// =============================================================================

import {
  KeyFactExtractor,
  createKeyFactExtractor,
  extractKeyFactsFromText,
} from '@/lib/agent/doc-analyzer/extractors/key-fact-extractor';
import { getUnifiedAIService } from '@/lib/ai/unified-service';
import type { DisputeFocusCategory } from '@/lib/agent/doc-analyzer/core/types';

// ---------------------------------------------------------------------------
// AI 服务 Mock
// ---------------------------------------------------------------------------

// 变量声明在 jest.mock 之前，但工厂函数通过闭包引用，不会触发 TDZ
const mockChatCompletion = jest.fn() as jest.Mock;

jest.mock('@/lib/ai/unified-service', () => ({
  // 只暴露本测试所需的导出
  getUnifiedAIService: jest.fn(),
}));

interface AIMockFact {
  category: string;
  description: string;
  details?: string;
  importance: number;
  confidence: number;
  factType: string;
  evidence?: string[];
}

/**
 * 模拟一次完整的 extract + review 调用链
 * extract 响应: { keyFacts: facts }
 * review 响应: { reviewedFacts: facts（带 id）, invalidIds: [] }
 */
function mockAIResponse(facts: AIMockFact[]) {
  const reviewedFacts = facts.map((f, i) => ({ ...f, id: `ai_fact_${i}` }));
  mockChatCompletion
    .mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ keyFacts: facts }) } }],
    })
    .mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({ reviewedFacts, invalidIds: [] }),
          },
        },
      ],
    });
}

/** 模拟 AI 调用直接抛出错误 */
function mockAIFailure(message = 'AI 服务不可用') {
  mockChatCompletion.mockRejectedValue(new Error(message));
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

const mockGetUnifiedAIService = getUnifiedAIService as jest.Mock;

describe('KeyFactExtractor', () => {
  let extractor: KeyFactExtractor;

  beforeEach(() => {
    extractor = createKeyFactExtractor();
    jest.resetAllMocks();
    // clearAllMocks 在 Jest 30 中会清除 mockResolvedValue，需要手动重置
    mockGetUnifiedAIService.mockResolvedValue({
      chatCompletion: mockChatCompletion,
    });
  });

  // =========================================================================
  describe('extractFromText — 基础行为', () => {
    it('AI 返回合同事实时应正确解析', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '双方于2024年1月15日签订合同，约定货款50万元',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
      ]);

      const result = await extractor.extractFromText(
        '双方于2024年1月15日签订合同，约定被告向原告采购货物，总价款50万元。',
        undefined,
        { minImportance: 5 }
      );

      expect(result.facts.length).toBeGreaterThan(0);
      const contractFact = result.facts.find(
        f => f.category === 'CONTRACT_TERM'
      );
      expect(contractFact).toBeDefined();
    });

    it('AI 返回违约事实时应正确解析', async () => {
      mockAIResponse([
        {
          category: 'BREACH_BEHAVIOR',
          description: '被告未按照合同约定时间付款，构成违约',
          importance: 9,
          confidence: 0.85,
          factType: 'EXPLICIT',
        },
      ]);

      const result = await extractor.extractFromText(
        '被告未按照合同约定时间付款，构成违约。'
      );

      expect(result.facts.length).toBeGreaterThan(0);
      expect(result.facts[0].category).toBe('BREACH_BEHAVIOR');
    });

    it('AI 返回损害事实时应正确解析', async () => {
      mockAIResponse([
        {
          category: 'DAMAGE_OCCURRENCE',
          description: '由于被告违约，造成原告经济损失5万元',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
      ]);

      const result = await extractor.extractFromText(
        '由于被告违约，造成原告经济损失5万元。'
      );

      expect(result.facts.length).toBeGreaterThan(0);
      const damageFact = result.facts.find(
        f => f.category === 'DAMAGE_OCCURRENCE'
      );
      expect(damageFact).toBeDefined();
    });

    it('AI 返回空结果时 facts 为空数组', async () => {
      mockAIResponse([]);

      const result = await extractor.extractFromText(
        '原告于2024年4月20日向法院提起诉讼。'
      );

      expect(result.facts).toEqual([]);
      expect(result.summary.total).toBe(0);
    });

    it('AI 失败时应直接抛出错误（不降级为规则兜底）', async () => {
      mockAIFailure('fetch failed: ECONNREFUSED');

      await expect(
        extractor.extractFromText('双方签订合同，约定货款50万元。')
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  describe('extractFromText — 字段校验', () => {
    it('importance 值应在 1-10 范围内', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '双方签订合同，约定货款50万元',
          importance: 7,
          confidence: 0.85,
          factType: 'EXPLICIT',
        },
      ]);

      const result =
        await extractor.extractFromText('双方签订合同，约定货款50万元。');

      result.facts.forEach(fact => {
        expect(fact.importance).toBeGreaterThanOrEqual(1);
        expect(fact.importance).toBeLessThanOrEqual(10);
      });
    });

    it('confidence 值应在 0-1 范围内', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '双方签订合同，约定货款50万元',
          importance: 7,
          confidence: 0.85,
          factType: 'EXPLICIT',
        },
      ]);

      const result =
        await extractor.extractFromText('双方签订合同，约定货款50万元。');

      result.facts.forEach(fact => {
        expect(fact.confidence).toBeGreaterThanOrEqual(0);
        expect(fact.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('每个 fact 应有唯一 id', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '双方签订合同',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
        {
          category: 'BREACH_BEHAVIOR',
          description: '被告违约',
          importance: 9,
          confidence: 0.85,
          factType: 'EXPLICIT',
        },
      ]);

      const result = await extractor.extractFromText(
        '双方签订合同。合同约定货款50万元。约定付款期限为30天。'
      );

      const ids = result.facts.map(f => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(result.facts.length);
    });
  });

  // =========================================================================
  describe('extractFromText — 过滤选项', () => {
    it('minImportance 应过滤低重要性事实', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '低重要性事实',
          importance: 3,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
        {
          category: 'BREACH_BEHAVIOR',
          description: '高重要性事实',
          importance: 9,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
      ]);

      const result = await extractor.extractFromText(
        '双方进行沟通协商。',
        undefined,
        {
          minImportance: 8,
        }
      );

      expect(result.facts.length).toBe(1);
      result.facts.forEach(fact => {
        expect(fact.importance).toBeGreaterThanOrEqual(8);
      });
    });

    it('minConfidence 应过滤低置信度事实', async () => {
      mockAIResponse([
        {
          category: 'LEGAL_RELATION',
          description: '低置信度事实',
          importance: 8,
          confidence: 0.5,
          factType: 'INFERRED',
        },
        {
          category: 'BREACH_BEHAVIOR',
          description: '高置信度事实',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
      ]);

      const result = await extractor.extractFromText(
        '双方可能进行了沟通。',
        undefined,
        {
          minConfidence: 0.8,
        }
      );

      expect(result.facts.length).toBe(1);
      result.facts.forEach(fact => {
        expect(fact.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('includeInferred: false 应过滤推断事实', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '明确事实',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
        {
          category: 'LEGAL_RELATION',
          description: '推断事实',
          importance: 6,
          confidence: 0.7,
          factType: 'INFERRED',
        },
      ]);

      const result = await extractor.extractFromText(
        '相关事实文本。',
        undefined,
        {
          includeInferred: false,
        }
      );

      const inferredFacts = result.facts.filter(f => f.factType === 'INFERRED');
      expect(inferredFacts.length).toBe(0);
    });
  });

  // =========================================================================
  describe('extractFromText — 摘要生成', () => {
    it('应生成正确的摘要统计', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '双方签订合同，约定货款50万元',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
        {
          category: 'BREACH_BEHAVIOR',
          description: '被告违约，造成原告损失',
          importance: 9,
          confidence: 0.85,
          factType: 'EXPLICIT',
        },
      ]);

      const result = await extractor.extractFromText(
        '双方签订合同，约定货款50万元，被告违约，造成原告损失。'
      );

      expect(result.summary.total).toBe(2);
      expect(result.summary.avgImportance).toBeGreaterThan(0);
      expect(result.summary.avgConfidence).toBeGreaterThan(0);
      expect(result.summary.ruleExtractedCount).toBe(0); // AI-only: 规则层固定为 0
    });

    it('空结果时摘要应为 0', async () => {
      mockAIResponse([]);

      const result =
        await extractor.extractFromText('这是一段没有关键事实的文本');

      expect(result.summary.total).toBe(0);
      expect(result.summary.avgImportance).toBe(0);
      expect(result.summary.avgConfidence).toBe(0);
    });
  });

  // =========================================================================
  describe('extractFromText — 事实关联', () => {
    it('应处理含争议焦点的 extractedData 而不报错', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '双方签订合同，约定货款50万元',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
      ]);

      const extractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [
          {
            id: 'focus_1',
            category: 'CONTRACT_BREACH' as DisputeFocusCategory,
            description: '合同违约争议',
            positionA: '原告认为被告违约',
            positionB: '被告辩称已履行',
            coreIssue: '是否违约',
            importance: 8,
            confidence: 0.8,
            relatedClaims: [],
            relatedFacts: [],
            evidence: ['民法典第509条'],
            legalBasis: '民法典第509条',
          },
        ],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(
        '双方签订合同，约定货款50万元，被告未付款。',
        extractedData
      );

      expect(result.facts).toBeDefined();
      expect(result.facts.length).toBeGreaterThan(0);
    });

    it('应处理空 extractedData 而不报错', async () => {
      mockAIResponse([]);

      const extractedData = {
        parties: [],
        claims: [],
        disputeFocuses: [],
        keyFacts: [],
      };

      const result = await extractor.extractFromText(
        '双方签订合同，约定货款50万元，被告未付款。',
        extractedData
      );

      expect(result.facts).toBeDefined();
      expect(Array.isArray(result.facts)).toBe(true);
    });
  });

  // =========================================================================
  describe('AI-only 契约验证', () => {
    it('AI 返回 CONTRACT_TERM 时应正确分类', async () => {
      mockAIResponse([
        {
          category: 'CONTRACT_TERM',
          description: '双方于2024年1月15日签订合同，约定货款50万元',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
      ]);

      const result = await extractor.extractFromText(
        '双方于2024年1月15日签订合同，约定货款50万元。'
      );

      const contractFacts = result.facts.filter(
        f => f.category === 'CONTRACT_TERM'
      );
      expect(contractFacts.length).toBeGreaterThan(0);
    });

    it('AI 返回 BREACH_BEHAVIOR 时应正确分类', async () => {
      mockAIResponse([
        {
          category: 'BREACH_BEHAVIOR',
          description: '被告未按约定付款，构成违约',
          importance: 9,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
      ]);

      const result =
        await extractor.extractFromText('被告未按约定付款，构成违约。');

      const breachFacts = result.facts.filter(
        f => f.category === 'BREACH_BEHAVIOR'
      );
      expect(breachFacts.length).toBeGreaterThan(0);
    });

    it('AI 返回 DAMAGE_OCCURRENCE 时应正确分类', async () => {
      mockAIResponse([
        {
          category: 'DAMAGE_OCCURRENCE',
          description: '由于被告违约，造成原告损失5万元',
          importance: 8,
          confidence: 0.9,
          factType: 'EXPLICIT',
        },
      ]);

      const result =
        await extractor.extractFromText('由于被告违约，造成原告损失5万元。');

      const damageFacts = result.facts.filter(
        f => f.category === 'DAMAGE_OCCURRENCE'
      );
      expect(damageFacts.length).toBeGreaterThan(0);
    });

    it('AI 返回空时不应有任何兜底结果', async () => {
      mockAIResponse([]);

      const result =
        await extractor.extractFromText('双方签订合同，约定货款50万元。');

      // AI-only: AI 不返回结果，则 facts 为空，无关键词兜底
      expect(result.facts.length).toBe(0);
    });
  });
});

// ===========================================================================
describe('extractKeyFactsFromText', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetUnifiedAIService.mockResolvedValue({
      chatCompletion: mockChatCompletion,
    });
  });

  it('AI 返回事实时应返回非空数组', async () => {
    mockChatCompletion
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                keyFacts: [
                  {
                    category: 'CONTRACT_TERM',
                    description: '双方签订合同，约定货款50万元',
                    importance: 8,
                    confidence: 0.9,
                    factType: 'EXPLICIT',
                  },
                ],
              }),
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reviewedFacts: [
                  {
                    id: 'ai_fact_0',
                    category: 'CONTRACT_TERM',
                    description: '双方签订合同，约定货款50万元',
                    importance: 8,
                    confidence: 0.9,
                    factType: 'EXPLICIT',
                  },
                ],
                invalidIds: [],
              }),
            },
          },
        ],
      });

    const facts =
      await extractKeyFactsFromText('双方签订合同，约定货款50万元。');

    expect(facts.length).toBeGreaterThan(0);
  });

  it('AI 返回空时应返回空数组', async () => {
    mockChatCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ keyFacts: [] }) } }],
    });

    const facts = await extractKeyFactsFromText('这是一段没有关键事实的文本');

    expect(Array.isArray(facts)).toBe(true);
    expect(facts.length).toBe(0);
  });
});
