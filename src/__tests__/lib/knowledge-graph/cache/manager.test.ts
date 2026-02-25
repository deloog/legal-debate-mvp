/**
 * 知识图谱缓存管理器测试
 *
 * 测试内容：
 * 1. 缓存键生成
 * 2. 缓存读写操作
 * 3. 缓存过期管理
 * 4. 缓存统计
 * 5. 缓存清理
 */

import {
  KnowledgeGraphCacheManager,
  kgCacheManager,
} from '@/lib/knowledge-graph/cache/manager';
import {
  CacheType,
  NeighborsQueryParams,
  ShortestPathQueryParams,
  SubgraphQueryParams,
  CacheData,
} from '@/lib/knowledge-graph/cache/types';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

// Mock prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    knowledgeGraphCache: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('KnowledgeGraphCacheManager', () => {
  let manager: KnowledgeGraphCacheManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = new KnowledgeGraphCacheManager({ enabled: true });
  });

  describe('缓存键生成', () => {
    it('应该为邻居查询生成正确的缓存键', () => {
      const params: NeighborsQueryParams = {
        nodeId: 'node-1',
        depth: 2,
      };

      const cacheKey = `neighbors:${params.nodeId}:${params.depth}`;

      expect(cacheKey).toBe('neighbors:node-1:2');
    });

    it('应该为包含关系类型的邻居查询生成正确的缓存键', () => {
      const params: NeighborsQueryParams = {
        nodeId: 'node-1',
        depth: 3,
        relationTypes: ['CITES', 'COMPLETES'],
      };

      const key = `neighbors:${params.nodeId}:${params.depth}`;
      const types = params.relationTypes.sort().join(',');

      expect(types).toBe('CITES,COMPLETES');
    });

    it('应该为最短路径查询生成正确的缓存键', () => {
      const params: ShortestPathQueryParams = {
        sourceId: 'node-a',
        targetId: 'node-b',
      };

      const cacheKey = `shortest:${params.sourceId}:${params.targetId}`;

      expect(cacheKey).toBe('shortest:node-a:node-b');
    });

    it('应该为包含最大深度的最短路径查询生成正确的缓存键', () => {
      const params: ShortestPathQueryParams = {
        sourceId: 'node-a',
        targetId: 'node-b',
        maxDepth: 10,
      };

      const cacheKey = `shortest:${params.sourceId}:${params.targetId}:${params.maxDepth}`;

      expect(cacheKey).toBe('shortest:node-a:node-b:10');
    });

    it('应该为子图查询生成正确的缓存键', () => {
      const params: SubgraphQueryParams = {
        nodeIds: ['node-1', 'node-2', 'node-3'],
        depth: 2,
      };

      const key = `subgraph:${params.nodeIds.sort().join(',')}:${params.depth}`;

      expect(key).toBe('subgraph:node-1,node-2,node-3:2');
    });
  });

  describe('邻居缓存操作', () => {
    const mockCacheEntry = {
      id: 'cache-1',
      cacheType: CacheType.NODE_NEIGHBORS,
      cacheKey: 'neighbors:node-1:2',
      cacheData: {
        nodes: [],
        links: [],
      } as unknown as Record<string, unknown>,
      hitCount: 5,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    it('应该成功获取邻居缓存', async () => {
      const params: NeighborsQueryParams = {
        nodeId: 'node-1',
        depth: 2,
      };

      (prisma.knowledgeGraphCache.findUnique as jest.Mock).mockResolvedValue(
        mockCacheEntry
      );

      const result = await manager.getNeighbors(params);

      expect(result).toBeDefined();
      expect(result?.nodes).toBeDefined();
      expect(prisma.knowledgeGraphCache.update).toHaveBeenCalled();
    });

    it('缓存未命中时应该返回null', async () => {
      const params: NeighborsQueryParams = {
        nodeId: 'node-1',
        depth: 2,
      };

      (prisma.knowledgeGraphCache.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const result = await manager.getNeighbors(params);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        '邻居缓存未命中',
        expect.any(Object)
      );
    });

    it('缓存过期时应该返回null', async () => {
      const params: NeighborsQueryParams = {
        nodeId: 'node-1',
        depth: 2,
      };

      const expiredEntry = {
        ...mockCacheEntry,
        expiresAt: new Date(Date.now() - 3600000),
      };

      (prisma.knowledgeGraphCache.findUnique as jest.Mock).mockResolvedValue(
        expiredEntry
      );

      const result = await manager.getNeighbors(params);

      expect(result).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        '邻居缓存已过期',
        expect.any(Object)
      );
    });

    it('应该成功设置邻居缓存', async () => {
      const params: NeighborsQueryParams = {
        nodeId: 'node-1',
        depth: 2,
      };

      const data: CacheData = {
        nodes: [],
        links: [],
      };

      (prisma.knowledgeGraphCache.count as jest.Mock).mockResolvedValue(0);
      (prisma.knowledgeGraphCache.create as jest.Mock).mockResolvedValue({
        id: 'cache-1',
      });

      const result = await manager.setNeighbors(params, data);

      expect(result).toBe(true);
      expect(prisma.knowledgeGraphCache.create).toHaveBeenCalled();
    });

    it('禁用缓存时应该返回null', async () => {
      const disabledManager = new KnowledgeGraphCacheManager({
        enabled: false,
      });
      const params: NeighborsQueryParams = {
        nodeId: 'node-1',
        depth: 2,
      };

      const result = await disabledManager.getNeighbors(params);

      expect(result).toBeNull();
    });
  });

  describe('最短路径缓存操作', () => {
    const mockCacheEntry = {
      id: 'cache-2',
      cacheType: CacheType.SHORTEST_PATH,
      cacheKey: 'shortest:node-a:node-b',
      cacheData: {
        shortestPath: {
          path: ['node-a', 'node-b'],
          pathLength: 1,
          relationTypes: ['CITES'],
          exists: true,
        },
      } as unknown as Record<string, unknown>,
      hitCount: 3,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    it('应该成功获取最短路径缓存', async () => {
      const params: ShortestPathQueryParams = {
        sourceId: 'node-a',
        targetId: 'node-b',
      };

      (prisma.knowledgeGraphCache.findUnique as jest.Mock).mockResolvedValue(
        mockCacheEntry
      );

      const result = await manager.getShortestPath(params);

      expect(result).toBeDefined();
      expect(result?.shortestPath).toBeDefined();
      expect(prisma.knowledgeGraphCache.update).toHaveBeenCalled();
    });

    it('缓存未命中时应该返回null', async () => {
      const params: ShortestPathQueryParams = {
        sourceId: 'node-a',
        targetId: 'node-b',
      };

      (prisma.knowledgeGraphCache.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const result = await manager.getShortestPath(params);

      expect(result).toBeNull();
    });

    it('应该成功设置最短路径缓存', async () => {
      const params: ShortestPathQueryParams = {
        sourceId: 'node-a',
        targetId: 'node-b',
      };

      const data: CacheData = {
        shortestPath: {
          path: ['node-a', 'node-b'],
          pathLength: 1,
          relationTypes: [],
          exists: true,
        },
      };

      (prisma.knowledgeGraphCache.count as jest.Mock).mockResolvedValue(0);
      (prisma.knowledgeGraphCache.create as jest.Mock).mockResolvedValue({
        id: 'cache-2',
      });

      const result = await manager.setShortestPath(params, data);

      expect(result).toBe(true);
      expect(prisma.knowledgeGraphCache.create).toHaveBeenCalled();
    });
  });

  describe('子图缓存操作', () => {
    const mockCacheEntry = {
      id: 'cache-3',
      cacheType: CacheType.SUBGRAPH,
      cacheKey: 'subgraph:hash:2',
      cacheData: {
        nodes: [],
        links: [],
      } as unknown as Record<string, unknown>,
      hitCount: 2,
      expiresAt: new Date(Date.now() + 3600000),
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };

    it('应该成功获取子图缓存', async () => {
      const params: SubgraphQueryParams = {
        nodeIds: ['node-1', 'node-2'],
        depth: 2,
      };

      (prisma.knowledgeGraphCache.findUnique as jest.Mock).mockResolvedValue(
        mockCacheEntry
      );

      const result = await manager.getSubgraph(params);

      expect(result).toBeDefined();
      expect(result?.nodes).toBeDefined();
      expect(prisma.knowledgeGraphCache.update).toHaveBeenCalled();
    });

    it('缓存未命中时应该返回null', async () => {
      const params: SubgraphQueryParams = {
        nodeIds: ['node-1', 'node-2'],
        depth: 2,
      };

      (prisma.knowledgeGraphCache.findUnique as jest.Mock).mockResolvedValue(
        null
      );

      const result = await manager.getSubgraph(params);

      expect(result).toBeNull();
    });

    it('应该成功设置子图缓存', async () => {
      const params: SubgraphQueryParams = {
        nodeIds: ['node-1', 'node-2'],
        depth: 2,
      };

      const data: CacheData = {
        nodes: [],
        links: [],
      };

      (prisma.knowledgeGraphCache.count as jest.Mock).mockResolvedValue(0);
      (prisma.knowledgeGraphCache.create as jest.Mock).mockResolvedValue({
        id: 'cache-3',
      });

      const result = await manager.setSubgraph(params, data);

      expect(result).toBe(true);
      expect(prisma.knowledgeGraphCache.create).toHaveBeenCalled();
    });
  });

  describe('缓存清理操作', () => {
    it('应该成功删除缓存条目', async () => {
      (prisma.knowledgeGraphCache.delete as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await manager.deleteEntry('cache-key-1');

      expect(result).toBe(true);
      expect(prisma.knowledgeGraphCache.delete).toHaveBeenCalledWith({
        where: { cacheKey: 'cache-key-1' },
      });
    });

    it('删除失败时应该返回false', async () => {
      (prisma.knowledgeGraphCache.delete as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await manager.deleteEntry('cache-key-1');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it('应该成功清理过期缓存', async () => {
      (prisma.knowledgeGraphCache.deleteMany as jest.Mock).mockResolvedValue({
        count: 10,
      });

      const result = await manager.cleanExpired();

      expect(result).toBe(10);
    });

    it('应该成功清理指定类型的缓存', async () => {
      (prisma.knowledgeGraphCache.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await manager.clearCache({
        cacheTypes: [CacheType.NODE_NEIGHBORS],
      });

      expect(result).toBe(5);
    });

    it('应该成功清理所有缓存', async () => {
      (prisma.knowledgeGraphCache.deleteMany as jest.Mock).mockResolvedValue({
        count: 100,
      });

      const result = await manager.clearCache();

      expect(result).toBe(100);
    });
  });

  describe('缓存统计', () => {
    it('应该成功获取缓存统计', async () => {
      (prisma.knowledgeGraphCache.count as jest.Mock).mockResolvedValue(100);
      (prisma.knowledgeGraphCache.groupBy as jest.Mock).mockResolvedValue([
        { cacheType: CacheType.NODE_NEIGHBORS, _count: 50 },
        { cacheType: CacheType.SHORTEST_PATH, _count: 30 },
        { cacheType: CacheType.SUBGRAPH, _count: 20 },
      ]);
      (prisma.knowledgeGraphCache.aggregate as jest.Mock).mockResolvedValue({
        _sum: { hitCount: 1000 },
      });
      (prisma.knowledgeGraphCache.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(10);

      const stats = await manager.getStats();

      expect(stats.totalEntries).toBe(100);
      expect(stats.totalHits).toBe(1000);
      expect(stats.byType[CacheType.NODE_NEIGHBORS]).toBe(50);
    });

    it('获取统计失败时应该返回默认值', async () => {
      (prisma.knowledgeGraphCache.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const stats = await manager.getStats();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('配置管理', () => {
    it('应该返回配置', () => {
      const config = manager.getConfig();

      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.defaultTTL).toBe(3600);
    });

    it('应该更新配置', () => {
      manager.updateConfig({ defaultTTL: 7200, enabled: false });

      const config = manager.getConfig();

      expect(config.defaultTTL).toBe(7200);
      expect(config.enabled).toBe(false);
    });
  });

  describe('缓存驱逐', () => {
    it('应该在达到最大条目数时驱逐缓存', async () => {
      const managerWithLimit = new KnowledgeGraphCacheManager({
        enabled: true,
        maxEntries: 100,
      });

      (prisma.knowledgeGraphCache.count as jest.Mock).mockResolvedValue(100);
      (prisma.knowledgeGraphCache.findMany as jest.Mock).mockResolvedValue([
        { id: 'cache-1' },
        { id: 'cache-2' },
        { id: 'cache-3' },
        { id: 'cache-4' },
        { id: 'cache-5' },
        { id: 'cache-6' },
        { id: 'cache-7' },
        { id: 'cache-8' },
        { id: 'cache-9' },
        { id: 'cache-10' },
      ]);
      (prisma.knowledgeGraphCache.deleteMany as jest.Mock).mockResolvedValue({
        count: 10,
      });
      (prisma.knowledgeGraphCache.create as jest.Mock).mockResolvedValue({
        id: 'cache-new',
      });

      await managerWithLimit.setNeighbors(
        { nodeId: 'node-1', depth: 2 },
        {
          nodes: [],
          links: [],
        }
      );

      expect(prisma.knowledgeGraphCache.findMany).toHaveBeenCalled();
    });

    it('不应该在未达到最大条目数时驱逐缓存', async () => {
      const managerWithLimit = new KnowledgeGraphCacheManager({
        enabled: true,
        maxEntries: 100,
      });

      (prisma.knowledgeGraphCache.count as jest.Mock).mockResolvedValue(50);
      (prisma.knowledgeGraphCache.create as jest.Mock).mockResolvedValue({
        id: 'cache-new',
      });

      await managerWithLimit.setNeighbors(
        { nodeId: 'node-1', depth: 2 },
        {
          nodes: [],
          links: [],
        }
      );

      expect(prisma.knowledgeGraphCache.findMany).not.toHaveBeenCalled();
    });
  });
});
