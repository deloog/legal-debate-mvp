/**
 * MemoryAgent - 记忆层Agent
 * 基于Manus三层记忆架构，整合所有记忆管理功能
 */

import { PrismaClient } from "@prisma/client";

import type { AIService } from "../../ai/service-refactored";
import { MemoryManager } from "./memory-manager";
import { MemoryCompressor } from "./compressor";
import { MemoryMigrator } from "./migrator";
import { ErrorLearner } from "./error-learner";
import type {
  StoreMemoryInput,
  GetMemoryInput,
  LearnFromErrorInput,
  MemoryStats,
  CompressionResult,
  LearningResult,
  MigrationResult,
} from "./types";

/**
 * MemoryAgent - 记忆Agent主类
 */
export class MemoryAgent {
  private memoryManager: MemoryManager;
  private compressor: MemoryCompressor;
  private migrator: MemoryMigrator;
  private errorLearner: ErrorLearner;
  private initialized: boolean = false;

  constructor(
    private prisma: PrismaClient,
    private aiService: AIService,
  ) {
    this.memoryManager = new MemoryManager(prisma);
    this.compressor = new MemoryCompressor(aiService);
    this.migrator = new MemoryMigrator(this.memoryManager, this.compressor);
    this.errorLearner = new ErrorLearner(prisma, aiService, this.memoryManager);
  }

  /**
   * 初始化Agent
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log("Initializing MemoryAgent...");

    // 启动记忆迁移定时任务
    this.migrator.start();

    this.initialized = true;
    console.log("MemoryAgent initialized successfully");
  }

  /**
   * 关闭Agent
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    console.log("Shutting down MemoryAgent...");

    // 停止定时任务
    this.migrator.stop();

    this.initialized = false;
    console.log("MemoryAgent shut down successfully");
  }

  /**
   * 存储记忆
   */
  async storeMemory(
    input: StoreMemoryInput,
    userId: string,
    caseId?: string,
    debateId?: string,
  ): Promise<string> {
    const memory = await this.memoryManager.storeMemory(
      input,
      userId,
      caseId,
      debateId,
    );

    return memory.memoryId;
  }

  /**
   * 获取记忆
   */
  async getMemory(input: GetMemoryInput): Promise<unknown> {
    const memory = await this.memoryManager.getMemory(input);

    if (!memory) {
      return null;
    }

    return memory.memoryValue;
  }

  /**
   * 压缩记忆
   */
  async compressMemory(memoryId: string): Promise<CompressionResult> {
    // 注意：这里需要从数据库获取完整记忆
    // 由于memory-manager缺少getById方法，这里需要补充

    // 临时实现：查找所有记忆并匹配ID
    const allMemories = await this.memoryManager.getMemoriesByType("WORKING");
    const memory = allMemories.find((m) => m.memoryId === memoryId);

    if (!memory) {
      // 尝试从Hot Memory查找
      const hotMemories = await this.memoryManager.getMemoriesByType("HOT");
      const hotMemory = hotMemories.find((m) => m.memoryId === memoryId);

      if (!hotMemory) {
        return {
          success: false,
          error: "Memory not found",
        };
      }

      return await this.compressor.compressMemory(hotMemory);
    }

    return await this.compressor.compressMemory(memory);
  }

  /**
   * 从错误学习
   */
  async learnFromError(input: LearnFromErrorInput): Promise<LearningResult> {
    return await this.errorLearner.learnFromError(input.errorId);
  }

  /**
   * 获取记忆统计信息
   */
  async getStats(): Promise<MemoryStats> {
    return await this.memoryManager.getStats();
  }

  /**
   * 清理过期记忆
   */
  async cleanExpired(): Promise<number> {
    return await this.memoryManager.cleanExpired();
  }

  /**
   * 执行记忆迁移（手动触发）
   */
  async triggerMigration(
    type: "workingToHot" | "hotToCold",
  ): Promise<MigrationResult> {
    if (type === "workingToHot") {
      return await this.migrator.migrateWorkingToHot();
    } else {
      return await this.migrator.compressHotToCold();
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
    return await this.migrator.getMigrationStats();
  }

  /**
   * 批量学习未学习的错误
   */
  async batchLearnErrors(limit: number = 50): Promise<LearningResult[]> {
    return await this.errorLearner.batchLearn(limit);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      const stats = await this.getStats();
      return stats.totalMemoryCount >= 0;
    } catch {
      return false;
    }
  }
}
