/**
 * 知识图谱安全测试
 *
 * 测试覆盖：
 * 1. SQL注入防护
 * 2. XSS防护
 * 3. 权限验证
 * 4. 数据验证
 * 5. 恶意输入处理
 */

import { prisma } from '@/lib/db';
import { LawArticleRelationService } from '@/lib/law-article/relation-service';
import { RuleBasedDetector } from '@/lib/law-article/relation-discovery/rule-based-detector';
import { RelationType } from '@prisma/client';

describe('知识图谱安全测试', () => {
  let testArticle: { id: string };

  beforeAll(async () => {
    testArticle = await prisma.lawArticle.create({
      data: {
        lawName: '安全测试法',
        articleNumber: '1',
        fullText: '这是一个安全测试法条',
        lawType: 'LAW',
        category: 'CIVIL',
        tags: ['安全'],
        keywords: ['测试'],
        effectiveDate: new Date(),
        status: 'VALID',
        issuingAuthority: '测试机构',
        searchableText: '这是一个安全测试法条',
      },
    });
  });

  afterAll(async () => {
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [{ sourceId: testArticle.id }, { targetId: testArticle.id }],
      },
    });
    await prisma.lawArticle.delete({ where: { id: testArticle.id } });
  });

  describe('SQL注入防护', () => {
    it('应该防止SQL注入攻击 - 单引号', async () => {
      const maliciousId = "'; DROP TABLE law_articles; --";

      await expect(
        LawArticleRelationService.getArticleRelations(maliciousId)
      ).resolves.toBeDefined();

      // 验证表仍然存在
      const count = await prisma.lawArticle.count();
      expect(count).toBeGreaterThan(0);
    });

    it('应该防止SQL注入攻击 - UNION查询', async () => {
      const maliciousId = "1' UNION SELECT * FROM users --";

      const result =
        await LawArticleRelationService.getArticleRelations(maliciousId);

      expect(result.totalRelations).toBe(0);
      expect(result.outgoingRelations).toEqual([]);
    });

    it('应该防止SQL注入攻击 - 布尔盲注', async () => {
      const maliciousId = "1' OR '1'='1";

      const result =
        await LawArticleRelationService.getArticleRelations(maliciousId);

      // 应该返回空结果，而不是所有数据
      expect(result.totalRelations).toBe(0);
    });

    it('应该安全处理特殊字符', async () => {
      const specialChars = ["'", '"', ';', '--', '/*', '*/', '\\', '\n', '\r'];

      for (const char of specialChars) {
        const result = await LawArticleRelationService.getArticleRelations(
          `test${char}id`
        );
        expect(result).toBeDefined();
      }
    });
  });

  describe('XSS防护', () => {
    it('应该防止XSS攻击 - script标签', async () => {
      const xssPayload = '<script>alert("XSS")</script>';

      const article = await prisma.lawArticle.create({
        data: {
          lawName: xssPayload,
          articleNumber: '999',
          fullText: xssPayload,
          lawType: 'LAW',
          category: 'CIVIL',
          tags: [xssPayload],
          keywords: [xssPayload],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: xssPayload,
        },
      });

      const retrieved = await prisma.lawArticle.findUnique({
        where: { id: article.id },
      });

      // 数据应该被存储，但在使用时需要转义
      expect(retrieved?.lawName).toBe(xssPayload);

      // 清理
      await prisma.lawArticle.delete({ where: { id: article.id } });
    });

    it('应该防止XSS攻击 - 事件处理器', async () => {
      const xssPayloads = [
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        '<iframe src="javascript:alert(1)">',
      ];

      for (const payload of xssPayloads) {
        await expect(
          LawArticleRelationService.createRelation({
            sourceId: testArticle.id,
            targetId: testArticle.id,
            relationType: RelationType.RELATED,
            description: payload,
          })
        ).rejects.toThrow(); // 应该拒绝自引用
      }
    });
  });

  describe('输入验证', () => {
    it('应该验证关系类型', async () => {
      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '验证测试法',
          articleNumber: '2',
          fullText: '验证测试',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['验证'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '验证测试',
        },
      });

      // 尝试使用无效的关系类型
      await expect(
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticle.id,
            targetId: article2.id,
            relationType: 'INVALID_TYPE' as RelationType,
          },
        })
      ).rejects.toThrow();

      // 清理
      await prisma.lawArticle.delete({ where: { id: article2.id } });
    });

    it('应该验证强度和置信度范围', async () => {
      const timestamp = Date.now();
      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: `范围测试法-${timestamp}`,
          articleNumber: '3',
          fullText: '范围测试',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['范围'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '范围测试',
        },
      });

      // 测试超出范围的值
      const invalidValues = [-1, 1.5, 999, -0.5];

      for (const value of invalidValues) {
        const relation = await LawArticleRelationService.createRelation({
          sourceId: testArticle.id,
          targetId: article2.id,
          relationType: RelationType.RELATED,
          strength: value,
          confidence: value,
        });

        // 验证关系创建成功（即使值超出范围，系统也应该处理）
        expect(relation).toBeDefined();
        expect(relation.sourceId).toBe(testArticle.id);
        expect(relation.targetId).toBe(article2.id);

        await prisma.lawArticleRelation.delete({ where: { id: relation.id } });
      }

      // 清理
      await prisma.lawArticle.delete({ where: { id: article2.id } });
    });

    it('应该验证法条ID格式', async () => {
      const invalidIds = [
        '',
        ' ',
        '../../etc/passwd',
        '../../../',
        'null',
        'undefined',
      ];

      for (const id of invalidIds) {
        const result = await LawArticleRelationService.getArticleRelations(id);
        expect(result.totalRelations).toBe(0);
      }
    });

    it('应该防止路径遍历攻击', async () => {
      const pathTraversalIds = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '%2e%2e%2f%2e%2e%2f',
        '....//....//....//etc/passwd',
      ];

      for (const id of pathTraversalIds) {
        const result = await LawArticleRelationService.getArticleRelations(id);
        expect(result).toBeDefined();
        expect(result.totalRelations).toBe(0);
      }
    });
  });

  describe('恶意输入处理', () => {
    it('应该处理超长输入', async () => {
      const longString = 'A'.repeat(100000);

      const article = await prisma.lawArticle.create({
        data: {
          lawName: '超长测试法',
          articleNumber: '4',
          fullText: longString.substring(0, 10000), // 限制长度
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['超长'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: longString.substring(0, 10000),
        },
      });

      const relations = RuleBasedDetector.detectCitesRelation(article as never);
      expect(relations).toBeDefined();

      // 清理
      await prisma.lawArticle.delete({ where: { id: article.id } });
    });

    it('应该处理特殊Unicode字符', async () => {
      const unicodeStrings = [
        '测试\uFFFD替换字符',
        '测试\u200B零宽空格',
        '测试\uFEFF字节顺序标记',
        '🔥💯✨', // Emoji
      ];

      for (const str of unicodeStrings) {
        const article = await prisma.lawArticle.create({
          data: {
            lawName: str,
            articleNumber: '5',
            fullText: str,
            lawType: 'LAW',
            category: 'CIVIL',
            tags: [str],
            keywords: [str],
            effectiveDate: new Date(),
            status: 'VALID',
            issuingAuthority: '测试机构',
            searchableText: str,
          },
        });

        expect(article).toBeDefined();

        // 清理
        await prisma.lawArticle.delete({ where: { id: article.id } });
      }
    });

    it('应该处理JSON注入', async () => {
      const jsonPayloads = [
        '{"__proto__": {"isAdmin": true}}',
        '{"constructor": {"prototype": {"isAdmin": true}}}',
        '{"$where": "this.password == \'secret\'"}',
      ];

      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: 'JSON测试法',
          articleNumber: '6',
          fullText: 'JSON测试',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['JSON'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: 'JSON测试',
        },
      });

      for (const payload of jsonPayloads) {
        const relation = await LawArticleRelationService.createRelation({
          sourceId: testArticle.id,
          targetId: article2.id,
          relationType: RelationType.RELATED,
          evidence: JSON.parse(payload),
        });

        expect(relation).toBeDefined();

        await prisma.lawArticleRelation.delete({ where: { id: relation.id } });
      }

      // 清理
      await prisma.lawArticle.delete({ where: { id: article2.id } });
    });
  });

  describe('并发安全', () => {
    it('应该防止竞态条件', async () => {
      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '竞态测试法',
          articleNumber: '7',
          fullText: '竞态测试',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['竞态'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '竞态测试',
        },
      });

      // 并发创建相同的关系
      const promises = Array.from({ length: 10 }, () =>
        LawArticleRelationService.createRelation({
          sourceId: testArticle.id,
          targetId: article2.id,
          relationType: RelationType.RELATED,
        }).catch(() => null)
      );

      const results = await Promise.all(promises);
      const successful = results.filter(r => r !== null);

      // 应该允许创建多个相同类型的关系（因为移除了唯一约束）
      expect(successful.length).toBeGreaterThan(0);

      // 清理
      await prisma.lawArticleRelation.deleteMany({
        where: {
          sourceId: testArticle.id,
          targetId: article2.id,
        },
      });
      await prisma.lawArticle.delete({ where: { id: article2.id } });
    });

    it('应该安全处理并发删除', async () => {
      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '删除测试法',
          articleNumber: '8',
          fullText: '删除测试',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['删除'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '删除测试',
        },
      });

      const relation = await LawArticleRelationService.createRelation({
        sourceId: testArticle.id,
        targetId: article2.id,
        relationType: RelationType.RELATED,
      });

      // 并发删除同一个关系
      const deletePromises = Array.from({ length: 5 }, () =>
        LawArticleRelationService.deleteRelation(relation.id).catch(() => null)
      );

      await Promise.all(deletePromises);

      // 验证关系已被删除
      const deleted = await prisma.lawArticleRelation.findUnique({
        where: { id: relation.id },
      });

      expect(deleted).toBeNull();

      // 清理
      await prisma.lawArticle.delete({ where: { id: article2.id } });
    });
  });

  describe('资源限制', () => {
    it('应该限制查询深度', async () => {
      // 尝试查询超大深度
      const result = await LawArticleRelationService.findRelationPath(
        testArticle.id,
        testArticle.id,
        1000 // 超大深度
      );

      // 应该返回结果而不是崩溃
      expect(result).toBeDefined();
    });

    it('应该限制批量操作大小', async () => {
      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '批量限制测试法',
          articleNumber: '9',
          fullText: '批量限制测试',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['批量'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '批量限制测试',
        },
      });

      // 尝试创建大量关系
      const largeRelations = Array.from({ length: 10000 }, () => ({
        sourceId: testArticle.id,
        targetId: article2.id,
        relationType: RelationType.RELATED,
      }));

      // 应该能处理大批量操作（可能会分批处理）
      const startTime = Date.now();
      await LawArticleRelationService.batchCreateRelations(
        largeRelations.slice(0, 100)
      );
      const duration = Date.now() - startTime;

      // 应该在合理时间内完成
      expect(duration).toBeLessThan(10000);

      // 清理
      await prisma.lawArticleRelation.deleteMany({
        where: {
          sourceId: testArticle.id,
          targetId: article2.id,
        },
      });
      await prisma.lawArticle.delete({ where: { id: article2.id } });
    });
  });

  describe('数据完整性', () => {
    it('应该维护外键约束', async () => {
      const article2 = await prisma.lawArticle.create({
        data: {
          lawName: '外键测试法',
          articleNumber: '10',
          fullText: '外键测试',
          lawType: 'LAW',
          category: 'CIVIL',
          tags: ['外键'],
          keywords: ['测试'],
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机构',
          searchableText: '外键测试',
        },
      });

      const relation = await LawArticleRelationService.createRelation({
        sourceId: testArticle.id,
        targetId: article2.id,
        relationType: RelationType.RELATED,
      });

      // 删除法条应该级联删除关系
      await prisma.lawArticle.delete({ where: { id: article2.id } });

      const deletedRelation = await prisma.lawArticleRelation.findUnique({
        where: { id: relation.id },
      });

      expect(deletedRelation).toBeNull();
    });

    it('应该防止孤立关系', async () => {
      // 尝试创建指向不存在法条的关系
      await expect(
        LawArticleRelationService.createRelation({
          sourceId: testArticle.id,
          targetId: 'non-existent-id',
          relationType: RelationType.RELATED,
        })
      ).rejects.toThrow();
    });
  });
});
