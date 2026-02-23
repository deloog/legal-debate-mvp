import { describe, it, expect, _beforeEach, _afterEach } from '@jest/globals';
import { LawArticleSearchService } from '../../lib/law-article/search-service';
import type { SearchQuery } from '../../lib/law-article/types';

describe('LawArticleSearchService', () => {
  describe('search 方法', () => {
    it('应该支持关键词模糊检索', async () => {
      const query: SearchQuery = {
        keyword: '合同',
        pagination: {
          page: 1,
          pageSize: 10,
        },
      };

      const result = await LawArticleSearchService.search(query);

      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.pagination).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('应该支持按分类筛选', async () => {
      const query: SearchQuery = {
        keyword: '责任',
        category: 'CIVIL',
        pagination: {
          page: 1,
          pageSize: 10,
        },
      };

      const result = await LawArticleSearchService.search(query);

      expect(result.results).toBeInstanceOf(Array);
      // 验证所有结果都属于指定分类
      if (result.results.length > 0) {
        result.results.forEach(item => {
          expect(item.article.category).toBe('CIVIL');
        });
      }
    });

    it('应该支持相关性排序', async () => {
      const query: SearchQuery = {
        keyword: '违约',
        sort: {
          field: 'relevance',
          order: 'desc',
        },
        pagination: {
          page: 1,
          pageSize: 10,
        },
      };

      const result = await LawArticleSearchService.search(query);

      expect(result.results).toBeInstanceOf(Array);
      // 验证结果按相关性降序排列
      for (let i = 1; i < result.results.length; i++) {
        expect(result.results[i - 1].relevanceScore).toBeGreaterThanOrEqual(
          result.results[i].relevanceScore
        );
      }
    });

    it('应该支持分页', async () => {
      const query: SearchQuery = {
        keyword: '权利',
        pagination: {
          page: 1,
          pageSize: 5,
        },
      };

      const result = await LawArticleSearchService.search(query);

      expect(result.results.length).toBeLessThanOrEqual(5);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.pageSize).toBe(5);
      expect(result.pagination.total).toBeGreaterThanOrEqual(0);
    });

    it('应该支持最小相关性得分过滤', async () => {
      const query: SearchQuery = {
        keyword: '赔偿',
        minRelevanceScore: 0.5,
        pagination: {
          page: 1,
          pageSize: 10,
        },
      };

      const result = await LawArticleSearchService.search(query);

      expect(result.results).toBeInstanceOf(Array);
      // 验证所有结果的相关性得分都大于等于最小得分
      result.results.forEach(item => {
        expect(item.relevanceScore).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('应该支持多条件组合检索', async () => {
      const query: SearchQuery = {
        keyword: '违约',
        category: 'CIVIL',
        tags: ['民事', '合同'],
        sort: {
          field: 'relevance',
          order: 'desc',
        },
        pagination: {
          page: 1,
          pageSize: 10,
        },
      };

      const result = await LawArticleSearchService.search(query);

      expect(result.results).toBeInstanceOf(Array);
      expect(result.pagination).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('应该返回正确的检索结果结构', async () => {
      const query: SearchQuery = {
        keyword: '义务',
      };

      const result = await LawArticleSearchService.search(query);

      // 验证响应结构
      expect(result).toHaveProperty('results');
      expect(result).toHaveProperty('pagination');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('cached');

      // 验证分页结构
      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('pageSize');
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('totalPages');
      expect(result.pagination).toHaveProperty('hasNext');
      expect(result.pagination).toHaveProperty('hasPrev');

      // 验证结果结构
      if (result.results.length > 0) {
        expect(result.results[0]).toHaveProperty('article');
        expect(result.results[0]).toHaveProperty('relevanceScore');
        expect(result.results[0]).toHaveProperty('matchDetails');
        expect(result.results[0]).toHaveProperty('matchedKeywords');

        // 验证匹配详情结构
        expect(result.results[0].matchDetails).toHaveProperty('keywordScore');
        expect(result.results[0].matchDetails).toHaveProperty('categoryScore');
        expect(result.results[0].matchDetails).toHaveProperty('tagScore');
        expect(result.results[0].matchDetails).toHaveProperty(
          'popularityScore'
        );
      }
    });

    it('应该支持空关键词检索', async () => {
      const query: SearchQuery = {
        category: 'CIVIL',
        pagination: {
          page: 1,
          pageSize: 10,
        },
      };

      const result = await LawArticleSearchService.search(query);

      expect(result.results).toBeInstanceOf(Array);
      expect(result.pagination).toBeDefined();
    });
  });

  describe('getArticleById 方法', () => {
    it('应该根据ID获取法条详情', async () => {
      // 先获取一个法条列表，找到第一个法条的ID
      const searchResult = await LawArticleSearchService.search({
        keyword: '合同',
        pagination: { page: 1, pageSize: 1 },
      });

      if (searchResult.results.length > 0) {
        const articleId = searchResult.results[0].article.id;
        const article = await LawArticleSearchService.getArticleById(articleId);

        expect(article).toBeDefined();
        expect(article?.id).toBe(articleId);
      }
    });

    it('应该对不存在的ID返回null', async () => {
      const article =
        await LawArticleSearchService.getArticleById('non-existent-id');

      expect(article).toBeNull();
    });
  });

  describe('getArticleByLawNameAndNumber 方法', () => {
    it('应该根据法律名称和法条编号获取法条', async () => {
      const article =
        await LawArticleSearchService.getArticleByLawNameAndNumber(
          '中华人民共和国民法典',
          '第五百七十七条'
        );

      expect(article).toBeDefined();
      expect(article?.lawName).toBe('中华人民共和国民法典');
      expect(article?.articleNumber).toBe('第五百七十七条');
    });
  });

  describe('findSimilarArticles 方法', () => {
    it('应该查找相似法条', async () => {
      // 先获取一个法条ID
      const searchResult = await LawArticleSearchService.search({
        keyword: '合同',
        pagination: { page: 1, pageSize: 1 },
      });

      if (searchResult.results.length > 0) {
        const articleId = searchResult.results[0].article.id;
        const similarArticles =
          await LawArticleSearchService.findSimilarArticles(articleId, 5);

        expect(similarArticles).toBeInstanceOf(Array);
        expect(similarArticles.length).toBeLessThanOrEqual(5);

        // 验证相似法条结构
        if (similarArticles.length > 0) {
          expect(similarArticles[0]).toHaveProperty('article');
          expect(similarArticles[0]).toHaveProperty('similarityScore');
          expect(similarArticles[0]).toHaveProperty('reasons');

          // 验证按相似度排序
          for (let i = 1; i < similarArticles.length; i++) {
            expect(
              similarArticles[i - 1].similarityScore
            ).toBeGreaterThanOrEqual(similarArticles[i].similarityScore);
          }
        }
      }
    });
  });

  describe('getPopularArticles 方法', () => {
    it('应该获取热门法条', async () => {
      const popularArticles = await LawArticleSearchService.getPopularArticles(
        undefined,
        10
      );

      expect(popularArticles).toBeInstanceOf(Array);
      expect(popularArticles.length).toBeLessThanOrEqual(10);

      // 验证按浏览次数排序
      for (let i = 1; i < popularArticles.length; i++) {
        expect(popularArticles[i - 1].viewCount).toBeGreaterThanOrEqual(
          popularArticles[i].viewCount
        );
      }
    });

    it('应该支持按分类获取热门法条', async () => {
      const popularArticles = await LawArticleSearchService.getPopularArticles(
        'CIVIL',
        5
      );

      expect(popularArticles).toBeInstanceOf(Array);

      // 验证所有结果都属于指定分类
      popularArticles.forEach(article => {
        expect(article.category).toBe('CIVIL');
      });
    });
  });

  describe('getCategoryStats 方法', () => {
    it('应该获取分类统计', async () => {
      const stats = await LawArticleSearchService.getCategoryStats();

      expect(stats).toBeInstanceOf(Array);
      expect(stats.length).toBeGreaterThan(0);

      // 验证统计结构
      expect(stats[0]).toHaveProperty('category');
      expect(stats[0]).toHaveProperty('count');
    });
  });

  describe('getSuggestions 方法', () => {
    it('应该提供搜索建议', async () => {
      const suggestions = await LawArticleSearchService.getSuggestions(
        '民法典',
        undefined,
        5
      );

      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeLessThanOrEqual(5);

      // 验证建议结构
      if (suggestions.length > 0) {
        expect(suggestions[0]).toHaveProperty('id');
        expect(suggestions[0]).toHaveProperty('label');
        expect(suggestions[0]).toHaveProperty('value');
        expect(suggestions[0]).toHaveProperty('category');
      }
    });

    it('应该支持按分类提供搜索建议', async () => {
      const suggestions = await LawArticleSearchService.getSuggestions(
        '法',
        'CIVIL',
        5
      );

      expect(suggestions).toBeInstanceOf(Array);

      // 验证所有建议都属于指定分类
      if (suggestions.length > 0) {
        suggestions.forEach(suggestion => {
          expect(suggestion.category).toBe('CIVIL');
        });
      }
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

      const isValid = LawArticleSearchService.validateWeights(validWeights);

      expect(isValid).toBe(true);
    });

    it('应该拒绝无效的权重配置', () => {
      const invalidWeights = {
        keywordWeight: 0.5,
        categoryWeight: 0.5,
        tagWeight: 0.2,
        popularityWeight: 0.1,
      };

      const isValid = LawArticleSearchService.validateWeights(invalidWeights);

      expect(isValid).toBe(false);
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

      const normalizedWeights =
        LawArticleSearchService.normalizeWeights(unnormalizedWeights);

      const total =
        normalizedWeights.keywordWeight +
        normalizedWeights.categoryWeight +
        normalizedWeights.tagWeight +
        normalizedWeights.popularityWeight;

      expect(Math.abs(total - 1.0)).toBeLessThan(0.001);
    });
  });
});
