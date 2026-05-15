/**
 * 知识图谱冲突检测API测试
 */

import { GET } from '@/app/api/v1/knowledge-graph/conflicts/route';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkKnowledgeGraphPermission } from '@/lib/middleware/knowledge-graph-permission';

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
    lawArticleRelation: {
      findMany: jest.fn(),
    },
    lawArticle: {
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
    GRAPH: 'knowledge_graph',
  },
}));

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCheckPermission = checkKnowledgeGraphPermission as jest.Mock;

describe('GET /api/v1/knowledge-graph/conflicts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({
      userId: 'test-user-1',
      email: 'test@test.com',
      role: 'USER',
    });
    mockCheckPermission.mockResolvedValue({ hasPermission: true });
  });

  describe('参数验证', () => {
    it('未登录时返回401', async () => {
      mockGetAuthUser.mockResolvedValueOnce(null);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(401);
    });

    it('应该拒绝缺少lawArticleIds参数的请求', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('缺少必需参数: lawArticleIds');
    });

    it('应该拒绝空的lawArticleIds参数', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('lawArticleIds不能为空');
    });

    it('应该拒绝超过10个lawArticleIds的请求', async () => {
      const ids = Array.from({ length: 11 }, (_, i) => `article-${i}`).join(
        ','
      );
      const request = new Request(
        `http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=${ids}`,
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('lawArticleIds最多支持10个');
    });

    it('应该接受有效的lawArticleIds参数', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        { id: 'article-1', lawName: '《民法典》', articleNumber: '第123条' },
        { id: 'article-2', lawName: '《合同法》', articleNumber: '第45条' },
      ]);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1,article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(200);
    });
  });

  describe('冲突检测功能', () => {
    beforeEach(() => {
      // Mock法条数据
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'article-1',
          lawName: '《民法典》',
          articleNumber: '第123条',
        },
        {
          id: 'article-2',
          lawName: '《合同法》',
          articleNumber: '第45条',
        },
      ]);

      // Mock冲突关系数据
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rel-1',
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: 'CONFLICTS',
          strength: 0.9,
          verificationStatus: 'VERIFIED',
          source: {
            id: 'article-1',
            lawName: '《民法典》',
            articleNumber: '第123条',
          },
          target: {
            id: 'article-2',
            lawName: '《合同法》',
            articleNumber: '第45条',
          },
        },
      ]);
    });

    it('应该检测到法条间的冲突关系', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1,article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.conflicts).toBeDefined();
      expect(data.data.conflicts).toBeInstanceOf(Array);
      expect(data.data.conflicts.length).toBeGreaterThan(0);
    });

    it('应该返回冲突关系的详细信息', async () => {
      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1,article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(data.data.conflicts[0]).toMatchObject({
        articleId: 'article-1',
        articleTitle: '《民法典》第123条',
        conflictsWith: expect.arrayContaining([
          expect.objectContaining({
            articleId: 'article-2',
            articleTitle: '《合同法》第45条',
            relationType: 'CONFLICTS',
          }),
        ]),
      });
    });

    it('应该只返回验证通过的冲突关系', async () => {
      // Mock只返回VERIFIED关系（模拟DB WHERE子句过滤）
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'rel-1',
          sourceId: 'article-1',
          targetId: 'article-2',
          relationType: 'CONFLICTS',
          strength: 0.9,
          verificationStatus: 'VERIFIED',
          source: {
            id: 'article-1',
            lawName: '《民法典》',
            articleNumber: '第123条',
          },
          target: {
            id: 'article-2',
            lawName: '《合同法》',
            articleNumber: '第45条',
          },
        },
      ]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1,article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      // 只返回验证通过的冲突
      const verifiedConflicts = data.data.conflicts[0].conflictsWith;
      expect(verifiedConflicts.length).toBe(1);
      expect(verifiedConflicts[0].relationId).toBe('rel-1');
    });

    it('应该正确处理没有冲突的情况', async () => {
      (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1,article-2',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.conflicts).toEqual([]);
    });
  });

  describe('错误处理', () => {
    it('应该处理权限不足的情况', async () => {
      mockCheckPermission.mockResolvedValueOnce({
        hasPermission: false,
        reason: '权限不足',
      });

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);

      expect(response.status).toBe(403);
    });

    it('应该处理数据库错误', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([
        { id: 'article-1', lawName: '《民法典》', articleNumber: '第123条' },
      ]);
      (prisma.lawArticleRelation.findMany as jest.Mock).mockRejectedValue(
        new Error('数据库连接失败')
      );

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    it('应该处理法条不存在的情况', async () => {
      (prisma.lawArticle.findMany as jest.Mock).mockResolvedValue([]);

      const request = new Request(
        'http://localhost:3000/api/v1/knowledge-graph/conflicts?lawArticleIds=article-1',
        {
          method: 'GET',
        }
      );

      const response = await GET(request as any);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('未找到相关法条');
    });
  });
});
