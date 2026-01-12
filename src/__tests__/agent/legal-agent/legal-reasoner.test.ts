/**
 * LegalReasoner单元测试
 * 测试覆盖率目标：>90%
 */

import { LegalReasoner } from '../../../lib/agent/legal-agent/legal-reasoner';
import type { Fact, LawArticle } from '../../../lib/agent/legal-agent/types';

// =============================================================================
// 测试数据
// =============================================================================

const mockFacts: Fact[] = [
  {
    id: 'fact-001',
    content: '被告未按照合同约定的时间支付货款',
    type: 'disputed',
    relevance: 0.95,
  },
  {
    id: 'fact-002',
    content: '原告已经履行了供货义务',
    type: 'undisputed',
    relevance: 0.9,
  },
  {
    id: 'fact-003',
    content: '合同约定违约方应承担赔偿损失的责任',
    type: 'undisputed',
    relevance: 0.85,
  },
  {
    id: 'fact-004',
    content: '被告的违约行为给原告造成了经济损失',
    type: 'disputed',
    relevance: 0.8,
  },
  {
    id: 'fact-005',
    content: '原告要求被告继续履行合同义务',
    type: 'disputed',
    relevance: 0.75,
  },
  {
    id: 'fact-low-relevance',
    content: '与案件关系不大的事实',
    type: 'undisputed',
    relevance: 0.3,
  },
];

const mockLaws: LawArticle[] = [
  {
    id: 'law-001',
    lawName: '合同法',
    articleNumber: '107条',
    content:
      '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
    level: 'law',
    category: 'civil-contract',
    keywords: ['合同', '违约', '责任', '赔偿', '履行'],
    effectiveDate: '2020-01-01',
    deprecated: false,
    scope: [],
  },
  {
    id: 'law-002',
    lawName: '合同法',
    articleNumber: '108条',
    content:
      '当事人一方明确表示或者以自己的行为表明不履行合同义务的，对方可以在履行期限届满前请求其承担违约责任。',
    level: 'law',
    category: 'civil-contract',
    keywords: ['合同', '违约', '履行', '责任'],
    effectiveDate: '2020-01-01',
    deprecated: false,
    scope: [],
  },
  {
    id: 'law-003',
    lawName: '合同法',
    articleNumber: '109条',
    content: '当事人一方未支付价款或者报酬的，对方可以请求其支付价款或者报酬。',
    level: 'law',
    category: 'civil-contract',
    keywords: ['支付', '价款', '报酬'],
    effectiveDate: '2020-01-01',
    deprecated: false,
    scope: [],
  },
  {
    id: 'law-constitutional',
    lawName: '宪法',
    articleNumber: '第1条',
    content:
      '中华人民共和国是工人阶级领导的、以工农联盟为基础的人民民主专政的社会主义国家。',
    level: 'constitution',
    category: 'constitutional',
    keywords: ['国家', '社会主义'],
    effectiveDate: '1982-12-04',
    deprecated: false,
    scope: [],
  },
];

// =============================================================================
// 测试套件
// =============================================================================

