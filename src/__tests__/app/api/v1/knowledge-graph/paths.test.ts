/**
 * 知识图谱路径查询API测试
 */

import { GET } from '@/app/api/v1/knowledge-graph/paths/route';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';

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

// Mock图算法
jest.mock('@/lib/knowledge-graph/graph-algorithms', () => ({
  GraphAlgorithms: {
    shortestPath: jest.fn(),
  },
}));

// Mock GraphBuilder
jest.mock('@/lib/law-article/graph-builder', () => ({
  GraphBuilder: {
    buildFullGraph: jest.fn(() =>
      Promise.resolve({
        nodes: [{ id: 'article-1' }, { id: 'article-2' }],
        links: [],
      })
    ),
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

describe('GET /api/v1/knowledge-graph/paths', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      checkKnowledgeGraphPermission,
    } = require('@/lib/middleware/knowledge-graph-permission');
    (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
      hasPermission: true,
    });
  });

  describe('参数验证', () => {
    it('应该拒绝缺少sourceId参数的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?targetId=article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: sourceId');
    });

    it('应该拒绝缺少targetId参数的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: targetId');
    });

    it('应该拒绝无效的maxDepth参数', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1&targetId=article-2&maxDepth=0',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('maxDepth参数必须在1-10之间');
    });

    it('应该拒绝超过最大值的maxDepth参数', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1&targetId=article-2&maxDepth=11',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('maxDepth参数必须在1-10之间');
    });

    it('应该接受有效的参数', async () => {
      (GraphAlgorithms.shortestPath as jest.Mock).mockReturnValue({
        path: ['article-1', 'article-2'],
        pathLength: 1,
        relationTypes: ['CITES'],
        exists: true,
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1&targetId=article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('最短路径查询', () => {
    beforeEach(() => {
      // Mock最短路径结果
      (GraphAlgorithms.shortestPath as jest.Mock).mockReturnValue({
        path: ['article-1', 'article-2'],
        pathLength: 1,
        relationTypes: ['CITES'],
        exists: true,
      });
    });

    it('应该查询最短路径', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1&targetId=article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.path).toBeDefined();
      expect(data.path).toEqual(['article-1', 'article-2']);
      expect(data.pathLength).toBe(1);
      expect(data.relationTypes).toEqual(['CITES']);
      expect(data.exists).toBe(true);
    });

    it('应该处理同源同目标的情况', async () => {
      (GraphAlgorithms.shortestPath as jest.Mock).mockReturnValue({
        path: ['article-1'],
        pathLength: 0,
        relationTypes: [],
        exists: true,
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1&targetId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.path).toEqual(['article-1']);
      expect(data.pathLength).toBe(0);
    });

    it('应该处理不存在路径的情况', async () => {
      (GraphAlgorithms.shortestPath as jest.Mock).mockReturnValue({
        path: [],
        pathLength: 0,
        relationTypes: [],
        exists: false,
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1&targetId=article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.path).toEqual([]);
      expect(data.exists).toBe(false);
    });
  });

  describe('错误处理', () => {
    it('应该处理权限不足的情况', async () => {
      const {
        checkKnowledgeGraphPermission,
      } = require('@/lib/middleware/knowledge-graph-permission');
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1&targetId=article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('权限不足');
    });

    it('应该处理服务器错误', async () => {
      (GraphAlgorithms.shortestPath as jest.Mock).mockImplementation(() => {
        throw new Error('算法执行失败');
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/paths?sourceId=article-1&targetId=article-2',
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
