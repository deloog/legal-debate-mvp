import { GET } from '@/app/api/cases/[id]/law-graph/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkPermission } from '@/lib/case/case-permission-manager';
import { checkResourceOwnership } from '@/lib/middleware/resource-permission';
import { CaseKnowledgeGraphAnalyzer } from '@/lib/case/knowledge-graph-analyzer';
import { prisma } from '@/lib/db';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/resource-permission', () => ({
  ResourceType: { CASE: 'CASE' },
  checkResourceOwnership: jest.fn(),
}));

jest.mock('@/lib/case/case-permission-manager', () => ({
  checkPermission: jest.fn(),
}));

jest.mock('@/lib/case/knowledge-graph-analyzer', () => ({
  CaseKnowledgeGraphAnalyzer: {
    analyze: jest.fn(),
  },
}));

jest.mock('@/lib/db', () => ({
  prisma: {
    case: {
      findFirst: jest.fn(),
    },
  },
}));

const request = new Request('http://localhost/api/cases/case-1/law-graph');
const params = { params: Promise.resolve({ id: 'case-1' }) };

describe('GET /api/cases/[id]/law-graph', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('未登录返回 401', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue(null);

    const response = await GET(request as never, params);

    expect(response.status).toBe(401);
  });

  it('案件不存在返回 404', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-1' });
    (prisma.case.findFirst as jest.Mock).mockResolvedValue(null);

    const response = await GET(request as never, params);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.message).toBe('案件不存在');
  });

  it('非所有人且无 VIEW_CASE 权限返回 403', async () => {
    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-1' });
    (prisma.case.findFirst as jest.Mock).mockResolvedValue({ id: 'case-1' });
    (checkResourceOwnership as jest.Mock).mockResolvedValue({
      hasPermission: false,
    });
    (checkPermission as jest.Mock).mockResolvedValue({ hasPermission: false });

    const response = await GET(request as never, params);

    expect(response.status).toBe(403);
    expect(CaseKnowledgeGraphAnalyzer.analyze).not.toHaveBeenCalled();
  });

  it('团队成员具备 VIEW_CASE 权限时返回案件图谱', async () => {
    const graphResult = {
      hasData: true,
      articleIds: ['article-1'],
      conflicts: [],
      evolutionChain: [],
      recommendedArticleIds: [],
      keyInferences: [],
      graphData: { nodes: [], links: [] },
    };

    (getAuthUser as jest.Mock).mockResolvedValue({ userId: 'user-1' });
    (prisma.case.findFirst as jest.Mock).mockResolvedValue({ id: 'case-1' });
    (checkResourceOwnership as jest.Mock).mockResolvedValue({
      hasPermission: false,
    });
    (checkPermission as jest.Mock).mockResolvedValue({ hasPermission: true });
    (CaseKnowledgeGraphAnalyzer.analyze as jest.Mock).mockResolvedValue(
      graphResult
    );

    const response = await GET(request as never, params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, data: graphResult });
    expect(checkPermission).toHaveBeenCalledWith(
      'user-1',
      'case-1',
      'VIEW_CASE'
    );
  });
});
