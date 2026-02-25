/**
 * 知识图谱企业风险分析API测试
 */

import { GET } from '@/app/api/v1/knowledge-graph/enterprise-risk-analysis/route';
import { prisma } from '@/lib/db';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';

// Mock数据库
jest.mock('@/lib/db', () => ({
  prisma: {
    contract: {
      findUnique: jest.fn(),
    },
    contractLawArticle: {
      findMany: jest.fn(),
    },
    lawArticle: {
      findMany: jest.fn(),
    },
  },
}));

// Mock图构建器
jest.mock('@/lib/law-article/graph-builder', () => ({
  GraphBuilder: {
    buildFullGraph: jest.fn(),
  },
}));

// Mock图算法
jest.mock('@/lib/knowledge-graph/graph-algorithms', () => ({
  GraphAlgorithms: {
    shortestPath: jest.fn(),
    degreeCentrality: jest.fn(),
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
}));

describe('GET /api/v1/knowledge-graph/enterprise-risk-analysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('参数验证', () => {
    it('应该拒绝缺少contractId的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: contractId');
    });

    it('应该接受有效的请求', async () => {
      // Mock合同关联法条数据
      (prisma.contractLawArticle.findMany as jest.Mock).mockResolvedValue([
        { lawArticleId: 'article-1' },
      ]);

      // Mock法条详情数据
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article-1',
          lawName: '《民法典》',
          articleNumber: '第123条',
          category: '民法典',
        },
        {
          id: 'article-2',
          lawName: '《民法典》',
          articleNumber: '第456条',
          category: '民法典',
        },
      ]);

      (GraphBuilder.buildFullGraph as jest.Mock).mockResolvedValue({
        nodes: [
          {
            id: 'article-1',
            lawName: '《民法典》',
            articleNumber: '第123条',
            category: '民法典',
          },
          {
            id: 'article-2',
            lawName: '《民法典》',
            articleNumber: '第456条',
            category: '民法典',
          },
        ],
        links: [
          {
            source: 'article-1',
            target: 'article-2',
            relationType: 'CONFLICTS',
          },
        ],
      });

      (GraphAlgorithms.shortestPath as jest.Mock).mockReturnValue({
        path: ['article-1', 'article-2'],
        pathLength: 1,
        relationTypes: ['CONFLICTS'],
        exists: true,
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis?contractId=contract-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('风险分析功能', () => {
    beforeEach(() => {
      // Mock合同关联法条数据
      (prisma.contractLawArticle.findMany as jest.Mock).mockResolvedValue([
        { lawArticleId: 'article-1' },
        { lawArticleId: 'article-2' },
      ]);

      // Mock法条详情数据
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article-1',
          lawName: '《民法典》',
          articleNumber: '第123条',
          category: '民法典',
        },
        {
          id: 'article-2',
          lawName: '《民法典》',
          articleNumber: '第456条',
          category: '民法典',
        },
        {
          id: 'article-3',
          lawName: '《合同法》',
          articleNumber: '第789条',
          category: '合同法',
        },
      ]);

      // Mock图谱数据
      (GraphBuilder.buildFullGraph as jest.Mock).mockResolvedValue({
        nodes: [
          {
            id: 'article-1',
            lawName: '《民法典》',
            articleNumber: '第123条',
            category: '民法典',
          },
          {
            id: 'article-2',
            lawName: '《民法典》',
            articleNumber: '第456条',
            category: '民法典',
          },
          {
            id: 'article-3',
            lawName: '《合同法》',
            articleNumber: '第789条',
            category: '合同法',
          },
        ],
        links: [
          {
            source: 'article-1',
            target: 'article-3',
            relationType: 'CITES',
          },
          {
            source: 'article-2',
            target: 'article-3',
            relationType: 'CONFLICTS',
          },
        ],
      });

      // Mock算法
      (GraphAlgorithms.shortestPath as jest.Mock).mockReturnValue({
        path: ['article-1', 'article-3'],
        pathLength: 1,
        relationTypes: ['CITES'],
        exists: true,
      });

      (GraphAlgorithms.degreeCentrality as jest.Mock).mockReturnValue([
        {
          nodeId: 'article-3',
          lawName: '《合同法》',
          articleNumber: '第789条',
          score: 5,
          rank: 1,
        },
      ]);
    });

    it('应该返回风险分析结果', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis?contractId=contract-1&enterpriseId=enterprise-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.contractId).toBe('contract-1');
      expect(data.analysis).toBeDefined();
      expect(data.clauses).toBeDefined();
      expect(data.risks).toBeDefined();
      expect(data.risks).toBeInstanceOf(Array);
    });

    it('应该检测冲突关系', async () => {
      (GraphAlgorithms.shortestPath as jest.Mock).mockReturnValue({
        path: ['article-1', 'article-2'],
        pathLength: 1,
        relationTypes: ['CONFLICTS'],
        exists: true,
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis?contractId=contract-1&enterpriseId=enterprise-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.risks.length).toBeGreaterThan(0);
      expect(data.risks[0]).toMatchObject({
        type: expect.any(String),
        severity: expect.any(String),
      });
    });

    it('应该计算风险等级', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis?contractId=contract-1&enterpriseId=enterprise-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.riskLevel).toBeDefined();
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(data.riskLevel);
    });
  });

  describe('错误处理', () => {
    it('应该处理合同不存在的情况', async () => {
      (prisma.contractLawArticle.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis?contractId=contract-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('合同不存在');
    });

    it('应该处理权限不足的情况', async () => {
      const {
        checkKnowledgeGraphPermission,
      } = require('@/lib/middleware/knowledge-graph-permission');
      (checkKnowledgeGraphPermission as jest.Mock).mockResolvedValue({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis?contractId=contract-1',
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
      (GraphBuilder.buildFullGraph as jest.Mock).mockRejectedValue(
        new Error('图谱构建失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis?contractId=contract-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('应该处理空图谱的情况', async () => {
      (prisma.contractLawArticle.findMany as jest.Mock).mockResolvedValue([]);

      (GraphBuilder.buildFullGraph as jest.Mock).mockResolvedValue({
        nodes: [],
        links: [],
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/enterprise-risk-analysis?contractId=contract-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.risks).toEqual([]);
      expect(data.riskLevel).toBe('LOW');
    });
  });
});
