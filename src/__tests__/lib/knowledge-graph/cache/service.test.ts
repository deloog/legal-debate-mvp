/**
 * 知识图谱缓存服务测试
 *
 * 测试内容：
 * 1. 邻居查询缓存
 * 2. 最短路径查询缓存
 * 3. 子图查询缓存
 * 4. 缓存管理操作
 */

import { kgCacheService } from '@/lib/knowledge-graph/cache/service';
import { kgCache } from '@/lib/knowledge-graph/cache/manager';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import { logger } from '@/lib/logger';
import {
  NeighborsQueryParams,
  ShortestPathQueryParams,
  SubgraphQueryParams,
  CacheData,
} from '@/lib/knowledge-graph/cache/types';

// Mock kgCache
jest.mock('@/lib/knowledge-graph/cache/manager', () => ({
  kgCache: {
    neighbors: {
      get: jest.fn(),
      set: jest.fn(),
    },
    shortestPath: {
      get: jest.fn(),
      set: jest.fn(),
    },
    subgraph: {
      get: jest.fn(),
      set: jest.fn(),
    },
    cleanExpired: jest.fn(),
    clear: jest.fn(),
    getStats: jest.fn(),
    updateConfig: jest.fn(),
  },
}));

// Mock GraphBuilder
jest.mock('@/lib/law-article/graph-builder', () => ({
  GraphBuilder: {
    buildGraph: jest.fn(),
    buildFullGraph: jest.fn(),
  },
}));

