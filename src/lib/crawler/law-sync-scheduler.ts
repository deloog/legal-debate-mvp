/**
 * 法律法规同步调度器
 * 定时执行法律法规数据同步
 */

import { npcCrawler } from './npc-crawler';
import { courtCrawler } from './court-crawler';
import { flkCrawler, HIGH_PRIORITY_TYPES } from './flk-crawler';
import { DataSource } from './types';
import { prisma } from '@/lib/db/prisma';

interface SyncResult {
  source: DataSource;
  success: boolean;
  itemsProcessed: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
  duration: number;
}

/** 分布式锁在 SystemConfig 中的 key */
const LOCK_KEY = 'crawler_sync_lock';
/** 锁超时时间（毫秒）：30 分钟后自动释放，防止进程崩溃后死锁 */
const LOCK_TTL_MS = 30 * 60 * 1000;

export class LawSyncScheduler {
  private lastSyncTime: Date | null = null;

  /**
   * 尝试获取 DB 分布式锁。
   * 返回 true 表示成功获锁，false 表示锁已被其他进程持有。
   * 若锁已超时（进程崩溃未释放），会自动覆盖。
   */
  private async acquireLock(): Promise<boolean> {
    const now = Date.now();
    const existing = await prisma.systemConfig.findUnique({
      where: { key: LOCK_KEY },
    });

    if (existing) {
      const value = existing.value as any;
      const lockedAt: number = value?.lockedAt ?? 0;
      if (now - lockedAt < LOCK_TTL_MS) {
        // 锁仍在有效期内，拒绝
        return false;
      }
      // 锁已超时，允许覆盖
    }

    await prisma.systemConfig.upsert({
      where: { key: LOCK_KEY },
      update: { value: { lockedAt: now, pid: process.pid } as any },
      create: {
        key: LOCK_KEY,
        value: { lockedAt: now, pid: process.pid } as any,
        type: 'OBJECT',
        category: 'crawler',
      },
    });
    return true;
  }

  /** 释放分布式锁 */
  private async releaseLock(): Promise<void> {
    await prisma.systemConfig.delete({ where: { key: LOCK_KEY } }).catch(() => {
      // 锁已被其他进程清理，忽略
    });
  }

  /**
   * 检查是否有正在运行的同步任务（跨进程安全）
   */
  async isSyncInProgress(): Promise<boolean> {
    const existing = await prisma.systemConfig.findUnique({
      where: { key: LOCK_KEY },
    });
    if (!existing) return false;
    const value = existing.value as any;
    return Date.now() - (value?.lockedAt ?? 0) < LOCK_TTL_MS;
  }

