/**
 * 知识图谱邻居查询API测试
 */

import { GET } from '@/app/api/v1/knowledge-graph/neighbors/route';
import { prisma } from '@/lib/db';

// Mock认证
jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(() =>
    Promise.resolve({
      userId: 'test-user-1',
      email: 'test@test.com',
      role: 'USER',
    })
  ),
}));

// Mock数据库
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
    },
    lawArticleRelation: {
      findMany: jest.fn(),
    },
  },
}));

// Mock权限检查
jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(() =>
    Promise.resolve({ hasPermission: true })
  ),
  logKnowledgeGraphAction: jest.fn(() => Promise.resolve()),
  KnowledgeGraphAction: {
    VIEW_RELATIONS: 'VIEW_RELATIONS',
  },
  KnowledgeGraphResource: {
    GRAPH: 'GRAPH',
  },
}));

describe('GET /api/v1/knowledge-graph/neighbors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('参数验证', () => {
    it('应该拒绝缺少nodeId参数的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: nodeId');
    });

    it('应该拒绝无效的depth参数', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1&depth=0',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('depth参数必须在1-5之间');
    });

    it('应该拒绝超过最大深度5的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1&depth=6',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('depth参数必须在1-5之间');
    });

    it('应该使用默认depth值1', async () => {
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('邻居查询功能', () => {
    beforeEach(() => {
      // Mock源节点
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });

      // Mock关系数据
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([
        {
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: 'CITES',
          strength: 0.8,
        },
        {
          sourceId: 'article-2',
          targetId: 'article-3',
          relationType: 'CONFLICTS',
          strength: 0.9,
        },
      ]);
    });

    it('应该返回1度邻居', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1&depth=1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.nodeId).toBe('article-1');
      expect(data.data.neighbors.degree1).toBeDefined();
      expect(data.data.neighbors.degree1.length).toBeGreaterThan(0);
    });

    it('应该返回2度邻居', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1&depth=2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.neighbors.degree1).toBeDefined();
      expect(data.data.neighbors.degree2).toBeDefined();
    });

    it('应该支持关系类型过滤', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1&depth=1&relationTypes=CITES',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.neighbors.degree1).toBeDefined();
    });

    it('应该返回邻居节点的关系类型和强度', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1&depth=1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      if (data.data.neighbors.degree1.length > 0) {
        expect(data.data.neighbors.degree1[0]).toMatchObject({
          id: expect.any(String),
          relationType: expect.any(String),
          strength: expect.any(Number),
          distance: 1,
        });
      }
    });

    it('应该处理没有邻居的情况', async () => {
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1&depth=1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.neighbors.degree1).toEqual([]);
    });
  });

  describe('错误处理', () => {
    it('应该处理节点不存在的情况', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('未找到该节点');
    });

    it('应该处理数据库错误', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        category: 'CIVIL',
      });
      (prisma.lawArticleRelation.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/neighbors?nodeId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });
  });
});
