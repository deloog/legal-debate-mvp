/**
 * KnowledgeBaseUpdater - 知识库更新器
 * 更新Cold Memory中的错误知识
 */

import { MemoryManager } from "../memory-manager";
import type { ErrorPattern, PreventionMeasure } from "../types";

/**
 * KnowledgeBaseUpdater - 知识库更新类
 */
export class KnowledgeBaseUpdater {
  constructor(private memoryManager: MemoryManager) {}

  /**
   * 更新知识库（存储到Cold Memory）
   */
  async updateKnowledgeBase(
    error: { errorType: string; userId: string | null },
    pattern: ErrorPattern,
    preventionMeasures: PreventionMeasure[],
  ): Promise<boolean> {
    try {
      const knowledgeKey = `error_pattern_${error.errorType}`;

      // 检查是否已存在该错误模式的知识
      const existing = await this.memoryManager.getColdMemory(knowledgeKey);

      const existingKnowledge = existing as {
        errorCount?: number;
      } | null;

      const newKnowledge = {
        errorType: error.errorType,
        patterns: pattern,
        preventionMeasures,
        lastUpdated: new Date().toISOString(),
        errorCount: existingKnowledge?.errorCount
          ? existingKnowledge.errorCount + 1
          : pattern.frequency,
      };

      // 存储到Cold Memory（永久保留）
      await this.memoryManager.storeColdMemory(
        knowledgeKey,
        newKnowledge,
        error.userId || "system",
      );

      return true;
    } catch (error) {
      console.error("Failed to update knowledge base:", error);
      return false;
    }
  }
}
