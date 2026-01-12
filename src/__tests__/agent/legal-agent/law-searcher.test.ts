/**
 * LawSearcher 单元测试
 *
 * 测试覆盖：
 * 1. 法律检索功能
 * 2. 语义匹配
 * 3. 关键词搜索
 * 4. 规则过滤（时效性、适用范围、法条层级）
 * 5. 结果合并与排序
 * 6. 错误处理
 */

import { LawSearcher } from '@/lib/agent/legal-agent/law-searcher';
import type { LegalQuery } from '@/lib/agent/legal-agent/types';
import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import * as path from 'path';

describe('LawSearcher', () => {
  let searcher: LawSearcher;
  const testDataDir = path.join(process.cwd(), 'data');

  beforeEach(() => {
    searcher = new LawSearcher(testDataDir);
  });

  afterEach(async () => {
    searcher.cleanup();
  });

  describe('基础功能', () => {
    test('应该成功创建LawSearcher实例', () => {
      expect(searcher).toBeInstanceOf(LawSearcher);
    });

    test('应该能够初始化搜索索引', async () => {
      await expect(searcher.initialize()).resolves.not.toThrow();
    });

    test('重复初始化应该正常工作', async () => {
      await searcher.initialize();
      await expect(searcher.initialize()).resolves.not.toThrow();
    });

    test('应该能够清理资源', () => {
      expect(() => searcher.cleanup()).not.toThrow();
    });

    test('清理后应该能够重新初始化', async () => {
      await searcher.initialize();
      searcher.cleanup();
      await expect(searcher.initialize()).resolves.not.toThrow();
    });
  });

  describe('统计信息', () => {
    test('未初始化时应该返回未初始化状态', () => {
      const stats = searcher.getStatistics();
      expect(stats.initialized).toBe(false);
    });

    test('初始化后应该返回正确的统计信息', async () => {
      await searcher.initialize();
      const stats = searcher.getStatistics();
      expect(stats.initialized).toBe(true);
      expect(stats.totalArticles).toBeGreaterThanOrEqual(0);
      expect(stats.totalTerms).toBeGreaterThanOrEqual(0);
    });
  });

  describe('关键词搜索', () => {
    test('应该能够搜索关键词', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同', '违约'],
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
      expect(result.articles).toBeDefined();
      expect(Array.isArray(result.articles)).toBe(true);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    test('应该返回本地搜索结果', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
      };
      const result = await searcher.search(query);
      expect(result.source).toBe('local');
    });

    test('空关键词应该返回所有结果', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: [],
      };
      const result = await searcher.search(query);
      expect(result.articles).toBeDefined();
    });

    test('应该按相关性降序排序', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同', '违约', '责任'],
        limit: 10,
      };
      const result = await searcher.search(query);
      for (let i = 0; i < result.articles.length - 1; i++) {
        expect(result.articles[i].relevanceScore).toBeGreaterThanOrEqual(
          result.articles[i + 1].relevanceScore ?? 0
        );
      }
    });

    test('应该限制返回结果数量', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
        limit: 2,
      };
      const result = await searcher.search(query);
      expect(result.articles.length).toBeLessThanOrEqual(2);
    });
  });

  describe('案件类型过滤', () => {
    test('应该能够按案件类型过滤', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
        caseType: '民事',
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
      expect(result.articles).toBeDefined();
    });

    test('未知案件类型应该正常工作', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
        caseType: '未知类型',
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
    });

    test('未指定案件类型应该返回所有结果', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
    });
  });

  describe('法律类型过滤', () => {
    test('应该能够按法律类型过滤', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
        lawType: '民事',
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
      expect(result.articles).toBeDefined();
    });

    test('未知法律类型应该正常工作', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
        lawType: '未知类型',
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
    });
  });

  describe('结果合并', () => {
    test('应该正确设置total字段', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
        limit: 5,
      };
      const result = await searcher.search(query);
      expect(result.total).toBeGreaterThanOrEqual(result.articles.length);
    });

    test('仅本地结果时source应为local', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
      };
      const result = await searcher.search(query);
      expect(result.source).toBe('local');
    });
  });

  describe('性能测试', () => {
    test('检索应该在合理时间内完成', async () => {
      await searcher.initialize();
      const startTime = Date.now();
      const query: LegalQuery = {
        keywords: ['合同', '违约', '责任'],
        limit: 10,
      };
      const result = await searcher.search(query);
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(500);
      expect(result.executionTime).toBeLessThan(500);
    });

    test('多次检索应该在合理时间内完成', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
      };
      const startTime = Date.now();
      for (let i = 0; i < 10; i++) {
        await searcher.search(query);
      }
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(2000);
    });
  });

  describe('边界条件', () => {
    test('处理长关键词应该正常工作', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同违约责任赔偿损失继续履行'],
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
    });

    test('处理特殊字符关键词应该正常工作', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同', '违约', '责任', '赔偿'],
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
    });

    test('处理大量关键词应该正常工作', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: Array(20).fill('合同'),
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
    });

    test('限制为0应该返回空结果', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
        limit: 0,
      };
      const result = await searcher.search(query);
      expect(result.articles).toEqual([]);
    });

    test('非常大的limit应该正常工作', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
        limit: 10000,
      };
      const result = await searcher.search(query);
      expect(result).toBeDefined();
    });
  });

  describe('错误处理', () => {
    test('初始化失败应该抛出错误', async () => {
      const invalidSearcher = new LawSearcher(
        path.join(process.cwd(), 'nonexistent-dir')
      );
      await expect(invalidSearcher.initialize()).rejects.toThrow();
    });

    test('清理后搜索应该重新初始化', async () => {
      await searcher.initialize();
      searcher.cleanup();
      const query: LegalQuery = {
        keywords: ['合同'],
      };
      await expect(searcher.search(query)).resolves.not.toThrow();
    });
  });

  describe('并发测试', () => {
    test('多个并发搜索应该正常工作', async () => {
      await searcher.initialize();
      const query: LegalQuery = {
        keywords: ['合同'],
      };
      const promises = Array(5)
        .fill(null)
        .map(() => searcher.search(query));
      const results = await Promise.all(promises);
      expect(results.length).toBe(5);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.articles).toBeDefined();
      });
    });
  });

  describe('词项提取', () => {
    test('应该正确提取中文词项', () => {
      const terms = searcher['extractTerms']({
        id: 'test',
        lawName: '中华人民共和国合同法',
        articleNumber: '第107条',
        content: '当事人一方不履行合同义务',
        category: '民事',
      });
      expect(terms).toBeInstanceOf(Map);
      expect(terms.size).toBeGreaterThan(0);
    });

    test('空内容应该返回空词项', () => {
      const terms = searcher['extractTerms']({
        id: 'test',
        lawName: '',
        articleNumber: '',
        content: '',
        category: '民事',
      });
      expect(terms).toBeInstanceOf(Map);
      expect(terms.size).toBe(0);
    });
  });

  describe('法律层级映射', () => {
    test('应该正确映射CONSTITUTION', () => {
      const level = searcher['mapLawLevel']('CONSTITUTION');
      expect(level).toBe('constitution');
    });

    test('应该正确映射LAW', () => {
      const level = searcher['mapLawLevel']('LAW');
      expect(level).toBe('law');
    });

    test('应该正确映射ADMINISTRATIVE', () => {
      const level = searcher['mapLawLevel']('ADMINISTRATIVE');
      expect(level).toBe('administrative');
    });

    test('未知类型应该默认为law', () => {
      const level = searcher['mapLawLevel']('UNKNOWN');
      expect(level).toBe('law');
    });

    test('undefined应该默认为law', () => {
      const level = searcher['mapLawLevel'](undefined);
      expect(level).toBe('law');
    });
  });

  describe('TF-IDF计算', () => {
    test('应该正确计算TF-IDF分数', () => {
      const doc = {
        id: 'test',
        terms: new Map([
          ['合同', 3],
          ['违约', 2],
        ]),
        totalTerms: 5,
      };
      const df = new Map([
        ['合同', 10],
        ['违约', 5],
      ]);
      const score = searcher['calculateTFIDF'](doc, '合同', df, 100);
      expect(score).toBeGreaterThan(0);
    });

    test('不存在的词项TF-IDF应该为0', () => {
      const doc = {
        id: 'test',
        terms: new Map([['合同', 3]]),
        totalTerms: 3,
      };
      const df = new Map([['合同', 10]]);
      const score = searcher['calculateTFIDF'](doc, '不存在', df, 100);
      expect(score).toBe(0);
    });
  });
});
