/**
 * 法条搜索与检索 E2E 测试
 *
 * 覆盖场景：
 * 1. 法条列表分页查询
 * 2. 关键词搜索（单词/多词）
 * 3. 分类过滤
 * 4. 法条详情查询
 * 5. 知识图谱邻居查询
 * 6. 权限控制（需要登录才能搜索）
 * 7. 参数边界值验证
 */

import { expect, test } from '@playwright/test';
import { createTestUser } from './auth-helpers';

// ── 文件级共享用户（只注册一次，避免触发限流）───────────────────────────────────
let sharedToken = '';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── 辅助类型 ──────────────────────────────────────────────────────────────────

interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText?: string;
  category: string;
  lawType: string;
  effectiveDate?: string;
}

interface ListResponse {
  success: boolean;
  data?: {
    articles?: LawArticle[];
    items?: LawArticle[];
    total?: number;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      hasMore: boolean;
    };
  };
  error?: { code: string; message: string };
}

interface SearchResponse {
  success: boolean;
  data?: {
    articles: LawArticle[];
    total: number;
  };
  error?: { code: string; message: string };
}

interface DetailResponse {
  success: boolean;
  data?: LawArticle;
  error?: { code: string; message: string };
}

// ── 文件级：注册一次共享用户 ──────────────────────────────────────────────────
test.beforeAll(async ({ request }) => {
  const user = await createTestUser(request);
  sharedToken = user.token ?? '';
});

// ── 测试套件：法条列表 ────────────────────────────────────────────────────────

test.describe('法条列表查询', () => {
  test('应该返回分页法条列表', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/law-articles`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      params: { page: '1', limit: '10' },
    });

    expect(response.status()).toBe(200);
    const data: ListResponse = await response.json();
    expect(data.success).toBe(true);

    // 数据库有 110 万条数据，列表必须返回结果
    const articles = data.data?.articles ?? data.data?.items ?? [];
    expect(articles.length).toBeGreaterThan(0);
    expect(articles.length).toBeLessThanOrEqual(10);

    // 验证字段完整性
    const first = articles[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('lawName');
    expect(first).toHaveProperty('articleNumber');
    expect(first).toHaveProperty('category');
  });

  test('分页参数应该生效', async ({ request }) => {
    const [res1, res2] = await Promise.all([
      request.get(`${BASE_URL}/api/v1/law-articles`, {
        headers: { Authorization: `Bearer ${sharedToken}` },
        params: { page: '1', limit: '5' },
      }),
      request.get(`${BASE_URL}/api/v1/law-articles`, {
        headers: { Authorization: `Bearer ${sharedToken}` },
        params: { page: '2', limit: '5' },
      }),
    ]);

    const d1: ListResponse = await res1.json();
    const d2: ListResponse = await res2.json();

    const items1 = d1.data?.articles ?? d1.data?.items ?? [];
    const items2 = d2.data?.articles ?? d2.data?.items ?? [];

    expect(items1.length).toBe(5);
    // 第2页第1条的 id 不应等于第1页第1条
    if (items2.length > 0) {
      expect(items1[0].id).not.toBe(items2[0].id);
    }
  });

  test('按分类过滤应该生效', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/law-articles`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      params: { category: 'CIVIL', limit: '10' },
    });

    expect(response.status()).toBe(200);
    const data: ListResponse = await response.json();
    const articles = data.data?.articles ?? data.data?.items ?? [];
    articles.forEach(a => expect(a.category).toBe('CIVIL'));
  });

  test('分页上限应不超过 100', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/law-articles`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      params: { limit: '9999' },
    });

    const data: ListResponse = await response.json();
    const articles = data.data?.articles ?? data.data?.items ?? [];
    expect(articles.length).toBeLessThanOrEqual(100);
  });

  test('未授权时应拒绝访问', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/v1/law-articles`);
    expect([401, 403]).toContain(response.status());
  });
});

// ── 测试套件：法条搜索 ────────────────────────────────────────────────────────

