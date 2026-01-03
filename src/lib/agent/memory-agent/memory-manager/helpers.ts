/**
 * MemoryManager Helpers
 * 工具方法：访问追踪、实体转换、过期时间计算
 */

import { PrismaClient, MemoryType } from "@prisma/client";

import { TTL_CONFIG } from "./config";
import type { Memory } from "../types";

/**
 * 追踪访问（更新计数和时间）
 */
export async function trackAccess(
  prisma: PrismaClient,
  record: import("@prisma/client").AgentMemory,
): Promise<void> {
  await prisma.agentMemory.update({
    where: { id: record.id },
    data: {
      accessCount: { increment: 1 },
      lastAccessedAt: new Date(),
    },
  });
}

/**
 * 转换为Memory实体
 */
export function toMemoryEntity(
  record: import("@prisma/client").AgentMemory,
): Memory {
  return {
    memoryId: record.id,
    memoryType: record.memoryType,
    memoryKey: record.memoryKey,
    memoryValue: JSON.parse(record.memoryValue as string),
    importance: record.importance,
    accessCount: record.accessCount,
    lastAccessedAt: record.lastAccessedAt,
    expiresAt: record.expiresAt || undefined,
    compressed: record.compressed,
    compressionRatio: record.compressionRatio || undefined,
    createdAt: record.createdAt,
  };
}

/**
 * 计算过期时间
 */
export function calculateExpiry(
  memoryType: MemoryType,
  ttl?: number,
): Date | null {
  if (memoryType === "COLD") {
    return null;
  }

  const defaultTTL = TTL_CONFIG[memoryType];
  const customTTL = ttl || defaultTTL;
  return new Date(Date.now() + customTTL * 1000);
}
