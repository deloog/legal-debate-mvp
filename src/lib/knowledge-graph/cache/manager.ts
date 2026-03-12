/**
 * 知识图谱缓存管理器
 *
 * 功能：
 * 1. 管理知识图谱缓存
 * 2. 提供缓存CRUD操作
 * 3. 缓存过期管理
 * 4. 缓存统计
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import {
  CacheConfig,
  CacheData,
  CacheStats,
  CacheType,
  ClearCacheOptions,
  NeighborsQueryParams,
  ShortestPathQueryParams,
  SubgraphQueryParams,
} from './types';

/**
 * 默认缓存配置
 */
const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 3600, // 1小时
  maxEntries: 10000,
  enabled: true,
};

/**
 * 缓存键生成器
 */
class CacheKeyGenerator {
  /**
   * 生成邻居查询的缓存键
   */
  static forNeighbors(params: NeighborsQueryParams): string {
    const key = `neighbors:${params.nodeId}:${params.depth}`;
    if (params.relationTypes && params.relationTypes.length > 0) {
      const types = params.relationTypes.sort().join(',');
      return `${key}:${this.hash(types)}`;
    }
    return key;
  }

  /**
   * 生成最短路径查询的缓存键
   */
  static forShortestPath(params: ShortestPathQueryParams): string {
    const base = `shortest:${params.sourceId}:${params.targetId}`;
    if (params.maxDepth) {
      return `${base}:${params.maxDepth}`;
    }
    return base;
  }

  /**
   * 生成子图查询的缓存键
   */
  static forSubgraph(params: SubgraphQueryParams): string {
    const nodeIds = params.nodeIds.sort().join(',');
    const base = `subgraph:${this.hash(nodeIds)}:${params.depth}`;
    if (params.relationTypes && params.relationTypes.length > 0) {
      const types = params.relationTypes.sort().join(',');
      return `${base}:${this.hash(types)}`;
    }
    return base;
  }

  /**
   * 生成字符串的哈希值
   */
  private static hash(str: string): string {
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }
}

/**
 * 知识图谱缓存管理器
 */
export class KnowledgeGraphCacheManager {
  private config: CacheConfig;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取邻居查询缓存
   */
  async getNeighbors(params: NeighborsQueryParams): Promise<CacheData | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const cacheKey = CacheKeyGenerator.forNeighbors(params);
      const entry = await prisma.knowledgeGraphCache.findUnique({
        where: { cacheKey },
      });

      if (!entry) {
        logger.debug('邻居缓存未命中', { cacheKey });
        return null;
      }

      // 检查是否过期
      if (entry.expiresAt < new Date()) {
        logger.debug('邻居缓存已过期', { cacheKey });
        await this.deleteEntry(cacheKey);
        return null;
      }

      // 更新命中次数和最后访问时间
      await prisma.knowledgeGraphCache.update({
        where: { id: entry.id },
        data: {
          hitCount: entry.hitCount + 1,
          lastAccessedAt: new Date(),
        },
      });

      logger.debug('邻居缓存命中', { cacheKey, hitCount: entry.hitCount + 1 });

