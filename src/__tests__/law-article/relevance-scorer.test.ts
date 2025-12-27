import { describe, it, expect } from '@jest/globals';
import { RelevanceScorer } from '../../lib/law-article/relevance-scorer';
import type { SearchQuery } from '../../lib/law-article/types';

describe('RelevanceScorer', () => {
  const mockArticle = {
    id: 'test-id',
    lawName: '中华人民共和国民法典',
    articleNumber: '第五百七十七条',
    fullText: '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。',
    searchableText: '民法典 合同 违约 责任 赔偿',
    lawType: 'LAW' as const,
    category: 'CIVIL' as const,
    subCategory: '合同编',
    tags: ['民事', '合同', '违约责任'] as string[],
    keywords: ['合同', '违约', '责任', '赔偿', '履行'] as string[],
    version: '1.0',
    effectiveDate: new Date('2021-01-01'),
    expiryDate: null,
    status: 'VALID' as const,
    amendmentHistory: null,
    parentId: null,
    chapterNumber: null,
    sectionNumber: null,
    level: 0,
    issuingAuthority: '全国人民代表大会',
    jurisdiction: '全国',
    relatedArticles: [] as string[],
    legalBasis: null,
    viewCount: 100,
    referenceCount: 50,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  describe('calculateScore 方法', () => {
    it('应该计算法条的相关性得分', () => {
      const query: SearchQuery = {
        keyword: '合同',
      };

      const score = RelevanceScorer.calculateScore(mockArticle, query);

      expect(score).toBeDefined();
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(1);
      expect(score.keywordScore).toBeGreaterThanOrEqual(0);
      expect(score.categoryScore).toBeGreaterThanOrEqual(0);
      expect(score.tagScore).toBeGreaterThanOrEqual(0);
      expect(score.popularityScore).toBeGreaterThanOrEqual(0);
    });

    it('应该提高关键词匹配的得分', () => {
      const query1: SearchQuery = { keyword: '合同' };
      const query2: SearchQuery = { keyword: '不存在的关键词' };

      const score1 = RelevanceScorer.calculateScore(mockArticle, query1);
      const score2 = RelevanceScorer.calculateScore(mockArticle, query2);

      expect(score1.keywordScore).toBeGreaterThan(score2.keywordScore);
    });

    it('应该提高分类匹配的得分', () => {
      const query1: SearchQuery = { category: 'CIVIL' };
      const query2: SearchQuery = { category: 'CRIMINAL' };

      const score1 = RelevanceScorer.calculateScore(mockArticle, query1);
      const score2 = RelevanceScorer.calculateScore(mockArticle, query2);

      expect(score1.categoryScore).toBeGreaterThan(score2.categoryScore);
    });

    it('应该提高子分类匹配的得分', () => {
      const query1: SearchQuery = { subCategory: '合同编' };
      const query2: SearchQuery = { subCategory: '物权编' };

      const score1 = RelevanceScorer.calculateScore(mockArticle, query1);
      const score2 = RelevanceScorer.calculateScore(mockArticle, query2);

      expect(score1.categoryScore).toBeGreaterThan(score2.categoryScore);
    });

    it('应该提高标签匹配的得分', () => {
      const query1: SearchQuery = { tags: ['民事', '合同'] };
      const query2: SearchQuery = { tags: ['刑法', '犯罪'] };

      const score1 = RelevanceScorer.calculateScore(mockArticle, query1);
      const score2 = RelevanceScorer.calculateScore(mockArticle, query2);

      expect(score1.tagScore).toBeGreaterThan(score2.tagScore);
    });

    it('应该使用自定义权重', () => {
      const query: SearchQuery = { keyword: '合同' };
      const customWeights = {
        keywordWeight: 0.7,
        categoryWeight: 0.1,
        tagWeight: 0.1,
        popularityWeight: 0.1,
      };

      const score = RelevanceScorer.calculateScore(mockArticle, query, customWeights);

      expect(score).toBeDefined();
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateSimilarity 方法', () => {
    const mockArticle1 = {
      ...mockArticle,
      category: 'CIVIL' as const,
      tags: ['民事', '合同'] as string[],
      keywords: ['合同', '违约'] as string[],
    };

    const mockArticle2 = {
      ...mockArticle,
      id: 'test-id-2',
      articleNumber: '第五百七十八条',
      category: 'CIVIL' as const,
      tags: ['民事', '责任'] as string[],
      keywords: ['责任', '赔偿'] as string[],
    };

    const mockArticle3 = {
      ...mockArticle,
      id: 'test-id-3',
      articleNumber: '第一条',
      category: 'CRIMINAL' as const,
      tags: ['刑法', '犯罪'] as string[],
      keywords: ['犯罪', '刑罚'] as string[],
    };

    it('应该计算两个法条之间的相似度', () => {
      const similarity = RelevanceScorer.calculateSimilarity(
        mockArticle1,
        mockArticle2,
      );

      expect(similarity).toBeDefined();
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('应该对同一分类的法条给出更高相似度', () => {
      const similarity12 = RelevanceScorer.calculateSimilarity(
        mockArticle1,
        mockArticle2,
      );
      const similarity13 = RelevanceScorer.calculateSimilarity(
        mockArticle1,
        mockArticle3,
      );

      expect(similarity12).toBeGreaterThan(similarity13);
    });

    it('应该对有共同标签的法条给出更高相似度', () => {
      const articleWithCommonTags = {
        ...mockArticle3,
        tags: ['民事', '犯罪'] as string[], // 与article1有共同标签'民事'
      };

      const similarityWithCommonTags = RelevanceScorer.calculateSimilarity(
        mockArticle1,
        articleWithCommonTags,
      );
      const similarityWithoutCommonTags = RelevanceScorer.calculateSimilarity(
        mockArticle1,
        mockArticle3,
      );

      expect(similarityWithCommonTags).toBeGreaterThan(
        similarityWithoutCommonTags,
      );
    });
  });

  describe('sortArticlesByRelevance 方法', () => {
    it('应该按相关性降序排列', () => {
      const articles = [
        { article: mockArticle, relevanceScore: 0.3 },
        { article: mockArticle, relevanceScore: 0.8 },
        { article: mockArticle, relevanceScore: 0.5 },
      ];

      const sorted = RelevanceScorer.sortArticlesByRelevance(articles, 'desc');

      expect(sorted[0].relevanceScore).toBe(0.8);
      expect(sorted[1].relevanceScore).toBe(0.5);
      expect(sorted[2].relevanceScore).toBe(0.3);
    });

    it('应该按相关性升序排列', () => {
      const articles = [
        { article: mockArticle, relevanceScore: 0.3 },
        { article: mockArticle, relevanceScore: 0.8 },
        { article: mockArticle, relevanceScore: 0.5 },
      ];

      const sorted = RelevanceScorer.sortArticlesByRelevance(articles, 'asc');

      expect(sorted[0].relevanceScore).toBe(0.3);
      expect(sorted[1].relevanceScore).toBe(0.5);
      expect(sorted[2].relevanceScore).toBe(0.8);
    });
  });

  describe('filterArticlesByMinScore 方法', () => {
    it('应该过滤低于最小相关性的法条', () => {
      const articles = [
        { article: mockArticle, relevanceScore: 0.2 },
        { article: mockArticle, relevanceScore: 0.5 },
        { article: mockArticle, relevanceScore: 0.8 },
      ];

      const filtered = RelevanceScorer.filterArticlesByMinScore(articles, 0.5);

      expect(filtered.length).toBe(2);
      expect(filtered.every((item) => item.relevanceScore >= 0.5)).toBe(true);
    });

    it('应该保留所有高于最小相关性的法条', () => {
      const articles = [
        { article: mockArticle, relevanceScore: 0.6 },
        { article: mockArticle, relevanceScore: 0.7 },
        { article: mockArticle, relevanceScore: 0.8 },
      ];

      const filtered = RelevanceScorer.filterArticlesByMinScore(articles, 0.5);

      expect(filtered.length).toBe(3);
    });
  });

  describe('validateWeights 方法', () => {
    it('应该验证有效的权重配置', () => {
      const validWeights = {
        keywordWeight: 0.4,
        categoryWeight: 0.3,
        tagWeight: 0.2,
        popularityWeight: 0.1,
      };

      const isValid = RelevanceScorer.validateWeights(validWeights);

      expect(isValid).toBe(true);
    });

    it('应该拒绝权重和不等于1的配置', () => {
      const invalidWeights = {
        keywordWeight: 0.5,
        categoryWeight: 0.5,
        tagWeight: 0.2,
        popularityWeight: 0.1,
      };

      const isValid = RelevanceScorer.validateWeights(invalidWeights);

      expect(isValid).toBe(false);
    });

    it('应该接受接近1的权重和', () => {
      const nearValidWeights = {
        keywordWeight: 0.333,
        categoryWeight: 0.333,
        tagWeight: 0.333,
        popularityWeight: 0.001,
      };

      const isValid = RelevanceScorer.validateWeights(nearValidWeights);

      expect(isValid).toBe(true);
    });
  });

  describe('normalizeWeights 方法', () => {
    it('应该归一化权重配置', () => {
      const unnormalizedWeights = {
        keywordWeight: 2,
        categoryWeight: 1,
        tagWeight: 1,
        popularityWeight: 0.5,
      };

      const normalizedWeights = RelevanceScorer.normalizeWeights(unnormalizedWeights);

      const total =
        normalizedWeights.keywordWeight +
        normalizedWeights.categoryWeight +
        normalizedWeights.tagWeight +
        normalizedWeights.popularityWeight;

      expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
    });

    it('应该保持权重之间的比例关系', () => {
      const unnormalizedWeights = {
        keywordWeight: 2,
        categoryWeight: 1,
        tagWeight: 1,
        popularityWeight: 0.5,
      };

      const normalizedWeights = RelevanceScorer.normalizeWeights(unnormalizedWeights);

      // 验证keywordWeight是categoryWeight的2倍
      expect(
        normalizedWeights.keywordWeight / normalizedWeights.categoryWeight,
      ).toBeCloseTo(2, 1);
    });

    it('应该处理全零的权重配置', () => {
      const zeroWeights = {
        keywordWeight: 0,
        categoryWeight: 0,
        tagWeight: 0,
        popularityWeight: 0,
      };

      const normalizedWeights = RelevanceScorer.normalizeWeights(zeroWeights);

      // 应该使用默认权重
      const total =
        normalizedWeights.keywordWeight +
        normalizedWeights.categoryWeight +
        normalizedWeights.tagWeight +
        normalizedWeights.popularityWeight;

      expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
    });
  });
});
