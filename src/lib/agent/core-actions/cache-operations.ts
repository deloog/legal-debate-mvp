/**
 * 缓存操作模块（Cache Operations）
 * 包含：缓存结果功能
 */

import { MemoryManager } from "../memory-agent/memory-manager";
import type { CacheResult } from "./types";

/**
 * cache_result - 结果缓存
 * 使用MemoryManager缓存结果
 */
export async function cache_result(
  memoryManager: MemoryManager,
  key: string,
  value: unknown,
  ttl: number,
  userId: string,
): Promise<CacheResult> {
  try {
    await memoryManager.storeWorkingMemory(
      key,
      value,
      userId,
      undefined,
      undefined,
      ttl,
    );
    return { success: true, cached: true, hit: false, ttl };
  } catch {
    return { success: false, cached: false };
  }
}
