import crypto from "crypto";
import { cacheManager } from "../cache/manager";
import type {
  SearchCacheKey,
  SearchCacheValue,
  SearchStatistics,
} from "./types";

/**
 * 法条检索缓存管理器
 * 负责管理检索结果的缓存
 */
export class SearchCacheManager {
  private static readonly CACHE_PREFIX = "law_article_search";
  private static readonly DEFAULT_TTL = 5 * 60; // 5分钟（秒）
  private static readonly CACHE_KEY_SEPARATOR = ":";

  /**
   * 生成缓存键
   */
  static generateCacheKey(key: SearchCacheKey): string {
    const keyParts: string[] = [this.CACHE_PREFIX];

    if (key.keyword) {
      keyParts.push(`kw:${key.keyword.trim().toLowerCase()}`);
    }
    if (key.category) {
      keyParts.push(`cat:${key.category}`);
    }
    if (key.subCategory) {
      keyParts.push(`sub:${key.subCategory.trim().toLowerCase()}`);
    }
    if (key.tags && key.tags.length > 0) {
      keyParts.push(`tags:${key.tags.sort().join(",")}`);
    }
    if (key.sortField) {
      keyParts.push(`sort:${key.sortField}:${key.sortOrder || "desc"}`);
    }
    if (key.page) {
      keyParts.push(`page:${key.page}`);
    }
    if (key.pageSize) {
      keyParts.push(`size:${key.pageSize}`);
    }

    // 如果键太长，使用SHA256哈希
    const keyString = keyParts.join(this.CACHE_KEY_SEPARATOR);
    if (keyString.length > 200) {
      return `${this.CACHE_PREFIX}:hash:${crypto.createHash("sha256").update(keyString).digest("hex")}`;
    }

    return keyString;
  }

  /**
   * 获取缓存
   */
  static async getCache(key: SearchCacheKey): Promise<SearchCacheValue | null> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const cached = await cacheManager.get<SearchCacheValue>(cacheKey);

      if (cached) {
        // 检查缓存是否过期
        const cacheAge = Date.now() - new Date(cached.cachedAt).getTime();
        const cacheTTL = this.DEFAULT_TTL * 1000; // 转换为毫秒

        if (cacheAge > cacheTTL) {
          await this.deleteCache(key);
          return null;
        }

        return cached;
      }

      return null;
    } catch (error) {
      console.error("Error getting search cache:", error);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  static async setCache(
    key: SearchCacheKey,
    value: SearchCacheValue,
    ttl?: number,
  ): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(key);
      const cacheTTL = ttl || this.DEFAULT_TTL;

      await cacheManager.set(cacheKey, value, { ttl: cacheTTL });
    } catch (error) {
      console.error("Error setting search cache:", error);
    }
  }

  /**
   * 删除缓存
   */
  static async deleteCache(key: SearchCacheKey): Promise<void> {
    try {
      const cacheKey = this.generateCacheKey(key);
      await cacheManager.delete(cacheKey);
    } catch (error) {
      console.error("Error deleting search cache:", error);
    }
  }

  /**
   * 清除所有法条检索缓存
   */
  static async clearAllCache(): Promise<void> {
    try {
      // 注意：这个操作会清除所有以CACHE_PREFIX开头的缓存
      // 实际实现可能需要根据Redis客户端的API调整
      console.log(`Clearing all cache with prefix: ${this.CACHE_PREFIX}`);
      // TODO: 实现按前缀清除缓存
    } catch (error) {
      console.error("Error clearing all search cache:", error);
    }
  }

  /**
   * 更新法条浏览计数
   */
  static async incrementViewCount(articleId: string): Promise<void> {
    try {
      const viewKey = `${this.CACHE_PREFIX}:views:${articleId}`;
      const currentViews = (await cacheManager.get<number>(viewKey)) || 0;

      await cacheManager.set(viewKey, currentViews + 1, { ttl: 60 * 60 });
    } catch (error) {
      console.error("Error incrementing view count:", error);
    }
  }

  /**
   * 获取法条浏览计数
   */
  static async getViewCount(articleId: string): Promise<number> {
    try {
      const viewKey = `${this.CACHE_PREFIX}:views:${articleId}`;
      return (await cacheManager.get<number>(viewKey)) || 0;
    } catch (error) {
      console.error("Error getting view count:", error);
      return 0;
    }
  }

  /**
   * 记录检索统计信息
   */
  static async recordSearch(keyword?: string): Promise<void> {
    try {
      const statsKey = `${this.CACHE_PREFIX}:stats`;
      const stats = await cacheManager.get<SearchStatistics>(statsKey);

      const now = new Date();
      const newStats: SearchStatistics = {
        totalSearches: (stats?.totalSearches || 0) + 1,
        cacheHits: stats?.cacheHits || 0,
        cacheHitRate: 0,
        averageExecutionTime: stats?.averageExecutionTime || 0,
        topKeywords: stats?.topKeywords || [],
        lastSearchTime: now,
      };

      await cacheManager.set(statsKey, newStats, { ttl: 60 * 60 });
    } catch (error) {
      console.error("Error recording search stats:", error);
    }
  }

  /**
   * 记录缓存命中
   */
  static async recordCacheHit(): Promise<void> {
    try {
      const statsKey = `${this.CACHE_PREFIX}:stats`;
      const stats = await cacheManager.get<SearchStatistics>(statsKey);

      if (stats) {
        const newStats: SearchStatistics = {
          ...stats,
          cacheHits: stats.cacheHits + 1,
          cacheHitRate:
            stats.totalSearches > 0
              ? (stats.cacheHits + 1) / stats.totalSearches
              : 0,
        };

        await cacheManager.set(statsKey, newStats, { ttl: 60 * 60 });
      }
    } catch (error) {
      console.error("Error recording cache hit:", error);
    }
  }

  /**
   * 获取检索统计信息
   */
  static async getSearchStatistics(): Promise<SearchStatistics | null> {
    try {
      const statsKey = `${this.CACHE_PREFIX}:stats`;
      return await cacheManager.get<SearchStatistics>(statsKey);
    } catch (error) {
      console.error("Error getting search statistics:", error);
      return null;
    }
  }

  /**
   * 重置检索统计信息
   */
  static async resetSearchStatistics(): Promise<void> {
    try {
      const statsKey = `${this.CACHE_PREFIX}:stats`;
      await cacheManager.delete(statsKey);
    } catch (error) {
      console.error("Error resetting search statistics:", error);
    }
  }

  /**
   * 批量预热缓存
   */
  static async warmUpCache(
    queries: SearchCacheKey[],
    values: SearchCacheValue[],
  ): Promise<void> {
    try {
      const promises = queries.map((key, index) =>
        this.setCache(key, values[index]),
      );

      await Promise.all(promises);
    } catch (error) {
      console.error("Error warming up cache:", error);
    }
  }
}
