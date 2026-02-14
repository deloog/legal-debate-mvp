/**
 * 法律法规同步调度器
 * 定时执行法律法规数据同步
 */

import { npcCrawler } from './npc-crawler';
import { courtCrawler } from './court-crawler';
import { flkCrawler } from './flk-crawler';
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

export class LawSyncScheduler {
  private isRunning = false;
  private lastSyncTime: Date | null = null;

  constructor() {
    // 初始化时检查是否需要同步
  }

  /**
   * 检查是否有正在运行的同步任务
   */
  isSyncInProgress(): boolean {
    return this.isRunning;
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
    if (this.isRunning) {
      throw new Error('同步任务正在执行中');
    }

    this.isRunning = true;
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
      this.isRunning = false;
    }
  }

  /**
   * 执行全量同步
   */
  async runFullSync(): Promise<SyncResult[]> {
    if (this.isRunning) {
      throw new Error('同步任务正在执行中');
    }

    this.isRunning = true;
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
      this.isRunning = false;
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
          result =
            crawlType === 'full'
              ? await flkCrawler.crawl()
              : await flkCrawler.incrementalCrawl(since);
          break;
        case 'npc':
          result =
            crawlType === 'full'
              ? await npcCrawler.crawl()
              : await (npcCrawler as any).incrementalCrawl(since);
          break;
        case 'court':
          result =
            crawlType === 'full'
              ? await courtCrawler.crawl()
              : await courtCrawler.crawl();
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
   */
  private async getEnabledSources(): Promise<DataSource[]> {
    // 从系统配置中获取启用的数据源
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'crawler_enabled_sources' },
    });

    if (!config) {
      // 默认启用 FLK、NPC 和 Court
      return ['flk', 'npc', 'court'];
    }

    const value = config.value as any;
    return value?.sources || ['flk', 'npc', 'court'];
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
      isRunning: this.isRunning,
    };
  }
}

export const lawSyncScheduler = new LawSyncScheduler();