test.describe('法条关键词搜索', () => {
  test('单关键词搜索应返回相关法条', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/law-articles/search`,
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
        data: { keywords: ['合同'], page: 1, limit: 10 },
      }
    );

    expect(response.status()).toBe(200);
    const data: SearchResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.articles).toBeDefined();
    expect(data.data!.articles.length).toBeGreaterThan(0);
    expect(data.data!.total).toBeGreaterThan(0);
  });

  test('多关键词搜索应返回结果', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/law-articles/search`,
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
        data: { keywords: ['劳动', '合同'], page: 1, limit: 10 },
      }
    );

    expect(response.status()).toBe(200);
    const data: SearchResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.articles.length).toBeGreaterThan(0);
  });

  test('搜索结果应包含完整法条信息', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/law-articles/search`,
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
        data: { keywords: ['侵权'], page: 1, limit: 5 },
      }
    );

    const data: SearchResponse = await response.json();
    const article = data.data?.articles[0];
    if (article) {
      expect(article).toHaveProperty('id');
      expect(article).toHaveProperty('lawName');
      expect(article).toHaveProperty('articleNumber');
      expect(article).toHaveProperty('fullText');
    }
  });

  test('缺少 keywords 参数时应返回 400', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/law-articles/search`,
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
        data: { page: 1, limit: 10 },
      }
    );

    expect(response.status()).toBe(400);
    const data: SearchResponse = await response.json();
    expect(data.success).toBe(false);
  });

  test('空 keywords 数组应返回 400', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/law-articles/search`,
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
        data: { keywords: [], page: 1, limit: 10 },
      }
    );

    expect(response.status()).toBe(400);
  });

  test('搜索结果分页限制不超过 100', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/law-articles/search`,
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
        data: { keywords: ['法律'], page: 1, limit: 200 },
      }
    );

    const data: SearchResponse = await response.json();
    if (data.success && data.data?.articles) {
      expect(data.data.articles.length).toBeLessThanOrEqual(100);
    }
  });

  test('未授权时应拒绝搜索', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/law-articles/search`,
      {
        data: { keywords: ['合同'], page: 1, limit: 10 },
      }
    );
    expect([401, 403]).toContain(response.status());
  });
});

// ── 测试套件：法条详情 ────────────────────────────────────────────────────────

test.describe('法条详情查询', () => {
  let articleId = '';

  test.beforeAll(async ({ request }) => {
    // 获取一个真实的法条 ID（使用文件级 sharedToken）
    const listRes = await request.get(`${BASE_URL}/api/v1/law-articles`, {
      headers: { Authorization: `Bearer ${sharedToken}` },
      params: { limit: '1' },
    });
    const listData: ListResponse = await listRes.json();
    const articles = listData.data?.articles ?? listData.data?.items ?? [];
    articleId = articles[0]?.id ?? '';
  });

  test('应该返回法条完整详情', async ({ request }) => {
    if (!articleId) test.skip();

    const response = await request.get(
      `${BASE_URL}/api/v1/law-articles/${articleId}`,
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
      }
    );

    expect(response.status()).toBe(200);
    // 法条详情直接返回对象（无 success 包装）
    const data = await response.json();
    // 可能是 { success, data } 格式或直接是法条对象，兼容两种
    const article = data.data ?? data;
    expect(article.id ?? article.articleId).toBeTruthy();
    expect(article.fullText ?? article.content).toBeTruthy();
  });

  test('不存在的 ID 应返回 404', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/law-articles/non-existent-id-00000`,
      { headers: { Authorization: `Bearer ${sharedToken}` } }
    );
    expect([404, 400]).toContain(response.status());
  });

  test('知识图谱邻居查询应返回关系数据', async ({ request }) => {
    if (!articleId) test.skip();

    const response = await request.get(
      `${BASE_URL}/api/v1/law-articles/${articleId}/graph?depth=1`,
      { headers: { Authorization: `Bearer ${sharedToken}` } }
    );

    // graph 接口直接返回 { nodes, links } 对象（无 success 包装）
    expect([200, 404]).toContain(response.status());
    if (response.status() === 200) {
      const data = await response.json();
      expect(data).toBeDefined();
      // graph 接口可能直接返回 { nodes, links }，或包装在 { success, data: { nodes, links } } 中
      const graphData = data.data ?? data;
      const hasGraph =
        graphData.nodes !== undefined ||
        graphData.links !== undefined ||
        data.error !== undefined;
      expect(hasGraph).toBe(true);
    }
  });
});
