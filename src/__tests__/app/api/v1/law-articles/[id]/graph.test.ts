/**
 * 图谱查询API测试
 *
 * 测试覆盖：
 * 1. 正常查询图谱
 * 2. 自定义深度参数
 * 3. 法条不存在的情况
 * 4. 参数验证
 * 5. 错误处理
 */

import { GET } from '@/app/api/v1/law-articles/[id]/graph/route';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { prisma } from '@/lib/db';
import { NextRequest } from 'next/server';

// Mock依赖
jest.mock('@/lib/law-article/graph-builder');
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
    },
  },
}));

describe('GET /api/v1/law-articles/[id]/graph', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('正常查询', () => {
    it('应该返回图谱数据（默认深度2）', async () => {
      // 准备测试数据
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

      // Mock数据库和服务
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      // 创建请求
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'article-1' } });
      const data = await response.json();

      // 验证结果
      expect(response.status).toBe(200);
      expect(data.nodes).toHaveLength(2);
      expect(data.links).toHaveLength(1);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 2);
    });

    it('应该支持自定义深度参数', async () => {
      // 准备测试数据
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
        ],
        links: [],
      };

      // Mock数据库和服务
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      // 创建请求（depth=3）
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=3'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'article-1' } });

      // 验证结果
      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 3);
    });

    it('应该处理depth=0的情况', async () => {
      // 准备测试数据
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
        ],
        links: [],
      };

      // Mock数据库和服务
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      // 创建请求（depth=0）
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=0'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'article-1' } });

      // 验证结果
      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 0);
    });

    it('应该处理非法depth参数（使用默认值）', async () => {
      // 准备测试数据
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
        ],
        links: [],
      };

      // Mock数据库和服务
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      // 创建请求（depth=abc）
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=abc'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'article-1' } });

      // 验证结果
      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 2);
    });
  });

  describe('错误处理', () => {
    it('应该返回404当法条不存在', async () => {
      // Mock数据库 - 法条不存在
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      // 创建请求
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/non-existent/graph'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'non-existent' } });
      const data = await response.json();

      // 验证结果
      expect(response.status).toBe(404);
      expect(data.error).toBe('法条不存在');
      expect(GraphBuilder.buildGraph).not.toHaveBeenCalled();
    });

    it('应该返回500当服务出错', async () => {
      // 准备测试数据
      const mockArticle = {
        id: 'article-1',
        lawName: '民法典',
        articleNumber: '1',
        category: 'CIVIL',
      };

      // Mock数据库和服务
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockRejectedValue(
        new Error('数据库错误')
      );

      // 创建请求
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'article-1' } });
      const data = await response.json();

      // 验证结果
      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
    });

    it('应该处理数据库连接错误', async () => {
      // Mock数据库错误
      (prisma.lawArticle.findUnique as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      // 创建请求
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'article-1' } });
      const data = await response.json();

      // 验证结果
      expect(response.status).toBe(500);
      expect(data.error).toBe('服务器错误');
    });
  });

  describe('参数验证', () => {
    it('应该限制最大深度为10', async () => {
      // 准备测试数据
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
        ],
        links: [],
      };

      // Mock数据库和服务
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      // 创建请求（depth=100）
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=100'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'article-1' } });

      // 验证结果 - 应该限制为10
      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 10);
    });

    it('应该处理负数深度（转换为0）', async () => {
      // 准备测试数据
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
        ],
        links: [],
      };

      // Mock数据库和服务
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      // 创建请求（depth=-5）
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph?depth=-5'
      );

      // 执行测试
      const response = await GET(request, { params: { id: 'article-1' } });

      // 验证结果 - 应该转换为0
      expect(response.status).toBe(200);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('article-1', 0);
    });
  });

  describe('性能测试', () => {
    it('应该在合理时间内返回结果', async () => {
      // 准备测试数据
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

      // Mock数据库和服务
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(
        mockArticle
      );
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraph);

      // 创建请求
      const request = new NextRequest(
        'http://localhost:3000/api/v1/law-articles/article-1/graph'
      );

      // 执行测试
      const startTime = Date.now();
      const response = await GET(request, { params: { id: 'article-1' } });
      const duration = Date.now() - startTime;

      // 验证结果
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000); // 应该在1秒内完成
    });
  });
});
