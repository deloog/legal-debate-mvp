/**
 * 知识图谱 E2E 测试
 *
 * 覆盖场景：
 * 1. 图谱浏览（节点 + 边）
 * 2. 关键词搜索过滤
 * 3. 分类过滤
 * 4. 关系类型过滤
 * 5. 邻居节点查询
 * 6. 关系生成统计接口
 * 7. 权限控制
 */

import { expect, test } from '@playwright/test';
import { createTestUser, loginUser } from './auth-helpers';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// ── 辅助类型 ──────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  lawName: string;
  articleNumber: string;
  category: string;
}

interface GraphLink {
  source: string;
  target: string;
  relationType: string;
  strength?: number;
}

// browse 接口直接返回 { nodes, links, pagination }，无 success 包装
interface BrowseResponse {
  nodes?: GraphNode[];
  links?: GraphLink[];
  pagination?: { page: number; pageSize: number; total: number };
  success?: boolean;
  error?: string;
}

interface StatsResponse {
  success: boolean;
  data?: {
    totalRelations: number;
    lastGeneratedAt: string | null;
    distribution: Record<string, Record<string, number>>;
  };
}

// ── 测试套件：图谱浏览（需要登录）──────────────────────────────────────────────

test.describe('知识图谱浏览', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;
  });

  test('应该返回图谱节点和边数据', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { pageSize: '20' },
      }
    );

    expect(response.status()).toBe(200);
    const data: BrowseResponse = await response.json();

    // browse 接口直接返回 nodes/links，不是 { success, data } 格式
    expect(data.nodes).toBeDefined();
    expect(data.links).toBeDefined();
    // 数据库有 64 万条关系，必须返回节点和边
    expect(data.nodes!.length).toBeGreaterThan(0);
    expect(data.links!.length).toBeGreaterThan(0);
  });

  test('节点应包含必要字段', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { pageSize: '5' },
      }
    );

    const data: BrowseResponse = await response.json();
    const node = data.nodes?.[0];
    if (node) {
      expect(node).toHaveProperty('id');
      expect(node).toHaveProperty('lawName');
      expect(node).toHaveProperty('articleNumber');
      expect(node).toHaveProperty('category');
    }
  });

  test('边应包含关系类型', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { pageSize: '30' },
      }
    );

    const data: BrowseResponse = await response.json();
    const link = data.links?.[0];
    if (link) {
      expect(link).toHaveProperty('source');
      expect(link).toHaveProperty('target');
      expect(link).toHaveProperty('relationType');
      expect([
        'SUPERSEDES',
        'SUPERSEDED_BY',
        'IMPLEMENTS',
        'IMPLEMENTED_BY',
        'CITES',
        'CITED_BY',
        'CONFLICTS',
        'RELATED',
        'COMPLETES',
        'COMPLETED_BY',
      ]).toContain(link.relationType);
    }
  });

  test('按关系类型过滤应只返回指定类型的边', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { relationType: 'SUPERSEDES', pageSize: '20' },
      }
    );

    expect(response.status()).toBe(200);
    const data: BrowseResponse = await response.json();
    if (data.links && data.links.length > 0) {
      data.links.forEach(link => {
        expect(link.relationType).toBe('SUPERSEDES');
      });
    }
  });

  test('关键词搜索应正常响应', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { search: '民法典', pageSize: '10' },
      }
    );

    expect(response.status()).toBe(200);
    const data: BrowseResponse = await response.json();
    expect(data.nodes).toBeDefined();
  });

  test('分类过滤应该生效', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { category: 'CIVIL', pageSize: '10' },
      }
    );

    expect(response.status()).toBe(200);
    const data: BrowseResponse = await response.json();
    if (data.nodes && data.nodes.length > 0) {
      data.nodes.forEach(node => {
        expect(node.category).toBe('CIVIL');
      });
    }
  });

  test('分页限制应生效', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { pageSize: '3' },
      }
    );

    const data: BrowseResponse = await response.json();
    expect(data.nodes?.length ?? 0).toBeLessThanOrEqual(3);
  });

  test('未授权时应返回 401', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`
    );
    expect([401, 403]).toContain(response.status());
  });
});

// ── 测试套件：邻居节点查询 ────────────────────────────────────────────────────

test.describe('邻居节点查询', () => {
  let token: string;
  let articleId: string;

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;

    // 找到一个有关系的节点
    const browseRes = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/browse`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { relationType: 'SUPERSEDES', pageSize: '5' },
      }
    );
    const browseData: BrowseResponse = await browseRes.json();
    articleId = browseData.nodes?.[0]?.id ?? '';
  });

  test('应该返回节点的邻居关系', async ({ request }) => {
    if (!articleId) test.skip();

    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/neighbors`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { nodeId: articleId, depth: '1' },
      }
    );

    expect([200, 404]).toContain(response.status());
  });

  test('不存在节点应返回 404 或空结果', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/neighbors`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { nodeId: 'non-existent-node-id', depth: '1' },
      }
    );

    expect([200, 404, 400]).toContain(response.status());
  });
});

// ── 测试套件：关系生成统计与管理 ────────────────────────────────────────────────

test.describe('关系生成统计与管理', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const user = await createTestUser(request);
    const auth = await loginUser(request, user.email, user.password);
    token = auth.token;
  });

  test('GET 统计接口应返回关系分布数据', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/generate-relations`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    expect(response.status()).toBe(200);
    const data: StatsResponse = await response.json();
    expect(data.success).toBe(true);
    expect(data.data?.totalRelations).toBeGreaterThan(0);
    expect(data.data?.distribution).toBeDefined();

    // SUPERSEDES 应该在分布中存在
    const dist = data.data!.distribution;
    expect('SUPERSEDES' in dist).toBe(true);
    expect(Number(dist['SUPERSEDES']?.['RULE_BASED'] ?? 0)).toBeGreaterThan(0);
  });

  test('未授权时统计接口应拒绝', async ({ request }) => {
    const response = await request.get(
      `${BASE_URL}/api/v1/knowledge-graph/generate-relations`
    );
    expect([401, 403]).toContain(response.status());
  });

  test('POST 触发增量生成应接受请求', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/knowledge-graph/generate-relations`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { mode: 'incremental', rule: 'implements' },
      }
    );

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('totalCreated');
    expect(data.data).toHaveProperty('mode', 'incremental');
  });

  test('无效的 mode 参数应返回 400', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/knowledge-graph/generate-relations`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { mode: 'invalid-mode' },
      }
    );
    expect(response.status()).toBe(400);
  });

  test('无效的 rule 参数应返回 400', async ({ request }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/knowledge-graph/generate-relations`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { mode: 'incremental', rule: 'invalid-rule' },
      }
    );
    expect(response.status()).toBe(400);
  });
});
