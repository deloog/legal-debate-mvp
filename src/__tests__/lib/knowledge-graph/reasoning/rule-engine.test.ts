/**
 * 规则引擎核心测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RuleEngine } from '@/lib/knowledge-graph/reasoning/rule-engine';
import {
  RuleType,
  RulePriority,
  ArticleRelation,
  ArticleNode,
  ReasoningContext,
  RuleExecutionOptions,
} from '@/lib/knowledge-graph/reasoning/types';
import { RelationType } from '@prisma/client';

describe('RuleEngine', () => {
  let ruleEngine: RuleEngine;

  beforeEach(() => {
    ruleEngine = new RuleEngine();
  });

  describe('规则注册和管理', () => {
    it('应该成功注册规则', () => {
      const mockRule = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '传递性替代规则',
          description: 'A替代B，B替代C → A间接替代C',
          priority: RulePriority.HIGH,
          enabled: true,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async (_context: ReasoningContext) => [],
      };

      ruleEngine.registerRule(mockRule);
      const rules = ruleEngine.getRegisteredRules();

      expect(rules).toHaveLength(1);
      expect(rules[0].metadata.type).toBe(RuleType.TRANSITIVE_SUPERSESSION);
    });

    it('应该支持多个规则注册', () => {
      const mockRule1 = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '传递性替代规则',
          description: '测试规则1',
          priority: RulePriority.HIGH,
          enabled: true,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async () => [],
      };

      const mockRule2 = {
        metadata: {
          type: RuleType.CONFLICT_PROPAGATION,
          name: '冲突传播规则',
          description: '测试规则2',
          priority: RulePriority.MEDIUM,
          enabled: true,
          applicableRelationTypes: [RelationType.CITES],
        },
        apply: async () => [],
      };

      ruleEngine.registerRule(mockRule1);
      ruleEngine.registerRule(mockRule2);

      const rules = ruleEngine.getRegisteredRules();
      expect(rules).toHaveLength(2);
    });

    it('应该支持规则启用/禁用', () => {
      const mockRule = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '传递性替代规则',
          description: '测试规则',
          priority: RulePriority.HIGH,
          enabled: true,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async () => [],
      };

      ruleEngine.registerRule(mockRule);
      ruleEngine.setRuleEnabled(RuleType.TRANSITIVE_SUPERSESSION, false);

      const rules = ruleEngine.getRegisteredRules();
      expect(rules[0].metadata.enabled).toBe(false);
    });

    it('应该按优先级排序规则', () => {
      const mockRuleHigh = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '高优先级规则',
          description: '测试',
          priority: RulePriority.HIGH,
          enabled: true,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async () => [],
      };

      const mockRuleLow = {
        metadata: {
          type: RuleType.CONFLICT_PROPAGATION,
          name: '低优先级规则',
          description: '测试',
          priority: RulePriority.LOW,
          enabled: true,
          applicableRelationTypes: [RelationType.CITES],
        },
        apply: async () => [],
      };

      ruleEngine.registerRule(mockRuleLow);
      ruleEngine.registerRule(mockRuleHigh);

      const rules = ruleEngine.getRegisteredRules();
      expect(rules[0].metadata.priority).toBe(RulePriority.HIGH);
      expect(rules[1].metadata.priority).toBe(RulePriority.LOW);
    });
  });

  describe('规则执行', () => {
    it('应该成功执行单个规则', async () => {
      const mockRule = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '传递性替代规则',
          description: '测试',
          priority: RulePriority.HIGH,
          enabled: true,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async (_context: ReasoningContext) => {
          return [
            {
              ruleType: RuleType.TRANSITIVE_SUPERSESSION,
              sourceArticleId: 'article-1',
              targetArticleId: 'article-3',
              inferredRelation: RelationType.SUPERSEDES,
              confidence: 0.81,
              reasoningPath: ['article-1', 'article-2', 'article-3'],
              explanation: 'A间接替代C',
            },
          ];
        },
      };

      ruleEngine.registerRule(mockRule);

      const context: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const result = await ruleEngine.applyRule(
        RuleType.TRANSITIVE_SUPERSESSION,
        context
      );

      expect(result.success).toBe(true);
      expect(result.inferences).toHaveLength(1);
      expect(result.inferences[0].confidence).toBe(0.81);
    });

    it('应该处理规则执行失败', async () => {
      const mockRule = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '失败规则',
          description: '测试',
          priority: RulePriority.HIGH,
          enabled: true,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async (_context: ReasoningContext) => {
          throw new Error('规则执行失败');
        },
      };

      ruleEngine.registerRule(mockRule);

      const context: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const result = await ruleEngine.applyRule(
        RuleType.TRANSITIVE_SUPERSESSION,
        context
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('应该不执行已禁用的规则', async () => {
      const mockRule = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '禁用规则',
          description: '测试',
          priority: RulePriority.HIGH,
          enabled: false,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async (_context: ReasoningContext) => {
          throw new Error('不应执行');
        },
      };

      ruleEngine.registerRule(mockRule);

      const context: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const result = await ruleEngine.applyRule(
        RuleType.TRANSITIVE_SUPERSESSION,
        context
      );

      expect(result.success).toBe(true);
      expect(result.inferences).toHaveLength(0);
    });
  });

  describe('推理执行', () => {
    beforeEach(() => {
      const mockRule1 = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '传递性替代',
          description: '测试',
          priority: RulePriority.HIGH,
          enabled: true,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async () => [
          {
            ruleType: RuleType.TRANSITIVE_SUPERSESSION,
            sourceArticleId: 'article-1',
            targetArticleId: 'article-3',
            inferredRelation: RelationType.SUPERSEDES,
            confidence: 0.9,
            reasoningPath: ['article-1', 'article-2', 'article-3'],
            explanation: 'A间接替代C',
          },
        ],
      };

      const mockRule2 = {
        metadata: {
          type: RuleType.CONFLICT_PROPAGATION,
          name: '冲突传播',
          description: '测试',
          priority: RulePriority.MEDIUM,
          enabled: true,
          applicableRelationTypes: [RelationType.CITES],
        },
        apply: async () => [
          {
            ruleType: RuleType.CONFLICT_PROPAGATION,
            sourceArticleId: 'article-1',
            targetArticleId: 'article-4',
            inferredRelation: RelationType.CITES,
            confidence: 0.5,
            reasoningPath: ['article-1', 'article-4'],
            explanation: '引用冲突',
          },
        ],
      };

      ruleEngine.registerRule(mockRule1);
      ruleEngine.registerRule(mockRule2);
    });

    it('应该成功执行完整推理流程', async () => {
      const context: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const options: RuleExecutionOptions = {
        maxDepth: 3,
        minConfidence: 0.3,
        includeMediumConfidence: true,
        includeLowConfidence: false,
      };

      const result = await ruleEngine.runReasoning(context, options);

      expect(result.sourceArticleId).toBe('article-1');
      expect(result.inferences).toHaveLength(2);
      expect(result.summary.totalInferences).toBe(2);
      expect(result.summary.highConfidenceInferences).toBe(1);
      expect(result.summary.mediumConfidenceInferences).toBe(1);
    });

    it('应该根据置信度过滤结果', async () => {
      const context: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const options: RuleExecutionOptions = {
        maxDepth: 3,
        minConfidence: 0.8, // 只保留高置信度
        includeMediumConfidence: false,
        includeLowConfidence: false,
      };

      const result = await ruleEngine.runReasoning(context, options);

      expect(result.inferences).toHaveLength(1);
      expect(result.inferences[0].confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('应该支持指定应用的规则类型', async () => {
      const context: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const options: RuleExecutionOptions = {
        maxDepth: 3,
        minConfidence: 0.3,
        includeMediumConfidence: true,
        includeLowConfidence: false,
      };

      const result = await ruleEngine.runReasoning(context, options, [
        RuleType.TRANSITIVE_SUPERSESSION,
      ]);

      expect(result.inferences).toHaveLength(1);
      expect(result.appliedRules).toContain(RuleType.TRANSITIVE_SUPERSESSION);
      expect(result.appliedRules).not.toContain(RuleType.CONFLICT_PROPAGATION);
    });

    it('应该正确生成推理摘要', async () => {
      const context: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const options: RuleExecutionOptions = {
        maxDepth: 3,
        minConfidence: 0.3,
        includeMediumConfidence: true,
        includeLowConfidence: false,
      };

      const result = await ruleEngine.runReasoning(context, options);

      expect(result.summary.inferencesByRule).toBeDefined();
      expect(
        result.summary.inferencesByRule[RuleType.TRANSITIVE_SUPERSESSION]
      ).toBe(1);
      expect(
        result.summary.inferencesByRule[RuleType.CONFLICT_PROPAGATION]
      ).toBe(1);
    });
  });

  describe('上下文管理', () => {
    it('应该正确初始化推理上下文', () => {
      const nodes = new Map<string, ArticleNode>([
        [
          'article-1',
          {
            id: 'article-1',
            lawName: '民法典',
            articleNumber: '第1条',
            status: 'VALID',
          },
        ],
      ]);

      const relations = new Map<string, ArticleRelation>();

      const context = ruleEngine.createContext(
        nodes,
        relations,
        'article-1',
        5
      );

      expect(context.sourceArticleId).toBe('article-1');
      expect(context.maxDepth).toBe(5);
      expect(context.visited).toBeInstanceOf(Set);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内完成推理', async () => {
      const mockRule = {
        metadata: {
          type: RuleType.TRANSITIVE_SUPERSESSION,
          name: '性能测试规则',
          description: '测试',
          priority: RulePriority.HIGH,
          enabled: true,
          applicableRelationTypes: [RelationType.SUPERSEDES],
        },
        apply: async () => [],
      };

      ruleEngine.registerRule(mockRule);

      const context: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const startTime = Date.now();
      await ruleEngine.runReasoning(context);
      const executionTime = Date.now() - startTime;

      expect(executionTime).toBeLessThan(1000); // 小于1秒
    });
  });
});
