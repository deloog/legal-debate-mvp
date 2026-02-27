/**
 * MemoryMigrator - 记忆迁移逻辑
 * 实现Working→Hot→Cold的自动迁移机制
 *
 * 注意：ActionType 枚举已包含 MIGRATE_WORKING_TO_HOT 和 MIGRATE_HOT_TO_COLD，
 * 可直接使用字符串字面量联合类型无需类型断言。
 */

import * as cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { logger } from '../security/logger';

import { MemoryManager } from './memory-manager';
import { MemoryCompressor } from './compressor';
import type { Memory, MigrationResult } from './types';
import { MIGRATION_CONFIG, FILTER_CONSTANTS } from './migrator/config';

const prisma = new PrismaClient();

/**
 * 记忆迁移类
 */
export class MemoryMigrator {
  private workingToHotCron?: ReturnType<typeof cron.schedule>;
  private hotToColdCron?: ReturnType<typeof cron.schedule>;

  constructor(
    private memoryManager: MemoryManager,
    private compressor: MemoryCompressor
  ) {
    // 不在构造函数中启动定时任务
    // 由外部调用start方法启动
  }

  /**
   * 记录迁移历史到agent_actions表
   */
  private async logMigrationAction(
    memory: Memory,
    actionType: 'MIGRATE_WORKING_TO_HOT' | 'MIGRATE_HOT_TO_COLD',
    status: 'COMPLETED' | 'FAILED',
    metadata?: {
      originalType: string;
      targetType: string;
      importance: number;
      accessCount: number;
      compressionRatio?: number;
      error?: string;
    }
  ): Promise<void> {
    try {
      await prisma.agentAction.create({
        data: {
          agentName: 'MemoryAgent',
          actionType,
          actionName:
            actionType === 'MIGRATE_WORKING_TO_HOT'
              ? 'Working→Hot Migration'
              : 'Hot→Cold Migration',
          actionLayer: 'SCRIPT',
          parameters: {
            memoryId: memory.memoryId,
            memoryKey: memory.memoryKey,
            ...metadata,
          },
          status,
          executionTime: 0, // 待后续实现时更新
          metadata: {
            memoryType: memory.memoryType,
            importance: memory.importance,
            accessCount: memory.accessCount,
          },
        },
      });
    } catch (error) {
      logger.error('Failed to log migration action', error instanceof Error ? error : new Error(String(error)));
      // 不影响迁移流程
    }
  }

  /**
   * 启动定时任务
   */
  start(): void {
    if (this.workingToHotCron) {
      logger.info('MemoryMigrator already started');
      return;
    }

    logger.info('Starting MemoryMigrator cron jobs...');

    // Working→Hot迁移（每小时）
    this.workingToHotCron = cron.schedule(
      MIGRATION_CONFIG.WORKING_TO_HOT_CRON,
      () => this.migrateWorkingToHot().catch((err: unknown) => logger.error('Working→Hot migration error', err instanceof Error ? err : new Error(String(err))))
    );

    // Hot→Cold归档（每天）
    this.hotToColdCron = cron.schedule(MIGRATION_CONFIG.HOT_TO_COLD_CRON, () =>
      this.compressHotToCold().catch((err: unknown) => logger.error('Hot→Cold archiving error', err instanceof Error ? err : new Error(String(err))))
    );

    logger.info('MemoryMigrator cron jobs started successfully');
  }

  /**
   * 停止定时任务
   */
  stop(): void {
    if (this.workingToHotCron) {
      this.workingToHotCron.stop();
      this.workingToHotCron = undefined;
    }

    if (this.hotToColdCron) {
      this.hotToColdCron.stop();
      this.hotToColdCron = undefined;
    }

    logger.info('MemoryMigrator cron jobs stopped');
  }

