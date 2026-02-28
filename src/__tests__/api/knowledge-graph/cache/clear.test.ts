/**
 * POST /api/knowledge-graph/cache/clear 测试
 */

import { POST } from '@/app/api/knowledge-graph/cache/clear/route';
import { kgCacheService } from '@/lib/knowledge-graph/cache/service';

// Mock kgCacheService
jest.mock('@/lib/knowledge-graph/cache/service', () => ({
  kgCacheService: {
    clearCache: jest.fn(),
  },
}));

describe('POST /api/knowledge-graph/cache/clear', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功清理所有缓存', async () => {
    (kgCacheService.clearCache as jest.Mock).mockResolvedValue(100);

    const request = new Request(
      'http://localhost:3000/api/knowledge-graph/cache/clear',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.clearedCount).toBe(100);
    expect(data.data.cacheType).toBe('all');
    expect(kgCacheService.clearCache).toHaveBeenCalledWith(undefined);
  });

  it('应该成功清理指定类型的缓存', async () => {
    (kgCacheService.clearCache as jest.Mock).mockResolvedValue(50);

    const request = new Request(
      'http://localhost:3000/api/knowledge-graph/cache/clear',
      {
        method: 'POST',
        body: JSON.stringify({ cacheType: 'node_neighbors' }),
      }
    );
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.clearedCount).toBe(50);
    expect(data.data.cacheType).toBe('node_neighbors');
    expect(kgCacheService.clearCache).toHaveBeenCalledWith('node_neighbors');
  });

  it('应该处理空的请求体', async () => {
    (kgCacheService.clearCache as jest.Mock).mockResolvedValue(0);

    const request = new Request(
      'http://localhost:3000/api/knowledge-graph/cache/clear',
      {
        method: 'POST',
      }
    );
    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.cacheType).toBe('all');
  });
});
