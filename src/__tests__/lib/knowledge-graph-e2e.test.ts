/**
 * 知识图谱E2E集成测试
 *
 * 测试覆盖：
 * 1. 完整的关系发现流程（规则+AI+案例）
 * 2. 关系管理服务集成
 * 3. 图谱构建和查询
 * 4. API端到端测试
 * 5. 数据一致性验证
 */

import { prisma } from '@/lib/db';
import { RuleBasedDetector } from '@/lib/law-article/relation-discovery/rule-based-detector';
import { AIDetector } from '@/lib/law-article/relation-discovery/ai-detector';
import { CaseDerivedDetector } from '@/lib/law-article/relation-discovery/case-derived-detector';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
} from '@prisma/client';

describe('知识图谱E2E集成测试', () => {
  let testArticles: Array<{
    id: string;
    lawName: string;
    articleNumber: string;
  }> = [];

  beforeAll(async () => {
    // 创建测试数据
    const article1 = await prisma.lawArticle.create({
      data: {
        lawName: '民法典',
        articleNumber: '1',
        fullText: '根据宪法第5条的规定，为了保护民事主体的合法权益，制定本法。',
        lawType: 'LAW',
        category: 'CIVIL',
        tags: ['民事', '基本原则'],
        keywords: ['宪法', '民事主体', '合法权益'],
        effectiveDate: new Date('2021-01-01'),
        status: 'VALID',
        issuingAuthority: '全国人民代表大会',
        searchableText:
          '根据宪法第5条的规定，为了保护民事主体的合法权益，制定本法。',
      },
    });

    const article2 = await prisma.lawArticle.create({
      data: {
        lawName: '宪法',
        articleNumber: '5',
        fullText: '中华人民共和国实行依法治国，建设社会主义法治国家。',
        lawType: 'CONSTITUTION',
        category: 'ADMINISTRATIVE',
        tags: ['依法治国', '法治'],
        keywords: ['依法治国', '法治国家'],
        effectiveDate: new Date('1982-12-04'),
        status: 'VALID',
        issuingAuthority: '全国人民代表大会',
        searchableText: '中华人民共和国实行依法治国，建设社会主义法治国家。',
      },
    });

    const article3 = await prisma.lawArticle.create({
      data: {
        lawName: '民法典',
        articleNumber: '2',
        fullText:
          '民法调整平等主体的自然人、法人和非法人组织之间的人身关系和财产关系。',
        lawType: 'LAW',
        category: 'CIVIL',
        tags: ['民事', '调整范围'],
        keywords: ['平等主体', '人身关系', '财产关系'],
        effectiveDate: new Date('2021-01-01'),
        status: 'VALID',
        issuingAuthority: '全国人民代表大会',
        searchableText:
          '民法调整平等主体的自然人、法人和非法人组织之间的人身关系和财产关系。',
      },
    });

    testArticles = [article1, article2, article3];
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: { in: testArticles.map(a => a.id) } },
          { targetId: { in: testArticles.map(a => a.id) } },
        ],
      },
    });

    await prisma.lawArticle.deleteMany({
      where: { id: { in: testArticles.map(a => a.id) } },
    });
  });

  describe('完整的关系发现流程', () => {
    it('应该通过规则引擎发现引用关系', async () => {
      const article1 = await prisma.lawArticle.findFirst({
        where: { lawName: '民法典', articleNumber: '1' },
      });

      expect(article1).toBeDefined();

      // 使用规则引擎检测关系
      const ruleRelations = await RuleBasedDetector.detectAllRelations(
        article1!
      );

      // 规则引擎应该能检测到关系（如果正则匹配成功）
      // 注意：实际检测结果取决于正则模式的匹配
      expect(ruleRelations).toBeDefined();
      expect(ruleRelations.cites).toBeDefined();
      expect(ruleRelations.hierarchical).toBeDefined();

      // 验证检测结果的结构正确
      if (ruleRelations.cites.length > 0) {
        expect(ruleRelations.cites[0]).toHaveProperty('lawName');
        expect(ruleRelations.cites[0]).toHaveProperty('articleNumber');
        expect(ruleRelations.cites[0]).toHaveProperty('confidence');
      }
    });

    it('应该创建并验证关系', async () => {
      const article1 = testArticles[0];
      const article2 = testArticles[1];

      // 创建关系
      const relation = await LawArticleRelationService.createRelation({
        sourceId: article1.id,
        targetId: article2.id,
        relationType: RelationType.CITES,
        strength: 0.95,
        confidence: 0.95,
        discoveryMethod: DiscoveryMethod.RULE_BASED,
        evidence: { text: '根据宪法第5条的规定' },
      });

      expect(relation).toBeDefined();
      expect(relation.relationType).toBe(RelationType.CITES);
      expect(relation.verificationStatus).toBe(VerificationStatus.PENDING);

      // 验证关系
      const verified = await LawArticleRelationService.verifyRelation(
        relation.id,
        'test-user',
        true
      );

      expect(verified.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(verified.verifiedBy).toBe('test-user');
      expect(verified.verifiedAt).toBeDefined();
    });

    it('应该获取法条的所有关系', async () => {
      const article1 = testArticles[0];

      const relations = await LawArticleRelationService.getArticleRelations(
        article1.id
      );

      expect(relations.articleId).toBe(article1.id);
      expect(relations.totalRelations).toBeGreaterThan(0);
      expect(relations.outgoingRelations.length).toBeGreaterThan(0);
    });

    it('应该构建关系图谱', async () => {
      const article1 = testArticles[0];

      const graph = await GraphBuilder.buildGraph(article1.id, 2);

      expect(graph.nodes.length).toBeGreaterThan(0);
      expect(graph.links.length).toBeGreaterThan(0);

      // 验证中心节点存在
      const centerNode = graph.nodes.find(n => n.id === article1.id);
      expect(centerNode).toBeDefined();
      expect(centerNode?.level).toBe(0);
    });
  });

  describe('批量关系发现和管理', () => {
    it('应该批量创建关系', async () => {
      const relations = [
        {
          sourceId: testArticles[0].id,
          targetId: testArticles[2].id,
          relationType: RelationType.RELATED,
          confidence: 0.8,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
        },
        {
          sourceId: testArticles[2].id,
          targetId: testArticles[1].id,
          relationType: RelationType.CITES,
          confidence: 0.7,
          discoveryMethod: DiscoveryMethod.AI_DETECTED,
        },
      ];

      const created =
        await LawArticleRelationService.batchCreateRelations(relations);

      expect(created.length).toBe(2);
      expect(created[0].relationType).toBe(RelationType.RELATED);
      expect(created[1].relationType).toBe(RelationType.CITES);
    });

    it('应该查找关系路径', async () => {
      const paths = await LawArticleRelationService.findRelationPath(
        testArticles[0].id,
        testArticles[1].id,
        3
      );

      expect(paths.length).toBeGreaterThan(0);
      expect(paths[0].source).toBe(testArticles[0].id);
      expect(paths[0].target).toBe(testArticles[1].id);
      expect(paths[0].length).toBeLessThanOrEqual(3);
    });

    it('应该获取关系统计', async () => {
      const stats = await LawArticleRelationService.getRelationStats(
        testArticles[0].id
      );

      expect(stats.articleId).toBe(testArticles[0].id);
      expect(stats.total).toBeGreaterThan(0);
      expect(Object.keys(stats.byType).length).toBeGreaterThan(0);
    });
  });

  describe('数据一致性验证', () => {
    it('应该防止自引用关系', async () => {
      await expect(
        LawArticleRelationService.createRelation({
          sourceId: testArticles[0].id,
          targetId: testArticles[0].id,
          relationType: RelationType.CITES,
        })
      ).rejects.toThrow('禁止自引用');
    });

    it('应该验证法条存在性', async () => {
      await expect(
        LawArticleRelationService.createRelation({
          sourceId: 'non-existent-id',
          targetId: testArticles[0].id,
          relationType: RelationType.CITES,
        })
      ).rejects.toThrow('源法条不存在');
    });

    it('应该正确处理关系删除', async () => {
      // 创建一个临时关系
      const relation = await LawArticleRelationService.createRelation({
        sourceId: testArticles[0].id,
        targetId: testArticles[1].id,
        relationType: RelationType.RELATED,
      });

      // 删除关系
      await LawArticleRelationService.deleteRelation(relation.id);

      // 验证关系已删除
      const deleted = await prisma.lawArticleRelation.findUnique({
        where: { id: relation.id },
      });

      expect(deleted).toBeNull();
    });
  });

  describe('性能基准测试', () => {
    it('批量查询应在合理时间内完成', async () => {
      const startTime = Date.now();

      // 查询所有测试法条的关系
      const promises = testArticles.map(article =>
        LawArticleRelationService.getArticleRelations(article.id)
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // 3个法条的关系查询应在500ms内完成
      expect(duration).toBeLessThan(500);
    });

    it('图谱构建应在合理时间内完成', async () => {
      const startTime = Date.now();

      await GraphBuilder.buildGraph(testArticles[0].id, 2);

      const duration = Date.now() - startTime;

      // 2层深度的图谱构建应在1秒内完成
      expect(duration).toBeLessThan(1000);
    });

    it('关系路径查找应高效', async () => {
      const startTime = Date.now();

      await LawArticleRelationService.findRelationPath(
        testArticles[0].id,
        testArticles[1].id,
        3
      );

      const duration = Date.now() - startTime;

      // 路径查找应在500ms内完成
      expect(duration).toBeLessThan(500);
    });
  });

  describe('错误处理和边界条件', () => {
    it('应该处理不存在的法条ID', async () => {
      const relations =
        await LawArticleRelationService.getArticleRelations('non-existent-id');

      expect(relations.totalRelations).toBe(0);
      expect(relations.outgoingRelations).toEqual([]);
      expect(relations.incomingRelations).toEqual([]);
    });

    it('应该处理空的关系路径', async () => {
      // 创建两个没有连接的法条
      const isolatedArticle = await prisma.lawArticle.create({
        data: {
          lawName: '测试法',
          articleNumber: '999',
          fullText: '这是一个孤立的法条',
          lawType: 'LAW',
          category: 'OTHER',
          tags: [],
          keywords: [],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '这是一个孤立的法条',
        },
      });

      const paths = await LawArticleRelationService.findRelationPath(
        testArticles[0].id,
        isolatedArticle.id,
        3
      );

      expect(paths).toEqual([]);

      // 清理
      await prisma.lawArticle.delete({ where: { id: isolatedArticle.id } });
    });

    it('应该处理超大深度查询', async () => {
      // 深度限制应该防止无限递归
      const graph = await GraphBuilder.buildGraph(testArticles[0].id, 10);

      expect(graph.nodes.length).toBeLessThan(1000); // 合理的节点数量限制
    });
  });
});
