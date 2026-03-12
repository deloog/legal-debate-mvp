/**
 * 采集任务管理器
 * 管理和调度法律法规采集任务
 */

import { prisma } from '@/lib/db/prisma';
import { DataSource, CrawlStatistics, CreateCrawlTaskParams } from './types';
import { Prisma, SyncStatus } from '@prisma/client';

export class CrawlTaskManager {
  /**
   * 创建采集任务
   */
  async createTask(params: CreateCrawlTaskParams): Promise<string> {
    const taskId = `crawl_${params.source}_${Date.now()}`;

    // 创建采集任务记录
    await prisma.systemConfig.upsert({
      where: { key: `crawl_task_${taskId}` },
      update: {
        value: {
          source: params.source,
          crawlType: params.crawlType,
          status: 'pending',
          options: params.options,
          createdAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
      create: {
        key: `crawl_task_${taskId}`,
        value: {
          source: params.source,
          crawlType: params.crawlType,
          status: 'pending',
          options: params.options,
          createdAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
        type: 'OBJECT',
        category: 'crawler',
      },
    });

    return taskId;
  }

  /**
   * 获取任务状态
   */
  async getTaskStatus(taskId: string): Promise<Record<string, unknown> | null> {
    const config = await prisma.systemConfig.findUnique({
      where: { key: `crawl_task_${taskId}` },
    });

    if (!config) {
      return null;
    }

    const value = config.value as Record<string, unknown>;
    return {
      id: taskId,
      source: value.source,
      status: value.status,
      crawlType: value.crawlType,
      itemsProcessed: value.itemsProcessed || 0,
      itemsSucceeded: value.itemsSucceeded || 0,
      itemsFailed: value.itemsFailed || 0,
      errors: value.errors || [],
      startedAt: value.startedAt,
      completedAt: value.completedAt,
    };
  }

  /**
   * 获取所有数据源统计
   */
  async getSourceStatistics(): Promise<CrawlStatistics[]> {
    const sources = await prisma.lawArticle.groupBy({
      by: ['dataSource'],
      _count: { id: true },
      where: {
        dataSource: { not: 'local' },
      },
    });

    const statistics: CrawlStatistics[] = [];

    for (const source of sources) {
      const total = source._count.id;
      const valid = await prisma.lawArticle.count({
        where: {
          dataSource: source.dataSource,
          status: 'VALID',
        },
      });

      statistics.push({
        source: source.dataSource as DataSource,
        totalArticles: total,
        validArticles: valid,
        invalidArticles: total - valid,
        newArticles: 0,
        updatedArticles: 0,
        failedArticles: 0,
        averageProcessingTime: 0,
        dataQuality: {
          completeness: 0.95,
          accuracy: 0.9,
          consistency: 0.85,
          timeliness: 0.8,
        },
      });
    }

    return statistics;
  }

  /**
   * 获取需要同步的法条
   */
  async getArticlesNeedingSync(
    source: DataSource,
    limit: number = 100
  ): Promise<Record<string, unknown>[]> {
    return prisma.lawArticle.findMany({
      where: {
        dataSource: source,
        syncStatus: { in: ['PENDING', 'NEED_UPDATE'] },
      },
      take: limit,
      orderBy: { lastSyncedAt: 'asc' },
    });
  }

  /**
   * 更新法条同步状态
   */
  async updateSyncStatus(
    articleId: string,
    status: SyncStatus,
    error?: string
  ): Promise<void> {
    const updateData: Prisma.LawArticleUpdateInput = {
      syncStatus: status,
      lastSyncedAt: new Date(),
    };

    if (error) {
      updateData.amendmentHistory = {
        push: {
          syncError: error,
          syncedAt: new Date(),
        },
      };
    }

    await prisma.lawArticle.update({
      where: { id: articleId },
      data: updateData,
    });
  }

  /**
   * 获取采集历史
   */
  async getCrawlHistory(
    options: {
      source?: DataSource;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Record<string, unknown>[]> {
    const { source, limit = 20, offset = 0 } = options;

    // 从系统配置中获取采集任务记录
    const configs = await prisma.systemConfig.findMany({
      where: {
        key: { startsWith: 'crawl_task_' },
        ...(source && {
          value: { path: ['source'], equals: source },
        }),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return configs.map(config => {
      const value = config.value as Record<string, unknown>;
      return {
        id: config.key.replace('crawl_task_', ''),
        source: value.source as string,
        status: value.status as string,
        crawlType: value.crawlType as string,
        itemsProcessed: (value.itemsProcessed as number) || 0,
        itemsSucceeded: (value.itemsSucceeded as number) || 0,
        itemsFailed: (value.itemsFailed as number) || 0,
        errors: (value.errors as string[]) || [],
        startedAt: value.startedAt as string | undefined,
        completedAt: value.completedAt as string | undefined,
        createdAt: config.createdAt,
      };
    });
  }

  /**
   * 更新任务进度
   */
  async updateTaskProgress(
    taskId: string,
    progress: {
      itemsProcessed?: number;
      itemsSucceeded?: number;
      itemsFailed?: number;
      errors?: string[];
      status?: string;
      currentItem?: string;
    }
  ): Promise<void> {
    const config = await prisma.systemConfig.findUnique({
      where: { key: `crawl_task_${taskId}` },
    });

    if (!config) {
      return;
    }

    const value = config.value as Record<string, unknown>;
    const updatedValue = {
      ...value,
      ...progress,
      updatedAt: new Date().toISOString(),
    };

    await prisma.systemConfig.update({
      where: { key: `crawl_task_${taskId}` },
      data: { value: updatedValue as Prisma.InputJsonValue },
    });
  }

  /**
   * 完成任务
   */
  async completeTask(
    taskId: string,
    result: {
      itemsProcessed: number;
      itemsSucceeded: number;
      itemsFailed: number;
      errors?: string[];
    }
  ): Promise<void> {
    await prisma.systemConfig.update({
      where: { key: `crawl_task_${taskId}` },
      data: {
        value: {
          status: 'completed',
          itemsProcessed: result.itemsProcessed,
          itemsSucceeded: result.itemsSucceeded,
          itemsFailed: result.itemsFailed,
          errors: result.errors || [],
          completedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * 获取数据源配置
   */
  async getSourceConfig(): Promise<Record<string, unknown>[]> {
    const stats = await this.getSourceStatistics();

    return stats.map(stat => ({
      source: stat.source,
      totalArticles: stat.totalArticles,
      validArticles: stat.validArticles,
      lastSync: null,
      syncStatus: 'unknown',
    }));
  }
}

export const crawlTaskManager = new CrawlTaskManager();
