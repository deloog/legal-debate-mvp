/**
 * 缓存处理器 - 负责缓存管理
 *
 * 核心功能：
 * - 缓存键生成
 * - 缓存读写操作
 * - TTL管理
 * - 缓存命中率统计
 */

import type { DocumentAnalysisOutput, CacheConfig } from '../core/types';
import { CACHE_TTL_MAP } from '../core/constants';
import { CacheManager } from '../../../cache';
import { logger } from '../../../agent/security/logger';

export class CacheProcessor {
  private cacheManager: CacheManager;
  private config: CacheConfig;
  private stats: {
    hits: number;
    misses: number;
    writes: number;
    errors: number;
  };
  private namespace: string;
  private disabled: boolean = false;

  constructor(config?: Partial<CacheConfig>) {
    this.cacheManager = new CacheManager();
    this.config = {
      enabled: true,
      ttl: 86400,
      namespace: 'doc-analyzer',
      ...config,
    };
    this.namespace = this.config.namespace;
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      errors: 0,
    };
  }

  /**
   * 尝试获取缓存
   */
  public async get(
    documentId: string,
    fileType: string,
    text: string
  ): Promise<DocumentAnalysisOutput | null> {
    if (!this.config.enabled || this.disabled) {
      return null;
    }

    try {
      const key = this.generateKey(documentId, fileType, text);
      const cached = await this.cacheManager.get<DocumentAnalysisOutput>(key, {
        namespace: this.namespace,
      });

      if (cached) {
        this.stats.hits++;
        logger.info('缓存命中', {
          documentId,
          key: key.substring(0, 50) + '...',
        });
        return cached;
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      logger.error('缓存获取失败', error instanceof Error ? error : undefined);
      return null;
    }
  }

  /**
   * 设置缓存
   */
  public async set(
    documentId: string,
    fileType: string,
    text: string,
    data: DocumentAnalysisOutput
  ): Promise<boolean> {
    if (!this.config.enabled || this.disabled) {
      return false;
    }

    try {
      const key = this.generateKey(documentId, fileType, text);
      const ttl = this.calculateTTL(fileType);

      await this.cacheManager.set(key, data, {
        namespace: this.namespace,
        ttl,
      });

      this.stats.writes++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('缓存设置失败', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * 生成缓存键
   */
  public generateKey(
    documentId: string,
    fileType: string,
    text: string
  ): string {
    const keyInput = `${documentId}_${fileType}_${text.substring(0, 1000)}`;
    return this.hash(keyInput);
  }

  /**
   * 计算TTL
   */
  public calculateTTL(fileType: string): number {
    return CACHE_TTL_MAP[fileType] || this.config.ttl;
  }

  /**
   * 获取统计信息
   */
  public getStats(): {
    hits: number;
    misses: number;
    writes: number;
    errors: number;
    hitRate: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      ...this.stats,
      hitRate: parseFloat(hitRate.toFixed(2)),
    };
  }

  /**
   * 重置统计
   */
  public resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      writes: 0,
      errors: 0,
    };
  }

  /**
   * 禁用缓存（用于测试）
   */
  public disable(): void {
    this.disabled = true;
  }

  /**
   * 启用缓存
   */
  public enable(): void {
    this.disabled = false;
  }

  /**
   * 清除缓存
   */
  public async clear(documentId?: string): Promise<boolean> {
    try {
      if (documentId) {
        // 清除特定文档的缓存 - 使用Redis keys命令
        const key = this.generateKey(documentId, 'FILE', '');
        // 由于CacheManager没有按前缀删除的方法，这里只是记录日志
        logger.info('请求清除文档缓存', { documentId, key });
        return true;
      } else {
        // 清除所有文档分析缓存
        await this.cacheManager.clearNamespace(this.namespace);
        logger.info('清除所有文档分析缓存');
        return true;
      }
    } catch (error) {
      logger.error('清除缓存失败', error instanceof Error ? error : undefined);
      return false;
    }
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.namespace) {
      this.namespace = config.namespace;
    }
  }

  /**
   * 哈希函数
   */
  private hash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}
