/**
 * 辩论生成器与法条推荐集成测试
 * 测试在辩论生成时推荐相关法条的功能
 */

import { _DebateGenerator } from '@/lib/debate/debate-generator';
import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';
import { _AIClient } from '@/lib/ai/clients';
import { prisma } from '@/lib/db';

// Mock AI Client
jest.mock('@/lib/ai/clients');

describe('辩论生成器与法条推荐集成', () => {
  let testArticleId1: string;
  let testArticleId2: string;

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
    testArticleId2 = article2.id;
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.lawArticle.deleteMany({
      where: { id: { in: [testArticleId1, testArticleId2] } },
    });
  });

  describe('recommendLawArticlesForDebate', () => {
    it('应该为辩论推荐相关法条', async () => {
      const caseInfo = {
        title: '民事纠纷案件',
        description: '关于合同纠纷的民事案件',
        type: 'CIVIL',
        keywords: ['合同', '民事', '纠纷'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 5,
        });

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // 验证推荐结果包含相关法条
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('article');
        expect(rec).toHaveProperty('score');
        expect(rec).toHaveProperty('reason');
        expect(rec.article.category).toBe('CIVIL');
      });
    });

    it('应该根据案件类型推荐法条', async () => {
      const caseInfo = {
        title: '合同纠纷',
        description: '关于合同履行的纠纷',
        type: 'CIVIL',
        keywords: ['合同', '履行'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 10,
        });

      expect(recommendations.length).toBeGreaterThan(0);

      // 应该推荐民事类法条
      const civilArticles = recommendations.filter(
        r => r.article.category === 'CIVIL'
      );
      expect(civilArticles.length).toBeGreaterThan(0);
    });

    it('应该返回推荐分数和原因', async () => {
      const caseInfo = {
        title: '民事案件',
        description: '民事纠纷',
        type: 'CIVIL',
        keywords: ['民事'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 5,
        });

      if (recommendations.length > 0) {
        recommendations.forEach(rec => {
          expect(typeof rec.score).toBe('number');
          expect(rec.score).toBeGreaterThan(0);
          expect(rec.score).toBeLessThanOrEqual(1);
          expect(typeof rec.reason).toBe('string');
          expect(rec.reason.length).toBeGreaterThan(0);
        });
      }
    });

    it('应该支持限制推荐数量', async () => {
      const caseInfo = {
        title: '民事案件',
        description: '民事纠纷',
        type: 'CIVIL',
        keywords: ['民事'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 3,
        });

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it('应该按分数降序排序', async () => {
      const caseInfo = {
        title: '合同纠纷',
        description: '关于合同的纠纷',
        type: 'CIVIL',
        keywords: ['合同'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 10,
        });

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
    it('应该在辩论生成过程中获取推荐法条', async () => {
      const caseInfo = {
        title: '合同纠纷案件',
        description: '关于合同履行的纠纷',
        type: 'CIVIL',
        keywords: ['合同', '履行'],
      };

      // 获取推荐法条
      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 5,
        });

      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);

      // 验证推荐法条可以用于辩论生成
      const legalReferences = recommendations.map(rec => ({
        lawName: rec.article.lawName,
        articleNumber: rec.article.articleNumber,
        fullText: rec.article.fullText,
        relevanceScore: rec.score,
      }));

      expect(legalReferences.length).toBeGreaterThan(0);
      legalReferences.forEach(ref => {
        expect(ref.lawName).toBeDefined();
        expect(ref.articleNumber).toBeDefined();
        expect(ref.fullText).toBeDefined();
        expect(ref.relevanceScore).toBeGreaterThan(0);
      });
    });

    it('应该处理空关键词的情况', async () => {
      const caseInfo = {
        title: '案件',
        description: '描述',
        type: 'CIVIL',
        keywords: [],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 5,
        });

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该处理无效案件类型的情况', async () => {
      const caseInfo = {
        title: '案件',
        description: '描述',
        type: 'INVALID_TYPE',
        keywords: ['测试'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 5,
        });

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });

  describe('性能测试', () => {
    it('推荐法条应该在合理时间内完成', async () => {
      const caseInfo = {
        title: '民事案件',
        description: '民事纠纷',
        type: 'CIVIL',
        keywords: ['民事'],
      };

      const startTime = Date.now();
      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 10,
        });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
      expect(recommendations).toBeDefined();
    });
  });
});
