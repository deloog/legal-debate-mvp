/**
 * 冲突传播规则测试
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ConflictPropagationRule } from '@/lib/knowledge-graph/reasoning/rules/conflict-propagation-rule';
import {
  ReasoningContext,
  ArticleNode,
  ArticleRelation,
} from '@/lib/knowledge-graph/reasoning/types';
import { RelationType } from '@prisma/client';

describe('ConflictPropagationRule', () => {
  let rule: ConflictPropagationRule;
  let context: ReasoningContext;

  beforeEach(() => {
    rule = new ConflictPropagationRule();

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
          status: 'REPEALED',
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
    ]);

    const relations = new Map<string, ArticleRelation>([
      [
        'rel-1',
        {
          id: 'rel-1',
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: RelationType.CITES,
          strength: 0.9,
          verificationStatus: 'VERIFIED',
        },
      ],
      [
        'rel-2',
        {
          id: 'rel-2',
          sourceId: 'article-3',
          targetId: 'article-2',
          relationType: RelationType.CITES,
          strength: 0.8,
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

    it('应该只适用于CITES关系类型', () => {
      expect(rule.metadata.applicableRelationTypes).toContain(
        RelationType.CITES
      );
      expect(rule.metadata.applicableRelationTypes.length).toBe(1);
    });
  });

  describe('冲突传播推理', () => {
    it('应该检测引用已失效法条的引用', async () => {
      const inferences = await rule.apply(context);

      // article-1引用了article-2（已失效）
      expect(inferences.length).toBeGreaterThan(0);

      const citationWarning = inferences.find(
        i =>
          i.sourceArticleId === 'article-1' && i.targetArticleId === 'article-2'
      );
      expect(citationWarning).toBeDefined();
      expect(citationWarning?.explanation).toContain('引用失效');
    });

    it('应该正确识别风险等级', async () => {
      const inferences = await rule.apply(context);

      // 高强度引用应该产生高风险警告
      const highRiskInference = inferences.find(i => i.confidence > 0.7);
      expect(highRiskInference).toBeDefined();
    });

    it('应该为受影响的法条生成警告', async () => {
      const inferences = await rule.apply(context);

      // article-1和article-3都引用了article-2
      const affectedArticles = new Set(inferences.map(i => i.sourceArticleId));
      expect(affectedArticles.has('article-1')).toBe(true);
      expect(affectedArticles.has('article-3')).toBe(true);
    });

    it('应该忽略未验证的引用关系', async () => {
      // 将两个引用关系都设置为未验证
      context.relations.set('rel-1', {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 0.9,
        verificationStatus: 'PENDING',
      });
      context.relations.set('rel-2', {
        id: 'rel-2',
        sourceId: 'article-3',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 0.8,
        verificationStatus: 'PENDING',
      });

      const inferences = await rule.apply(context);

      // 不应该产生警告
      expect(inferences).toHaveLength(0);
    });

    it('应该忽略指向有效法条的引用', async () => {
      context.nodes.set('article-2', {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '第2条',
        status: 'VALID',
      });

      const inferences = await rule.apply(context);

      // 不应该产生警告
      expect(inferences).toHaveLength(0);
    });

    it('应该根据引用强度调整置信度', async () => {
      context.relations.set('rel-1', {
        id: 'rel-1',
        sourceId: 'article-1',
        targetId: 'article-2',
        relationType: RelationType.CITES,
        strength: 1.0,
        verificationStatus: 'VERIFIED',
      });

      const inferences = await rule.apply(context);

      const highRiskInference = inferences.find(
        i => i.sourceArticleId === 'article-1'
      );
      expect(highRiskInference?.confidence).toBe(1.0);
    });
  });

  describe('推理说明', () => {
    it('应该生成清晰的警告说明', async () => {
      const inferences = await rule.apply(context);

      expect(inferences[0].explanation).toBeDefined();
      expect(inferences[0].explanation.length).toBeGreaterThan(0);
      expect(inferences[0].explanation).toContain('引用');
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

    it('应该处理没有引用关系的情况', async () => {
      const noCitationsContext: ReasoningContext = {
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
        ]),
        relations: new Map(),
        sourceArticleId: 'article-1',
        maxDepth: 3,
        visited: new Set(),
      };

      const inferences = await rule.apply(noCitationsContext);

      expect(inferences).toHaveLength(0);
    });

    it('应该处理所有法条都有效的情况', async () => {
      context.nodes.set('article-2', {
        id: 'article-2',
        lawName: '民法典',
        articleNumber: '第2条',
        status: 'VALID',
      });

      const inferences = await rule.apply(context);

      expect(inferences).toHaveLength(0);
    });
  });
});
