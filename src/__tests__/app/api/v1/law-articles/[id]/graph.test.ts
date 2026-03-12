/**
 * 图谱查询API测试
 *
 * 测试覆盖：
 * 1. 认证检查
 * 2. 正常查询图谱
 * 3. 自定义深度参数
 * 4. 法条不存在的情况
 * 5. 参数验证
 * 6. 错误处理
 */

import { GET } from '@/app/api/v1/law-articles/[id]/graph/route';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';

// Mock依赖
jest.mock('@/lib/law-article/graph-builder');
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock('@/lib/middleware/auth');

const mockGetAuthUser = getAuthUser as jest.Mock;
const AUTHED_USER = { userId: 'user-1', role: 'USER', email: 'user@test.com' };

describe('GET /api/v1/law-articles/[id]/graph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(AUTHED_USER);
  });

  describe('认证', () => {
    it('未认证时应该返回401', async () => {
      mockGetAuthUser.mockResolvedValue(null);
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('正常查询', () => {
    it('应该返回图谱数据（默认深度2）', async () => {
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const mockGraph = {
        nodes: [
          {
            id: 'article-1',
            lawName: '民法典',
            articleNumber: '1',
            category: 'CIVIL',
            level: 0,
          },
          {
            id: 'article-2',
            lawName: '民法典',
            articleNumber: '2',
            category: 'CIVIL',
            level: 1,
          },
        ],
        links: [
          {
            source: 'article-1',
            target: 'article-2',
            relationType: 'CITES',
            strength: 0.9,
            confidence: 0.95,
          },
        ],
      };

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.nodes).toHaveLength(2);
      expect(data.data.links).toHaveLength(1);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 2);
    });

    it('应该支持自定义深度参数', async () => {
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const mockGraph = {
        nodes: [{ id: 'article-1', level: 0 }],
        links: [],
      };

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=3'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });

      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 3);
    });

    it('应该处理depth=0的情况', async () => {
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const mockGraph = {
        nodes: [{ id: 'article-1', level: 0 }],
        links: [],
      };

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=0'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });

      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 0);
    });

    it('应该处理非法depth参数（使用默认值）', async () => {
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const mockGraph = {
        nodes: [{ id: 'article-1', level: 0 }],
        links: [],
      };

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=abc'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });

      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 2);
    });
  });

  describe('错误处理', () => {
    it('应该返回404当法条不存在', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/non-existent/graph'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'non-existent' }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
      expect(GraphBuilder.buildGraph).not.toHaveBeenCalled();
    });

    it('应该返回500当服务出错', async () => {
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });

    it('应该处理数据库连接错误', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('参数验证', () => {
    it('应该限制最大深度为10', async () => {
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const mockGraph = {
        nodes: [{ id: 'article-1', level: 0 }],
        links: [],
      };

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=100'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });

      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 10);
    });

    it('应该处理负数深度（转换为0）', async () => {
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const mockGraph = {
        nodes: [{ id: 'article-1', level: 0 }],
        links: [],
      };

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=-5'
      );
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });

      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 0);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内返回结果', async () => {
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      const mockGraph = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `article-${i}`,
          lawName: '民法典',
          articleNumber: `${i}`,
          category: 'CIVIL',
          level: i % 3,
        })),
        links: Array.from({ length: 200 }, (_, i) => ({
          source: `article-${i % 100}`,
          target: `article-${(i + 1) % 100}`,
          relationType: 'CITES',
          strength: 0.9,
          confidence: 0.95,
        })),
      };

      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );
      const startTime = Date.now();
      const response = await GET(request, {
        params: Promise.resolve({ id: 'article-1' }),
      });
      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });
  });
});
