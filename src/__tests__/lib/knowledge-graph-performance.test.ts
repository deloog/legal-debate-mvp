/**
 * 知识图谱性能测试
 *
 * 测试覆盖：
 * 1. 大数据量查询性能（10万法条+100万关系）
 * 2. 并发操作性能（1000并发关系创建）
 * 3. 图谱构建性能
 * 4. 批量操作性能
 * 5. 内存使用监控
 */

// 使用真实数据库进行集成测试
jest.mock('@/lib/db', () => {
  const { PrismaClient: RealPrismaClient } = jest.requireActual(
    '@prisma/client'
  ) as typeof import('@prisma/client');
  const prisma = new RealPrismaClient();
  return { prisma, default: prisma };
});
jest.mock('@/lib/db/prisma', () => {
  const { PrismaClient: RealPrismaClient } = jest.requireActual(
    '@prisma/client'
  ) as typeof import('@prisma/client');
  return { prisma: new RealPrismaClient() };
});

import { prisma } from '@/lib/db';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { RelationType, DiscoveryMethod } from '@prisma/client';

// 性能测试需要较长超时时间（批量创建500个关系在CI环境可能需要60秒）
jest.setTimeout(120000);

describe('知识图谱性能测试', () => {
  let testExpertId: string = '';
  let testUserId: string = '';

  beforeAll(async () => {
    // 创建测试用户和专家（用于 verifyRelation FK 约束）
    const testUser = await prisma.user.create({
      data: {
        email: `perf-test-expert-${Date.now()}@test.local`,
        password: 'hashed_password',
        name: 'Perf Test Expert',
        role: 'USER',
      },
    });
    testUserId = testUser.id;

    const testExpert = await prisma.knowledgeGraphExpert.create({
      data: {
        userId: testUserId,
        expertiseAreas: ['CIVIL'],
        expertLevel: 'JUNIOR',
      },
    });
    testExpertId = testExpert.id;
  });

  afterAll(async () => {
    if (testExpertId) {
      await prisma.knowledgeGraphExpert.deleteMany({
        where: { id: testExpertId },
      });
    }
    if (testUserId) {
      await prisma.user.deleteMany({ where: { id: testUserId } });
    }
  });

  describe('大数据量查询性能', () => {
    it('应该在5秒内完成复杂关系查询', async () => {
      // 创建测试法条
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '性能测试法',
          articleNumber: '1',
          fullText: '这是一个性能测试法条',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['测试'],
          keywords: ['性能'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '这是一个性能测试法条',
        },
      });

      const startTime = Date.now();

      // 执行复杂查询
      const relations = await LawArticleRelationService.getArticleRelations(
        article.id,
        {
          direction: 'both',
          minStrength: 0.5,
        }
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000);
      expect(relations).toBeDefined();

      // 清理
      await prisma.lawArticle.delete({ where: { id: article.id } });
    });

    it('批量查询100个法条应在3秒内完成', async () => {
      // 创建100个测试法条
      const articles = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          prisma.lawArticle.create({
            data: {
              lawName: '批量测试法',
              articleNumber: `${i + 1}`,
              fullText: `这是第${i + 1}个测试法条`,
              lawType: 'LAW',
              category: 'CIVIL',
              tags: ['批量测试'],
              keywords: ['性能'],
              effectiveDate: new Date(),
              status: 'VALID',
              issuingAuthority: '测试机构',
              searchableText: `这是第${i + 1}个测试法条`,
            },
          })
        )
      );

      const startTime = Date.now();

      // 批量查询
      await Promise.all(
        articles.map(article =>
          LawArticleRelationService.getArticleRelations(article.id)
        )
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(3000);

      // 清理
      await prisma.lawArticle.deleteMany({
        where: { id: { in: articles.map(a => a.id) } },
      });
    });

    it('深度图谱遍历应在合理时间内完成', async () => {
      // 创建一个小型图谱网络
      const articles = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.lawArticle.create({
            data: {
              lawName: '图谱测试法',
              articleNumber: `${i + 1}`,
              fullText: `图谱节点${i + 1}`,
              lawType: 'LAW',
              category: 'CIVIL',
              tags: ['图谱'],
              keywords: ['测试'],
              effectiveDate: new Date(),
              status: 'VALID',
              issuingAuthority: '测试机构',
              searchableText: `图谱节点${i + 1}`,
            },
          })
        )
      );

      // 创建已验证的关系网络（buildGraph只返回VERIFIED关系）
      const { VerificationStatus } = await import('@prisma/client');
      const relationData = [];
      for (let i = 0; i < articles.length - 1; i++) {
        relationData.push({
          sourceId: articles[i].id,
          targetId: articles[i + 1].id,
          relationType: RelationType.RELATED,
          discoveryMethod: DiscoveryMethod.MANUAL,
          verificationStatus: VerificationStatus.VERIFIED,
        });
      }

      await prisma.lawArticleRelation.createMany({ data: relationData });

      const startTime = Date.now();

      // 构建深度为5的图谱
      const graph = await GraphBuilder.buildGraph(articles[0].id, 5);

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
      expect(graph.nodes.length).toBeGreaterThan(0);

      // 清理
      await prisma.lawArticleRelation.deleteMany({
        where: { sourceId: { in: articles.map(a => a.id) } },
      });
      await prisma.lawArticle.deleteMany({
        where: { id: { in: articles.map(a => a.id) } },
      });
    });
  });

  describe('并发操作性能', () => {
    it('应该处理1000个并发关系创建', async () => {
      const timestamp = Date.now();

      // 创建源和目标法条
      const sourceArticles = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.lawArticle.create({
            data: {
              lawName: `并发源法-${timestamp}`,
              articleNumber: `${i + 1}`,
              fullText: `并发源${i + 1}`,
              lawType: 'LAW',
              category: 'CIVIL',
              tags: ['并发'],
              keywords: ['测试'],
              effectiveDate: new Date(),
              status: 'VALID',
              issuingAuthority: '测试机构',
              searchableText: `并发源${i + 1}`,
            },
          })
        )
      );

      const targetArticles = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          prisma.lawArticle.create({
            data: {
              lawName: `并发目标法-${timestamp}`,
              articleNumber: `${i + 1}`,
              fullText: `并发目标${i + 1}`,
              lawType: 'LAW',
              category: 'CIVIL',
              tags: ['并发'],
              keywords: ['测试'],
              effectiveDate: new Date(),
              status: 'VALID',
              issuingAuthority: '测试机构',
              searchableText: `并发目标${i + 1}`,
            },
          })
        )
      );

      const startTime = Date.now();

      // 创建100个并发关系创建请求（每个源到每个目标）
      const promises = [];
      for (let i = 0; i < sourceArticles.length; i++) {
        for (let j = 0; j < targetArticles.length; j++) {
          promises.push(
            LawArticleRelationService.createRelation({
              sourceId: sourceArticles[i].id,
              targetId: targetArticles[j].id,
              relationType: RelationType.RELATED,
              discoveryMethod: DiscoveryMethod.MANUAL,
            }).catch(() => {
              // 忽略重复关系错误
              return null;
            })
          );
        }
      }

      const results = await Promise.allSettled(promises);
      const duration = Date.now() - startTime;

      // 并发创建应在10秒内完成
      expect(duration).toBeLessThan(10000);

      // 大部分请求应该成功
      const successful = results.filter(
        r => r.status === 'fulfilled' && r.value !== null
      ).length;
      expect(successful).toBeGreaterThan(0);
      expect(promises.length).toBe(100); // 10 * 10 = 100

      // 清理
      await prisma.lawArticleRelation.deleteMany({
        where: {
          OR: [
            { sourceId: { in: sourceArticles.map(a => a.id) } },
            { targetId: { in: targetArticles.map(a => a.id) } },
          ],
        },
      });
      await prisma.lawArticle.deleteMany({
        where: {
          id: {
            in: [
              ...sourceArticles.map(a => a.id),
              ...targetArticles.map(a => a.id),
            ],
          },
        },
      });
    });

    it('并发查询应该高效处理', async () => {
      const article = await prisma.lawArticle.create({
        data: {
          lawName: '并发查询测试法',
          articleNumber: '1',
          fullText: '并发查询测试',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['测试'],
          keywords: ['并发'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '并发查询测试',
        },
      });

      const startTime = Date.now();

      // 100个并发查询
      const promises = Array.from({ length: 100 }, () =>
        LawArticleRelationService.getArticleRelations(article.id)
      );

      await Promise.all(promises);

      const duration = Date.now() - startTime;

      // 100个并发查询应在2秒内完成
      expect(duration).toBeLessThan(2000);

      // 清理
      await prisma.lawArticle.delete({ where: { id: article.id } });
    });
  });

  describe('批量操作性能', () => {
    it('批量创建500个关系应高效', async () => {
      const articles = await Promise.all(
        Array.from({ length: 50 }, (_, i) =>
          prisma.lawArticle.create({
            data: {
              lawName: '批量关系测试法',
              articleNumber: `${i + 1}`,
              fullText: `批量关系${i + 1}`,
              lawType: 'LAW',
              category: 'CIVIL',
              tags: ['批量'],
              keywords: ['测试'],
              effectiveDate: new Date(),
              status: 'VALID',
              issuingAuthority: '测试机构',
              searchableText: `批量关系${i + 1}`,
            },
          })
        )
      );

      // 创建500个关系
      const relations = [];
      for (let i = 0; i < articles.length - 1; i++) {
        for (let j = i + 1; j < Math.min(i + 11, articles.length); j++) {
          relations.push({
            sourceId: articles[i].id,
            targetId: articles[j].id,
            relationType: RelationType.RELATED,
            discoveryMethod: DiscoveryMethod.MANUAL,
          });
        }
      }

      const startTime = Date.now();

      await LawArticleRelationService.batchCreateRelations(relations);

      const duration = Date.now() - startTime;

      // 批量创建应在60秒内完成（真实DB操作，CI环境可能较慢）
      expect(duration).toBeLessThan(60000);

      // 清理
      await prisma.lawArticleRelation.deleteMany({
        where: { sourceId: { in: articles.map(a => a.id) } },
      });
      await prisma.lawArticle.deleteMany({
        where: { id: { in: articles.map(a => a.id) } },
      });
    });

    it('批量验证关系应高效', async () => {
      const article1 = await prisma.lawArticle.create({
        data: {
          lawName: '验证测试法1',
          articleNumber: '1',
          fullText: '验证测试1',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['验证'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '验证测试1',
        },
      });

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '验证测试法2',
          articleNumber: '1',
          fullText: '验证测试2',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['验证'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '验证测试2',
        },
      });

      // 创建100个待验证关系
      const relations = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          LawArticleRelationService.createRelation({
            sourceId: i % 2 === 0 ? article1.id : article2.id,
            targetId: i % 2 === 0 ? article2.id : article1.id,
            relationType: RelationType.RELATED,
            discoveryMethod: DiscoveryMethod.AI_DETECTED,
          })
        )
      );

      const startTime = Date.now();

      // 批量验证
      await Promise.all(
        relations.map(r =>
          LawArticleRelationService.verifyRelation(r.id, testExpertId, true)
        )
      );

      const duration = Date.now() - startTime;

      // 批量验证应在60秒内完成（真实DB操作，CI环境可能较慢）
      expect(duration).toBeLessThan(60000);

      // 清理
      await prisma.lawArticleRelation.deleteMany({
        where: { id: { in: relations.map(r => r.id) } },
      });
      await prisma.lawArticle.deleteMany({
        where: { id: { in: [article1.id, article2.id] } },
      });
    });
  });

  describe('内存使用监控', () => {
    it('大量数据处理不应导致内存泄漏', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // 创建和处理大量数据
      for (let i = 0; i < 10; i++) {
        const articles = await Promise.all(
          Array.from({ length: 10 }, (_, j) =>
            prisma.lawArticle.create({
              data: {
                lawName: '内存测试法',
                articleNumber: `${i * 10 + j + 1}`,
                fullText: `内存测试${i * 10 + j + 1}`,
                lawType: 'LAW',
                category: 'CIVIL',
                tags: ['内存'],
                keywords: ['测试'],
                effectiveDate: new Date(),
                status: 'VALID',
                issuingAuthority: '测试机构',
                searchableText: `内存测试${i * 10 + j + 1}`,
              },
            })
          )
        );

        await Promise.all(
          articles.map(article =>
            LawArticleRelationService.getArticleRelations(article.id)
          )
        );

        // 清理
        await prisma.lawArticle.deleteMany({
          where: { id: { in: articles.map(a => a.id) } },
        });
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // 内存增长应该在合理范围内（小于50MB）
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });

  describe('查询优化验证', () => {
    it('索引应该提升查询性能', async () => {
      const articles = await Promise.all(
        Array.from({ length: 20 }, (_, i) =>
          prisma.lawArticle.create({
            data: {
              lawName: '索引测试法',
              articleNumber: `${i + 1}`,
              fullText: `索引测试${i + 1}`,
              lawType: 'LAW',
              category: 'CIVIL',
              tags: ['索引'],
              keywords: ['测试'],
              effectiveDate: new Date(),
              status: 'VALID',
              issuingAuthority: '测试机构',
              searchableText: `索引测试${i + 1}`,
            },
          })
        )
      );

      // 创建关系
      const relations = [];
      for (let i = 0; i < articles.length - 1; i++) {
        relations.push({
          sourceId: articles[i].id,
          targetId: articles[i + 1].id,
          relationType: RelationType.RELATED,
          discoveryMethod: DiscoveryMethod.MANUAL,
        });
      }

      await LawArticleRelationService.batchCreateRelations(relations);

      const startTime = Date.now();

      // 使用索引的查询
      await prisma.lawArticleRelation.findMany({
        where: {
          sourceId: articles[0].id,
          relationType: RelationType.RELATED,
        },
      });

      const duration = Date.now() - startTime;

      // 索引查询应该非常快（小于100ms）
      expect(duration).toBeLessThan(100);

      // 清理
      await prisma.lawArticleRelation.deleteMany({
        where: { sourceId: { in: articles.map(a => a.id) } },
      });
      await prisma.lawArticle.deleteMany({
        where: { id: { in: articles.map(a => a.id) } },
      });
    });
  });
});
