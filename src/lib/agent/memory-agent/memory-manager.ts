/**
 * MemoryManager - 三层记忆管理
 * 实现Working Memory、Hot Memory、Cold Memory的CRUD操作
 */

import { PrismaClient, MemoryType } from '@prisma/client';

import type {
  Memory,
  MemoryWithMetadata,
  StoreMemoryInput,
  GetMemoryInput,
  MemoryStats,
} from './types';
import { DEFAULT_IMPORTANCE, AGENT_NAME } from './memory-manager/config';
import {
  trackAccess,
  toMemoryEntity,
  calculateExpiry,
} from './memory-manager/helpers';

/**
 * MemoryManager - 三层记忆管理类
 */
export class MemoryManager {
  constructor(private prisma: PrismaClient) {}

  /**
   * 存储记忆（通用）
   */
  async storeMemory(
    input: StoreMemoryInput,
    userId: string,
    caseId?: string,
    debateId?: string
  ): Promise<Memory> {
    const {
      memoryType,
      memoryKey,
      memoryValue,
      importance = DEFAULT_IMPORTANCE,
      ttl,
    } = input;

    // 计算过期时间
    const expiresAt = calculateExpiry(memoryType, ttl);

    // 检查是否已存在
    const existing = await this.prisma.agentMemory.findFirst({
      where: {
        agentName: AGENT_NAME,
        memoryKey,
      },
    });

    if (existing) {
      // 更新现有记忆
      const updated = await this.prisma.agentMemory.update({
        where: { id: existing.id },
        data: {
          memoryValue: JSON.stringify(memoryValue),
          memoryType,
          importance,
          expiresAt,
          updatedAt: new Date(),
        },
      });

      return toMemoryEntity(updated);
    }

    // 创建新记忆
    const created = await this.prisma.agentMemory.create({
      data: {
        userId,
        caseId,
        debateId,
        memoryType,
        agentName: AGENT_NAME,
        memoryKey,
        memoryValue: JSON.stringify(memoryValue),
        importance,
        expiresAt,
      },
    });

    return toMemoryEntity(created);
  }

  /**
   * 存储Working Memory（TTL: 1小时）
   */
  async storeWorkingMemory(
    key: string,
    value: unknown,
    userId: string,
    caseId?: string,
    debateId?: string,
    ttl?: number
  ): Promise<void> {
    await this.storeMemory(
      {
        memoryType: 'WORKING',
        memoryKey: key,
        memoryValue: value,
        ttl,
      },
      userId,
      caseId,
      debateId
    );
  }

  /**
   * 获取Working Memory
   */
  async getWorkingMemory(key: string): Promise<unknown> {
    const input: GetMemoryInput = {
      memoryType: 'WORKING',
      memoryKey: key,
    };

    const result = await this.getMemory(input);
    return result?.memoryValue;
  }

  /**
   * 删除Working Memory
   */
  async deleteWorkingMemory(key: string): Promise<void> {
    await this.prisma.agentMemory.deleteMany({
      where: {
        agentName: AGENT_NAME,
        memoryKey: key,
        memoryType: 'WORKING',
      },
    });
  }

  /**
   * 存储Hot Memory（TTL: 7天）
   */
  async storeHotMemory(
    key: string,
    value: unknown,
    userId: string,
    importance: number,
    caseId?: string
  ): Promise<void> {
    await this.storeMemory(
      {
        memoryType: 'HOT',
        memoryKey: key,
        memoryValue: value,
        importance,
      },
      userId,
      caseId
    );
  }

  /**
   * 获取Hot Memory
   */
  async getHotMemory(key: string): Promise<unknown> {
    const input: GetMemoryInput = {
      memoryType: 'HOT',
      memoryKey: key,
    };

    const result = await this.getMemory(input);
    return result?.memoryValue;
  }

