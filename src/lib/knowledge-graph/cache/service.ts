/**
 * 知识图谱缓存服务
 *
 * 功能：
 * 1. 集成缓存到图查询操作
 * 2. 提供带缓存的邻居查询
 * 3. 提供带缓存的最短路径查询
 * 4. 提供带缓存的子图查询
 */

import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import { GraphData } from '@/lib/law-article/graph-builder';
import { kgCache } from './manager';
import { logger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';
import {
  NeighborsQueryParams,
  ShortestPathQueryParams,
  SubgraphQueryParams,
  CacheData,
  CacheType,
} from './types';

/**
 * 知识图谱缓存服务
 */
export class KnowledgeGraphCacheService {
  /**
   * 获取节点的N度邻居（带缓存）
   */
  static async getNeighbors(
    params: NeighborsQueryParams
  ): Promise<CacheData | null> {
    const startTime = Date.now();

    try {
      // 尝试从缓存获取
      const cached = await kgCache.neighbors.get(params);
      if (cached) {
        logger.debug('邻居查询命中缓存', {
          params,
          timeMs: Date.now() - startTime,
        });
        return cached;
      }

      // 缓存未命中，查询数据库
      logger.debug('邻居查询未命中缓存，查询数据库', { params });
      const graphData = await GraphBuilder.buildGraph(
        params.nodeId,
        params.depth
      );

      // 应用关系类型筛选
      let filteredData = this.buildCacheData(graphData);

      if (params.relationTypes && params.relationTypes.length > 0) {
        filteredData = this.filterByRelationTypes(
          filteredData,
          params.relationTypes
        );
      }

      // 缓存结果
      await kgCache.neighbors.set(params, filteredData);

      logger.info('邻居查询完成', { params, timeMs: Date.now() - startTime });
      return filteredData;
    } catch (error) {
      logger.error('邻居查询失败', { params, error });
      return null;
    }
  }

  /**
   * 获取两节点间的最短路径（带缓存）
   */
  static async getShortestPath(
    params: ShortestPathQueryParams
  ): Promise<CacheData | null> {
    const startTime = Date.now();

    try {
      // 尝试从缓存获取
      const cached = await kgCache.shortestPath.get(params);
      if (cached) {
        logger.debug('最短路径查询命中缓存', {
          params,
          timeMs: Date.now() - startTime,
        });
        return cached;
      }

      // 缓存未命中，计算路径
      logger.debug('最短路径查询未命中缓存，计算路径', { params });

      // 获取全图数据（优化：可以只获取相关子图）
      const fullGraph = await GraphBuilder.buildFullGraph();

      // 计算最短路径
      const pathResult = GraphAlgorithms.shortestPath(
        fullGraph.nodes,
        fullGraph.links,
        params.sourceId,
        params.targetId
      );

      const cacheData: CacheData = {
        shortestPath: pathResult,
      };

      // 缓存结果
      await kgCache.shortestPath.set(params, cacheData);

      logger.info('最短路径查询完成', {
        params,
        timeMs: Date.now() - startTime,
      });
      return cacheData;
    } catch (error) {
      logger.error('最短路径查询失败', { params, error });
      return null;
    }
  }

  /**
   * 获取子图数据（带缓存）
   */
  static async getSubgraph(
    params: SubgraphQueryParams
  ): Promise<CacheData | null> {
    const startTime = Date.now();

    try {
      // 验证参数
      if (!params.nodeIds || params.nodeIds.length === 0) {
        logger.warn('子图查询参数无效：节点ID为空');
        return null;
      }

      // 尝试从缓存获取
      const cached = await kgCache.subgraph.get(params);
      if (cached) {
        logger.debug('子图查询命中缓存', {
          params,
          timeMs: Date.now() - startTime,
        });
        return cached;
      }

      // 缓存未命中，查询数据库
      logger.debug('子图查询未命中缓存，查询数据库', { params });

      // 构建子图
      const subgraph = await this.buildSubgraph(params);

      // 缓存结果
      await kgCache.subgraph.set(params, subgraph);

      logger.info('子图查询完成', { params, timeMs: Date.now() - startTime });
      return subgraph;
    } catch (error) {
      logger.error('子图查询失败', { params, error });
      return null;
    }
  }

  /**
   * 构建子图数据
   */
  private static async buildSubgraph(
    params: SubgraphQueryParams
  ): Promise<CacheData> {
    const nodes = new Map<string, (typeof params.nodeIds)[number]>();
    const links = new Set<string>();
    const subgraphNodes: GraphData['nodes'] = [];
    const subgraphLinks: GraphData['links'] = [];

    // 使用 BFS 遍历获取子图
    const queue: Array<{ nodeId: string; depth: number }> = params.nodeIds.map(
      nodeId => ({ nodeId, depth: 0 })
    );

    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const { nodeId, depth } = current;

      if (visited.has(nodeId)) continue;
      visited.add(nodeId);

      // 获取该节点的邻居
      const neighborGraph = await GraphBuilder.buildGraph(nodeId, 1);

      // 添加节点
      for (const node of neighborGraph.nodes) {
        if (!nodes.has(node.id)) {
          nodes.set(node.id, node.id);
          subgraphNodes.push(node);

          // 如果深度未达到上限，继续遍历
          if (depth + 1 <= params.depth) {
            queue.push({ nodeId: node.id, depth: depth + 1 });
          }
        }
      }

      // 添加边（应用关系类型筛选）
      for (const link of neighborGraph.links) {
        if (params.relationTypes && params.relationTypes.length > 0) {
          if (!params.relationTypes.includes(link.relationType)) {
            continue;
          }
        }

        const linkKey = `${link.source}-${link.target}`;
        if (!links.has(linkKey)) {
          links.add(linkKey);
          subgraphLinks.push(link);
        }
      }
    }

    return {
      nodes: subgraphNodes,
      links: subgraphLinks,
    };
  }

  /**
   * 将图数据转换为缓存数据格式
   */
  private static buildCacheData(graphData: GraphData): CacheData {
    return {
      nodes: graphData.nodes,
      links: graphData.links,
    };
  }

  /**
   * 按关系类型筛选
   */
  private static filterByRelationTypes(
    data: CacheData,
    relationTypes: string[]
  ): CacheData {
    if (!data.links) {
      return data;
    }

    const filteredLinks = data.links.filter(link =>
      relationTypes.includes(link.relationType)
    );

    // 获取所有保留的节点ID
    const nodeIds = new Set<string>();
    filteredLinks.forEach(link => {
      nodeIds.add(link.source);
      nodeIds.add(link.target);
    });

    // 筛选节点
    const filteredNodes = data.nodes?.filter(node => nodeIds.has(node.id));

    return {
      nodes: filteredNodes,
      links: filteredLinks,
    };
  }

  /**
   * 预热缓存
   */
  static async warmUpCache(): Promise<number> {
    const startTime = Date.now();
    let warmedCount = 0;

    try {
      logger.info('开始预热知识图谱缓存');

      // 1. 获取关系数最多的前 50 个法条（作为高频热点节点）
      const hotArticles = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT a.id
        FROM "law_articles" a
        JOIN "law_article_relations" r
          ON r."sourceId" = a.id OR r."targetId" = a.id
        WHERE r."verificationStatus" = 'VERIFIED'
        GROUP BY a.id
        ORDER BY COUNT(r.id) DESC
        LIMIT 50
      `;

      // 2. 对每个热点节点预计算 1-hop 邻居并写入缓存
      for (const { id } of hotArticles) {
        try {
          const params: NeighborsQueryParams = { nodeId: id, depth: 1 };
          const cached = await kgCache.neighbors.get(params);
          if (!cached) {
            const graphData = await GraphBuilder.buildGraph(id, 1);
            await kgCache.neighbors.set(params, {
              nodes: graphData.nodes,
              links: graphData.links,
            });
            warmedCount++;
          }
        } catch {
          // 单节点预热失败不影响整体
        }
      }

      logger.info('缓存预热完成', {
        warmedCount,
        total: hotArticles.length,
        timeMs: Date.now() - startTime,
      });
      return warmedCount;
    } catch (error) {
      logger.error('缓存预热失败', error instanceof Error ? error : undefined);
      return warmedCount;
    }
  }

  /**
   * 清理过期缓存
   */
  static async cleanExpiredCache(): Promise<number> {
    try {
      const count = await kgCache.cleanExpired();
      logger.info('清理过期缓存完成', { count });
      return count;
    } catch (error) {
      logger.error('清理过期缓存失败', { error });
      return 0;
    }
  }

  /**
   * 获取缓存统计
   */
  static async getCacheStats() {
    try {
      return await kgCache.getStats();
    } catch (error) {
      logger.error('获取缓存统计失败', { error });
      return null;
    }
  }

  /**
   * 清空缓存
   */
  static async clearCache(cacheType?: string): Promise<number> {
    try {
      if (
        cacheType &&
        Object.values(CacheType).includes(cacheType as CacheType)
      ) {
        return await kgCache.clear({ cacheTypes: [cacheType as CacheType] });
      }
      return await kgCache.clear();
    } catch (error) {
      logger.error('清空缓存失败', { cacheType, error });
      return 0;
    }
  }

  /**
   * 禁用缓存
   */
  static disableCache(): void {
    kgCache.updateConfig({ enabled: false });
    logger.info('缓存已禁用');
  }

  /**
   * 启用缓存
   */
  static enableCache(): void {
    kgCache.updateConfig({ enabled: true });
    logger.info('缓存已启用');
  }
}

// 导出单例
export const kgCacheService = KnowledgeGraphCacheService;

export default kgCacheService;
