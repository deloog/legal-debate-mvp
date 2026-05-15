import { GET as getSnapshots } from '@/app/api/v1/knowledge-graph/snapshots/route';
import { GET as getLatestSnapshot } from '@/app/api/v1/knowledge-graph/snapshots/latest/route';
import { GET as getSnapshotDetail } from '@/app/api/v1/knowledge-graph/snapshots/[snapshotId]/route';
import { GET as compareSnapshots } from '@/app/api/v1/knowledge-graph/snapshots/[snapshotId]/compare/route';
import { getAuthUser } from '@/lib/middleware/auth';
import { checkKnowledgeGraphPermission } from '@/lib/middleware/knowledge-graph-permission';
import { snapshotService } from '@/lib/knowledge-graph/version-control';

jest.mock('@/lib/middleware/auth', () => ({
  getAuthUser: jest.fn(),
}));

jest.mock('@/lib/middleware/knowledge-graph-permission', () => ({
  checkKnowledgeGraphPermission: jest.fn(),
  logKnowledgeGraphAction: jest.fn(),
  KnowledgeGraphAction: {
    VIEW_STATS: 'VIEW_STATS',
    MANAGE_RELATIONS: 'MANAGE_RELATIONS',
  },
  KnowledgeGraphResource: {
    GRAPH: 'knowledge_graph',
  },
}));

jest.mock('@/lib/knowledge-graph/version-control', () => ({
  snapshotService: {
    getSnapshots: jest.fn(),
    getLatestSnapshot: jest.fn(),
    getSnapshot: jest.fn(),
    compareSnapshots: jest.fn(),
  },
}));

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCheckPermission = checkKnowledgeGraphPermission as jest.Mock;
const mockSnapshotService = snapshotService as jest.Mocked<
  typeof snapshotService
>;

function params(snapshotId: string) {
  return { params: Promise.resolve({ snapshotId }) };
}

describe('Knowledge graph snapshot routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'ADMIN',
    });
    mockCheckPermission.mockResolvedValue({ hasPermission: true });
  });

  it('列表接口使用 VIEW_STATS 权限', async () => {
    mockSnapshotService.getSnapshots.mockResolvedValue({
      snapshots: [],
      total: 0,
      page: 1,
      pageSize: 20,
    } as any);

    const response = await getSnapshots(
      new Request('http://localhost/api/v1/knowledge-graph/snapshots') as any
    );

    expect(response.status).toBe(200);
    expect(mockCheckPermission).toHaveBeenCalledWith(
      'admin-1',
      'VIEW_STATS',
      'knowledge_graph'
    );
  });

  it('列表接口参数错误返回 400', async () => {
    const response = await getSnapshots(
      new Request(
        'http://localhost/api/v1/knowledge-graph/snapshots?version=YEARLY'
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
    expect(mockSnapshotService.getSnapshots).not.toHaveBeenCalled();
  });

  it('列表接口服务异常返回 500 而不是伪装成空数据', async () => {
    mockSnapshotService.getSnapshots.mockRejectedValueOnce(
      new Error('snapshot table missing')
    );

    const response = await getSnapshots(
      new Request('http://localhost/api/v1/knowledge-graph/snapshots') as any
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });

  it('最新快照未登录返回 401', async () => {
    mockGetAuthUser.mockResolvedValueOnce(null);

    const response = await getLatestSnapshot(
      new Request(
        'http://localhost/api/v1/knowledge-graph/snapshots/latest'
      ) as any
    );

    expect(response.status).toBe(401);
    expect(mockCheckPermission).not.toHaveBeenCalled();
  });

  it('最新快照权限不足返回 403', async () => {
    mockCheckPermission.mockResolvedValueOnce({ hasPermission: false });

    const response = await getLatestSnapshot(
      new Request(
        'http://localhost/api/v1/knowledge-graph/snapshots/latest'
      ) as any
    );

    expect(response.status).toBe(403);
    expect(mockSnapshotService.getLatestSnapshot).not.toHaveBeenCalled();
  });

  it('最新快照通过权限后返回数据', async () => {
    mockSnapshotService.getLatestSnapshot.mockResolvedValue({
      id: 'snapshot-1',
      versionLabel: 'manual-1',
    } as any);

    const response = await getLatestSnapshot(
      new Request(
        'http://localhost/api/v1/knowledge-graph/snapshots/latest'
      ) as any
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('snapshot-1');
  });

  it('快照详情权限不足返回 403', async () => {
    mockCheckPermission.mockResolvedValueOnce({ hasPermission: false });

    const response = await getSnapshotDetail(
      new Request(
        'http://localhost/api/v1/knowledge-graph/snapshots/snapshot-1'
      ) as any,
      params('snapshot-1')
    );

    expect(response.status).toBe(403);
    expect(mockSnapshotService.getSnapshot).not.toHaveBeenCalled();
  });

  it('快照比较权限不足返回 403', async () => {
    mockCheckPermission.mockResolvedValueOnce({ hasPermission: false });

    const response = await compareSnapshots(
      new Request(
        'http://localhost/api/v1/knowledge-graph/snapshots/snapshot-1/compare?compareWithId=snapshot-2'
      ) as any,
      params('snapshot-1')
    );

    expect(response.status).toBe(403);
    expect(mockSnapshotService.compareSnapshots).not.toHaveBeenCalled();
  });

  it('快照比较缺 compareWithId 返回 400', async () => {
    const response = await compareSnapshots(
      new Request(
        'http://localhost/api/v1/knowledge-graph/snapshots/snapshot-1/compare'
      ) as any,
      params('snapshot-1')
    );

    expect(response.status).toBe(400);
  });
});
