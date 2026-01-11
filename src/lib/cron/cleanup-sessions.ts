/**
 * 会话清理模块
 * 定时清理过期的会话记录
 */

import { prisma } from "@/lib/db/prisma";
import type { SessionCleanupConfig } from "@/types/auth";

const DEFAULT_CONFIG: SessionCleanupConfig = {
  inactiveDays: 30, // 清理30天未活动的会话
  batchLimit: 100, // 每次最多处理100条记录
};

/**
 * 清理过期会话
 * 删除所有已过期的会话记录
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await prisma.session.deleteMany({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });

    return result.count;
  } catch (error) {
    console.error("Cleanup expired sessions error:", error);
    throw new Error("清理过期会话失败");
  }
}

/**
 * 清理未活动会话
 * 删除指定天数内未活动的会话
 */
export async function cleanupInactiveSessions(
  config: SessionCleanupConfig = DEFAULT_CONFIG,
): Promise<number> {
  try {
    const inactiveDate = new Date();
    inactiveDate.setDate(inactiveDate.getDate() - config.inactiveDays);

    // 注意：当前Session模型没有lastActive字段，这里仅作为预留
    // 如果需要实现此功能，需要扩展Session模型
    // 这里仅返回0作为占位
    return 0;
  } catch (error) {
    console.error("Cleanup inactive sessions error:", error);
    throw new Error("清理未活动会话失败");
  }
}

/**
 * 清理用户的所有会话
 * 当用户账户被禁用时调用
 */
export async function cleanupUserSessions(userId: string): Promise<number> {
  try {
    const result = await prisma.session.deleteMany({
      where: { userId },
    });

    return result.count;
  } catch (error) {
    console.error("Cleanup user sessions error:", error);
    throw new Error("清理用户会话失败");
  }
}

/**
 * 获取过期会话数量统计
 */
export async function getExpiredSessionsCount(): Promise<number> {
  try {
    const count = await prisma.session.count({
      where: {
        expires: {
          lt: new Date(),
        },
      },
    });

    return count;
  } catch (error) {
    console.error("Get expired sessions count error:", error);
    return 0;
  }
}

/**
 * 获取活跃会话数量统计
 */
export async function getActiveSessionsCount(): Promise<number> {
  try {
    const count = await prisma.session.count({
      where: {
        expires: {
          gt: new Date(),
        },
      },
    });

    return count;
  } catch (error) {
    console.error("Get active sessions count error:", error);
    return 0;
  }
}

/**
 * 执行完整的会话清理流程
 * 清理所有过期会话并返回统计信息
 */
export async function executeSessionCleanup(): Promise<{
  expiredCount: number;
  remainingExpiredCount: number;
  activeCount: number;
}> {
  try {
    // 清理过期会话
    const expiredCount = await cleanupExpiredSessions();

    // 获取统计信息
    const remainingExpiredCount = await getExpiredSessionsCount();
    const activeCount = await getActiveSessionsCount();

    return {
      expiredCount,
      remainingExpiredCount,
      activeCount,
    };
  } catch (error) {
    console.error("Execute session cleanup error:", error);
    throw new Error("执行会话清理失败");
  }
}
