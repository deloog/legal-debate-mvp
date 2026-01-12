/**
 * 法条检索API relevanceScore 单元测试
 * 测试relevanceScore字段的完整性和正确性
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { POST } from '@/app/api/v1/law-articles/search/route';
import { prisma } from '@/lib/db/prisma';
import { LawCategory, LawStatus } from '@prisma/client';
import { NextRequest } from 'next/server';

// 测试数据
import { LawType } from '@prisma/client';

// 定义搜索请求体类型
interface SearchRequestBody {
  keywords: string[];
  category?: LawCategory;
  sortField?: string;
  sortOrder?: string;
  page?: number;
  limit?: number;
}

// 定义 API 请求类型（用于测试）
interface TestApiRequest extends Omit<NextRequest, 'json'> {
  json: () => Promise<SearchRequestBody>;
}

const testArticles = [
  {
    id: 'test-relevance-1',
    lawName: '测试民法典',
    articleNumber: '第1条',
    fullText: '民事活动应当遵循公平原则',
    category: LawCategory.CIVIL,
    lawType: LawType.LAW,
    status: LawStatus.VALID,
    tags: ['公平', '民事活动'],
    keywords: ['民事活动', '公平'],
    viewCount: 100,
    referenceCount: 50,
    effectiveDate: new Date('2020-01-01'),
    issuingAuthority: '全国人民代表大会',
    searchableText: '民事活动应当遵循公平原则',
  },
  {
    id: 'test-relevance-2',
    lawName: '测试刑法',
    articleNumber: '第1条',
    fullText: '刑法的目的和任务',
    category: LawCategory.CRIMINAL,
    lawType: LawType.LAW,
    status: LawStatus.VALID,
    tags: ['刑法', '目的'],
    keywords: ['刑法', '目的'],
    viewCount: 200,
    referenceCount: 100,
    effectiveDate: new Date('2020-01-01'),
    issuingAuthority: '全国人民代表大会',
    searchableText: '刑法的目的和任务',
  },
  {
    id: 'test-relevance-3',
    lawName: '测试合同法',
    articleNumber: '第2条',
    fullText: '合同应当遵循公平原则',
    category: LawCategory.CIVIL,
    lawType: LawType.LAW,
    status: LawStatus.VALID,
    tags: ['合同', '公平'],
    keywords: ['合同', '公平'],
    viewCount: 150,
    referenceCount: 75,
    effectiveDate: new Date('2020-01-01'),
    issuingAuthority: '全国人民代表大会',
    searchableText: '合同应当遵循公平原则',
  },
];

describe('法条检索API relevanceScore测试', () => {
  beforeAll(async () => {
    // 准备测试数据
    for (const article of testArticles) {
      await prisma.lawArticle.upsert({
        where: { id: article.id },
        create: article,
        update: article,
      });
    }
  });

  afterAll(async () => {
    // 清理测试数据
    for (const article of testArticles) {
      await prisma.lawArticle.deleteMany({
        where: { id: article.id },
      });
    }
  });

  /**
   * 测试1: 验证relevanceScore字段存在性
   */
  it('应该返回包含relevanceScore的结果', async () => {
    const request = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['民法'],
        }),
      }
    );

    const response = await POST(request as TestApiRequest);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
    expect(data.data.articles).toBeDefined();

    data.data.articles.forEach((article: { relevanceScore?: unknown }) => {
      expect(article).toHaveProperty('relevanceScore');
      expect(typeof article.relevanceScore).toBe('number');
    });
  });

  /**
   * 测试2: 验证relevanceScore值范围[0,1]
   */
  it('relevanceScore值应该在[0,1]范围内', async () => {
    const request = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['公平'],
        }),
      }
    );

    const response = await POST(request as TestApiRequest);
    const data = await response.json();

    expect(data.success).toBe(true);

    data.data.articles.forEach((article: { relevanceScore?: number }) => {
      expect(article.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(article.relevanceScore).toBeLessThanOrEqual(1);
    });
  });

  /**
   * 测试3: 验证relevanceScore按降序排列
   */
  it('relevanceScore应该按降序排列（当sortField为relevance时）', async () => {
    const request = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['公平'],
          sortField: 'relevance',
          sortOrder: 'desc',
        }),
      }
    );

    const response = await POST(request as TestApiRequest);
    const data = await response.json();

    expect(data.success).toBe(true);

    const scores: number[] = data.data.articles.map(
      (a: { relevanceScore: number }) => a.relevanceScore
    );

    // 验证数组是降序排列
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  /**
   * 测试4: 验证matchedKeywords存在
   */
  it('应该返回matchedKeywords数组', async () => {
    const request = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['合同'],
        }),
      }
    );

    const response = await POST(request as TestApiRequest);
    const data = await response.json();

    expect(data.success).toBe(true);

    data.data.articles.forEach((article: { matchedKeywords?: unknown }) => {
      expect(article).toHaveProperty('matchedKeywords');
      expect(Array.isArray(article.matchedKeywords)).toBe(true);
    });
  });

  /**
   * 测试5: 验证关键词匹配的relevanceScore更高
   */
  it('包含搜索关键词的文章应该有更高的relevanceScore', async () => {
    const request = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['合同'],
        }),
      }
    );

    const response = await POST(request as TestApiRequest);
    const data = await response.json();

    expect(data.success).toBe(true);

    // 第一条结果应该是合同法相关
    const firstArticle = data.data.articles[0];
    expect(firstArticle.lawName).toContain('合同');
    expect(firstArticle.relevanceScore).toBeGreaterThan(0);
  });

  /**
   * 测试6: 验证分类筛选时的relevanceScore
   */
  it('分类筛选后仍应返回有效的relevanceScore', async () => {
    const request = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['原则'],
          category: LawCategory.CIVIL,
        }),
      }
    );

    const response = await POST(request as TestApiRequest);
    const data = await response.json();

    expect(data.success).toBe(true);

    data.data.articles.forEach(
      (article: { relevanceScore?: number; category: LawCategory }) => {
        expect(article.relevanceScore).toBeDefined();
        expect(typeof article.relevanceScore).toBe('number');
        expect(article.category).toBe(LawCategory.CIVIL);
      }
    );
  });

  /**
   * 测试7: 验证分页时relevanceScore的一致性
   */
  it('分页时每页的relevanceScore都应该有效', async () => {
    // 第一页
    const request1 = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['原则'],
          page: 1,
          limit: 2,
        }),
      }
    );

    const response1 = await POST(request1 as TestApiRequest);
    const data1 = await response1.json();

    expect(data1.success).toBe(true);
    data1.data.articles.forEach((article: { relevanceScore?: number }) => {
      expect(article.relevanceScore).toBeDefined();
      expect(article.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(article.relevanceScore).toBeLessThanOrEqual(1);
    });
  });

  /**
   * 测试8: 验证缓存数据格式正确性
   */
  it('缓存的返回数据应该包含完整的relevanceScore', async () => {
    const requestBody = {
      keywords: ['民法'],
      page: 1,
      limit: 10,
    };

    // 第一次请求
    const request1 = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    const response1 = await POST(request1 as TestApiRequest);
    const data1 = await response1.json();

    expect(data1.success).toBe(true);
    data1.data.articles.forEach((article: { relevanceScore?: number }) => {
      expect(article.relevanceScore).toBeDefined();
    });

    // 第二次相同请求（应该命中缓存）
    const request2 = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }
    );

    const response2 = await POST(request2 as TestApiRequest);
    const data2 = await response2.json();

    expect(data2.success).toBe(true);
    data2.data.articles.forEach((article: { relevanceScore?: number }) => {
      expect(article.relevanceScore).toBeDefined();
      expect(typeof article.relevanceScore).toBe('number');
    });
  });

  /**
   * 测试9: 验证空搜索时relevanceScore默认值
   */
  it('无匹配结果时应返回空数组', async () => {
    const request = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['不存在的非常特殊的关键词'],
        }),
      }
    );

    const response = await POST(request as TestApiRequest);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.articles).toEqual([]);
    expect(data.data.total).toBe(0);
  });

  /**
   * 测试10: 验证relevanceScores数组存在
   */
  it('响应应该包含relevanceScores数组', async () => {
    const request = new Request(
      'http://localhost:3000/api/v1/law-articles/search',
      {
        method: 'POST',
        body: JSON.stringify({
          keywords: ['民法'],
        }),
      }
    );

    const response = await POST(request as TestApiRequest);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('relevanceScores');
    expect(Array.isArray(data.data.relevanceScores)).toBe(true);
    expect(data.data.relevanceScores.length).toBe(data.data.articles.length);

    // 验证每个score都是有效数字
    data.data.relevanceScores.forEach((score: number) => {
      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
