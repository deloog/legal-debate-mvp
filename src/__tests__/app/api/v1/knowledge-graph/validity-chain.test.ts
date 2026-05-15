/**
 * 知识图谱效力链追踪API测试
 */

import { GET } from '@/app/api/v1/knowledge-graph/validity-chain/route';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkKnowledgeGraphPermission } from '@/lib/middleware/knowledge-graph-permission';

// Mock数据库
jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findUnique: jest.fn(),
    },
    lawArticleRelation: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
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
    RELATION: 'law_article_relation',
  },
}));

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCheckPermission = checkKnowledgeGraphPermission as jest.Mock;

describe('GET /api/v1/knowledge-graph/validity-chain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({
      userId: 'user-123',
      email: 'user@example.com',
      role: 'USER',
    });
    mockCheckPermission.mockResolvedValue({ hasPermission: true });
  });

  describe('参数验证', () => {
    it('未登录时返回401', async () => {
      mockGetAuthUser.mockResolvedValueOnce(null);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(401);
    });

    it('应该拒绝缺少lawArticleId参数的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: lawArticleId');
    });
  });

  describe('效力链追踪功能', () => {
    beforeEach(() => {
      // Mock源法条
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
        id: 'article-1',
        lawName: '《民法典》',
        articleNumber: '第123条',
        status: 'VALID',
        effectiveDate: new Date('2020-01-01'),
      });

      // Mock替代关系
      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue({
        targetId: 'article-2',
        verifiedAt: new Date('2021-01-01'),
      });
    });

    it('应该返回法条的效力链', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.articleId).toBe('article-1');
      expect(data.chain).toBeDefined();
      expect(data.chain).toBeInstanceOf(Array);
      expect(data.chainLength).toBeGreaterThan(0);
    });

    it('应该返回效力链节点的完整信息', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.chain[0]).toMatchObject({
        id: expect.any(String),
        title: expect.any(String),
        status: expect.any(String),
      });
    });

    it('应该包含替代关系信息', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.chain[0].replacedBy).toBe('article-2');
      expect(data.chain[0].replacedAt).toBeDefined();
    });

    it('应该处理没有替代关系的情况', async () => {
      (prisma.lawArticleRelation.findFirst as jest.Mock).mockResolvedValue(
        null
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chain[0].replacedBy).toBeUndefined();
    });

    it('应该限制最大追踪深度', async () => {
      // Mock多个替代关系
      const callCount = jest.fn();
      (prisma.lawArticleRelation.findFirst as jest.Mock).mockImplementation(
        () => {
          callCount();
          return {
            targetId: `article-${callCount.mock.calls.length + 1}`,
            verifiedAt: new Date('2021-01-01'),
          };
        }
      );

      (prisma.lawArticle.findUnique as jest.Mock).mockImplementation(
        (params: any) => {
          if (params.where.id === 'article-1') {
            return {
              id: 'article-1',
              lawName: '《民法典》',
              articleNumber: '第123条',
              status: 'VALID',
              effectiveDate: new Date('2020-01-01'),
            };
          }
          return {
            id: params.where.id,
            lawName: '《民法典》',
            articleNumber: '第124条',
            status: 'VALID',
            effectiveDate: new Date('2020-01-01'),
          };
        }
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      // 最大深度是10
      expect(data.chain.length).toBeLessThanOrEqual(10);
    });
  });

  describe('错误处理', () => {
    it('应该处理权限不足的情况', async () => {
      mockCheckPermission.mockResolvedValueOnce({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(403);
    });

    it('应该处理法条不存在的情况', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('未找到该法条');
    });

    it('应该处理数据库错误', async () => {
      (prisma.lawArticle.findUnique as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('应该处理循环引用', async () => {
      // 模拟循环引用
      let callCount = 0;
      (prisma.lawArticleRelation.findFirst as jest.Mock).mockImplementation(
        () => {
          callCount++;
          return {
            targetId: callCount > 5 ? 'article-1' : `article-${callCount + 1}`,
            verifiedAt: new Date('2021-01-01'),
          };
        }
      );

      (prisma.lawArticle.findUnique as jest.Mock).mockImplementation(
        (params: any) => ({
          id: params.where.id,
          lawName: '《民法典》',
          articleNumber: '第123条',
          status: 'VALID',
          effectiveDate: new Date('2020-01-01'),
        })
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/validity-chain?lawArticleId=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      // 应该在检测到循环时停止（最大深度10）
      expect(data.chain.length).toBeLessThanOrEqual(10);
    });
  });
});