  /**
   * 更新Hot Memory
   */
  async updateHotMemory(key: string, value: unknown): Promise<void> {
    await this.prisma.agentMemory.updateMany({
      where: {
        agentName: AGENT_NAME,
        memoryKey: key,
        memoryType: 'HOT',
      },
      data: {
        memoryValue: JSON.stringify(value),
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 存储Cold Memory（永久保留）
   */
  async storeColdMemory(
    key: string,
    value: unknown,
    userId: string
  ): Promise<void> {
    await this.storeMemory(
      {
        memoryType: 'COLD',
        memoryKey: key,
        memoryValue: value,
        importance: 1.0, // 冷记忆重要性较高
      },
      userId
    );
  }

  /**
   * 获取Cold Memory
   */
  async getColdMemory(key: string): Promise<unknown> {
    const input: GetMemoryInput = {
      memoryType: 'COLD',
      memoryKey: key,
    };

    const result = await this.getMemory(input);
    return result?.memoryValue;
  }

  /**
   * 获取记忆（通用）
   */
  async getMemory(input: GetMemoryInput): Promise<Memory | null> {
    const { memoryType, memoryKey } = input;

    const record = await this.prisma.agentMemory.findFirst({
      where: {
        agentName: AGENT_NAME,
        memoryKey,
        memoryType,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!record) {
      return null;
    }

    // 追踪访问
    await trackAccess(this.prisma, record);

    return toMemoryEntity(record);
  }

  /**
   * 获取所有记忆（按类型）
   */
  async getMemoriesByType(memoryType: MemoryType): Promise<Memory[]> {
    const records = await this.prisma.agentMemory.findMany({
      where: {
        agentName: AGENT_NAME,
        memoryType,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { lastAccessedAt: 'desc' },
    });

    return records.map(record => toMemoryEntity(record));
  }

  /**
   * 清理过期记忆
   */
  async cleanExpired(): Promise<number> {
    const result = await this.prisma.agentMemory.deleteMany({
      where: {
        agentName: AGENT_NAME,
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  }

  /**
   * 通过ID获取记忆
   */
  async getMemoryById(memoryId: string): Promise<Memory | null> {
    const record = await this.prisma.agentMemory.findFirst({
      where: {
        id: memoryId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!record) {
      return null;
    }

    return toMemoryEntity(record);
  }

  /**
   * 通过ID获取记忆（包含元数据）
   */
  async getMemoryWithMetadata(
    memoryId: string
  ): Promise<MemoryWithMetadata | null> {
    const record = await this.prisma.agentMemory.findFirst({
      where: {
        id: memoryId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!record) {
      return null;
    }

    const memory = toMemoryEntity(record);

    return {
      ...memory,
      userId: record.userId,
      caseId: record.caseId,
      debateId: record.debateId,
    };
  }

  /**
   * 获取记忆统计信息
   */
  async getStats(): Promise<MemoryStats> {
    const [
      workingCount,
      hotCount,
      coldCount,
      totalCount,
      avgImportance,
      compressedCount,
    ] = await Promise.all([
      this.prisma.agentMemory.count({
        where: { memoryType: 'WORKING' },
      }),
      this.prisma.agentMemory.count({
        where: { memoryType: 'HOT' },
      }),
      this.prisma.agentMemory.count({
        where: { memoryType: 'COLD' },
      }),
      this.prisma.agentMemory.count(),
      this.prisma.agentMemory.aggregate({
        _avg: { importance: true },
      }),
      this.prisma.agentMemory.count({
        where: { compressed: true },
      }),
    ]);

    // 统计过期记忆数
    const expiredCount = await this.prisma.agentMemory.count({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    return {
      workingMemoryCount: workingCount,
      hotMemoryCount: hotCount,
      coldMemoryCount: coldCount,
      totalMemoryCount: totalCount,
      averageImportance: avgImportance._avg.importance || 0,
      expiredMemoryCount: expiredCount,
      compressedMemoryCount: compressedCount,
    };
  }

  /**
   * 更新记忆压缩状态
   */
  async markAsCompressed(
    memoryId: string,
    compressionRatio: number
  ): Promise<void> {
    await this.prisma.agentMemory.update({
      where: { id: memoryId },
      data: {
        compressed: true,
        compressionRatio,
        updatedAt: new Date(),
      },
    });
  }
}