  /**
   * Working→Hot迁移（即将过期且高访问量的记忆）
   */
  async migrateWorkingToHot(): Promise<MigrationResult> {
    const startTime = Date.now();
    let migratedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      // 获取所有Working Memory
      const workingMemories =
        await this.memoryManager.getMemoriesByType('WORKING');

      logger.info(`Found ${workingMemories.length} Working Memories to migrate`);

      // 过滤候选记忆
      const candidates = this.filterWorkingCandidates(workingMemories);

      logger.info(`Found ${candidates.length} candidates for migration`);

      // 限制迁移数量
      const toMigrate = candidates.slice(
        0,
        MIGRATION_CONFIG.MAX_MIGRATION_COUNT
      );

      for (const memory of toMigrate) {
        try {
          await this.migrateSingleMemory(memory, 'HOT');
          migratedCount++;
        } catch (error) {
          logger.error(`Failed to migrate memory ${memory.memoryId}`, error instanceof Error ? error : new Error(String(error)));
          failedCount++;
        }
      }

      skippedCount = workingMemories.length - toMigrate.length;

      logger.info(`Working→Hot migration completed: ${migratedCount} migrated, ${skippedCount} skipped, ${failedCount} failed`);
    } catch (error) {
      logger.error('Error during Working→Hot migration', error instanceof Error ? error : new Error(String(error)));
      failedCount++;
    }

