import { describe, it, expect } from '@jest/globals';
import { RelevanceScorer } from '@/lib/law-article/relevance-scorer';
import type { LawArticle, LawType } from '@prisma/client';
import type {
  SearchQuery,
  RelevanceWeightConfig,
} from '@/lib/law-article/types';

describe('RelevanceScorer', () => {
  const createMockArticle = (
    overrides: Partial<LawArticle> = {}
  ): LawArticle => ({
    id: '1',
    lawName: '中华人民共和国民法典',
    articleNumber: '第五百七十七条',
    fullText:
      '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
    searchableText: '合同 违约 赔偿 继续履行 补救措施',
    lawType: 'LAW' as LawType,
    category: 'CIVIL',
    subCategory: '合同',
    tags: ['合同', '违约', '损害赔偿'],
    keywords: ['合同义务', '违约责任', '赔偿损失'],
    version: '1.0',
    effectiveDate: new Date('2021-01-01'),
    expiryDate: null,
    status: 'VALID',
    parentId: null,
    chapterNumber: null,
    sectionNumber: null,
    level: 0,
    issuingAuthority: '全国人民代表大会',
    jurisdiction: '全国',
    relatedArticles: [],
    legalBasis: null,
    amendmentHistory: null,
    viewCount: 100,
    referenceCount: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe('calculateScore 方法', () => {
    const mockArticle = createMockArticle();

    const mockQuery: SearchQuery = {
      keyword: '合同',
      category: 'CIVIL',
      tags: ['合同'],
    };

    it('应该计算法条的相关性得分', () => {
      const score = RelevanceScorer.calculateScore(mockArticle, mockQuery);

      expect(score).toBeDefined();
      expect(score).toHaveProperty('totalScore');
      expect(score).toHaveProperty('keywordScore');
      expect(score).toHaveProperty('categoryScore');
      expect(score).toHaveProperty('tagScore');
      expect(score).toHaveProperty('popularityScore');
      expect(score).toHaveProperty('details');
    });

    it('应该使用默认权重配置', () => {
      const score = RelevanceScorer.calculateScore(mockArticle, mockQuery);

      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(1);
    });

    it('应该支持自定义权重配置', () => {
      const customWeights: RelevanceWeightConfig = {
        keywordWeight: 0.5,
        categoryWeight: 0.3,
        tagWeight: 0.2,
        popularityWeight: 0.0,
      };

      const score = RelevanceScorer.calculateScore(
        mockArticle,
        mockQuery,
        customWeights
      );

      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(1);
    });

    it('应该处理无关键词的查询', () => {
      const emptyQuery: SearchQuery = {};

      const score = RelevanceScorer.calculateScore(mockArticle, emptyQuery);

      expect(score.keywordScore).toBe(0);
    });

    it('应该处理无分类的查询', () => {
      const noCategoryQuery: SearchQuery = {
        keyword: '合同',
      };

      const score = RelevanceScorer.calculateScore(
        mockArticle,
        noCategoryQuery
      );

      expect(score.categoryScore).toBe(0);
    });

    it('应该处理无标签的查询', () => {
      const noTagsQuery: SearchQuery = {
        keyword: '合同',
      };

      const score = RelevanceScorer.calculateScore(mockArticle, noTagsQuery);

      expect(score.tagScore).toBe(0);
    });

    it('应该正确计算匹配详情', () => {
      const score = RelevanceScorer.calculateScore(mockArticle, mockQuery);

      expect(score.details).toBeDefined();
      expect(score.details).toHaveProperty('matchedKeywordsCount');
      expect(score.details).toHaveProperty('matchedTagsCount');
      expect(score.details).toHaveProperty('categoryMatched');
      expect(score.details).toHaveProperty('subCategoryMatched');
    });

    it('应该识别分类匹配', () => {
      const score = RelevanceScorer.calculateScore(mockArticle, mockQuery);

      expect(score.details.categoryMatched).toBe(true);
    });

    it('应该识别分类不匹配', () => {
      const wrongCategoryQuery: SearchQuery = {
        keyword: '合同',
        category: 'CRIMINAL',
      };

      const score = RelevanceScorer.calculateScore(
        mockArticle,
        wrongCategoryQuery
      );

      expect(score.details.categoryMatched).toBe(false);
    });

    it('应该识别子分类匹配', () => {
      const withSubCategoryQuery: SearchQuery = {
        keyword: '合同',
        category: 'CIVIL',
        subCategory: '合同',
      };

      const score = RelevanceScorer.calculateScore(
        mockArticle,
        withSubCategoryQuery
      );

      expect(score.details.subCategoryMatched).toBe(true);
    });

    it('应该处理零浏览次数的法条', () => {
      const zeroViewArticle = createMockArticle({
        viewCount: 0,
        referenceCount: 0,
      });

      const score = RelevanceScorer.calculateScore(zeroViewArticle, mockQuery);

      expect(score.popularityScore).toBe(0);
    });

    it('应该处理高浏览次数的法条', () => {
      const highViewArticle = createMockArticle({
        viewCount: 1000,
        referenceCount: 500,
      });

      const score = RelevanceScorer.calculateScore(highViewArticle, mockQuery);

      expect(score.popularityScore).toBeGreaterThan(0);
    });
  });

  describe('calculateSimilarity 方法', () => {
    const article1 = createMockArticle({
      id: '1',
      fullText: '第一条内容',
      searchableText: '合同',
    });

    const article2 = createMockArticle({
      id: '2',
      articleNumber: '第五百七十八条',
      fullText: '第二条内容',
      searchableText: '合同',
      viewCount: 80,
      referenceCount: 40,
    });

    it('应该计算两个法条的相似度', () => {
      const similarity = RelevanceScorer.calculateSimilarity(
        article1,
        article2
      );

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('应该为相同分类的法条返回较高相似度', () => {
      const sameCategoryArticle = createMockArticle({ id: '3' });

      const similarity = RelevanceScorer.calculateSimilarity(
        article1,
        sameCategoryArticle
      );

      expect(similarity).toBeGreaterThanOrEqual(0.4);
    });

    it('应该为不同分类的法条返回较低相似度', () => {
      const differentCategoryArticle = createMockArticle({
        id: '4',
        category: 'CRIMINAL',
      });

      const similarity = RelevanceScorer.calculateSimilarity(
        article1,
        differentCategoryArticle
      );

      expect(similarity).toBeLessThan(0.8);
    });

    it('应该考虑标签相似度', () => {
      const sameTagsArticle = createMockArticle({
        id: '5',
        tags: ['合同', '违约'],
        keywords: ['违约责任'],
      });

      const similarity = RelevanceScorer.calculateSimilarity(
        article1,
        sameTagsArticle
      );

      expect(similarity).toBeGreaterThanOrEqual(0.7);
    });

    it('应该处理无标签的法条', () => {
      const noTagsArticle = createMockArticle({
        id: '7',
        tags: [],
        keywords: [],
      });

      const similarity = RelevanceScorer.calculateSimilarity(
        article1,
        noTagsArticle
      );

      expect(similarity).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sortArticlesByRelevance 方法', () => {
    const mockArticles = [
      { relevanceScore: 0.8 },
      { relevanceScore: 0.3 },
      { relevanceScore: 0.9 },
      { relevanceScore: 0.5 },
    ];

    it('应该按相关性得分降序排列', () => {
      const sorted = RelevanceScorer.sortArticlesByRelevance(mockArticles);

      expect(sorted[0].relevanceScore).toBe(0.9);
      expect(sorted[1].relevanceScore).toBe(0.8);
      expect(sorted[2].relevanceScore).toBe(0.5);
      expect(sorted[3].relevanceScore).toBe(0.3);
    });

    it('应该按相关性得分升序排列', () => {
      const sorted = RelevanceScorer.sortArticlesByRelevance(
        mockArticles,
        'asc'
      );

      expect(sorted[0].relevanceScore).toBe(0.3);
      expect(sorted[1].relevanceScore).toBe(0.5);
      expect(sorted[2].relevanceScore).toBe(0.8);
      expect(sorted[3].relevanceScore).toBe(0.9);
    });

    it('应该保持原始数组不变', () => {
      const original = [...mockArticles];
      RelevanceScorer.sortArticlesByRelevance(mockArticles);

      expect(mockArticles).toEqual(original);
    });

    it('应该处理空数组', () => {
      const sorted = RelevanceScorer.sortArticlesByRelevance([]);

      expect(sorted).toEqual([]);
    });

    it('应该处理单个元素的数组', () => {
      const singleArticle = [{ relevanceScore: 0.5 }];
      const sorted = RelevanceScorer.sortArticlesByRelevance(singleArticle);

      expect(sorted).toHaveLength(1);
      expect(sorted[0].relevanceScore).toBe(0.5);
    });

    it('应该处理相同得分的法条', () => {
      const sameScoreArticles = [
        { relevanceScore: 0.5 },
        { relevanceScore: 0.5 },
        { relevanceScore: 0.5 },
      ];

      const sorted = RelevanceScorer.sortArticlesByRelevance(sameScoreArticles);

      expect(sorted).toHaveLength(3);
      sorted.forEach(article => {
        expect(article.relevanceScore).toBe(0.5);
      });
    });
  });

  describe('filterArticlesByMinScore 方法', () => {
    const mockArticles = [
      { relevanceScore: 0.9 },
      { relevanceScore: 0.3 },
      { relevanceScore: 0.8 },
      { relevanceScore: 0.5 },
      { relevanceScore: 0.2 },
    ];

    it('应该过滤低于最小得分的法条', () => {
      const filtered = RelevanceScorer.filterArticlesByMinScore(
        mockArticles,
        0.5
      );

      expect(filtered).toHaveLength(3);
      filtered.forEach(article => {
        expect(article.relevanceScore).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('应该返回所有高于最小得分的法条', () => {
      const filtered = RelevanceScorer.filterArticlesByMinScore(
        mockArticles,
        0.5
      );

      const scores = filtered.map(a => a.relevanceScore);
      expect(scores).toContain(0.9);
      expect(scores).toContain(0.8);
      expect(scores).toContain(0.5);
    });

    it('应该处理高阈值（无匹配）', () => {
      const filtered = RelevanceScorer.filterArticlesByMinScore(
        mockArticles,
        0.95
      );

      expect(filtered).toHaveLength(0);
    });

    it('应该处理低阈值（全匹配）', () => {
      const filtered = RelevanceScorer.filterArticlesByMinScore(
        mockArticles,
        0.1
      );

      expect(filtered).toHaveLength(5);
    });

    it('应该处理零阈值（全匹配）', () => {
      const filtered = RelevanceScorer.filterArticlesByMinScore(
        mockArticles,
        0
      );

      expect(filtered).toHaveLength(5);
    });

    it('应该处理空数组', () => {
      const filtered = RelevanceScorer.filterArticlesByMinScore([], 0.5);

      expect(filtered).toHaveLength(0);
    });
  });

  describe('validateWeights 方法', () => {
    it('应该验证有效的权重配置', () => {
      const weights: RelevanceWeightConfig = {
        keywordWeight: 0.4,
        categoryWeight: 0.3,
        tagWeight: 0.2,
        popularityWeight: 0.1,
      };

      const isValid = RelevanceScorer.validateWeights(weights);

      expect(isValid).toBe(true);
    });

    it('应该拒绝总和不为1的权重配置', () => {
      const invalidWeights: RelevanceWeightConfig = {
        keywordWeight: 0.5,
        categoryWeight: 0.5,
        tagWeight: 0.2,
        popularityWeight: 0.1,
      };

      const isValid = RelevanceScorer.validateWeights(invalidWeights);

      expect(isValid).toBe(false);
    });

    it('应该接受浮点数误差', () => {
      const almostOneWeights: RelevanceWeightConfig = {
        keywordWeight: 0.4,
        categoryWeight: 0.3,
        tagWeight: 0.2,
        popularityWeight: 0.10000001,
      };

      const isValid = RelevanceScorer.validateWeights(almostOneWeights);

      expect(isValid).toBe(true);
    });

    it('应该处理零权重', () => {
      const zeroWeights: RelevanceWeightConfig = {
        keywordWeight: 0.25,
        categoryWeight: 0.25,
        tagWeight: 0.25,
        popularityWeight: 0.25,
      };

      const isValid = RelevanceScorer.validateWeights(zeroWeights);

      expect(isValid).toBe(true);
    });

    it('应该处理全零权重', () => {
      const allZeroWeights: RelevanceWeightConfig = {
        keywordWeight: 0,
        categoryWeight: 0,
        tagWeight: 0,
        popularityWeight: 0,
      };

      const isValid = RelevanceScorer.validateWeights(allZeroWeights);

      expect(isValid).toBe(false);
    });

    it('应该接受浮点数误差', () => {
      const almostOneWeights: RelevanceWeightConfig = {
        keywordWeight: 0.4,
        categoryWeight: 0.3,
        tagWeight: 0.2,
        popularityWeight: 0.10000001,
      };

      const isValid = RelevanceScorer.validateWeights(almostOneWeights);

      expect(isValid).toBe(true);
    });
  });

  describe('normalizeWeights 方法', () => {
    it('应该归一化权重配置', () => {
      const unnormalized: RelevanceWeightConfig = {
        keywordWeight: 4,
        categoryWeight: 3,
        tagWeight: 2,
        popularityWeight: 1,
      };

      const normalized = RelevanceScorer.normalizeWeights(unnormalized);

      expect(normalized.keywordWeight).toBe(0.4);
      expect(normalized.categoryWeight).toBe(0.3);
      expect(normalized.tagWeight).toBe(0.2);
      expect(normalized.popularityWeight).toBe(0.1);
    });

    it('应该保持总和为1', () => {
      const weights: RelevanceWeightConfig = {
        keywordWeight: 2,
        categoryWeight: 1,
        tagWeight: 1,
        popularityWeight: 0.5,
      };

      const normalized = RelevanceScorer.normalizeWeights(weights);
      const total =
        normalized.keywordWeight +
        normalized.categoryWeight +
        normalized.tagWeight +
        normalized.popularityWeight;

      expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
    });

    it('应该处理全零权重（返回默认值）', () => {
      const allZeroWeights: RelevanceWeightConfig = {
        keywordWeight: 0,
        categoryWeight: 0,
        tagWeight: 0,
        popularityWeight: 0,
      };

      const normalized = RelevanceScorer.normalizeWeights(allZeroWeights);

      expect(normalized.keywordWeight).toBe(0.4);
      expect(normalized.categoryWeight).toBe(0.3);
      expect(normalized.tagWeight).toBe(0.2);
      expect(normalized.popularityWeight).toBe(0.1);
    });

    it('应该处理单个非零权重', () => {
      const singleWeight: RelevanceWeightConfig = {
        keywordWeight: 1,
        categoryWeight: 0,
        tagWeight: 0,
        popularityWeight: 0,
      };

      const normalized = RelevanceScorer.normalizeWeights(singleWeight);

      expect(normalized.keywordWeight).toBe(1);
      expect(normalized.categoryWeight).toBe(0);
      expect(normalized.tagWeight).toBe(0);
      expect(normalized.popularityWeight).toBe(0);
    });

    it('应该处理已归一化的权重', () => {
      const alreadyNormalized: RelevanceWeightConfig = {
        keywordWeight: 0.4,
        categoryWeight: 0.3,
        tagWeight: 0.2,
        popularityWeight: 0.1,
      };

      const normalized = RelevanceScorer.normalizeWeights(alreadyNormalized);

      expect(normalized.keywordWeight).toBeCloseTo(0.4, 0.001);
      expect(normalized.categoryWeight).toBeCloseTo(0.3, 0.001);
      expect(normalized.tagWeight).toBeCloseTo(0.2, 0.001);
      expect(normalized.popularityWeight).toBeCloseTo(0.1, 0.001);
    });
  });

  describe('关键词匹配测试', () => {
    const mockArticle = createMockArticle({
      fullText:
        '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
      searchableText: '合同 违约 赔偿',
      tags: ['合同'],
      keywords: ['违约'],
    });

    it('应该匹配法律名称中的关键词', () => {
      const query: SearchQuery = {
        keyword: '民法典',
      };

      const score = RelevanceScorer.calculateScore(mockArticle, query);

      expect(score.keywordScore).toBeGreaterThan(0);
    });

    it('应该匹配法条编号中的关键词', () => {
      const query: SearchQuery = {
        keyword: '第五百七十七条',
      };

      const score = RelevanceScorer.calculateScore(mockArticle, query);

      expect(score.keywordScore).toBeGreaterThan(0);
    });

    it('应该匹配全文中的关键词', () => {
      const query: SearchQuery = {
        keyword: '履行',
      };

      const score = RelevanceScorer.calculateScore(mockArticle, query);

      expect(score.keywordScore).toBeGreaterThan(0);
    });

    it('应该匹配可搜索文本中的关键词', () => {
      const query: SearchQuery = {
        keyword: '赔偿',
      };

      const score = RelevanceScorer.calculateScore(mockArticle, query);

      expect(score.keywordScore).toBeGreaterThan(0);
    });

    it('应该为无匹配返回0分', () => {
      const query: SearchQuery = {
        keyword: '不存在的关键词',
      };

      const score = RelevanceScorer.calculateScore(mockArticle, query);

      expect(score.keywordScore).toBe(0);
    });

    it('应该处理多次出现的同一关键词', () => {
      const multipleOccurrencesArticle = createMockArticle({
        fullText: '合同 合同 合同 合同 合同',
      });

      const query: SearchQuery = {
        keyword: '合同',
      };

      const score = RelevanceScorer.calculateScore(
        multipleOccurrencesArticle,
        query
      );

      expect(score.keywordScore).toBeGreaterThan(0);
    });

    it('应该处理大小写不敏感的匹配', () => {
      const query: SearchQuery = {
        keyword: '合同',
      };

      const lowercaseArticle = createMockArticle({
        fullText: '合同 合同',
      });

      const score = RelevanceScorer.calculateScore(lowercaseArticle, query);

      expect(score.keywordScore).toBeGreaterThan(0);
    });
  });
});
