import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { LawArticleSearchService } from '../../lib/law-article/search-service';
import type { SearchQuery } from '../../lib/law-article/types';

describe('LawArticleSearchService 性能测试', () => {
  const MAX_EXECUTION_TIME = 1000; // 最大执行时间：1秒（1000毫秒）

  describe('检索性能测试', () => {
    it('关键词检索应该在1秒内完成', async () => {
      const query: SearchQuery = {
        keyword: '合同',
        pagination: {
          page: 1,
          pageSize: 20,
        },
      };

      const startTime = Date.now();
      const result = await LawArticleSearchService.search(query);
      const executionTime = Date.now() - startTime;

      console.log(`关键词检索耗时: ${executionTime}ms`);
      console.log(`结果数量: ${result.results.length}`);

      expect(executionTime).toBeLessThan(MAX_EXECUTION_TIME);
      expect(result.executionTime).toBeLessThan(MAX_EXECUTION_TIME);
    });

    it('分类筛选检索应该在1秒内完成', async () => {
      const query: SearchQuery = {
        keyword: '责任',
        category: 'CIVIL',
        pagination: {
          page: 1,
          pageSize: 20,
        },
      };

      const startTime = Date.now();
      const result = await LawArticleSearchService.search(query);
      const executionTime = Date.now() - startTime;

      console.log(`分类筛选检索耗时: ${executionTime}ms`);

      expect(executionTime).toBeLessThan(MAX_EXECUTION_TIME);
      expect(result.executionTime).toBeLessThan(MAX_EXECUTION_TIME);
    });

    it('相关性排序检索应该在1秒内完成', async () => {
      const query: SearchQuery = {
        keyword: '违约',
        sort: {
          field: 'relevance',
          order: 'desc',
        },
        pagination: {
          page: 1,
          pageSize: 20,
        },
      };

      const startTime = Date.now();
      const result = await LawArticleSearchService.search(query);
      const executionTime = Date.now() - startTime;

      console.log(`相关性排序检索耗时: ${executionTime}ms`);

      expect(executionTime).toBeLessThan(MAX_EXECUTION_TIME);
      expect(result.executionTime).toBeLessThan(MAX_EXECUTION_TIME);
    });

    it('多条件组合检索应该在1秒内完成', async () => {
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
          pageSize: 20,
        },
      };

      const startTime = Date.now();
      const result = await LawArticleSearchService.search(query);
      const executionTime = Date.now() - startTime;

      console.log(`多条件组合检索耗时: ${executionTime}ms`);

      expect(executionTime).toBeLessThan(MAX_EXECUTION_TIME);
      expect(result.executionTime).toBeLessThan(MAX_EXECUTION_TIME);
    });

    it('分页检索第二页应该在1秒内完成', async () => {
      const query: SearchQuery = {
        keyword: '权利',
        pagination: {
          page: 2,
          pageSize: 20,
        },
      };

      const startTime = Date.now();
      const result = await LawArticleSearchService.search(query);
      const executionTime = Date.now() - startTime;

      console.log(`分页检索耗时: ${executionTime}ms`);

      expect(executionTime).toBeLessThan(MAX_EXECUTION_TIME);
      expect(result.executionTime).toBeLessThan(MAX_EXECUTION_TIME);
      expect(result.pagination.page).toBe(2);
    });

    it('缓存命中检索应该在100毫秒内完成', async () => {
      const query: SearchQuery = {
        keyword: '义务',
        pagination: {
          page: 1,
          pageSize: 20,
        },
      };

      // 第一次检索（建立缓存）
      await LawArticleSearchService.search(query);

      // 第二次检索（应该命中缓存）
      const startTime = Date.now();
      const result = await LawArticleSearchService.search(query);
      const executionTime = Date.now() - startTime;

      console.log(`缓存检索耗时: ${executionTime}ms`);
      console.log(`是否使用缓存: ${result.cached}`);

      expect(executionTime).toBeLessThan(100); // 缓存应该更快
      expect(result.cached).toBe(true);
    });
  });

  describe('批量检索性能测试', () => {
    it('连续10次检索平均时间应该小于500ms', async () => {
      const query: SearchQuery = {
        keyword: '合同',
        pagination: {
          page: 1,
          pageSize: 10,
        },
      };

      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        await LawArticleSearchService.search(query);
        const executionTime = Date.now() - startTime;
        times.push(executionTime);
      }

      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      console.log(`10次检索统计:`);
      console.log(`- 平均耗时: ${averageTime.toFixed(2)}ms`);
      console.log(`- 最大耗时: ${maxTime}ms`);
      console.log(`- 最小耗时: ${minTime}ms`);

      expect(averageTime).toBeLessThan(500);
      expect(maxTime).toBeLessThan(MAX_EXECUTION_TIME);
    });

    it('并发5次检索应该在1秒内完成', async () => {
      const queries: SearchQuery[] = [
        { keyword: '合同', pagination: { page: 1, pageSize: 10 } },
        { keyword: '责任', pagination: { page: 1, pageSize: 10 } },
        { keyword: '违约', pagination: { page: 1, pageSize: 10 } },
        { keyword: '赔偿', pagination: { page: 1, pageSize: 10 } },
        { keyword: '义务', pagination: { page: 1, pageSize: 10 } },
      ];

      const startTime = Date.now();
      const results = await Promise.all(
        queries.map((query) => LawArticleSearchService.search(query)),
      );
      const executionTime = Date.now() - startTime;

      console.log(`并发5次检索总耗时: ${executionTime}ms`);
      console.log(`平均每次检索耗时: ${(executionTime / 5).toFixed(2)}ms`);

      expect(executionTime).toBeLessThan(MAX_EXECUTION_TIME);
      expect(results.length).toBe(5);
    });
  });

  describe('其他方法性能测试', () => {
    it('getArticleById 应该在500ms内完成', async () => {
      // 先获取一个法条ID
      const searchResult = await LawArticleSearchService.search({
        keyword: '合同',
        pagination: { page: 1, pageSize: 1 },
      });

      if (searchResult.results.length > 0) {
        const articleId = searchResult.results[0].article.id;

        const startTime = Date.now();
        const article = await LawArticleSearchService.getArticleById(articleId);
        const executionTime = Date.now() - startTime;

        console.log(`获取法条详情耗时: ${executionTime}ms`);

        expect(executionTime).toBeLessThan(500);
        expect(article).toBeDefined();
      }
    });

    it('findSimilarArticles 应该在1秒内完成', async () => {
      const searchResult = await LawArticleSearchService.search({
        keyword: '合同',
        pagination: { page: 1, pageSize: 1 },
      });

      if (searchResult.results.length > 0) {
        const articleId = searchResult.results[0].article.id;

        const startTime = Date.now();
        const similarArticles = await LawArticleSearchService.findSimilarArticles(
          articleId,
          10,
        );
        const executionTime = Date.now() - startTime;

        console.log(`查找相似法条耗时: ${executionTime}ms`);

        expect(executionTime).toBeLessThan(MAX_EXECUTION_TIME);
        expect(similarArticles).toBeInstanceOf(Array);
      }
    });

    it('getPopularArticles 应该在500ms内完成', async () => {
      const startTime = Date.now();
      const popularArticles = await LawArticleSearchService.getPopularArticles(
        undefined,
        10,
      );
      const executionTime = Date.now() - startTime;

      console.log(`获取热门法条耗时: ${executionTime}ms`);

      expect(executionTime).toBeLessThan(500);
      expect(popularArticles).toBeInstanceOf(Array);
    });

    it('getCategoryStats 应该在500ms内完成', async () => {
      const startTime = Date.now();
      const stats = await LawArticleSearchService.getCategoryStats();
      const executionTime = Date.now() - startTime;

      console.log(`获取分类统计耗时: ${executionTime}ms`);

      expect(executionTime).toBeLessThan(500);
      expect(stats).toBeInstanceOf(Array);
    });

    it('getSuggestions 应该在500ms内完成', async () => {
      const startTime = Date.now();
      const suggestions = await LawArticleSearchService.getSuggestions('民法典', undefined, 10);
      const executionTime = Date.now() - startTime;

      console.log(`获取搜索建议耗时: ${executionTime}ms`);

      expect(executionTime).toBeLessThan(500);
      expect(suggestions).toBeInstanceOf(Array);
    });
  });

  describe('极限性能测试', () => {
    it('大量结果检索（100条）应该在2秒内完成', async () => {
      const query: SearchQuery = {
        keyword: '权利',
        pagination: {
          page: 1,
          pageSize: 100,
        },
      };

      const startTime = Date.now();
      const result = await LawArticleSearchService.search(query);
      const executionTime = Date.now() - startTime;

      console.log(`大量结果检索耗时: ${executionTime}ms`);
      console.log(`返回结果数量: ${result.results.length}`);

      expect(executionTime).toBeLessThan(2000);
    });

    it('复杂查询（多条件+大页码）应该在2秒内完成', async () => {
      const query: SearchQuery = {
        keyword: '违约',
        category: 'CIVIL',
        tags: ['民事', '合同'],
        sort: {
          field: 'relevance',
          order: 'desc',
        },
        minRelevanceScore: 0.3,
        pagination: {
          page: 5,
          pageSize: 20,
        },
      };

      const startTime = Date.now();
      const result = await LawArticleSearchService.search(query);
      const executionTime = Date.now() - startTime;

      console.log(`复杂查询耗时: ${executionTime}ms`);

      expect(executionTime).toBeLessThan(2000);
    });
  });
});
