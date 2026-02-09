/**
 * 法条推荐服务测试
 * 测试法条推荐功能，包括基于关系图谱、相似度和案例的推荐
 */

import { LawArticleRecommendationService } from '@/lib/law-article/recommendation-service';
import { prisma } from '@/lib/db';
import { RelationType, VerificationStatus } from '@prisma/client';

describe('LawArticleRecommendationService', () => {
  let testArticleId1: string;
  let testArticleId2: string;
  let testArticleId3: string;
  let testArticleId4: string;

  beforeAll(async () => {
    // 创建测试数据
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

    const article4 = await prisma.lawArticle.create({
      data: {
        lawName: '刑法',
        articleNumber: '1',
        fullText:
          '为了惩罚犯罪，保护人民，根据宪法，结合我国同犯罪作斗争的具体经验及实际情况，制定本法。',
        lawType: 'LAW',
        category: 'CRIMINAL',
        keywords: ['惩罚犯罪', '保护人民'],
        tags: ['总则', '立法目的'],
        effectiveDate: new Date('1997-10-01'),
        issuingAuthority: '全国人民代表大会',
        searchableText:
          '为了惩罚犯罪，保护人民，根据宪法，结合我国同犯罪作斗争的具体经验及实际情况，制定本法。',
      },
    });
    testArticleId4 = article4.id;

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
            sourceId: {
              in: [
                testArticleId1,
                testArticleId2,
                testArticleId3,
                testArticleId4,
              ],
            },
          },
          {
            targetId: {
              in: [
                testArticleId1,
                testArticleId2,
                testArticleId3,
                testArticleId4,
              ],
            },
          },
        ],
      },
    });
    await prisma.lawArticle.deleteMany({
      where: {
        id: {
          in: [testArticleId1, testArticleId2, testArticleId3, testArticleId4],
        },
      },
    });
  });

  describe('recommendByRelations', () => {
    it('应该基于关系图谱推荐相关法条', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          testArticleId1,
          { maxDepth: 2, limit: 10 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
      expect(recommendations.length).toBeGreaterThan(0);

      // 验证推荐结果包含相关法条
      const articleIds = recommendations.map(r => r.article.id);
      expect(articleIds).toContain(testArticleId2);
    });

    it('应该返回推荐分数和原因', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          testArticleId1,
          { maxDepth: 1, limit: 5 }
        );

      expect(recommendations.length).toBeGreaterThan(0);

      const firstRec = recommendations[0];
      expect(firstRec).toHaveProperty('article');
      expect(firstRec).toHaveProperty('score');
      expect(firstRec).toHaveProperty('reason');
      expect(firstRec).toHaveProperty('relationType');

      expect(typeof firstRec.score).toBe('number');
      expect(firstRec.score).toBeGreaterThan(0);
      expect(firstRec.score).toBeLessThanOrEqual(1);
      expect(typeof firstRec.reason).toBe('string');
      expect(firstRec.reason.length).toBeGreaterThan(0);
    });

    it('应该支持限制推荐数量', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          testArticleId1,
          { maxDepth: 2, limit: 1 }
        );

      expect(recommendations.length).toBeLessThanOrEqual(1);
    });

    it('应该支持按关系类型过滤', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          testArticleId1,
          { maxDepth: 2, limit: 10, relationTypes: [RelationType.RELATED] }
        );

      expect(recommendations).toBeDefined();
      recommendations.forEach(rec => {
        expect(rec.relationType).toBe(RelationType.RELATED);
      });
    });

    it('应该按分数降序排序', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          testArticleId1,
          { maxDepth: 2, limit: 10 }
        );

      if (recommendations.length > 1) {
        for (let i = 0; i < recommendations.length - 1; i++) {
          expect(recommendations[i].score).toBeGreaterThanOrEqual(
            recommendations[i + 1].score
          );
        }
      }
    });

    it('对于不存在的法条应该返回空数组', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          'non-existent-id',
          { maxDepth: 1, limit: 10 }
        );

      expect(recommendations).toEqual([]);
    });
  });

  describe('recommendBySimilarity', () => {
    it('应该基于相似度推荐法条', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendBySimilarity(
          testArticleId1,
          { limit: 10 }
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该基于关键词相似度推荐', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendBySimilarity(
          testArticleId1,
          { limit: 10 }
        );

      // 应该推荐包含相似关键词的法条
      expect(recommendations.length).toBeGreaterThan(0);

      // 验证推荐结果的结构
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('article');
        expect(rec).toHaveProperty('score');
        expect(rec).toHaveProperty('reason');
        expect(typeof rec.reason).toBe('string');
        expect(rec.reason.length).toBeGreaterThan(0);
      });

      // 至少有一个推荐结果的原因包含"关键词"或"相同分类"
      const hasValidReason = recommendations.some(
        rec =>
          rec.reason.includes('关键词') ||
          rec.reason.includes('相同分类') ||
          rec.reason.includes('内容相似')
      );
      expect(hasValidReason).toBe(true);
    });

    it('应该基于分类相似度推荐', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendBySimilarity(
          testArticleId1,
          { limit: 10 }
        );

      // 应该优先推荐相同分类的法条
      const civilArticles = recommendations.filter(
        r => r.article.category === 'CIVIL'
      );
      expect(civilArticles.length).toBeGreaterThan(0);
    });

    it('应该排除自身', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendBySimilarity(
          testArticleId1,
          { limit: 10 }
        );

      const selfRecommendation = recommendations.find(
        r => r.article.id === testArticleId1
      );
      expect(selfRecommendation).toBeUndefined();
    });
  });

  describe('recommendForDebate', () => {
    it('应该为辩论推荐相关法条', async () => {
      const caseInfo = {
        title: '民事纠纷案件',
        description: '关于合同纠纷的民事案件',
        type: 'CIVIL',
        keywords: ['合同', '民事', '纠纷'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 10,
        });

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该基于案件类型推荐', async () => {
      const caseInfo = {
        title: '刑事案件',
        description: '关于盗窃罪的刑事案件',
        type: 'CRIMINAL',
        keywords: ['盗窃', '刑事'],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 10,
        });

      // 应该推荐刑事类法条
      const criminalArticles = recommendations.filter(
        r => r.article.category === 'CRIMINAL'
      );
      expect(criminalArticles.length).toBeGreaterThan(0);
    });

    it('应该基于关键词推荐', async () => {
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

      // 应该推荐包含"合同"关键词的法条
      if (recommendations.length > 0) {
        const hasContractKeyword = recommendations.some(
          r =>
            r.article.keywords?.includes('合同') ||
            r.article.fullText.includes('合同')
        );
        expect(hasContractKeyword).toBe(true);
      }
    });

    it('应该返回推荐原因', async () => {
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
          expect(rec.reason).toBeDefined();
          expect(typeof rec.reason).toBe('string');
          expect(rec.reason.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('recommendForContract', () => {
    it('应该为合同审查推荐补全法条', async () => {
      const contractInfo = {
        type: '买卖合同',
        content: '关于商品买卖的合同',
        existingArticles: [testArticleId3],
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

      // 应该推荐与已有法条相关的法条
      if (recommendations.length > 0) {
        const relatedArticle = recommendations.find(
          r => r.article.id === testArticleId2
        );
        expect(relatedArticle).toBeDefined();
      }
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
    });
  });

  describe('getRecommendationStats', () => {
    it('应该返回推荐统计信息', async () => {
      const stats =
        await LawArticleRecommendationService.getRecommendationStats(
          testArticleId1
        );

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('articleId');
      expect(stats).toHaveProperty('totalRelations');
      expect(stats).toHaveProperty('relationsByType');
      expect(stats).toHaveProperty('recommendationScore');

      expect(stats.articleId).toBe(testArticleId1);
      expect(typeof stats.totalRelations).toBe('number');
      expect(typeof stats.recommendationScore).toBe('number');
    });

    it('应该统计各类型关系数量', async () => {
      const stats =
        await LawArticleRecommendationService.getRecommendationStats(
          testArticleId1
        );

      expect(stats.relationsByType).toBeDefined();
      expect(typeof stats.relationsByType).toBe('object');
    });

    it('对于不存在的法条应该返回零值统计', async () => {
      const stats =
        await LawArticleRecommendationService.getRecommendationStats(
          'non-existent-id'
        );

      expect(stats.totalRelations).toBe(0);
      expect(stats.recommendationScore).toBe(0);
    });
  });

  describe('边界条件测试', () => {
    it('应该处理空参数', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          testArticleId1,
          {}
        );

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('应该处理负数限制', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          testArticleId1,
          { limit: -1 }
        );

      expect(recommendations).toEqual([]);
    });

    it('应该处理零深度', async () => {
      const recommendations =
        await LawArticleRecommendationService.recommendByRelations(
          testArticleId1,
          { maxDepth: 0 }
        );

      expect(recommendations).toEqual([]);
    });

    it('应该处理空关键词数组', async () => {
      const caseInfo = {
        title: '案件',
        description: '描述',
        type: 'CIVIL',
        keywords: [],
      };

      const recommendations =
        await LawArticleRecommendationService.recommendForDebate(caseInfo, {
          limit: 10,
        });

      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });
  });
});