// Mock GraphAlgorithms
jest.mock('@/lib/knowledge-graph/graph-algorithms', () => ({
  GraphAlgorithms: {
    shortestPath: jest.fn(),
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

describe('KnowledgeGraphCacheService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('邻居查询缓存', () => {
    const mockParams: NeighborsQueryParams = {
      nodeId: 'node-1',
      depth: 2,
    };

    const mockCacheData: CacheData = {
      nodes: [
        {
          id: 'node-1',
          lawName: 'Test Law',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
      ],
      links: [],
    };

    const mockGraphData = {
      nodes: [
        {
          id: 'node-1',
          lawName: 'Test Law',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
      ],
      links: [],
    };

    it('应该从缓存获取邻居数据', async () => {
      (kgCache.neighbors.get as jest.Mock).mockResolvedValue(mockCacheData);

      const result = await kgCacheService.getNeighbors(mockParams);

      expect(result).toEqual(mockCacheData);
      expect(kgCache.neighbors.get).toHaveBeenCalledWith(mockParams);
      expect(kgCache.neighbors.set).not.toHaveBeenCalled();
      expect(GraphBuilder.buildGraph).not.toHaveBeenCalled();
    });

    it('缓存未命中时应该查询数据库', async () => {
      (kgCache.neighbors.get as jest.Mock).mockResolvedValue(null);
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(mockGraphData);
      (kgCache.neighbors.set as jest.Mock).mockResolvedValue(true);

      const result = await kgCacheService.getNeighbors(mockParams);

      expect(result).toBeDefined();
      expect(kgCache.neighbors.get).toHaveBeenCalledWith(mockParams);
      expect(GraphBuilder.buildGraph).toHaveBeenCalledWith('node-1', 2);
      expect(kgCache.neighbors.set).toHaveBeenCalled();
    });

    it('应该应用关系类型筛选', async () => {
      const paramsWithTypes: NeighborsQueryParams = {
        ...mockParams,
        relationTypes: ['CITES', 'COMPLETES'],
      };

      const mockGraphDataWithMultipleLinks = {
        nodes: [
          {
            id: 'node-1',
            lawName: 'Test Law',
            articleNumber: '1',
            category: 'CIVIL',
            level: 0,
          },
          {
            id: 'node-2',
            lawName: 'Test Law 2',
            articleNumber: '2',
            category: 'CIVIL',
            level: 1,
          },
        ],
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

      (kgCache.neighbors.get as jest.Mock).mockResolvedValue(null);
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(
        mockGraphDataWithMultipleLinks
      );
      (kgCache.neighbors.set as jest.Mock).mockResolvedValue(true);

      const result = await kgCacheService.getNeighbors(paramsWithTypes);

      expect(result).toBeDefined();
      expect(result?.links?.length).toBe(1);
      expect(kgCache.neighbors.set).toHaveBeenCalled();
    });

    it('查询失败时应该返回null', async () => {
      (kgCache.neighbors.get as jest.Mock).mockResolvedValue(null);
      (GraphBuilder.buildGraph as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await kgCacheService.getNeighbors(mockParams);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('最短路径查询缓存', () => {
    const mockParams: ShortestPathQueryParams = {
      sourceId: 'node-a',
      targetId: 'node-b',
    };

    const mockCacheData: CacheData = {
      shortestPath: {
        path: ['node-a', 'node-b'],
        pathLength: 1,
        relationTypes: ['CITES'],
        exists: true,
      },
    };

    const mockFullGraph = {
      nodes: [
        {
          id: 'node-a',
          lawName: 'Test Law A',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
        {
          id: 'node-b',
          lawName: 'Test Law B',
          articleNumber: '2',
          category: 'CIVIL',
          level: 0,
        },
      ],
      links: [
        {
          source: 'node-a',
          target: 'node-b',
          relationType: 'CITES',
          strength: 1.0,
          confidence: 1.0,
        },
      ],
    };

    const mockPathResult = {
      path: ['node-a', 'node-b'],
      pathLength: 1,
      relationTypes: ['CITES'],
      exists: true,
    };

    it('应该从缓存获取最短路径', async () => {
      (kgCache.shortestPath.get as jest.Mock).mockResolvedValue(mockCacheData);

      const result = await kgCacheService.getShortestPath(mockParams);

      expect(result).toEqual(mockCacheData);
      expect(kgCache.shortestPath.get).toHaveBeenCalledWith(mockParams);
      expect(kgCache.shortestPath.set).not.toHaveBeenCalled();
      expect(GraphBuilder.buildFullGraph).not.toHaveBeenCalled();
    });

    it('缓存未命中时应该计算路径', async () => {
      (kgCache.shortestPath.get as jest.Mock).mockResolvedValue(null);
      (GraphBuilder.buildFullGraph as jest.Mock).mockResolvedValue(
        mockFullGraph
      );
      (GraphAlgorithms.shortestPath as jest.Mock).mockReturnValue(
        mockPathResult
      );
      (kgCache.shortestPath.set as jest.Mock).mockResolvedValue(true);

      const result = await kgCacheService.getShortestPath(mockParams);

      expect(result).toBeDefined();
      expect(result?.shortestPath).toEqual(mockPathResult);
      expect(kgCache.shortestPath.get).toHaveBeenCalledWith(mockParams);
      expect(GraphBuilder.buildFullGraph).toHaveBeenCalled();
      expect(GraphAlgorithms.shortestPath).toHaveBeenCalledWith(
        mockFullGraph.nodes,
        mockFullGraph.links,
        'node-a',
        'node-b'
      );
      expect(kgCache.shortestPath.set).toHaveBeenCalled();
    });

    it('计算失败时应该返回null', async () => {
      (kgCache.shortestPath.get as jest.Mock).mockResolvedValue(null);
      (GraphBuilder.buildFullGraph as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await kgCacheService.getShortestPath(mockParams);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('子图查询缓存', () => {
    const mockParams: SubgraphQueryParams = {
      nodeIds: ['node-1', 'node-2'],
      depth: 2,
    };

    const mockCacheData: CacheData = {
      nodes: [
        {
          id: 'node-1',
          lawName: 'Test Law 1',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
      ],
      links: [],
    };

    const mockNeighborGraph = {
      nodes: [
        {
          id: 'node-1',
          lawName: 'Test Law 1',
          articleNumber: '1',
          category: 'CIVIL',
          level: 0,
        },
        {
          id: 'node-2',
          lawName: 'Test Law 2',
          articleNumber: '2',
          category: 'CIVIL',
          level: 1,
        },
      ],
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

    it('应该从缓存获取子图数据', async () => {
      (kgCache.subgraph.get as jest.Mock).mockResolvedValue(mockCacheData);

      const result = await kgCacheService.getSubgraph(mockParams);

      expect(result).toEqual(mockCacheData);
      expect(kgCache.subgraph.get).toHaveBeenCalledWith(mockParams);
      expect(kgCache.subgraph.set).not.toHaveBeenCalled();
    });

    it('缓存未命中时应该构建子图', async () => {
      (kgCache.subgraph.get as jest.Mock).mockResolvedValue(null);
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(
        mockNeighborGraph
      );
      (kgCache.subgraph.set as jest.Mock).mockResolvedValue(true);

      const result = await kgCacheService.getSubgraph(mockParams);

      expect(result).toBeDefined();
      expect(kgCache.subgraph.get).toHaveBeenCalledWith(mockParams);
      expect(GraphBuilder.buildGraph).toHaveBeenCalled();
      expect(kgCache.subgraph.set).toHaveBeenCalled();
    });

    it('空节点ID应该返回null', async () => {
      const emptyParams: SubgraphQueryParams = {
        nodeIds: [],
        depth: 2,
      };

      const result = await kgCacheService.getSubgraph(emptyParams);

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('构建失败时应该返回null', async () => {
      (kgCache.subgraph.get as jest.Mock).mockResolvedValue(null);
      (GraphBuilder.buildGraph as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const result = await kgCacheService.getSubgraph(mockParams);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('应该应用关系类型筛选', async () => {
      const paramsWithTypes: SubgraphQueryParams = {
        ...mockParams,
        relationTypes: ['CITES'],
      };

      (kgCache.subgraph.get as jest.Mock).mockResolvedValue(null);
      (GraphBuilder.buildGraph as jest.Mock).mockResolvedValue(
        mockNeighborGraph
      );
      (kgCache.subgraph.set as jest.Mock).mockResolvedValue(true);

      const result = await kgCacheService.getSubgraph(paramsWithTypes);

      expect(result).toBeDefined();
      expect(kgCache.subgraph.set).toHaveBeenCalled();
    });
  });

  describe('缓存管理操作', () => {
    it('应该成功清理过期缓存', async () => {
      (kgCache.cleanExpired as jest.Mock).mockResolvedValue(10);

      const count = await kgCacheService.cleanExpiredCache();

      expect(count).toBe(10);
      expect(kgCache.cleanExpired).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalled();
    });

    it('清理失败时应该返回0', async () => {
      (kgCache.cleanExpired as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const count = await kgCacheService.cleanExpiredCache();

      expect(count).toBe(0);
      expect(logger.error).toHaveBeenCalled();
    });

    it('应该成功获取缓存统计', async () => {
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

      (kgCache.getStats as jest.Mock).mockResolvedValue(mockStats);

      const stats = await kgCacheService.getCacheStats();

      expect(stats).toEqual(mockStats);
    });

    it('获取统计失败时应该返回null', async () => {
      (kgCache.getStats as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      const stats = await kgCacheService.getCacheStats();

      expect(stats).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    it('应该成功清空所有缓存', async () => {
      (kgCache.clear as jest.Mock).mockResolvedValue(100);

      const count = await kgCacheService.clearCache();

      expect(count).toBe(100);
      expect(kgCache.clear).toHaveBeenCalledWith();
    });

    it('应该成功清空指定类型的缓存', async () => {
      (kgCache.clear as jest.Mock).mockResolvedValue(50);

      const count = await kgCacheService.clearCache('node_neighbors');

      expect(count).toBe(50);
      expect(kgCache.clear).toHaveBeenCalledWith({
        cacheTypes: ['node_neighbors'],
      });
    });

    it('应该成功预热缓存', async () => {
      const count = await kgCacheService.warmUpCache();

      expect(typeof count).toBe('number');
      expect(logger.info).toHaveBeenCalledWith('开始预热知识图谱缓存');
    });
  });

  describe('缓存开关', () => {
    it('应该成功禁用缓存', () => {
      kgCacheService.disableCache();

      expect(kgCache.updateConfig).toHaveBeenCalledWith({ enabled: false });
      expect(logger.info).toHaveBeenCalledWith('缓存已禁用');
    });

    it('应该成功启用缓存', () => {
      kgCacheService.enableCache();

      expect(kgCache.updateConfig).toHaveBeenCalledWith({ enabled: true });
      expect(logger.info).toHaveBeenCalledWith('缓存已启用');
    });
  });
});
