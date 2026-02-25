/**
 * GET /api/knowledge-graph/cache/stats 测试
 */

import { GET } from '@/app/api/knowledge-graph/cache/stats/route';
import { kgCacheService } from '@/lib/knowledge-graph/cache/service';

// Mock kgCacheService
jest.mock('@/lib/knowledge-graph/cache/service', () => ({
  kgCacheService: {
    getCacheStats: jest.fn(),
  },
}));

describe('GET /api/knowledge-graph/cache/stats', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功返回缓存统计信息', async () => {
    const mockStats = {
      totalEntries: 100,
      byType: {
        node_neighbors: 50,
        shortest_path: 30,
        subgraph: 20,
      },
      hitRate: 0.75,
      totalHits: 750,
      totalRequests: 1000,
      expiringSoon: 10,
      expired: 5,
    };

    (kgCacheService.getCacheStats as jest.Mock).mockResolvedValue(mockStats);

    const request = new Request(
      'http://localhost:3000/api/knowledge-graph/cache/stats'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual(mockStats);
    expect(data.meta).toHaveProperty('timestamp');
  });

  it('获取统计失败时应该返回500错误', async () => {
    (kgCacheService.getCacheStats as jest.Mock).mockResolvedValue(null);

    const request = new Request(
      'http://localhost:3000/api/knowledge-graph/cache/stats'
    );
    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toHaveProperty('code', 'CACHE_STATS_ERROR');
    expect(data.error).toHaveProperty('message', '获取缓存统计失败');
  });
});
