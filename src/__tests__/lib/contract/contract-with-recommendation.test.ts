/**
 * 合同审查与法条推荐集成测试
 * 测试在合同审查时推荐补全法条的功能
 */

// 使用真实数据库进行集成测试
jest.mock('@/lib/db', () => {
  const { PrismaClient: RealPrismaClient } = jest.requireActual(
    '@prisma/client'
  ) as typeof import('@prisma/client');
  const prisma = new RealPrismaClient();
  return { prisma, default: prisma };
});

import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';
import { prisma } from '@/lib/db';
import { RelationType, VerificationStatus } from '@prisma/client';

describe('合同审查与法条推荐集成', () => {
  let testArticleId1: string;
  let testArticleId2: string;
  let testArticleId3: string;

  beforeAll(async () => {
    // 创建测试法条
    const article1 = await prisma.lawArticle.create({
      data: {
        lawName: '民法典',
        articleNumber: '1',
        fullText:
          '为了保护民事主体的合法权益，调整民事关系，维护社会和经济秩序，适应中国特色社会主义发展要求，弘扬社会主义核心价值观，根据宪法，制定本法。',
        lawType: 'LAW',
        category: 'CIVIL',
        keywords: ['民事主体', '合法权益', '民事关系'],
        tags: ['总则', '基本原则'],
        effectiveDate: new Date('2021-01-01'),
        issuingAuthority: '全国人民代表大会',
        searchableText:
          '为了保护民事主体的合法权益，调整民事关系，维护社会和经济秩序，适应中国特色社会主义发展要求，弘扬社会主义核心价值观，根据宪法，制定本法。',
      },
    });
    testArticleId1 = article1.id;

    const article2 = await prisma.lawArticle.create({
      data: {
        lawName: '民法典',
        articleNumber: '2',
        fullText:
          '民法调整平等主体的自然人、法人和非法人组织之间的人身关系和财产关系。',
        lawType: 'LAW',
        category: 'CIVIL',
        keywords: [
          '平等主体',
          '自然人',
          '法人',
          '人身关系',
          '财产关系',
          '民事关系',
        ],
        tags: ['总则', '调整范围'],
        effectiveDate: new Date('2021-01-01'),
        issuingAuthority: '全国人民代表大会',
        searchableText:
          '民法调整平等主体的自然人、法人和非法人组织之间的人身关系和财产关系。',
      },
    });
    testArticleId2 = article2.id;

    const article3 = await prisma.lawArticle.create({
      data: {
        lawName: '合同法',
        articleNumber: '1',
        fullText:
          '为了保护合同当事人的合法权益，维护社会经济秩序，促进社会主义现代化建设，制定本法。',
        lawType: 'LAW',
        category: 'CIVIL',
        keywords: ['合同', '当事人', '合法权益'],
        tags: ['总则', '立法目的'],
        effectiveDate: new Date('1999-10-01'),
        issuingAuthority: '全国人民代表大会',
        searchableText:
          '为了保护合同当事人的合法权益，维护社会经济秩序，促进社会主义现代化建设，制定本法。',
      },
    });
    testArticleId3 = article3.id;

    // 创建关系
    await prisma.lawArticleRelation.create({
      data: {
        sourceId: testArticleId1,
        targetId: testArticleId2,
        relationType: RelationType.RELATED,
        strength: 0.9,
        confidence: 0.95,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });

    await prisma.lawArticleRelation.create({
      data: {
        sourceId: testArticleId2,
        targetId: testArticleId3,
        relationType: RelationType.COMPLETES,
        strength: 0.8,
        confidence: 0.9,
        verificationStatus: VerificationStatus.VERIFIED,
      },
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.lawArticleRelation.deleteMany({
      where: {
        OR: [
          {
            sourceId: { in: [testArticleId1, testArticleId2, testArticleId3] },
          },
          {
            targetId: { in: [testArticleId1, testArticleId2, testArticleId3] },
          },
        ],
      },
    });
    await prisma.lawArticle.deleteMany({
      where: { id: { in: [testArticleId1, testArticleId2, testArticleId3] } },
    });
  });

  describe('recommendLawArticlesForContract', () => {
    it('应该为合同审查推荐补全法条', async () => {
      const contractInfo = {
        type: '买卖合同',
        content: '关于商品买卖的合同',
        existingArticles: [],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 10 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该基于已有法条推荐补全法条', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [testArticleId1],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 10 }
        );

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // 应该推荐与已有法条相关的法条
      const relatedArticle = recommendations.find(
        r => r.article.id === testArticleId2
      );
      expect(relatedArticle).toBeDefined();
    });

    it('应该排除已有法条', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [testArticleId1, testArticleId2],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 10 }
        );

      // 不应该推荐已有的法条
      const hasExisting = recommendations.some(
        r => r.article.id === testArticleId1 || r.article.id === testArticleId2
      );
      expect(hasExisting).toBe(false);
    });

    it('应该基于合同类型推荐', async () => {
      const contractInfo = {
        type: '买卖合同',
        content: '关于商品买卖的合同',
        existingArticles: [],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 10 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该返回推荐分数和原因', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [testArticleId1],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 5 }
        );

      if (recommendations.length > 0) {
        recommendations.forEach(rec => {
          expect(rec).toHaveProperty('article');
          expect(rec).toHaveProperty('score');
          expect(rec).toHaveProperty('reason');
          expect(typeof rec.score).toBe('number');
          expect(rec.score).toBeGreaterThan(0);
          expect(rec.score).toBeLessThanOrEqual(1);
          expect(typeof rec.reason).toBe('string');
          expect(rec.reason.length).toBeGreaterThan(0);
        });
      }
    });

    it('应该支持限制推荐数量', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [testArticleId1],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 3 }
        );

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('应该按分数降序排序', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [testArticleId1],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 10 }
        );

      if (recommendations.length > 1) {
        for (let i = 0; i < recommendations.length - 1; i++) {
          expect(recommendations[i].score).toBeGreaterThanOrEqual(
            recommendations[i + 1].score
          );
        }
      }
    });
  });

  describe('集成测试', () => {
    it('应该在合同审查过程中获取推荐法条', async () => {
      const contractInfo = {
        type: '买卖合同',
        content: '关于商品买卖的合同，涉及商品交付、价款支付等条款',
        existingArticles: [testArticleId3],
      };

      // 获取推荐法条
      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 5 }
        );

      expect(recommendations).toBeDefined();

      // 验证推荐法条可以用于合同审查
      const suggestedArticles = recommendations.map(rec => ({
        id: rec.article.id,
        lawName: rec.article.lawName,
        articleNumber: rec.article.articleNumber,
        fullText: rec.article.fullText,
        relevanceScore: rec.score,
        reason: rec.reason,
      }));

      expect(Array.isArray(suggestedArticles)).toBe(true);
      suggestedArticles.forEach(article => {
        expect(article.id).toBeDefined();
        expect(article.lawName).toBeDefined();
        expect(article.articleNumber).toBeDefined();
        expect(article.fullText).toBeDefined();
        expect(article.relevanceScore).toBeGreaterThan(0);
        expect(article.reason).toBeDefined();
      });
    });

    it('应该处理空已有法条列表', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 5 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该处理未定义的已有法条列表', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 5 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该基于多个已有法条推荐', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [testArticleId1, testArticleId2],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 10 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);

      // 应该推荐与已有法条相关的法条
      if (recommendations.length > 0) {
        const hasRelatedArticle = recommendations.some(
          r => r.article.id === testArticleId3
        );
        expect(hasRelatedArticle).toBe(true);
      }
    });
  });

  describe('性能测试', () => {
    it('推荐法条应该在合理时间内完成', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [testArticleId1],
      };

      const startTime = Date.now();
      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 10 }
        );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
      expect(recommendations).toBeDefined();
    });

    it('批量推荐应该高效处理', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: [testArticleId1, testArticleId2, testArticleId3],
      };

      const startTime = Date.now();
      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 20 }
        );
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000); // 应该在2秒内完成
      expect(recommendations).toBeDefined();
    });
  });

  describe('边界条件测试', () => {
    it('应该处理不存在的已有法条ID', async () => {
      const contractInfo = {
        type: '合同',
        content: '合同内容',
        existingArticles: ['non-existent-id'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 5 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该处理空合同类型', async () => {
      const contractInfo = {
        type: '',
        content: '合同内容',
        existingArticles: [],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 5 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该处理空合同内容', async () => {
      const contractInfo = {
        type: '合同',
        content: '',
        existingArticles: [],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForContract(
          contractInfo,
          { limit: 5 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
