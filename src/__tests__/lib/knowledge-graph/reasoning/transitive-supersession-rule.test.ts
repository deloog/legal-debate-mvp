/**
 * 传递性替代规则测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TransitiveSupersessionRule } from '@/lib/knowledge-graph/reasoning/rules/transitive-supersession-rule';
import {
  ReasoningContext,
  ArticleNode,
  ArticleRelation,
} from '@/lib/knowledge-graph/reasoning/types';
import { RelationType } from '@prisma/client';

describe('TransitiveSupersessionRule', () => {
  let rule: TransitiveSupersessionRule;
  let context: ReasoningContext;

  beforeEach(() => {
    rule = new TransitiveSupersessionRule();

    // 创建测试数据
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
      [
        'article-2',
        {
          id: 'article-2',
          lawName: '民法典',
          articleNumber: '第2条',
          status: 'VALID',
        },
      ],
      [
        'article-3',
        {
          id: 'article-3',
          lawName: '民法典',
          articleNumber: '第3条',
          status: 'VALID',
        },
      ],
      [
        'article-4',
        {
          id: 'article-4',
          lawName: '民法典',
          articleNumber: '第4条',
          status: 'VALID',
        },
      ],
    ]);

    const relations = new Map<string, ArticleRelation>([
      [
        'rel-1',
        {
          id: 'rel-1',
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: RelationType.SUPERSEDES,
          strength: 0.9,
          verificationStatus: 'VERIFIED',
        },
      ],
      [
        'rel-2',
        {
          id: 'rel-2',
          sourceId: 'article-2',
          targetId: 'article-3',
          relationType: RelationType.SUPERSEDES,
          strength: 0.9,
          verificationStatus: 'VERIFIED',
        },
      ],
      [
        'rel-3',
        {
          id: 'rel-3',
          sourceId: 'article-3',
          targetId: 'article-4',
          relationType: RelationType.SUPERSEDES,
          strength: 0.9,
          verificationStatus: 'VERIFIED',
        },
      ],
    ]);

    context = {
      nodes,
      relations,
      sourceArticleId: 'article-1',
      maxDepth: 3,
      visited: new Set(),
    };
  });

  describe('规则元数据', () => {
    it('应该具有正确的规则类型', () => {
      expect(rule.metadata.type).toBeDefined();
    });

    it('应该具有正确的优先级', () => {
      expect(rule.metadata.priority).toBeDefined();
    });

    it('应该只适用于SUPERSEDES关系类型', () => {
      expect(rule.metadata.applicableRelationTypes).toContain(
        RelationType.SUPERSEDES
      );
      expect(rule.metadata.applicableRelationTypes.length).toBe(1);
    });
  });

  describe('传递性替代推理', () => {
    it('应该正确推断间接替代关系（2跳）', async () => {
      const inferences = await rule.apply(context);

      // 查找2跳的推断（路径长度为3）
      const twoHopInference = inferences.find(
        i => i.reasoningPath.length === 3
      );
      expect(twoHopInference).toBeDefined();
      expect(twoHopInference?.sourceArticleId).toBe('article-1');
      expect(twoHopInference?.targetArticleId).toBe('article-3');
      expect(twoHopInference?.inferredRelation).toBe(RelationType.SUPERSEDES);
      expect(twoHopInference?.reasoningPath).toEqual([
        'article-1',
        'article-2',
        'article-3',
      ]);
    });

    it('应该正确计算置信度（关系强度乘积）', async () => {
      const inferences = await rule.apply(context);

      expect(inferences[0].confidence).toBe(0.81); // 0.9 * 0.9 = 0.81
    });

    it('应该支持多跳传递（3跳）', async () => {
      context.maxDepth = 4;

      const inferences = await rule.apply(context);

      // 应该推断出article-1间接替代article-3和article-4
      expect(inferences.length).toBeGreaterThan(0);

      const inferenceToArticle4 = inferences.find(
        i => i.targetArticleId === 'article-4'
      );
      expect(inferenceToArticle4).toBeDefined();
      expect(inferenceToArticle4?.reasoningPath).toContain('article-4');
    });

    it('应该尊重最大深度限制', async () => {
      context.maxDepth = 2;

      const inferences = await rule.apply(context);

      // 深度为2时，只应该推断1跳的间接关系
      const maxPathLength = Math.max(
        ...inferences.map(i => i.reasoningPath.length)
      );
      expect(maxPathLength).toBeLessThanOrEqual(3); // 源 + 2跳 = 3个节点
    });

    it('应该防止循环引用', async () => {
      // 添加循环关系：article-4 -> article-1
      context.relations.set('rel-4', {
        id: 'rel-4',
        sourceId: 'article-4',
        targetId: 'article-1',
        relationType: RelationType.SUPERSEDES,
        strength: 0.9,
        verificationStatus: 'VERIFIED',
      });

      const inferences = await rule.apply(context);

      // 不应该产生无限循环
      expect(inferences.length).toBeLessThan(10);
    });

    it('应该忽略未验证的关系', async () => {
      // 将一个关系设置为未验证状态
      context.relations.set('rel-1', {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.SUPERSEDES,
        strength: 0.9,
        verificationStatus: 'PENDING',
      });

      const inferences = await rule.apply(context);

      // 应该不产生推断结果
      expect(inferences).toHaveLength(0);
    });

    it('应该忽略低强度关系（< 0.5）', async () => {
      // 将一个关系设置为低强度
      context.relations.set('rel-1', {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.SUPERSEDES,
        strength: 0.3,
        verificationStatus: 'VERIFIED',
      });

      const inferences = await rule.apply(context);

      // 应该不产生推断结果
      expect(inferences).toHaveLength(0);
    });

    it('应该正确处理不存在的节点', async () => {
      context.nodes.delete('article-2');

      const inferences = await rule.apply(context);

      // 应该优雅地处理缺失节点
      expect(inferences).toHaveLength(0);
    });
  });

  describe('推理说明', () => {
    it('应该生成清晰的推理说明', async () => {
      const inferences = await rule.apply(context);

      expect(inferences[0].explanation).toBeDefined();
      expect(inferences[0].explanation.length).toBeGreaterThan(0);
      expect(inferences[0].explanation).toContain('间接替代');
    });
  });

  describe('边界情况', () => {
    it('应该处理空的关系图', async () => {
      const emptyContext: ReasoningContext = {
        nodes: new Map(),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const inferences = await rule.apply(emptyContext);

      expect(inferences).toHaveLength(0);
    });

    it('应该处理只有1跳关系的情况', async () => {
      const singleHopContext: ReasoningContext = {
        nodes: new Map([
          [
            'article-1',
            {
              id: 'article-1',
              lawName: '民法典',
              articleNumber: '第1条',
              status: 'VALID',
            },
          ],
          [
            'article-2',
            {
              id: 'article-2',
              lawName: '民法典',
              articleNumber: '第2条',
              status: 'VALID',
            },
          ],
        ]),
        relations: new Map([
          [
            'rel-1',
            {
              id: 'rel-1',
              sourceId: 'article-1',
              targetId: 'article-2',
              relationType: RelationType.SUPERSEDES,
              strength: 0.9,
              verificationStatus: 'VERIFIED',
            },
          ],
        ]),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const inferences = await rule.apply(singleHopContext);

      // 1跳关系无法推断间接替代
      expect(inferences).toHaveLength(0);
    });
  });
});
