import {
  GET,
  POST,
} from '@/app/api/v1/knowledge-graph/generate-relations/route';
import { prisma } from '@/lib/db';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkKnowledgeGraphPermission } from '@/lib/middleware/knowledge-graph-permission';
import {
  generateLayer1Relations,
  getLastGeneratedAt,
} from '@/lib/knowledge-graph/relation-generator';

jest.mock('@/lib/db', () => ({
  prisma: {
    lawArticleRelation: {
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(),
  KnowledgeGraphAction: {
    MANAGE_RELATIONS: 'manage_relations',
    VIEW_STATS: 'view_stats',
  },
  KnowledgeGraphResource: {
    RELATION: 'law_article_relation',
    STATS: 'knowledge_graph_stats',
  },
}));

jest.mock('@/lib/knowledge-graph/relation-generator', () => ({
  generateLayer1Relations: jest.fn(),
  getLastGeneratedAt: jest.fn(),
}));

const mockGetAuthUser = getAuthUser as jest.MockedFunction<typeof getAuthUser>;
const mockPermission = checkKnowledgeGraphPermission as jest.MockedFunction<
  typeof checkKnowledgeGraphPermission
>;

describe('GET/POST /api/v1/knowledge-graph/generate-relations', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAuthUser.mockResolvedValue({
      userId: 'admin-user-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
    mockPermission.mockResolvedValue({ hasPermission: true });
    (getLastGeneratedAt as jest.Mock).mockResolvedValue(
      new Date('2026-01-01T00:00:00.000Z')
    );
    (generateLayer1Relations as jest.Mock).mockResolvedValue({
      supersedesCreated: 1,
      citesCreated: 2,
      implementsCreated: 3,
      totalCreated: 6,
      durationMs: 1234,
    });
    (prisma.lawArticleRelation.count as jest.Mock).mockResolvedValue(10);
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([
      { relationType: 'CITES', method: 'RULE_BASED', cnt: BigInt(4) },
    ]);
  });

  it('POST 应该使用当前 getAuthUser 契约并检查管理权限', async () => {
    const response = await POST(
      new Request(
        'http://localhost/api/v1/knowledge-graph/generate-relations',
        {
          method: 'POST',
          body: JSON.stringify({ mode: 'incremental', rule: 'cites' }),
        }
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toMatchObject({
      mode: 'incremental',
      rule: 'cites',
      totalCreated: 0,
    });
    expect(mockGetAuthUser).toHaveBeenCalled();
    expect(mockPermission).toHaveBeenCalledWith(
      'admin-user-1',
      'manage_relations',
      'law_article_relation'
    );
  });

  it('POST 应该拒绝未登录请求', async () => {
    mockGetAuthUser.mockResolvedValueOnce(null);

    const response = await POST(
      new Request(
        'http://localhost/api/v1/knowledge-graph/generate-relations',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error.code).toBe('UNAUTHORIZED');
    expect(generateLayer1Relations).not.toHaveBeenCalled();
  });

  it('POST 应该拒绝没有管理权限的用户', async () => {
    mockPermission.mockResolvedValueOnce({
      hasPermission: false,
      reason: '需要管理员权限',
    });

    const response = await POST(
      new Request(
        'http://localhost/api/v1/knowledge-graph/generate-relations',
        {
          method: 'POST',
          body: JSON.stringify({}),
        }
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('FORBIDDEN');
    expect(generateLayer1Relations).not.toHaveBeenCalled();
  });

  it('POST 应该校验 mode 和 rule', async () => {
    const badMode = await POST(
      new Request(
        'http://localhost/api/v1/knowledge-graph/generate-relations',
        {
          method: 'POST',
          body: JSON.stringify({ mode: 'bad' }),
        }
      ) as any
    );
    expect(badMode.status).toBe(400);

    const badRule = await POST(
      new Request(
        'http://localhost/api/v1/knowledge-graph/generate-relations',
        {
          method: 'POST',
          body: JSON.stringify({ rule: 'bad' }),
        }
      ) as any
    );
    expect(badRule.status).toBe(400);
  });

  it('GET 应该使用当前 getAuthUser 契约并检查统计权限', async () => {
    const response = await GET(
      new Request(
        'http://localhost/api/v1/knowledge-graph/generate-relations'
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.totalRelations).toBe(10);
    expect(data.data.distribution).toEqual({
      CITES: { RULE_BASED: 4 },
    });
    expect(mockPermission).toHaveBeenCalledWith(
      'admin-user-1',
      'view_stats',
      'knowledge_graph_stats'
    );
  });

  it('GET 应该拒绝没有统计权限的用户', async () => {
    mockPermission.mockResolvedValueOnce({
      hasPermission: false,
      reason: '权限不足',
    });

    const response = await GET(
      new Request(
        'http://localhost/api/v1/knowledge-graph/generate-relations'
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error.code).toBe('FORBIDDEN');
  });
});
