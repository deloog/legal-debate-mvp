import { GET } from '@/app/api/v1/knowledge-graph/recommendations/route';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
} from '@/lib/middleware/knowledge-graph-permission';

jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticle: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    lawArticleRelation: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(),
  logKnowledgeGraphAction: jest.fn(),
  KnowledgeGraphAction: {
    VIEW_RELATIONS: 'VIEW_RELATIONS',
  },
  KnowledgeGraphResource: {
    GRAPH: 'GRAPH',
  },
}));

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCheckPermission = checkKnowledgeGraphPermission as jest.Mock;
const mockLogAction = logKnowledgeGraphAction as jest.Mock;

describe('GET /api/v1/knowledge-graph/recommendations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({
      userId: 'user-123',
      email: 'user@example.com',
      role: 'USER',
    });
    mockCheckPermission.mockResolvedValue({ hasPermission: true });
    mockLogAction.mockResolvedValue(undefined);
  });

  it('未登录时返回 401', async () => {
    mockGetAuthUser.mockResolvedValueOnce(null);

    const response = await GET(
      new Request(
        'http://localhost/api/v1/knowledge-graph/recommendations'
      ) as any
    );

    expect(response.status).toBe(401);
  });

  it('权限不足时返回 403', async () => {
    mockCheckPermission.mockResolvedValueOnce({ hasPermission: false });

    const response = await GET(
      new Request(
        'http://localhost/api/v1/knowledge-graph/recommendations?articleId=article-1'
      ) as any
    );

    expect(response.status).toBe(403);
  });

  it('缺少 articleId 时返回 400 而不是静默空结果', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/v1/knowledge-graph/recommendations'
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.message).toBe('缺少必需参数: articleId');
    expect(prisma.lawArticle.findUnique).not.toHaveBeenCalled();
  });

  it('直接关系推荐同时支持入边和出边', async () => {
    (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
      id: 'article-1',
      lawName: '民法典',
      articleNumber: '第667条',
      category: 'CIVIL',
    });
    (prisma.lawArticleRelation.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'rel-incoming',
        sourceId: 'article-2',
        targetId: 'article-1',
        relationType: 'RELATED',
        strength: 0.82,
        source: {
          id: 'article-2',
          lawName: '民法典',
          articleNumber: '第668条',
        },
        target: {
          id: 'article-1',
          lawName: '民法典',
          articleNumber: '第667条',
        },
      },
      {
        id: 'rel-outgoing',
        sourceId: 'article-1',
        targetId: 'article-3',
        relationType: 'COMPLETES',
        strength: 0.72,
        source: {
          id: 'article-1',
          lawName: '民法典',
          articleNumber: '第667条',
        },
        target: {
          id: 'article-3',
          lawName: '民法典',
          articleNumber: '第669条',
        },
      },
    ]);

    const response = await GET(
      new Request(
        'http://localhost/api/v1/knowledge-graph/recommendations?articleId=article-1&mode=relations'
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(
      data.data.recommendations.map((item: any) => item.articleId)
    ).toEqual(['article-2', 'article-3']);
    expect(prisma.lawArticleRelation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ sourceId: 'article-1' }, { targetId: 'article-1' }],
        }),
      })
    );
  });

  it('无效模式返回参数错误', async () => {
    (prisma.lawArticle.findUnique as jest.Mock).mockResolvedValue({
      id: 'article-1',
      lawName: '民法典',
      articleNumber: '第667条',
      category: 'CIVIL',
    });

    const response = await GET(
      new Request(
        'http://localhost/api/v1/knowledge-graph/recommendations?articleId=article-1&mode=unknown'
      ) as any
    );

    expect(response.status).toBe(422);
  });
});