  /**
   * 获取最后同步时间
   */
  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  /**
   * 执行增量同步
   */
  async runIncrementalSync(): Promise<SyncResult[]> {
    if (!(await this.acquireLock())) {
      throw new Error('同步任务正在执行中（分布式锁）');
    }

    const results: SyncResult[] = [];

    try {
      // 获取需要同步的数据源配置
      const sources = await this.getEnabledSources();

      for (const source of sources) {
        const result = await this.syncSource(source, 'incremental');
        results.push(result);
      }

      this.lastSyncTime = new Date();

      // 记录同步历史
      await this.recordSyncHistory(results);

      return results;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * 执行全量同步
   */
  async runFullSync(): Promise<SyncResult[]> {
    if (!(await this.acquireLock())) {
      throw new Error('同步任务正在执行中（分布式锁）');
    }

    const results: SyncResult[] = [];

    try {
      const sources = await this.getEnabledSources();

      for (const source of sources) {
        const result = await this.syncSource(source, 'full');
        results.push(result);
      }

      this.lastSyncTime = new Date();
      await this.recordSyncHistory(results);

      return results;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * 同步单个数据源
   */
  private async syncSource(
    source: DataSource,
    crawlType: 'full' | 'incremental'
  ): Promise<SyncResult> {
    const startTime = Date.now();
    let itemsProcessed = 0;
    let itemsCreated = 0;
    let itemsUpdated = 0;
    const errors: string[] = [];

    try {
      const since = new Date();
      since.setDate(since.getDate() - 7);

      let result: {
        success: boolean;
        itemsCrawled: number;
        itemsCreated: number;
        itemsUpdated: number;
        errors: string[];
      };

      switch (source) {
        case 'flk':
          // 优先采集全国性法律（使用 HIGH_PRIORITY_TYPES），确保高权威性数据优先入库
          result =
            crawlType === 'full'
              ? await flkCrawler.crawl({ types: HIGH_PRIORITY_TYPES })
              : await flkCrawler.incrementalCrawl(since);
          break;
        case 'npc':
          result =
            crawlType === 'full'
              ? await npcCrawler.crawl()
              : await (npcCrawler as any).incrementalCrawl(since);
          break;
        case 'court':
          // court 爬虫尚未实现 incrementalCrawl，全量/增量均走 crawl()
          result = await courtCrawler.crawl();
          break;
        default:
          throw new Error(`不支持的数据源: ${source}`);
      }

      itemsProcessed = result.itemsCrawled;
      itemsCreated = result.itemsCreated;
      itemsUpdated = result.itemsUpdated;
      errors.push(...result.errors);

      return {
        source,
        success: result.success,
        itemsProcessed,
        itemsCreated,
        itemsUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      return {
        source,
        success: false,
        itemsProcessed,
        itemsCreated,
        itemsUpdated,
        errors,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * 获取启用的数据源
   *
   * 注意：npc 和 court 爬虫尚未对接真实 API（均返回 NOT_IMPLEMENTED 失败），
   * 默认只启用已实现的 'flk' 数据源，避免每次同步产生无意义的错误日志。
   * 若已完成其他数据源的接口对接，可通过 setEnabledSources() 重新启用。
   */
  private async getEnabledSources(): Promise<DataSource[]> {
    // 从系统配置中获取启用的数据源
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'crawler_enabled_sources' },
    });

    if (!config) {
      return ['flk'];
    }

    const value = config.value as any;
    return value?.sources || ['flk'];
  }

  /**
   * 记录同步历史
   */
  private async recordSyncHistory(results: SyncResult[]): Promise<void> {
    const summary = {
      sources: results.map(r => r.source),
      totalProcessed: results.reduce((sum, r) => sum + r.itemsProcessed, 0),
      totalCreated: results.reduce((sum, r) => sum + r.itemsCreated, 0),
      totalUpdated: results.reduce((sum, r) => sum + r.itemsUpdated, 0),
      success: results.every(r => r.success),
    };

    await prisma.systemConfig.upsert({
      where: { key: 'last_sync_result' },
      update: {
        value: {
          ...summary,
          syncedAt: new Date().toISOString(),
        } as any,
      },
      create: {
        key: 'last_sync_result',
        value: {
          ...summary,
          syncedAt: new Date().toISOString(),
        } as any,
        type: 'OBJECT',
        category: 'crawler',
      },
    });
  }

  /**
   * 配置启用的数据源
   */
  async setEnabledSources(sources: DataSource[]): Promise<void> {
    await prisma.systemConfig.upsert({
      where: { key: 'crawler_enabled_sources' },
      update: {
        value: { sources } as any,
      },
      create: {
        key: 'crawler_enabled_sources',
        value: { sources } as any,
        type: 'OBJECT',
        category: 'crawler',
      },
    });
  }

  /**
   * 获取同步配置
   */
  async getSyncConfig(): Promise<any> {
    const [enabledSources, lastSyncResult] = await Promise.all([
      this.getEnabledSources(),
      prisma.systemConfig.findUnique({
        where: { key: 'last_sync_result' },
      }),
    ]);

    return {
      enabledSources,
      lastSyncTime: this.lastSyncTime,
      lastSyncResult: lastSyncResult?.value as any,
      isRunning: await this.isSyncInProgress(),
    };
  }
}

export const lawSyncScheduler = new LawSyncScheduler();
