/**
 * 知识图谱缓存类型定义测试
 *
 * 测试内容：
 * 1. 缓存类型枚举
 * 2. 查询参数接口
 * 3. 缓存配置接口
 */

import {
  CacheType,
  NeighborsQueryParams,
  ShortestPathQueryParams,
  SubgraphQueryParams,
  CacheData,
  CacheEntry,
  CacheConfig,
  CacheStats,
  WarmUpOptions,
  ClearCacheOptions,
} from '@/lib/knowledge-graph/cache/types';

describe('知识图谱缓存类型定义', () => {
  describe('CacheType 枚举', () => {
    it('应该包含所有预定义的缓存类型', () => {
      expect(CacheType.NODE_NEIGHBORS).toBe('node_neighbors');
      expect(CacheType.SHORTEST_PATH).toBe('shortest_path');
      expect(CacheType.SUBGRAPH).toBe('subgraph');
    });

    it('枚举值应该是字符串类型', () => {
      expect(typeof CacheType.NODE_NEIGHBORS).toBe('string');
      expect(typeof CacheType.SHORTEST_PATH).toBe('string');
      expect(typeof CacheType.SUBGRAPH).toBe('string');
    });
  });

  describe('NeighborsQueryParams', () => {
    it('应该正确构建邻居查询参数', () => {
      const params: NeighborsQueryParams = {
        nodeId: 'test-node-1',
        depth: 2,
      };

      expect(params.nodeId).toBe('test-node-1');
      expect(params.depth).toBe(2);
    });

    it('应该支持可选的关系类型筛选', () => {
      const params: NeighborsQueryParams = {
        nodeId: 'test-node-1',
        depth: 3,
        relationTypes: ['CITES', 'COMPLETES'],
      };

      expect(params.relationTypes).toEqual(['CITES', 'COMPLETES']);
    });

    it('应该允许不指定关系类型', () => {
      const params: NeighborsQueryParams = {
        nodeId: 'test-node-1',
        depth: 1,
      };

      expect(params.relationTypes).toBeUndefined();
    });
  });

  describe('ShortestPathQueryParams', () => {
    it('应该正确构建最短路径查询参数', () => {
      const params: ShortestPathQueryParams = {
        sourceId: 'node-a',
        targetId: 'node-b',
      };

      expect(params.sourceId).toBe('node-a');
      expect(params.targetId).toBe('node-b');
    });

    it('应该支持可选的最大深度', () => {
      const params: ShortestPathQueryParams = {
        sourceId: 'node-a',
        targetId: 'node-b',
        maxDepth: 10,
      };

      expect(params.maxDepth).toBe(10);
    });

    it('应该允许不指定最大深度', () => {
      const params: ShortestPathQueryParams = {
        sourceId: 'node-a',
        targetId: 'node-b',
      };

      expect(params.maxDepth).toBeUndefined();
    });
  });

  describe('SubgraphQueryParams', () => {
    it('应该正确构建子图查询参数', () => {
      const params: SubgraphQueryParams = {
        nodeIds: ['node-1', 'node-2', 'node-3'],
        depth: 2,
      };

      expect(params.nodeIds).toEqual(['node-1', 'node-2', 'node-3']);
      expect(params.depth).toBe(2);
    });

    it('应该支持可选的关系类型筛选', () => {
      const params: SubgraphQueryParams = {
        nodeIds: ['node-1'],
        depth: 1,
        relationTypes: ['CITES'],
      };

      expect(params.relationTypes).toEqual(['CITES']);
    });

    it('应该允许不指定关系类型', () => {
      const params: SubgraphQueryParams = {
        nodeIds: ['node-1', 'node-2'],
        depth: 2,
      };

      expect(params.relationTypes).toBeUndefined();
    });

    it('应该支持空节点ID数组', () => {
      const params: SubgraphQueryParams = {
        nodeIds: [],
        depth: 1,
      };

      expect(params.nodeIds).toEqual([]);
    });
  });

  describe('CacheData', () => {
    it('应该支持节点数据', () => {
      const data: CacheData = {
        nodes: [
          {
            id: 'node-1',
            lawName: 'Test Law',
            articleNumber: '1',
            category: 'CIVIL',
            level: 0,
          },
        ],
      };

      expect(data.nodes).toBeDefined();
      expect(data.nodes?.length).toBe(1);
    });

    it('应该支持关系数据', () => {
      const data: CacheData = {
        links: [
          {
            source: 'node-1',
            target: 'node-2',
            relationType: 'CITES',
            strength: 1.0,
            confidence: 1.0,
          },
        ],
      };

      expect(data.links).toBeDefined();
      expect(data.links?.length).toBe(1);
    });

    it('应该支持最短路径结果', () => {
      const data: CacheData = {
        shortestPath: {
          path: ['node-1', 'node-2', 'node-3'],
          pathLength: 2,
          relationTypes: ['CITES', 'COMPLETES'],
          exists: true,
        },
      };

      expect(data.shortestPath).toBeDefined();
      expect(data.shortestPath?.pathLength).toBe(2);
    });

    it('应该支持元数据', () => {
      const data: CacheData = {
        metadata: {
          computedAt: new Date().toISOString(),
          computationTimeMs: 150,
        },
      };

      expect(data.metadata).toBeDefined();
      expect(data.metadata?.computedAt).toBeDefined();
    });
  });

  describe('CacheEntry', () => {
    it('应该正确构建缓存条目', () => {
      const entry: CacheEntry = {
        id: 'cache-1',
        cacheType: CacheType.NODE_NEIGHBORS,
        cacheKey: 'node_neighbors:node-1:2',
        cacheData: {
          nodes: [],
          links: [],
        },
        hitCount: 0,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      };

      expect(entry.id).toBe('cache-1');
      expect(entry.cacheType).toBe(CacheType.NODE_NEIGHBORS);
      expect(entry.hitCount).toBe(0);
    });

    it('应该支持可选的最后访问时间', () => {
      const entry: CacheEntry = {
        id: 'cache-1',
        cacheType: CacheType.NODE_NEIGHBORS,
        cacheKey: 'node_neighbors:node-1:2',
        cacheData: {},
        hitCount: 5,
        expiresAt: new Date(),
        createdAt: new Date(),
        lastAccessedAt: new Date(),
      };

      expect(entry.lastAccessedAt).toBeDefined();
    });

    it('应该允许不指定最后访问时间', () => {
      const entry: CacheEntry = {
        id: 'cache-1',
        cacheType: CacheType.SHORTEST_PATH,
        cacheKey: 'shortest_path:node-1:node-2',
        cacheData: {},
        hitCount: 1,
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      expect(entry.lastAccessedAt).toBeUndefined();
    });
  });

  describe('CacheConfig', () => {
    it('应该正确构建缓存配置', () => {
      const config: CacheConfig = {
        defaultTTL: 3600,
        maxEntries: 1000,
        enabled: true,
      };

      expect(config.defaultTTL).toBe(3600);
      expect(config.maxEntries).toBe(1000);
      expect(config.enabled).toBe(true);
    });

    it('应该允许不指定最大条目数', () => {
      const config: CacheConfig = {
        defaultTTL: 7200,
        enabled: false,
      };

      expect(config.maxEntries).toBeUndefined();
    });

    it('应该支持禁用缓存', () => {
      const config: CacheConfig = {
        defaultTTL: 1800,
        enabled: false,
      };

      expect(config.enabled).toBe(false);
    });
  });

  describe('CacheStats', () => {
    it('应该正确构建缓存统计', () => {
      const stats: CacheStats = {
        totalEntries: 100,
        byType: {
          [CacheType.NODE_NEIGHBORS]: 50,
          [CacheType.SHORTEST_PATH]: 30,
          [CacheType.SUBGRAPH]: 20,
        },
        hitRate: 0.75,
        totalHits: 750,
        totalRequests: 1000,
        expiringSoon: 10,
        expired: 5,
      };

      expect(stats.totalEntries).toBe(100);
      expect(stats.hitRate).toBe(0.75);
      expect(stats.totalHits).toBe(750);
      expect(stats.expiringSoon).toBe(10);
      expect(stats.expired).toBe(5);
    });

    it('应该计算命中率', () => {
      const stats: CacheStats = {
        totalEntries: 50,
        byType: {
          [CacheType.NODE_NEIGHBORS]: 30,
          [CacheType.SHORTEST_PATH]: 20,
          [CacheType.SUBGRAPH]: 0,
        },
        hitRate: 0.8,
        totalHits: 800,
        totalRequests: 1000,
        expiringSoon: 2,
        expired: 0,
      };

      expect(stats.hitRate).toBe(0.8);
    });
  });

  describe('WarmUpOptions', () => {
    it('应该正确构建预热选项', () => {
      const options: WarmUpOptions = {
        cacheTypes: [CacheType.NODE_NEIGHBORS, CacheType.SHORTEST_PATH],
        maxEntries: 100,
        skipExisting: true,
      };

      expect(options.cacheTypes).toEqual([
        CacheType.NODE_NEIGHBORS,
        CacheType.SHORTEST_PATH,
      ]);
      expect(options.maxEntries).toBe(100);
      expect(options.skipExisting).toBe(true);
    });

    it('应该允许不指定缓存类型', () => {
      const options: WarmUpOptions = {
        maxEntries: 50,
      };

      expect(options.cacheTypes).toBeUndefined();
    });

    it('应该允许不指定最大条目数', () => {
      const options: WarmUpOptions = {
        cacheTypes: [CacheType.SUBGRAPH],
      };

      expect(options.maxEntries).toBeUndefined();
    });

    it('应该默认不跳过已存在的缓存', () => {
      const options: WarmUpOptions = {
        cacheTypes: [CacheType.NODE_NEIGHBORS],
      };

      expect(options.skipExisting).toBeUndefined();
    });
  });

  describe('ClearCacheOptions', () => {
    it('应该正确构建清理选项', () => {
      const options: ClearCacheOptions = {
        cacheTypes: [CacheType.NODE_NEIGHBORS],
        expiredOnly: true,
      };

      expect(options.cacheTypes).toEqual([CacheType.NODE_NEIGHBORS]);
      expect(options.expiredOnly).toBe(true);
    });

    it('应该允许清理所有缓存类型', () => {
      const options: ClearCacheOptions = {
        expiredOnly: false,
      };

      expect(options.cacheTypes).toBeUndefined();
    });

    it('应该允许只清理过期缓存', () => {
      const options: ClearCacheOptions = {
        cacheTypes: [CacheType.SHORTEST_PATH, CacheType.SUBGRAPH],
        expiredOnly: true,
      };

      expect(options.expiredOnly).toBe(true);
    });

    it('应该允许清理指定类型的所有缓存', () => {
      const options: ClearCacheOptions = {
        cacheTypes: [CacheType.NODE_NEIGHBORS],
      };

      expect(options.expiredOnly).toBeUndefined();
    });
  });
});
