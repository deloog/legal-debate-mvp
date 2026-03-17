/**
 * 法条关系表设计测试
 * 测试LawArticleRelation模型的数据库schema设计
 * @jest-environment node
 */

import { PrismaClient } from '@prisma/client';

// 创建测试用的Prisma客户端
const prisma = new PrismaClient();

describe('LawArticleRelation Schema 测试', () => {
  // 测试数据
  let testArticle1Id: string;
  let testArticle2Id: string;
  let testUserId: string;
  let testExpertId: string;

  beforeAll(async () => {
    // 创建测试用的法条数据
    const article1 = await prisma.lawArticle.create({
      data: {
        lawName: '测试法律A',
        articleNumber: '1',
        fullText: '这是测试法条A的内容',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: new Date('2024-01-01'),
        status: 'VALID',
        issuingAuthority: '测试机关',
        searchableText: '这是测试法条A的内容',
      },
    });

    const article2 = await prisma.lawArticle.create({
      data: {
        lawName: '测试法律B',
        articleNumber: '2',
        fullText: '这是测试法条B的内容',
        lawType: 'LAW',
        category: 'CIVIL',
        effectiveDate: new Date('2024-01-01'),
        status: 'VALID',
        issuingAuthority: '测试机关',
        searchableText: '这是测试法条B的内容',
      },
    });

    testArticle1Id = article1.id;
    testArticle2Id = article2.id;

    // 创建测试用的User和KnowledgeGraphExpert（verifiedBy为FK到KnowledgeGraphExpert）
    const testUser = await prisma.user.create({
      data: {
        email: `relation-schema-test-${Date.now()}@test.local`,
        password: 'hashed_password',
        name: 'Relation Schema Test Expert',
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
    // 清理测试数据
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: testArticle1Id },
          { targetId: testArticle1Id },
          { sourceId: testArticle2Id },
          { targetId: testArticle2Id },
        ],
      },
    });

    await prisma.lawArticle.deleteMany({
      where: {
        id: {
          in: [testArticle1Id, testArticle2Id],
        },
      },
    });

    // 清理专家和用户
    if (testExpertId) {
      await prisma.knowledgeGraphExpert.delete({ where: { id: testExpertId } });
    }
    if (testUserId) {
      await prisma.user.delete({ where: { id: testUserId } });
    }

    await prisma.$disconnect();
  });

  afterEach(async () => {
    // 每个测试后清理关系数据
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          { sourceId: testArticle1Id },
          { targetId: testArticle1Id },
          { sourceId: testArticle2Id },
          { targetId: testArticle2Id },
        ],
      },
    });
  });

  describe('1. 模型基本字段测试', () => {
    it('应该成功创建一个基本的关系记录', async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
          strength: 1.0,
          confidence: 0.95,
          discoveryMethod: 'RULE_BASED',
          verificationStatus: 'PENDING',
        },
      });

      expect(relation).toBeDefined();
      expect(relation.id).toBeDefined();
      expect(relation.sourceId).toBe(testArticle1Id);
      expect(relation.targetId).toBe(testArticle2Id);
      expect(relation.relationType).toBe('CITES');
      expect(relation.strength).toBe(1.0);
      expect(relation.confidence).toBe(0.95);
      expect(relation.discoveryMethod).toBe('RULE_BASED');
      expect(relation.verificationStatus).toBe('PENDING');
      expect(relation.createdAt).toBeInstanceOf(Date);
      expect(relation.updatedAt).toBeInstanceOf(Date);
    });

    it('应该支持可选字段', async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
          description: '这是一个引用关系',
          evidence: { text: '根据测试法律B第2条' },
          createdBy: 'test-user-id',
        },
      });

      expect(relation.description).toBe('这是一个引用关系');
      expect(relation.evidence).toEqual({ text: '根据测试法律B第2条' });
      expect(relation.createdBy).toBe('test-user-id');
    });

    it('应该使用默认值', async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
        },
      });

      expect(relation.strength).toBe(1.0);
      expect(relation.confidence).toBe(1.0);
      expect(relation.discoveryMethod).toBe('MANUAL');
      expect(relation.verificationStatus).toBe('PENDING');
    });
  });

  describe('2. RelationType 枚举测试', () => {
    const relationTypes = [
      'CITES',
      'CITED_BY',
      'CONFLICTS',
      'COMPLETES',
      'COMPLETED_BY',
      'SUPERSEDES',
      'SUPERSEDED_BY',
      'IMPLEMENTS',
      'IMPLEMENTED_BY',
      'RELATED',
    ];

    relationTypes.forEach(type => {
      it(`应该支持关系类型: ${type}`, async () => {
        const relation = await prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticle1Id,
            targetId: testArticle2Id,
            relationType: type as any,
          },
        });

        expect(relation.relationType).toBe(type);
      });
    });

    it('应该拒绝无效的关系类型', async () => {
      await expect(
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticle1Id,
            targetId: testArticle2Id,
            relationType: 'INVALID_TYPE' as any,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('3. DiscoveryMethod 枚举测试', () => {
    const discoveryMethods = [
      'MANUAL',
      'RULE_BASED',
      'AI_DETECTED',
      'CASE_DERIVED',
    ];

    discoveryMethods.forEach(method => {
      it(`应该支持发现方式: ${method}`, async () => {
        const relation = await prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticle1Id,
            targetId: testArticle2Id,
            relationType: 'CITES',
            discoveryMethod: method as any,
          },
        });

        expect(relation.discoveryMethod).toBe(method);
      });
    });

    it('应该拒绝无效的发现方式', async () => {
      await expect(
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticle1Id,
            targetId: testArticle2Id,
            relationType: 'CITES',
            discoveryMethod: 'INVALID_METHOD' as any,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('4. VerificationStatus 枚举测试', () => {
    const verificationStatuses = ['PENDING', 'VERIFIED', 'REJECTED'];

    verificationStatuses.forEach(status => {
      it(`应该支持验证状态: ${status}`, async () => {
        const relation = await prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticle1Id,
            targetId: testArticle2Id,
            relationType: 'CITES',
            verificationStatus: status as any,
          },
        });

        expect(relation.verificationStatus).toBe(status);
      });
    });

    it('应该拒绝无效的验证状态', async () => {
      await expect(
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticle1Id,
            targetId: testArticle2Id,
            relationType: 'CITES',
            verificationStatus: 'INVALID_STATUS' as any,
          },
        })
      ).rejects.toThrow();
    });
  });

  describe('5. 外键约束测试', () => {
    it('应该拒绝不存在的sourceId', async () => {
      await expect(
        prisma.lawArticleRelation.create({
          data: {
            sourceId: 'non-existent-id',
            targetId: testArticle2Id,
            relationType: 'CITES',
          },
        })
      ).rejects.toThrow();
    });

    it('应该拒绝不存在的targetId', async () => {
      await expect(
        prisma.lawArticleRelation.create({
          data: {
            sourceId: testArticle1Id,
            targetId: 'non-existent-id',
            relationType: 'CITES',
          },
        })
      ).rejects.toThrow();
    });

    it('删除法条时应该级联删除关系', async () => {
      // 创建一个临时法条
      const tempArticle = await prisma.lawArticle.create({
        data: {
          lawName: '临时法律',
          articleNumber: '999',
          fullText: '临时内容',
          lawType: 'LAW',
          category: 'CIVIL',
          effectiveDate: new Date(),
          status: 'VALID',
          issuingAuthority: '测试机关',
          searchableText: '临时内容',
        },
      });

      // 创建关系
      await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: tempArticle.id,
          relationType: 'CITES',
        },
      });

      // 删除法条
      await prisma.lawArticle.delete({
        where: { id: tempArticle.id },
      });

      // 验证关系也被删除
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          OR: [{ sourceId: tempArticle.id }, { targetId: tempArticle.id }],
        },
      });

      expect(relations).toHaveLength(0);
    });
  });

  describe('6. 关系查询测试', () => {
    beforeEach(async () => {
      // 创建多个测试关系
      await prisma.lawArticleRelation.createMany({
        data: [
          {
            sourceId: testArticle1Id,
            targetId: testArticle2Id,
            relationType: 'CITES',
            strength: 0.9,
            discoveryMethod: 'RULE_BASED',
            verificationStatus: 'VERIFIED',
          },
          {
            sourceId: testArticle1Id,
            targetId: testArticle2Id,
            relationType: 'COMPLETES',
            strength: 0.7,
            discoveryMethod: 'AI_DETECTED',
            verificationStatus: 'PENDING',
          },
          {
            sourceId: testArticle2Id,
            targetId: testArticle1Id,
            relationType: 'CITED_BY',
            strength: 0.9,
            discoveryMethod: 'RULE_BASED',
            verificationStatus: 'VERIFIED',
          },
        ],
      });
    });

    it('应该能查询指定法条的所有出边关系', async () => {
      const relations = await prisma.lawArticleRelation.findMany({
        where: { sourceId: testArticle1Id },
      });

      expect(relations).toHaveLength(2);
      expect(relations.every(r => r.sourceId === testArticle1Id)).toBe(true);
    });

    it('应该能查询指定法条的所有入边关系', async () => {
      const relations = await prisma.lawArticleRelation.findMany({
        where: { targetId: testArticle1Id },
      });

      expect(relations).toHaveLength(1);
      expect(relations.every(r => r.targetId === testArticle1Id)).toBe(true);
    });

    it('应该能按关系类型筛选', async () => {
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          sourceId: testArticle1Id,
          relationType: 'CITES',
        },
      });

      expect(relations).toHaveLength(1);
      expect(relations[0].relationType).toBe('CITES');
    });

    it('应该能按验证状态筛选', async () => {
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          verificationStatus: 'VERIFIED',
          OR: [{ sourceId: testArticle1Id }, { sourceId: testArticle2Id }],
        },
      });

      expect(relations).toHaveLength(2);
      expect(relations.every(r => r.verificationStatus === 'VERIFIED')).toBe(
        true
      );
    });

    it('应该能按强度范围筛选', async () => {
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          strength: { gte: 0.8 },
          OR: [{ sourceId: testArticle1Id }, { sourceId: testArticle2Id }],
        },
      });

      expect(relations).toHaveLength(2);
      expect(relations.every(r => r.strength >= 0.8)).toBe(true);
    });

    it('应该支持关联查询source和target', async () => {
      const relations = await prisma.lawArticleRelation.findMany({
        where: { sourceId: testArticle1Id },
        include: {
          source: true,
          target: true,
        },
      });

      expect(relations).toHaveLength(2);
      expect(relations[0].source).toBeDefined();
      expect(relations[0].target).toBeDefined();
      expect(relations[0].source.id).toBe(testArticle1Id);
    });
  });

  describe('7. 索引性能测试', () => {
    it('应该能快速查询sourceId和targetId的组合', async () => {
      const startTime = Date.now();

      await prisma.lawArticleRelation.findMany({
        where: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
        },
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
    });

    it('应该能快速查询relationType', async () => {
      const startTime = Date.now();

      await prisma.lawArticleRelation.findMany({
        where: {
          relationType: 'CITES',
        },
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });

    it('应该能快速查询verificationStatus', async () => {
      const startTime = Date.now();

      await prisma.lawArticleRelation.findMany({
        where: {
          verificationStatus: 'PENDING',
        },
      });

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('8. 数据完整性测试', () => {
    it('strength应该在0-1范围内', async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
          strength: 0.5,
        },
      });

      expect(relation.strength).toBeGreaterThanOrEqual(0);
      expect(relation.strength).toBeLessThanOrEqual(1);
    });

    it('confidence应该在0-1范围内', async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
          confidence: 0.85,
        },
      });

      expect(relation.confidence).toBeGreaterThanOrEqual(0);
      expect(relation.confidence).toBeLessThanOrEqual(1);
    });

    it('应该支持JSON类型的evidence字段', async () => {
      const evidenceData = {
        text: '根据民法典第1条',
        context: '在合同纠纷中',
        confidence: 0.95,
      };

      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
          evidence: evidenceData,
        },
      });

      expect(relation.evidence).toEqual(evidenceData);
    });
  });

  describe('9. 验证字段测试', () => {
    it('应该支持验证相关字段', async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
          verificationStatus: 'VERIFIED',
          verifiedBy: testExpertId,
          verifiedAt: new Date(),
        },
      });

      expect(relation.verificationStatus).toBe('VERIFIED');
      expect(relation.verifiedBy).toBe(testExpertId);
      expect(relation.verifiedAt).toBeInstanceOf(Date);
    });

    it('未验证的关系verifiedBy和verifiedAt应该为null', async () => {
      const relation = await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
          verificationStatus: 'PENDING',
        },
      });

      expect(relation.verifiedBy).toBeNull();
      expect(relation.verifiedAt).toBeNull();
    });
  });

  describe('10. LawArticle关系字段测试', () => {
    it('应该能通过LawArticle查询sourceRelations', async () => {
      await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
        },
      });

      const article = await prisma.lawArticle.findUnique({
        where: { id: testArticle1Id },
        include: { sourceRelations: true },
      });

      expect(article).toBeDefined();
      expect(article?.sourceRelations).toBeDefined();
      expect(article?.sourceRelations.length).toBeGreaterThan(0);
    });

    it('应该能通过LawArticle查询targetRelations', async () => {
      await prisma.lawArticleRelation.create({
        data: {
          sourceId: testArticle1Id,
          targetId: testArticle2Id,
          relationType: 'CITES',
        },
      });

      const article = await prisma.lawArticle.findUnique({
        where: { id: testArticle2Id },
        include: { targetRelations: true },
      });

      expect(article).toBeDefined();
      expect(article?.targetRelations).toBeDefined();
      expect(article?.targetRelations.length).toBeGreaterThan(0);
    });
  });
});
