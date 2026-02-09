/**
 * 关系管理服务测试
 * 测试法条关系的CRUD操作和查询功能
 * @jest-environment node
 */

import { LawArticleRelationService } from '../../../lib/law-article/relation-service';
import { prisma } from '../../../lib/db/prisma';
import {
  RelationType,
  DiscoveryMethod,
  VerificationStatus,
  LawType,
  LawCategory,
  LawStatus,
} from '@prisma/client';
import type { LawArticle } from '@prisma/client';

describe('LawArticleRelationService', () => {
  let testArticle1: LawArticle;
  let testArticle2: LawArticle;
  let testArticle3: LawArticle;

  // 测试前准备：创建测试数据
  beforeAll(async () => {
    // 创建测试法条
    testArticle1 = await prisma.lawArticle.create({
      data: {
        lawName: '测试法A',
        articleNumber: '1',
        fullText: '这是测试法条A的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是测试法条A的内容',
      },
    });

    testArticle2 = await prisma.lawArticle.create({
      data: {
        lawName: '测试法B',
        articleNumber: '2',
        fullText: '这是测试法条B的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是测试法条B的内容',
      },
    });

    testArticle3 = await prisma.lawArticle.create({
      data: {
        lawName: '测试法C',
        articleNumber: '3',
        fullText: '这是测试法条C的内容',
        lawType: LawType.LAW,
        category: LawCategory.CIVIL,
        tags: [],
        keywords: [],
        effectiveDate: new Date('2020-01-01'),
        status: LawStatus.VALID,
        issuingAuthority: '全国人大',
        relatedArticles: [],
        searchableText: '这是测试法条C的内容',
      },
    });
  });

  // 测试后清理：删除测试数据
  afterAll(async () => {
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          {
            sourceId: {
              in: [testArticle1.id, testArticle2.id, testArticle3.id],
            },
          },
          {
            targetId: {
              in: [testArticle1.id, testArticle2.id, testArticle3.id],
            },
          },
        ],
      },
    });
    await prisma.lawArticle.deleteMany({
      where: {
        id: { in: [testArticle1.id, testArticle2.id, testArticle3.id] },
      },
    });
  });

  // 每个测试后清理关系数据
  afterEach(async () => {
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          {
            sourceId: {
              in: [testArticle1.id, testArticle2.id, testArticle3.id],
            },
          },
          {
            targetId: {
              in: [testArticle1.id, testArticle2.id, testArticle3.id],
            },
          },
        ],
      },
    });
  });

  describe('createRelation - 创建关系', () => {
    it('应该成功创建引用关系', async () => {
      const relation = await LawArticleRelationService.createRelation({
        sourceId: testArticle1.id,
        targetId: testArticle2.id,
        relationType: RelationType.CITES,
        confidence: 0.95,
        strength: 0.9,
        description: '测试引用关系',
        discoveryMethod: DiscoveryMethod.RULE_BASED,
      });

      expect(relation).toBeDefined();
      expect(relation.sourceId).toBe(testArticle1.id);
      expect(relation.targetId).toBe(testArticle2.id);
      expect(relation.relationType).toBe(RelationType.CITES);
      expect(relation.confidence).toBe(0.95);
      expect(relation.strength).toBe(0.9);
      expect(relation.discoveryMethod).toBe(DiscoveryMethod.RULE_BASED);
      expect(relation.verificationStatus).toBe(VerificationStatus.PENDING);
    });

    it('应该使用默认值创建关系', async () => {
      const relation = await LawArticleRelationService.createRelation({
        sourceId: testArticle1.id,
        targetId: testArticle2.id,
        relationType: RelationType.RELATED,
      });

      expect(relation.strength).toBe(1.0);
      expect(relation.confidence).toBe(1.0);
      expect(relation.discoveryMethod).toBe(DiscoveryMethod.MANUAL);
      expect(relation.verificationStatus).toBe(VerificationStatus.PENDING);
    });

    it('应该拒绝自引用关系', async () => {
      await expect(
        LawArticleRelationService.createRelation({
          sourceId: testArticle1.id,
          targetId: testArticle1.id,
          relationType: RelationType.CITES,
        })
      ).rejects.toThrow('禁止自引用');
    });

    it('应该拒绝不存在的源法条', async () => {
      await expect(
        LawArticleRelationService.createRelation({
          sourceId: 'non-existent-id',
          targetId: testArticle2.id,
          relationType: RelationType.CITES,
        })
      ).rejects.toThrow('源法条不存在');
    });

    it('应该拒绝不存在的目标法条', async () => {
      await expect(
        LawArticleRelationService.createRelation({
          sourceId: testArticle1.id,
          targetId: 'non-existent-id',
          relationType: RelationType.CITES,
        })
      ).rejects.toThrow('目标法条不存在');
    });

    it('应该支持创建带证据的关系', async () => {
      const evidence = {
        text: '根据《测试法B》第2条',
        position: 10,
        matchedPattern: '根据.*第\\d+条',
      };

      const relation = await LawArticleRelationService.createRelation({
        sourceId: testArticle1.id,
        targetId: testArticle2.id,
        relationType: RelationType.CITES,
        evidence,
      });

      expect(relation.evidence).toEqual(evidence);
    });

    it('应该支持创建所有类型的关系', async () => {
      const relationTypes = [
        RelationType.CITES,
        RelationType.CITED_BY,
        RelationType.CONFLICTS,
        RelationType.COMPLETES,
        RelationType.COMPLETED_BY,
        RelationType.SUPERSEDES,
        RelationType.SUPERSEDED_BY,
        RelationType.IMPLEMENTS,
        RelationType.IMPLEMENTED_BY,
        RelationType.RELATED,
      ];

      for (const relationType of relationTypes) {
        const relation = await LawArticleRelationService.createRelation({
          sourceId: testArticle1.id,
          targetId: testArticle2.id,
          relationType,
        });

        expect(relation.relationType).toBe(relationType);

        // 清理
        await prisma.lawArticleRelation.delete({ where: { id: relation.id } });
      }
    });
  });

  describe('batchCreateRelations - 批量创建关系', () => {
    it('应该成功批量创建多个关系', async () => {
      const relations = await LawArticleRelationService.batchCreateRelations([
        {
          sourceId: testArticle1.id,
          targetId: testArticle2.id,
          relationType: RelationType.CITES,
        },
        {
          sourceId: testArticle1.id,
          targetId: testArticle3.id,
          relationType: RelationType.RELATED,
        },
        {
          sourceId: testArticle2.id,
          targetId: testArticle3.id,
          relationType: RelationType.IMPLEMENTS,
        },
      ]);

      expect(relations).toHaveLength(3);
      expect(relations[0].sourceId).toBe(testArticle1.id);
      expect(relations[1].sourceId).toBe(testArticle1.id);
      expect(relations[2].sourceId).toBe(testArticle2.id);
    });

    it('应该处理部分失败的情况', async () => {
      const relations = await LawArticleRelationService.batchCreateRelations([
        {
          sourceId: testArticle1.id,
          targetId: testArticle2.id,
          relationType: RelationType.CITES,
        },
        {
          sourceId: testArticle1.id,
          targetId: testArticle1.id, // 自引用，应该失败
          relationType: RelationType.RELATED,
        },
        {
          sourceId: testArticle2.id,
          targetId: testArticle3.id,
          relationType: RelationType.IMPLEMENTS,
        },
      ]);

      // 应该成功创建2个，跳过1个失败的
      expect(relations.length).toBeGreaterThanOrEqual(2);
    });

    it('应该处理空数组', async () => {
      const relations = await LawArticleRelationService.batchCreateRelations(
        []
      );
      expect(relations).toHaveLength(0);
    });
  });

  describe('getArticleRelations - 获取法条关系', () => {
    beforeEach(async () => {
      // 创建测试关系
      await prisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: testArticle1.id,
            targetId: testArticle2.id,
            relationType: RelationType.CITES,
            strength: 0.9,
            confidence: 0.95,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
            verificationStatus: VerificationStatus.VERIFIED,
          },
          {
            sourceId: testArticle1.id,
            targetId: testArticle3.id,
            relationType: RelationType.RELATED,
            strength: 0.7,
            confidence: 0.8,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
            verificationStatus: VerificationStatus.PENDING,
          },
          {
            sourceId: testArticle2.id,
            targetId: testArticle1.id,
            relationType: RelationType.CITED_BY,
            strength: 0.9,
            confidence: 0.95,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
            verificationStatus: VerificationStatus.VERIFIED,
          },
        ],
      });
    });

    it('应该获取法条的所有关系（双向）', async () => {
      const result = await LawArticleRelationService.getArticleRelations(
        testArticle1.id
      );

      expect(result.articleId).toBe(testArticle1.id);
      expect(result.outgoingRelations).toHaveLength(2);
      expect(result.incomingRelations).toHaveLength(1);
      expect(result.totalRelations).toBe(3);
    });

    it('应该只获取出边关系', async () => {
      const result = await LawArticleRelationService.getArticleRelations(
        testArticle1.id,
        {
          direction: 'outgoing',
        }
      );

      expect(result.outgoingRelations).toHaveLength(2);
      expect(result.incomingRelations).toHaveLength(0);
      expect(result.totalRelations).toBe(2);
    });

    it('应该只获取入边关系', async () => {
      const result = await LawArticleRelationService.getArticleRelations(
        testArticle1.id,
        {
          direction: 'incoming',
        }
      );

      expect(result.outgoingRelations).toHaveLength(0);
      expect(result.incomingRelations).toHaveLength(1);
      expect(result.totalRelations).toBe(1);
    });

    it('应该按关系类型过滤', async () => {
      const result = await LawArticleRelationService.getArticleRelations(
        testArticle1.id,
        {
          relationType: RelationType.CITES,
        }
      );

      expect(result.outgoingRelations).toHaveLength(1);
      expect(result.outgoingRelations[0].relationType).toBe(RelationType.CITES);
    });

    it('应该按最小强度过滤', async () => {
      const result = await LawArticleRelationService.getArticleRelations(
        testArticle1.id,
        {
          minStrength: 0.8,
        }
      );

      expect(result.outgoingRelations).toHaveLength(1);
      expect(result.outgoingRelations[0].strength).toBeGreaterThanOrEqual(0.8);
    });

    it('应该按验证状态过滤', async () => {
      const result = await LawArticleRelationService.getArticleRelations(
        testArticle1.id,
        {
          verificationStatus: VerificationStatus.VERIFIED,
        }
      );

      expect(result.outgoingRelations).toHaveLength(1);
      expect(result.outgoingRelations[0].verificationStatus).toBe(
        VerificationStatus.VERIFIED
      );
    });

    it('应该组合多个过滤条件', async () => {
      const result = await LawArticleRelationService.getArticleRelations(
        testArticle1.id,
        {
          relationType: RelationType.CITES,
          minStrength: 0.8,
          verificationStatus: VerificationStatus.VERIFIED,
          direction: 'outgoing',
        }
      );

      expect(result.outgoingRelations).toHaveLength(1);
      expect(result.outgoingRelations[0].relationType).toBe(RelationType.CITES);
      expect(result.outgoingRelations[0].strength).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('findRelationPath - 查找关系路径', () => {
    beforeEach(async () => {
      // 创建关系链: A -> B -> C
      await prisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: testArticle1.id,
            targetId: testArticle2.id,
            relationType: RelationType.CITES,
            strength: 0.9,
            confidence: 0.95,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
          },
          {
            sourceId: testArticle2.id,
            targetId: testArticle3.id,
            relationType: RelationType.IMPLEMENTS,
            strength: 0.8,
            confidence: 0.9,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
          },
        ],
      });
    });

    it('应该找到直接关系路径', async () => {
      const paths = await LawArticleRelationService.findRelationPath(
        testArticle1.id,
        testArticle2.id
      );

      expect(paths).toHaveLength(1);
      expect(paths[0].source).toBe(testArticle1.id);
      expect(paths[0].target).toBe(testArticle2.id);
      expect(paths[0].length).toBe(1);
      expect(paths[0].path).toHaveLength(1);
    });

    it('应该找到间接关系路径', async () => {
      const paths = await LawArticleRelationService.findRelationPath(
        testArticle1.id,
        testArticle3.id
      );

      expect(paths).toHaveLength(1);
      expect(paths[0].source).toBe(testArticle1.id);
      expect(paths[0].target).toBe(testArticle3.id);
      expect(paths[0].length).toBe(2);
      expect(paths[0].path).toHaveLength(2);
    });

    it('应该在没有路径时返回空数组', async () => {
      const paths = await LawArticleRelationService.findRelationPath(
        testArticle3.id,
        testArticle1.id
      );

      expect(paths).toHaveLength(0);
    });

    it('应该限制最大深度', async () => {
      const paths = await LawArticleRelationService.findRelationPath(
        testArticle1.id,
        testArticle3.id,
        1 // 最大深度为1
      );

      expect(paths).toHaveLength(0); // 因为需要深度2才能到达
    });

    it('应该处理源和目标相同的情况', async () => {
      const paths = await LawArticleRelationService.findRelationPath(
        testArticle1.id,
        testArticle1.id
      );

      expect(paths).toHaveLength(0);
    });
  });

  describe('getRelationStats - 获取关系统计', () => {
    beforeEach(async () => {
      await prisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: testArticle1.id,
            targetId: testArticle2.id,
            relationType: RelationType.CITES,
            strength: 0.9,
            confidence: 0.95,
            discoveryMethod: DiscoveryMethod.RULE_BASED,
          },
          {
            sourceId: testArticle1.id,
            targetId: testArticle3.id,
            relationType: RelationType.CITES,
            strength: 0.8,
            confidence: 0.9,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
          },
          {
            sourceId: testArticle2.id,
            targetId: testArticle1.id,
            relationType: RelationType.RELATED,
            strength: 0.7,
            confidence: 0.8,
            discoveryMethod: DiscoveryMethod.MANUAL,
          },
        ],
      });
    });

    it('应该正确统计各类型关系数量', async () => {
      const stats = await LawArticleRelationService.getRelationStats(
        testArticle1.id
      );

      expect(stats.articleId).toBe(testArticle1.id);
      expect(stats.total).toBe(3);
      expect(stats.byType[RelationType.CITES]).toBe(2);
      expect(stats.byType[RelationType.RELATED]).toBe(1);
    });

    it('应该处理没有关系的法条', async () => {
      // 创建一个新的测试法条
      const newArticle = await prisma.lawArticle.create({
        data: {
          lawName: '测试法D',
          articleNumber: '4',
          fullText: '这是测试法条D的内容',
          lawType: LawType.LAW,
          category: LawCategory.CIVIL,
          tags: [],
          keywords: [],
          effectiveDate: new Date('2020-01-01'),
          status: LawStatus.VALID,
          issuingAuthority: '全国人大',
          relatedArticles: [],
          searchableText: '这是测试法条D的内容',
        },
      });

      const stats = await LawArticleRelationService.getRelationStats(
        newArticle.id
      );

      expect(stats.total).toBe(0);
      expect(Object.keys(stats.byType)).toHaveLength(0);

      // 清理
      await prisma.lawArticle.delete({ where: { id: newArticle.id } });
    });
  });

  describe('verifyRelation - 验证关系', () => {
    let testRelationId: string;

    beforeEach(async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1.id,
          targetId: testArticle2.id,
          relationType: RelationType.CITES,
          strength: 0.9,
          confidence: 0.95,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
          verificationStatus: VerificationStatus.PENDING,
        },
      });
      testRelationId = relation.id;
    });

    it('应该成功验证通过关系', async () => {
      const result = await LawArticleRelationService.verifyRelation(
        testRelationId,
        'admin-user-id',
        true
      );

      expect(result.verificationStatus).toBe(VerificationStatus.VERIFIED);
      expect(result.verifiedBy).toBe('admin-user-id');
      expect(result.verifiedAt).toBeDefined();
    });

    it('应该成功拒绝关系', async () => {
      const result = await LawArticleRelationService.verifyRelation(
        testRelationId,
        'admin-user-id',
        false
      );

      expect(result.verificationStatus).toBe(VerificationStatus.REJECTED);
      expect(result.verifiedBy).toBe('admin-user-id');
      expect(result.verifiedAt).toBeDefined();
    });

    it('应该处理不存在的关系ID', async () => {
      await expect(
        LawArticleRelationService.verifyRelation(
          'non-existent-id',
          'admin-user-id',
          true
        )
      ).rejects.toThrow();
    });
  });

  describe('deleteRelation - 删除关系', () => {
    let testRelationId: string;

    beforeEach(async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1.id,
          targetId: testArticle2.id,
          relationType: RelationType.CITES,
          strength: 0.9,
          confidence: 0.95,
          discoveryMethod: DiscoveryMethod.RULE_BASED,
        },
      });
      testRelationId = relation.id;
    });

    it('应该成功删除关系', async () => {
      await LawArticleRelationService.deleteRelation(testRelationId);

      const relation = await prisma.lawArticleRelation.findUnique({
        where: { id: testRelationId },
      });

      expect(relation).toBeNull();
    });

    it('应该处理不存在的关系ID', async () => {
      await expect(
        LawArticleRelationService.deleteRelation('non-existent-id')
      ).rejects.toThrow();
    });
  });

  describe('边界情况和性能测试', () => {
    it('应该处理大量关系的查询', async () => {
      // 创建100个关系
      const relations = Array.from({ length: 100 }, (_, i) => ({
        sourceId: testArticle1.id,
        targetId: i % 2 === 0 ? testArticle2.id : testArticle3.id,
        relationType: RelationType.RELATED,
        strength: 0.5 + Math.random() * 0.5,
        confidence: 0.5 + Math.random() * 0.5,
        discoveryMethod: DiscoveryMethod.MANUAL,
      }));

      await prisma.lawArticleRelation.createMany({ data: relations });

      const startTime = Date.now();
      const result = await LawArticleRelationService.getArticleRelations(
        testArticle1.id
      );
      const duration = Date.now() - startTime;

      expect(result.totalRelations).toBe(100);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });

    it('应该处理空字符串参数', async () => {
      await expect(
        LawArticleRelationService.createRelation({
          sourceId: '',
          targetId: testArticle2.id,
          relationType: RelationType.CITES,
        })
      ).rejects.toThrow();
    });

    it('应该处理极端的置信度和强度值', async () => {
      const relation = await LawArticleRelationService.createRelation({
        sourceId: testArticle1.id,
        targetId: testArticle2.id,
        relationType: RelationType.CITES,
        confidence: 0.0,
        strength: 0.0,
      });

      expect(relation.confidence).toBe(0.0);
      expect(relation.strength).toBe(0.0);
    });
  });
});
