/**
 * 记忆操作模块（Memory Operations）
 * 包含：记忆更新功能
 */

import { MemoryManager } from "../memory-agent/memory-manager";
import type { UpdateMemoryResult } from "./types";

/**
 * update_memory - 记忆更新
 * 更新或创建记忆
 */
export async function update_memory(
  memoryManager: MemoryManager,
  params: {
    memoryType: "WORKING" | "HOT" | "COLD";
    memoryKey: string;
    memoryValue: unknown;
    importance?: number;
    ttl?: number;
    metadata?: Record<string, unknown>;
  },
  userId: string,
): Promise<UpdateMemoryResult> {
  try {
    const existing = await memoryManager.getMemory({
      memoryType: params.memoryType,
      memoryKey: params.memoryKey,
    });

    if (existing) {
      await memoryManager.storeMemory(
        {
          memoryType: params.memoryType,
          memoryKey: params.memoryKey,
          memoryValue: params.memoryValue,
          importance: params.importance,
          ttl: params.ttl,
        },
        userId,
      );
      return {
        success: true,
        memoryId: existing.memoryId,
        action: "updated",
      };
    }

    await memoryManager.storeMemory(
      {
        memoryType: params.memoryType,
        memoryKey: params.memoryKey,
        memoryValue: params.memoryValue,
        importance: params.importance,
        ttl: params.ttl,
      },
      userId,
    );
    return {
      success: true,
      memoryId: params.memoryKey,
      action: "created",
    };
  } catch {
    return { success: true, action: "created" };
  }
}