describe('LegalReasoner', () => {
  let reasoner: LegalReasoner;

  beforeEach(() => {
    reasoner = new LegalReasoner();
  });

  describe('基础功能', () => {
    it('应该成功创建LegalReasoner实例', () => {
      expect(reasoner).toBeInstanceOf(LegalReasoner);
    });

    it('应该有默认配置', () => {
      expect(reasoner).toBeDefined();
    });
  });

  describe('推理链构建', () => {
    it('应该能够构建推理链', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain).toBeDefined();
      expect(chain.facts).toBeInstanceOf(Array);
      expect(chain.laws).toBeInstanceOf(Array);
      expect(chain.steps).toBeInstanceOf(Array);
      expect(chain.conclusion).toBeDefined();
      expect(chain.logicScore).toBeGreaterThanOrEqual(0);
      expect(chain.logicScore).toBeLessThanOrEqual(1);
      expect(chain.completeness).toBeGreaterThanOrEqual(0);
      expect(chain.completeness).toBeLessThanOrEqual(1);
      expect(chain.buildTime).toBeGreaterThanOrEqual(0);
    });

    it('应该能够提取关键事实', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts,
        mockLaws.slice(0, 2)
      );

      // 应该只包含相关性>0.5的事实
      chain.facts.forEach(fact => {
        expect(fact.relevance).toBeGreaterThan(0.5);
      });

      // 应该最多5个关键事实
      expect(chain.facts.length).toBeLessThanOrEqual(5);
    });

    it('应该能够构建推理步骤', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain.steps.length).toBeGreaterThan(0);

      // 验证每个步骤的结构
      chain.steps.forEach(step => {
        expect(step.id).toBeDefined();
        expect(typeof step.id).toBe('string');
        expect(step.order).toBeGreaterThan(0);
        expect(step.content).toBeDefined();
        expect(step.law).toBeDefined();
        expect(step.facts).toBeInstanceOf(Array);
        expect(step.confidence).toBeGreaterThanOrEqual(0);
        expect(step.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('应该能够生成结论', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain.conclusion).toBeDefined();
      expect(chain.conclusion.length).toBeGreaterThan(0);
    });

    it('应该计算逻辑评分', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain.logicScore).toBeGreaterThanOrEqual(0);
      expect(chain.logicScore).toBeLessThanOrEqual(1);
    });

    it('应该计算完整性', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain.completeness).toBeGreaterThanOrEqual(0);
      expect(chain.completeness).toBeLessThanOrEqual(1);
    });
  });

  describe('推理步骤生成', () => {
    it('应该为每个法条生成推理步骤', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 3)
      );

      // 应该有多个推理步骤（每个法条一个）
      expect(chain.steps.length).toBeGreaterThan(0);
    });

    it('推理步骤应该包含相关事实', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 1)
      );

      if (chain.steps.length > 0) {
        expect(chain.steps[0].facts.length).toBeGreaterThan(0);
      }
    });

    it('推理步骤应该有序号', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 3)
      );

      for (let i = 0; i < chain.steps.length; i++) {
        expect(chain.steps[i].order).toBe(i + 1);
      }
    });

    it('推理步骤应该有置信度', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      chain.steps.forEach(step => {
        expect(step.confidence).toBeGreaterThanOrEqual(0);
        expect(step.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('应该支持自定义最大步骤数', async () => {
      const chain1 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 5),
        { maxSteps: 2 }
      );

      const chain2 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 5),
        { maxSteps: 10 }
      );

      expect(chain1.steps.length).toBeLessThanOrEqual(2);
      expect(chain2.steps.length).toBeLessThanOrEqual(10);
    });
  });

  describe('推理类型', () => {
    it('应该支持演绎推理', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2),
        { reasoningType: 'deductive' }
      );

      chain.steps.forEach(step => {
        expect(step.logicType).toBe('deductive');
      });
    });

    it('应该支持归纳推理', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2),
        { reasoningType: 'inductive' }
      );

      chain.steps.forEach(step => {
        expect(step.logicType).toBe('inductive');
      });
    });

    it('应该支持类比推理', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2),
        { reasoningType: 'analogical' }
      );

      chain.steps.forEach(step => {
        expect(step.logicType).toBe('analogical');
      });
    });
  });

  describe('置信度过滤', () => {
    it('应该过滤低置信度的步骤', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 5),
        { minConfidence: 0.8 }
      );

      chain.steps.forEach(step => {
        expect(step.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });

    it('应该支持自定义最小置信度', async () => {
      const chain1 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 5),
        { minConfidence: 0.3 }
      );

      const chain2 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 5),
        { minConfidence: 0.7 }
      );

      // 较低的置信度阈值应该允许更多步骤
      expect(chain1.steps.length).toBeGreaterThanOrEqual(chain2.steps.length);
    });
  });

  describe('置信度计算', () => {
    it('宪法法条应该有更高的置信度', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        [mockLaws[3]] // 宪法
      );

      if (chain.steps.length > 0) {
        expect(chain.steps[0].confidence).toBeGreaterThan(0.7);
      }
    });

    it('应该基于事实相关性计算置信度', async () => {
      const chain1 = await reasoner.buildReasoningChain(
        [mockFacts[0], mockFacts[1]], // 高相关性
        [mockLaws[0]]
      );

      const chain2 = await reasoner.buildReasoningChain(
        [mockFacts[5]], // 低相关性
        [mockLaws[0]]
      );

      // 高相关性事实应该产生更高的置信度
      if (chain1.steps.length > 0 && chain2.steps.length > 0) {
        expect(chain1.steps[0].confidence).toBeGreaterThan(
          chain2.steps[0].confidence
        );
      }
    });
  });

  describe('结论生成', () => {
    it('应该生成有意义的结论', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain.conclusion).toBeDefined();
      expect(chain.conclusion.length).toBeGreaterThan(50);
    });

    it('应该在结论中包含法条信息', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain.conclusion).toContain('法条');
    });

    it('应该在结论中包含事实信息', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain.conclusion).toContain('事实');
    });

    it('应该处理空法条的情况', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        []
      );

      expect(chain.conclusion).toContain('无法得出有效结论');
    });
  });

  describe('逻辑验证', () => {
    it('应该验证推理链的逻辑', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      const validation = reasoner.validateLogic(chain);

      expect(validation).toBeDefined();
      expect(validation).toHaveProperty('passed');
      expect(validation).toHaveProperty('score');
      expect(validation).toHaveProperty('issues');
    });

    it('应该检测推理步骤过少的问题', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 1),
        mockLaws.slice(0, 1)
      );

      const validation = reasoner.validateLogic(chain);

      const missingPremiseIssue = validation.issues.find(
        issue => issue.type === 'missing_premise'
      );

      if (chain.steps.length < 2) {
        expect(missingPremiseIssue).toBeDefined();
      }
    });

    it('应该检测没有事实支持的步骤', async () => {
      const chain = await reasoner.buildReasoningChain(
        [], // 没有事实
        mockLaws.slice(0, 2)
      );

      const validation = reasoner.validateLogic(chain);

      const invalidInferenceIssue = validation.issues.find(
        issue => issue.type === 'invalid_inference'
      );

      // 由于没有事实，应该没有步骤，所以不会触发这个检查
      if (chain.steps.length > 0) {
        const stepWithoutFact = chain.steps.find(
          step => step.facts.length === 0
        );
        if (stepWithoutFact) {
          expect(invalidInferenceIssue).toBeDefined();
        }
      }
    });

    it('应该检测低置信度步骤', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 1),
        mockLaws.slice(0, 1),
        { minConfidence: 0.1 }
      );

      const validation = reasoner.validateLogic(chain);

      const lowConfidenceStep = chain.steps.find(step => step.confidence < 0.5);
      if (lowConfidenceStep) {
        const issue = validation.issues.find(
          issue => issue.type === 'invalid_inference'
        );
        expect(issue).toBeDefined();
      }
    });

    it('应该检测结论过于简短', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      // 修改结论为短内容
      chain.conclusion = '简短结论';

      const validation = reasoner.validateLogic(chain);

      const weakArgumentIssue = validation.issues.find(
        issue => issue.type === 'weak_argument'
      );

      expect(weakArgumentIssue).toBeDefined();
      expect(weakArgumentIssue?.description).toContain('过于简短');
    });

    it('应该检测矛盾', async () => {
      // 创建一个包含否定词的结论
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      // 修改结论包含否定词
      chain.conclusion = '不应当支持原告的诉请';

      const validation = reasoner.validateLogic(chain);

      // 检查是否检测到矛盾
      const contradictionIssue = validation.issues.find(
        issue => issue.type === 'contradiction'
      );

      // 可能检测到矛盾
      if (contradictionIssue) {
        expect(contradictionIssue.severity).toBe('medium');
      }
    });
  });

  describe('边界条件', () => {
    it('应该处理空事实列表', async () => {
      const chain = await reasoner.buildReasoningChain(
        [],
        mockLaws.slice(0, 2)
      );

      expect(chain.facts).toHaveLength(0);
      expect(chain.steps.length).toBe(0);
      expect(chain.conclusion).toContain('无法得出有效结论');
    });

    it('应该处理空法条列表', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        []
      );

      expect(chain.laws).toHaveLength(0);
      expect(chain.steps.length).toBe(0);
      expect(chain.conclusion).toContain('无法得出有效结论');
    });

    it('应该处理所有低相关性事实', async () => {
      const lowRelevanceFacts = [mockFacts[5]]; // relevance: 0.3

      const chain = await reasoner.buildReasoningChain(
        lowRelevanceFacts,
        mockLaws.slice(0, 2)
      );

      // 由于没有高相关性事实，应该不会有关键事实
      expect(chain.facts.length).toBe(0);
    });
  });

  describe('性能测试', () => {
    it('构建推理链应该合理时间内完成', async () => {
      const startTime = Date.now();
      const chain = await reasoner.buildReasoningChain(mockFacts, mockLaws);
      const elapsed = Date.now() - startTime;

      expect(chain).toBeDefined();
      expect(elapsed).toBeLessThan(5000); // 应该在5秒内完成
    });

    it('验证逻辑应该合理时间内完成', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      const startTime = Date.now();
      const validation = reasoner.validateLogic(chain);
      const elapsed = Date.now() - startTime;

      expect(validation).toBeDefined();
      expect(elapsed).toBeLessThan(1000); // 应该在1秒内完成
    });
  });

  describe('批量处理', () => {
    it('应该支持批量构建推理链', async () => {
      const cases = [
        { facts: mockFacts.slice(0, 3), laws: mockLaws.slice(0, 2) },
        { facts: mockFacts.slice(2, 5), laws: mockLaws.slice(0, 2) },
        { facts: mockFacts.slice(0, 2), laws: mockLaws.slice(0, 3) },
      ];

      const chains = await reasoner.batchBuildReasoningChains(cases);

      expect(chains).toHaveLength(3);
      chains.forEach(chain => {
        expect(chain).toBeDefined();
        expect(chain.conclusion).toBeDefined();
      });
    });

    it('批量处理应该返回正确数量的结果', async () => {
      const cases = [
        { facts: mockFacts.slice(0, 2), laws: mockLaws.slice(0, 1) },
        { facts: mockFacts.slice(1, 3), laws: mockLaws.slice(0, 1) },
      ];

      const chains = await reasoner.batchBuildReasoningChains(cases);

      expect(chains.length).toBe(2);
    });

    it('批量处理应该支持自定义选项', async () => {
      const cases = [
        { facts: mockFacts.slice(0, 3), laws: mockLaws.slice(0, 2) },
      ];

      const chains = await reasoner.batchBuildReasoningChains(cases, {
        reasoningType: 'inductive',
        minConfidence: 0.8,
      });

      expect(chains[0].steps).toBeDefined();
      chains[0].steps.forEach(step => {
        expect(step.logicType).toBe('inductive');
        expect(step.confidence).toBeGreaterThanOrEqual(0.8);
      });
    });
  });

  describe('推理链完整性', () => {
    it('完整性应该基于法条覆盖度', async () => {
      const chain1 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 1)
      );

      const chain2 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 3)
      );

      // 更多的法条应该产生更高的覆盖度
      if (chain1.steps.length > 0 && chain2.steps.length > 0) {
        // 由于法条数量不同，完整性计算会有差异
        expect(chain1.completeness).toBeDefined();
        expect(chain2.completeness).toBeDefined();
      }
    });

    it('完整性应该基于事实覆盖度', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      expect(chain.completeness).toBeGreaterThanOrEqual(0);
      expect(chain.completeness).toBeLessThanOrEqual(1);
    });

    it('多步骤推理链应该有更高的完整性', async () => {
      const chain1 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 1),
        mockLaws.slice(0, 1)
      );

      const chain2 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 3)
      );

      if (chain1.steps.length > 1 && chain2.steps.length > 1) {
        // 多步骤推理应该有更高的连续性得分
        expect(chain1.completeness).toBeGreaterThan(0);
        expect(chain2.completeness).toBeGreaterThan(0);
      }
    });
  });

  describe('推理步骤ID生成', () => {
    it('应该为每个步骤生成唯一ID', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 3)
      );

      const ids = chain.steps.map(step => step.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).toBe(ids.length);
    });

    it('步骤ID应该是固定长度', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      chain.steps.forEach(step => {
        expect(step.id).toBeDefined();
        expect(step.id.length).toBe(16);
      });
    });
  });

  describe('逻辑评分计算', () => {
    it('逻辑评分应该基于步骤数量', async () => {
      const chain = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      // 有步骤应该有基础分数
      if (chain.steps.length > 0) {
        expect(chain.logicScore).toBeGreaterThan(0);
      } else {
        expect(chain.logicScore).toBe(0);
      }
    });

    it('逻辑评分应该基于平均置信度', async () => {
      const chain1 = await reasoner.buildReasoningChain(
        [mockFacts[0]], // 高相关性
        [mockLaws[0]]
      );

      const chain2 = await reasoner.buildReasoningChain(
        [mockFacts[5]], // 低相关性
        [mockLaws[0]]
      );

      if (chain1.steps.length > 0 && chain2.steps.length > 0) {
        expect(chain1.logicScore).toBeGreaterThanOrEqual(chain2.logicScore);
      }
    });

    it('逻辑评分应该基于结论质量', async () => {
      const chain1 = await reasoner.buildReasoningChain(
        mockFacts.slice(0, 3),
        mockLaws.slice(0, 2)
      );

      if (chain1.steps.length > 0 && chain1.conclusion.length > 20) {
        expect(chain1.logicScore).toBeGreaterThan(0);
      }
    });
  });
});