      return entry.cacheData as CacheData;
    } catch (error) {
      logger.error('获取邻居缓存失败', { params, error });
      return null;
    }
  }

  /**
   * 设置邻居查询缓存
   */
  async setNeighbors(
    params: NeighborsQueryParams,
    data: CacheData,
    ttl?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const cacheKey = CacheKeyGenerator.forNeighbors(params);
      const expiresAt = new Date(
        Date.now() + (ttl ?? this.config.defaultTTL) * 1000
      );

      // 检查是否超过最大缓存条目数
      await this.evictIfNeeded();

      await prisma.knowledgeGraphCache.create({
        data: {
          cacheType: CacheType.NODE_NEIGHBORS,
          cacheKey,
          cacheData: data as Prisma.InputJsonValue,
          hitCount: 0,
          expiresAt,
        },
      });

      logger.info('创建邻居缓存', { cacheKey, expiresAt });
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        // 缓存已存在，更新
        const cacheKey = CacheKeyGenerator.forNeighbors(params);
        await this.updateEntry(cacheKey, data, ttl);
        return true;
      }
      logger.error('设置邻居缓存失败', { params, error });
      return false;
    }
  }

  /**
   * 获取最短路径缓存
   */
  async getShortestPath(
    params: ShortestPathQueryParams
  ): Promise<CacheData | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const cacheKey = CacheKeyGenerator.forShortestPath(params);
      const entry = await prisma.knowledgeGraphCache.findUnique({
        where: { cacheKey },
      });

      if (!entry) {
        logger.debug('最短路径缓存未命中', { cacheKey });
        return null;
      }

      // 检查是否过期
      if (entry.expiresAt < new Date()) {
        logger.debug('最短路径缓存已过期', { cacheKey });
        await this.deleteEntry(cacheKey);
        return null;
      }

      // 更新命中次数和最后访问时间
      await prisma.knowledgeGraphCache.update({
        where: { id: entry.id },
        data: {
          hitCount: entry.hitCount + 1,
          lastAccessedAt: new Date(),
        },
      });

      logger.debug('最短路径缓存命中', {
        cacheKey,
        hitCount: entry.hitCount + 1,
      });

      return entry.cacheData as CacheData;
    } catch (error) {
      logger.error('获取最短路径缓存失败', { params, error });
      return null;
    }
  }

  /**
   * 设置最短路径缓存
   */
  async setShortestPath(
    params: ShortestPathQueryParams,
    data: CacheData,
    ttl?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const cacheKey = CacheKeyGenerator.forShortestPath(params);
      const expiresAt = new Date(
        Date.now() + (ttl ?? this.config.defaultTTL) * 1000
      );

      // 检查是否超过最大缓存条目数
      await this.evictIfNeeded();

      await prisma.knowledgeGraphCache.create({
        data: {
          cacheType: CacheType.SHORTEST_PATH,
          cacheKey,
          cacheData: data as Prisma.InputJsonValue,
          hitCount: 0,
          expiresAt,
        },
      });

      logger.info('创建最短路径缓存', { cacheKey, expiresAt });
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        // 缓存已存在，更新
        const cacheKey = CacheKeyGenerator.forShortestPath(params);
        await this.updateEntry(cacheKey, data, ttl);
        return true;
      }
      logger.error('设置最短路径缓存失败', { params, error });
      return false;
    }
  }

  /**
   * 获取子图缓存
   */
  async getSubgraph(params: SubgraphQueryParams): Promise<CacheData | null> {
    if (!this.config.enabled) {
      return null;
    }

    try {
      const cacheKey = CacheKeyGenerator.forSubgraph(params);
      const entry = await prisma.knowledgeGraphCache.findUnique({
        where: { cacheKey },
      });

      if (!entry) {
        logger.debug('子图缓存未命中', { cacheKey });
        return null;
      }

      // 检查是否过期
      if (entry.expiresAt < new Date()) {
        logger.debug('子图缓存已过期', { cacheKey });
        await this.deleteEntry(cacheKey);
        return null;
      }

      // 更新命中次数和最后访问时间
      await prisma.knowledgeGraphCache.update({
        where: { id: entry.id },
        data: {
          hitCount: entry.hitCount + 1,
          lastAccessedAt: new Date(),
        },
      });

      logger.debug('子图缓存命中', { cacheKey, hitCount: entry.hitCount + 1 });

      return entry.cacheData as CacheData;
    } catch (error) {
      logger.error('获取子图缓存失败', { params, error });
      return null;
    }
  }

  /**
   * 设置子图缓存
   */
  async setSubgraph(
    params: SubgraphQueryParams,
    data: CacheData,
    ttl?: number
  ): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    try {
      const cacheKey = CacheKeyGenerator.forSubgraph(params);
      const expiresAt = new Date(
        Date.now() + (ttl ?? this.config.defaultTTL) * 1000
      );

      // 检查是否超过最大缓存条目数
      await this.evictIfNeeded();

      await prisma.knowledgeGraphCache.create({
        data: {
          cacheType: CacheType.SUBGRAPH,
          cacheKey,
          cacheData: data as Prisma.InputJsonValue,
          hitCount: 0,
          expiresAt,
        },
      });

      logger.info('创建子图缓存', { cacheKey, expiresAt });
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint')
      ) {
        // 缓存已存在，更新
        const cacheKey = CacheKeyGenerator.forSubgraph(params);
        await this.updateEntry(cacheKey, data, ttl);
        return true;
      }
      logger.error('设置子图缓存失败', { params, error });
      return false;
    }
  }

  /**
   * 更新缓存条目
   */
  private async updateEntry(
    cacheKey: string,
    data: CacheData,
    ttl?: number
  ): Promise<void> {
    const expiresAt = new Date(
      Date.now() + (ttl ?? this.config.defaultTTL) * 1000
    );

    await prisma.knowledgeGraphCache.update({
      where: { cacheKey },
      data: {
        cacheData: data as Prisma.InputJsonValue,
        expiresAt,
        createdAt: new Date(),
      },
    });
  }

  /**
   * 删除缓存条目
   */
  async deleteEntry(cacheKey: string): Promise<boolean> {
    try {
      await prisma.knowledgeGraphCache.delete({
        where: { cacheKey },
      });
      return true;
    } catch (error) {
      logger.error('删除缓存条目失败', { cacheKey, error });
      return false;
    }
  }

  /**
   * 清理缓存
   */
  async clearCache(options?: ClearCacheOptions): Promise<number> {
    try {
      const where: {
        cacheType?: CacheType;
        expiresAt?: Record<string, Date>;
      } = {};

      if (options?.cacheTypes && options.cacheTypes.length > 0) {
        where.cacheType = options.cacheTypes[0] as CacheType;
      }

      if (options?.expiredOnly) {
        where.expiresAt = { lt: new Date() };
      }

      const result = await prisma.knowledgeGraphCache.deleteMany({ where });

      logger.info('清理缓存完成', { count: result.count, options });
      return result.count;
    } catch (error) {
      logger.error('清理缓存失败', { options, error });
      return 0;
    }
  }

  /**
   * 获取缓存统计
   */
  async getStats(): Promise<CacheStats> {
    try {
      const now = new Date();
      const oneHourLater = new Date(now.getTime() + 3600000);

      const [totalEntries, byType, totalHits, expired, expiringSoon] =
        await Promise.all([
          // 总缓存条目数
          prisma.knowledgeGraphCache.count(),

          // 按类型分组统计
          prisma.knowledgeGraphCache.groupBy({
            by: ['cacheType'],
            _count: true,
          }),

          // 总命中次数
          prisma.knowledgeGraphCache.aggregate({
            _sum: { hitCount: true },
          }),

          // 已过期条目数
          prisma.knowledgeGraphCache.count({
            where: { expiresAt: { lt: now } },
          }),

          // 即将过期的条目数（1小时内）
          prisma.knowledgeGraphCache.count({
            where: {
              expiresAt: { gte: now, lte: oneHourLater },
            },
          }),
        ]);

      const hits = totalHits._sum.hitCount || 0;

      // 按类型分组
      const byTypeMap: Record<CacheType, number> = {
        [CacheType.NODE_NEIGHBORS]: 0,
        [CacheType.SHORTEST_PATH]: 0,
        [CacheType.SUBGRAPH]: 0,
      };

      byType.forEach(item => {
        byTypeMap[item.cacheType as CacheType] = item._count;
      });

      return {
        totalEntries,
        byType: byTypeMap,
        hitRate: 0, // 需要额外的追踪来计算
        totalHits: hits,
        totalRequests: hits, // 近似值
        expiringSoon,
        expired,
      };
    } catch (error) {
      logger.error('获取缓存统计失败', { error });
      return {
        totalEntries: 0,
        byType: {
          [CacheType.NODE_NEIGHBORS]: 0,
          [CacheType.SHORTEST_PATH]: 0,
          [CacheType.SUBGRAPH]: 0,
        },
        hitRate: 0,
        totalHits: 0,
        totalRequests: 0,
        expiringSoon: 0,
        expired: 0,
      };
    }
  }

  /**
   * 如果需要，驱逐缓存
   */
  private async evictIfNeeded(): Promise<void> {
    if (!this.config.maxEntries) {
      return;
    }

    const count = await prisma.knowledgeGraphCache.count();

    if (count >= this.config.maxEntries) {
      // 驱逐最旧的缓存
      const entriesToEvict = await prisma.knowledgeGraphCache.findMany({
        orderBy: { lastAccessedAt: 'asc' },
        take: Math.ceil(count * 0.1), // 驱逐10%
        select: { id: true },
      });

      await prisma.knowledgeGraphCache.deleteMany({
        where: {
          id: { in: entriesToEvict.map(e => e.id) },
        },
      });

      logger.info('驱逐缓存完成', { count: entriesToEvict.length });
    }
  }

  /**
   * 清理过期缓存
   */
  async cleanExpired(): Promise<number> {
    return this.clearCache({ expiredOnly: true });
  }

  /**
   * 获取配置
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// 创建默认缓存管理器实例
export const kgCacheManager = new KnowledgeGraphCacheManager();

// 便捷函数
export const kgCache = {
  neighbors: {
    get: (params: NeighborsQueryParams) => kgCacheManager.getNeighbors(params),
    set: (params: NeighborsQueryParams, data: CacheData, ttl?: number) =>
      kgCacheManager.setNeighbors(params, data, ttl),
  },
  shortestPath: {
    get: (params: ShortestPathQueryParams) =>
      kgCacheManager.getShortestPath(params),
    set: (params: ShortestPathQueryParams, data: CacheData, ttl?: number) =>
      kgCacheManager.setShortestPath(params, data, ttl),
  },
  subgraph: {
    get: (params: SubgraphQueryParams) => kgCacheManager.getSubgraph(params),
    set: (params: SubgraphQueryParams, data: CacheData, ttl?: number) =>
      kgCacheManager.setSubgraph(params, data, ttl),
  },
  delete: (cacheKey: string) => kgCacheManager.deleteEntry(cacheKey),
  clear: (options?: ClearCacheOptions) => kgCacheManager.clearCache(options),
  getStats: () => kgCacheManager.getStats(),
  cleanExpired: () => kgCacheManager.cleanExpired(),
  getConfig: () => kgCacheManager.getConfig(),
  updateConfig: (config: Partial<CacheConfig>) =>
    kgCacheManager.updateConfig(config),
};

export default kgCacheManager;
