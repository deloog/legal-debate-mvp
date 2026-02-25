/**
 * 知识图谱导出API测试
 */

import { GET } from '@/app/api/v1/knowledge-graph/export/route';
import { prisma } from '@/lib/db';

// Mock数据库
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findMany: jest.fn(),
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
    EXPORT_DATA: 'EXPORT_DATA',
  },
}));

describe('GET /api/v1/knowledge-graph/export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('参数验证', () => {
    it('应该拒绝无效的导出格式', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export?format=xml',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('不支持的导出格式: xml');
    });

    it('应该接受默认的json格式', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('导出功能', () => {
    beforeEach(() => {
      // Mock节点数据
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article-1',
          lawName: '《民法典》',
          articleNumber: '第123条',
          category: 'CIVIL',
          status: 'VALID',
          effectiveDate: new Date('2020-01-01'),
        },
        {
          id: 'article-2',
          lawName: '《合同法》',
          articleNumber: '第45条',
          category: 'CIVIL',
          status: 'VALID',
          effectiveDate: new Date('2020-01-01'),
        },
      ]);

      // Mock关系数据
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rel-1',
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: 'CITES',
          strength: 0.8,
          verificationStatus: 'VERIFIED',
          discoveryMethod: 'MANUAL',
          createdAt: new Date('2021-01-01'),
        },
      ]);
    });

    it('应该返回完整的图谱数据', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.format).toBe('json');
      expect(data.nodes).toBeDefined();
      expect(data.links).toBeDefined();
      expect(data.metadata).toBeDefined();
    });

    it('应该包含正确的节点数量', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.metadata.nodeCount).toBe(2);
      expect(data.nodes).toHaveLength(2);
    });

    it('应该包含正确的关系数量', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.metadata.linkCount).toBe(1);
      expect(data.links).toHaveLength(1);
    });

    it('应该返回节点的基本信息', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.nodes[0]).toMatchObject({
        id: expect.any(String),
        lawName: expect.any(String),
        articleNumber: expect.any(String),
        category: expect.any(String),
        status: expect.any(String),
      });
    });

    it('应该返回关系的基本信息', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.links[0]).toMatchObject({
        id: expect.any(String),
        source: expect.any(String),
        target: expect.any(String),
        relationType: expect.any(String),
        strength: expect.any(Number),
        verificationStatus: expect.any(String),
      });
    });
  });

  describe('时间范围过滤', () => {
    it('应该支持时间范围过滤', async () => {
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export?startDate=2020-01-01&endDate=2021-12-31',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);

      // 验证查询参数
      const calls = (prisma.lawArticleRelation.findMany as jest.Mock).mock
        .calls;
      expect(calls[0][0].where.createdAt).toBeDefined();
    });

    it('应该只在指定时间范围内过滤关系', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export?startDate=2020-01-01&endDate=2021-12-31',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata.timeRange).toEqual({
        start: '2020-01-01',
        end: '2021-12-31',
      });
    });

    it('应该处理只有开始时间的情况', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export?startDate=2020-01-01',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metadata.timeRange).toEqual({
        start: '2020-01-01',
        end: '-',
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理数据库错误', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('应该处理空数据', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/export',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nodes).toEqual([]);
      expect(data.links).toEqual([]);
      expect(data.metadata.nodeCount).toBe(0);
      expect(data.metadata.linkCount).toBe(0);
    });
  });
});