    return {
      migratedCount,
      skippedCount,
      failedCount,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Hot→Cold归档（即将过期且高重要性的记忆）
   */
  async compressHotToCold(): Promise<MigrationResult> {
    const startTime = Date.now();
    let migratedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    try {
      // 获取所有Hot Memory
      const hotMemories = await this.memoryManager.getMemoriesByType('HOT');

      logger.info(`Found ${hotMemories.length} Hot Memories to archive`);

      // 过滤候选记忆
      const candidates = this.filterHotCandidates(hotMemories);

      logger.info(`Found ${candidates.length} candidates for archiving`);

      // 限制迁移数量
      const toCompress = candidates.slice(
        0,
        MIGRATION_CONFIG.MAX_MIGRATION_COUNT
      );

      for (const memory of toCompress) {
        try {
          await this.compressAndArchive(memory);
          migratedCount++;
        } catch (error) {
          logger.error(`Failed to archive memory ${memory.memoryId}`, error instanceof Error ? error : new Error(String(error)));
          failedCount++;
        }
      }

      skippedCount = hotMemories.length - toCompress.length;

      logger.info(`Hot→Cold archiving completed: ${migratedCount} migrated, ${skippedCount} skipped, ${failedCount} failed`);
    } catch (error) {
      logger.error('Error during Hot→Cold archiving', error instanceof Error ? error : new Error(String(error)));
      failedCount++;
    }

    return {
      migratedCount,
      skippedCount,
      failedCount,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * 强制迁移单个记忆到指定目标
   */
  async forcemigrate(
    memoryId: string,
    targetType: 'HOT' | 'COLD'
  ): Promise<void> {
    // 查找记忆
    const memory = await this.memoryManager.getMemoryById(memoryId);

    if (!memory) {
      throw new Error(`Memory not found: ${memoryId}`);
    }

    // 迁移记忆
    await this.migrateSingleMemory(memory, targetType);
  }

  /**
   * 过滤Working Memory候选
   */
  private filterWorkingCandidates(memories: Memory[]): Memory[] {
    return memories.filter(memory => {
      if (!memory.expiresAt) {
        return false;
      }

      const timeToExpiry = memory.expiresAt.getTime() - Date.now();
      const meetsCriteria =
        timeToExpiry < FILTER_CONSTANTS.WORKING_EXPIRY_THRESHOLD &&
        memory.accessCount >= MIGRATION_CONFIG.MIN_ACCESS_COUNT &&
        memory.importance >= FILTER_CONSTANTS.WORKING_MIN_IMPORTANCE;

      return meetsCriteria;
    });
  }

  /**
   * 过滤Hot Memory候选
   */
  private filterHotCandidates(memories: Memory[]): Memory[] {
    return memories.filter(memory => {
      if (!memory.expiresAt) {
        return false;
      }

      const timeToExpiry = memory.expiresAt.getTime() - Date.now();
      return (
        timeToExpiry < FILTER_CONSTANTS.HOT_EXPIRY_THRESHOLD &&
        memory.importance >= FILTER_CONSTANTS.HOT_MIN_IMPORTANCE
      );
    });
  }

  /**
   * 迁移单个记忆
   */
  private async migrateSingleMemory(
    memory: Memory,
    targetType: 'HOT' | 'COLD'
  ): Promise<void> {
    const startTime = Date.now();

    try {
      // 获取包含元数据的记忆
      const memoryWithMetadata = await this.memoryManager.getMemoryWithMetadata(
        memory.memoryId
      );

      if (!memoryWithMetadata) {
        throw new Error(
          `Failed to retrieve memory with metadata: ${memory.memoryId}`
        );
      }

      // 删除原始记忆
      if (memory.memoryType === 'WORKING') {
        await this.memoryManager.deleteWorkingMemory(memory.memoryKey);
      }

      // 存储到目标层级
      if (targetType === 'HOT') {
        await this.memoryManager.storeHotMemory(
          memory.memoryKey,
          memory.memoryValue,
          memoryWithMetadata.userId || 'system',
          memory.importance,
          memoryWithMetadata.caseId || undefined
        );

        // 记录迁移历史
        await this.logMigrationAction(
          memory,
          'MIGRATE_WORKING_TO_HOT',
          'COMPLETED',
          {
            originalType: memory.memoryType,
            targetType: 'HOT',
            importance: memory.importance,
            accessCount: memory.accessCount,
          }
        );
      }

      // 记录执行时间
      const executionTime = Date.now() - startTime;
      await prisma.agentAction.updateMany({
        where: {
          agentName: 'MemoryAgent',
          parameters: {
            path: ['memoryId'],
            equals: memory.memoryId,
          },
        },
        data: { executionTime },
      });
    } catch (error) {
      // 记录失败的迁移
      await this.logMigrationAction(
        memory,
        targetType === 'HOT' ? 'MIGRATE_WORKING_TO_HOT' : 'MIGRATE_HOT_TO_COLD',
        'FAILED',
        {
          originalType: memory.memoryType,
          targetType,
          importance: memory.importance,
          accessCount: memory.accessCount,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      );
      throw error;
    }
  }

  /**
   * 压缩并归档记忆
   */
  private async compressAndArchive(memory: Memory): Promise<void> {
    const startTime = Date.now();

    try {
      // 压缩记忆
      const compressionResult = await this.compressor.compressMemory(memory);

      if (!compressionResult.success) {
        throw new Error(
          `Compression failed: ${compressionResult.error || 'Unknown error'}`
        );
      }

      // 删除原始记忆
      await this.memoryManager.deleteWorkingMemory(memory.memoryKey);

      // 创建压缩后的记忆存储
      const compressedValue = {
        summary: compressionResult.summary,
        keyInfo: compressionResult.keyInfo,
        originalType: memory.memoryType,
        compressedAt: new Date().toISOString(),
      };

      // 存储到Cold Memory
      await this.memoryManager.storeColdMemory(
        memory.memoryKey,
        compressedValue,
        memory.memoryId
      );

      // 标记为已压缩（如果后续需要）
      await this.memoryManager.markAsCompressed(
        memory.memoryId,
        compressionResult.ratio || 0
      );

      // 记录迁移历史
      await this.logMigrationAction(
        memory,
        'MIGRATE_HOT_TO_COLD',
        'COMPLETED',
        {
          originalType: memory.memoryType,
          targetType: 'COLD',
          importance: memory.importance,
          accessCount: memory.accessCount,
          compressionRatio: compressionResult.ratio,
        }
      );

      // 更新执行时间
      const executionTime = Date.now() - startTime;
      await prisma.agentAction.updateMany({
        where: {
          agentName: 'MemoryAgent',
          parameters: {
            path: ['memoryId'],
            equals: memory.memoryId,
          },
        },
        data: { executionTime },
      });
    } catch (error) {
      // 记录失败的归档
      await this.logMigrationAction(memory, 'MIGRATE_HOT_TO_COLD', 'FAILED', {
        originalType: memory.memoryType,
        targetType: 'COLD',
        importance: memory.importance,
        accessCount: memory.accessCount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * 获取迁移统计
   */
  async getMigrationStats(): Promise<{
    workingCount: number;
    hotCount: number;
    coldCount: number;
    workingToHotEligible: number;
    hotToColdEligible: number;
  }> {
    const [workingMemories, hotMemories] = await Promise.all([
      this.memoryManager.getMemoriesByType('WORKING'),
      this.memoryManager.getMemoriesByType('HOT'),
    ]);

    const workingToHotEligible =
      this.filterWorkingCandidates(workingMemories).length;

    const hotToColdEligible = this.filterHotCandidates(hotMemories).length;

    return {
      workingCount: workingMemories.length,
      hotCount: hotMemories.length,
      coldCount: (await this.memoryManager.getMemoriesByType('COLD')).length,
      workingToHotEligible,
      hotToColdEligible,
    };
  }
}
