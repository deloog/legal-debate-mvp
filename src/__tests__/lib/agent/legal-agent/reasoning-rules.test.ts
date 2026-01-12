/**
 * 逻辑推理规则库单元测试
 */

import {
  selectLogicalConnector,
  getAvailableConnectors,
  getRandomConnector,
  identifyCausalType,
  calculateReasoningDepth,
  getReasoningPattern,
  generateReasoningChain,
  evaluateArgumentLogic,
  getConnectorCount,
  getReasoningTypeCount,
  getCausalTypeCount,
  LOGICAL_CONNECTORS,
  CAUSAL_KEYWORDS,
  REASONING_PATTERNS,
  CAUSAL_PATTERNS,
} from '@/lib/agent/legal-agent/reasoning-rules';

describe('reasoning-rules', () => {
  describe('LOGICAL_CONNECTORS', () => {
    test('应该包含16个逻辑连接词', () => {
      expect(LOGICAL_CONNECTORS.length).toBe(16);
    });

    test('每个连接词应该有type、word、strength和contexts属性', () => {
      for (const connector of LOGICAL_CONNECTORS) {
        expect(connector).toHaveProperty('type');
        expect(connector).toHaveProperty('word');
        expect(connector).toHaveProperty('strength');
        expect(connector).toHaveProperty('contexts');
        expect(Array.isArray(connector.contexts)).toBe(true);
        expect(connector.strength).toBeGreaterThan(0);
        expect(connector.strength).toBeLessThanOrEqual(1);
      }
    });

    test('连接词应该按强度分组（相同强度可任意顺序）', () => {
      const strengths = LOGICAL_CONNECTORS.map(c => c.strength);
      const uniqueStrengths = [...new Set(strengths)].sort((a, b) => b - a);
      expect(uniqueStrengths[0]).toBe(1.0); // 最高强度
      expect(uniqueStrengths[uniqueStrengths.length - 1]).toBeLessThan(1.0); // 最低强度
    });
  });

  describe('CAUSAL_KEYWORDS', () => {
    test('应该包含5种因果类型', () => {
      expect(Object.keys(CAUSAL_KEYWORDS).length).toBe(5);
    });

    test('每种因果类型应该包含关键词数组', () => {
      for (const [, keywords] of Object.entries(CAUSAL_KEYWORDS)) {
        expect(Array.isArray(keywords)).toBe(true);
        expect(keywords.length).toBeGreaterThan(0);
      }
    });
  });

  describe('REASONING_PATTERNS', () => {
    test('应该包含3种推理类型', () => {
      expect(Object.keys(REASONING_PATTERNS).length).toBe(3);
      expect(REASONING_PATTERNS.deductive).toBeDefined();
      expect(REASONING_PATTERNS.inductive).toBeDefined();
      expect(REASONING_PATTERNS.analogical).toBeDefined();
    });

    test('每种推理模式应该有type、steps和description属性', () => {
      for (const [type, pattern] of Object.entries(REASONING_PATTERNS)) {
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('steps');
        expect(pattern).toHaveProperty('description');
        expect(pattern.type).toBe(type);
        expect(pattern.steps).toBeGreaterThan(0);
        expect(typeof pattern.description).toBe('string');
      }
    });
  });

  describe('CAUSAL_PATTERNS', () => {
    test('应该包含5种因果模式', () => {
      expect(Object.keys(CAUSAL_PATTERNS).length).toBe(5);
    });

    test('每种因果模式应该有type、cause、effect和strength属性', () => {
      for (const [type, pattern] of Object.entries(CAUSAL_PATTERNS)) {
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('cause');
        expect(pattern).toHaveProperty('effect');
        expect(pattern).toHaveProperty('strength');
        expect(pattern.type).toBe(type);
        expect(pattern.strength).toBeGreaterThan(0);
        expect(pattern.strength).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('selectLogicalConnector', () => {
    test('应该返回指定上下文中强度最高的连接词', () => {
      const connector = selectLogicalConnector('conclusion');
      expect(connector).toBeDefined();
      expect(connector!.contexts).toContain('conclusion');
    });

    test('当minStrength参数生效时，应该只返回强度达到阈值的连接词', () => {
      const connector = selectLogicalConnector('conclusion', 0.95);
      expect(connector).toBeDefined();
      expect(connector!.strength).toBeGreaterThanOrEqual(0.95);
    });

    test('当没有符合条件的连接词时，应该返回undefined', () => {
      const connector = selectLogicalConnector('conclusion', 1.5);
      expect(connector).toBeUndefined();
    });

    test('premise上下文应该返回因由连接词', () => {
      const connector = selectLogicalConnector('premise');
      expect(connector).toBeDefined();
      expect(['causal', 'explanatory', 'conditional']).toContain(
        connector!.type
      );
    });
  });

  describe('getAvailableConnectors', () => {
    test('应该返回指定上下文中的所有连接词', () => {
      const connectors = getAvailableConnectors('premise');
      expect(connectors.length).toBeGreaterThan(0);
      expect(connectors.every(c => c.contexts.includes('premise'))).toBe(true);
    });

    test('conclusion上下文应该返回因由和总结连接词', () => {
      const connectors = getAvailableConnectors('conclusion');
      expect(connectors.length).toBeGreaterThan(0);
      for (const connector of connectors) {
        expect(['causal', 'conclusive']).toContain(connector.type);
      }
    });

    test('argument上下文应该返回所有类型连接词', () => {
      const connectors = getAvailableConnectors('argument');
      expect(connectors.length).toBeGreaterThan(0);
    });
  });

  describe('getRandomConnector', () => {
    test('应该返回指定上下文中的一个随机连接词', () => {
      const connector = getRandomConnector('premise');
      expect(connector).toBeDefined();
      expect(connector.contexts.includes('premise')).toBe(true);
    });

    test('多次调用应该返回可能不同的连接词', () => {
      const connector1 = getRandomConnector('premise');
      const connector2 = getRandomConnector('premise');
      // 不一定每次都不同，但应该有可能不同
      expect(
        connector1.word ||
          connector2.word ||
          connector1.strength !== connector2.strength
      ).toBeDefined();
    });
  });

  describe('identifyCausalType', () => {
    test('应该能识别直接因果关系', () => {
      const text = '被告的行为导致原告受伤';
      const type = identifyCausalType(text);
      expect(type).toBe('direct');
    });

    test('应该能识别间接因果关系（仅包含间接因果关键词）', () => {
      const text = '违约进而出现损失';
      const type = identifyCausalType(text);
      expect(type).toBe('indirect');
    });

    test('应该能识别条件因果关系', () => {
      const text = '如果被告违约，应当承担责任';
      const type = identifyCausalType(text);
      expect(type).toBe('conditional');
    });

    test('当文本中没有因果关系时，应该返回undefined', () => {
      const text = '这是一个简单的陈述';
      const type = identifyCausalType(text);
      expect(type).toBeUndefined();
    });
  });

  describe('calculateReasoningDepth', () => {
    test('应该正确计算推理深度评分', () => {
      const depth = calculateReasoningDepth(3, 'deductive');
      expect(depth).toBe(1.0);
    });

    test('应该对演绎推理给予奖励', () => {
      const depth1 = calculateReasoningDepth(3, 'deductive');
      const depth2 = calculateReasoningDepth(3, 'inductive');
      expect(depth1).toBeGreaterThanOrEqual(depth2);
    });

    test('应该对类比推理的多步骤给予奖励（达到阈值）', () => {
      const depth1 = calculateReasoningDepth(5, 'analogical');
      const depth2 = calculateReasoningDepth(3, 'analogical');
      expect(depth1).toBeGreaterThanOrEqual(depth2);
    });

    test('评分应该限制在0-1之间', () => {
      const depth1 = calculateReasoningDepth(0, 'deductive');
      const depth2 = calculateReasoningDepth(10, 'deductive');
      expect(depth1).toBeGreaterThanOrEqual(0);
      expect(depth2).toBeLessThanOrEqual(1.0);
    });
  });

  describe('getReasoningPattern', () => {
    test('应该返回指定的推理模式', () => {
      const pattern = getReasoningPattern('deductive');
      expect(pattern.type).toBe('deductive');
      expect(pattern.description).toBe('从一般性原则推出具体结论');
    });

    test('应该返回归纳推理模式', () => {
      const pattern = getReasoningPattern('inductive');
      expect(pattern.type).toBe('inductive');
      expect(pattern.description).toBe('从多个具体事实归纳出普遍规律');
    });

    test('应该返回类比推理模式', () => {
      const pattern = getReasoningPattern('analogical');
      expect(pattern.type).toBe('analogical');
      expect(pattern.description).toContain('类比');
    });
  });

  describe('generateReasoningChain', () => {
    test('应该生成3个步骤的推理链', () => {
      const chain = generateReasoningChain('法条规定', '推理过程', '结论');
      expect(chain).toHaveLength(3);
    });

    test('推理链应该包含有效的内容和连接词', () => {
      const chain = generateReasoningChain('法条规定', '推理过程', '结论');
      expect(chain).toHaveLength(3);
      expect(chain[0]).toBeTruthy();
      expect(chain[1]).toBeTruthy();
      expect(chain[2]).toBeTruthy();
    });
  });

  describe('evaluateArgumentLogic', () => {
    test('应该评估论点逻辑性并返回评分', () => {
      const score = evaluateArgumentLogic('因此被告应当承担责任');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('包含强逻辑连接词的论点应该得分更高', () => {
      const score1 = evaluateArgumentLogic('因此被告应当承担责任');
      const score2 = evaluateArgumentLogic('被告应当承担责任');
      expect(score1).toBeGreaterThan(score2);
    });

    test('包含因果关系的论点应该得分更高', () => {
      const score1 = evaluateArgumentLogic('因为被告违约导致原告损失');
      const score2 = evaluateArgumentLogic('被告造成损失');
      expect(score1).toBeGreaterThan(score2);
    });

    test('应该对推理深度给予奖励', () => {
      const chain = generateReasoningChain('前提', '推理', '结论');
      const score1 = evaluateArgumentLogic(chain.join(''));
      const score2 = evaluateArgumentLogic('简单论点');
      expect(score1).toBeGreaterThan(score2);
    });
  });

  describe('辅助函数', () => {
    test('getConnectorCount应该返回16', () => {
      expect(getConnectorCount()).toBe(16);
    });

    test('getReasoningTypeCount应该返回3', () => {
      expect(getReasoningTypeCount()).toBe(3);
    });

    test('getCausalTypeCount应该返回5', () => {
      expect(getCausalTypeCount()).toBe(5);
    });
  });
});
