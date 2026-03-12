/**
 * 导出频率限制器
 *
 * 防止频繁导出数据，保护服务器资源
 */

import { logger } from '@/lib/logger';

interface ExportRateLimitConfig {
  // 时间窗口（毫秒）
  windowMs: number;
  // 最大导出次数
  maxExports: number;
}

// 默认配置：每小时最多5次导出
const DEFAULT_CONFIG: ExportRateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1小时
  maxExports: 5,
};

// 内存存储（生产环境应使用 Redis）
const exportRateLimitStore = new Map<
  string,
  {
    count: number;
    firstExport: number;
    lastExport: number;
  }
>();

/**
 * 生成限流键
 */
function generateKey(userId: string, exportType: string): string {
  return `export:${userId}:${exportType}`;
}

/**
 * 检查导出频率限制
 * @param userId 用户ID
 * @param exportType 导出类型
 * @param config 配置选项
 * @returns 检查结果
 */
export function checkExportRateLimit(
  userId: string,
  exportType: string,
  config: Partial<ExportRateLimitConfig> = {}
): {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  message?: string;
} {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };
  const key = generateKey(userId, exportType);
  const now = Date.now();

  const entry = exportRateLimitStore.get(key);

  if (!entry) {
    // 首次导出
    exportRateLimitStore.set(key, {
      count: 1,
      firstExport: now,
      lastExport: now,
    });

    logger.info(`用户开始导出`, {
      userId: userId.substring(0, 8) + '...',
      exportType,
    });

    return {
      allowed: true,
      remaining: fullConfig.maxExports - 1,
      resetTime: now + fullConfig.windowMs,
    };
  }

  // 检查是否在时间窗口内
  const windowStart = now - fullConfig.windowMs;

  if (entry.firstExport < windowStart) {
    // 窗口已过期，重置计数
    entry.count = 1;
    entry.firstExport = now;
    entry.lastExport = now;

    return {
      allowed: true,
      remaining: fullConfig.maxExports - 1,
      resetTime: now + fullConfig.windowMs,
    };
  }

  // 检查是否超过最大导出次数
  if (entry.count >= fullConfig.maxExports) {
    const resetTime = entry.firstExport + fullConfig.windowMs;
    const waitMinutes = Math.ceil((resetTime - now) / (60 * 1000));

    logger.warn(`导出频率限制触发`, {
      userId: userId.substring(0, 8) + '...',
      exportType,
      count: entry.count,
    });

    return {
      allowed: false,
      remaining: 0,
      resetTime,
      message: `导出过于频繁，请${waitMinutes}分钟后再试`,
    };
  }

  // 允许导出，更新计数
  entry.count++;
  entry.lastExport = now;

  logger.info(`用户导出数据`, {
    userId: userId.substring(0, 8) + '...',
    exportType,
    count: entry.count,
  });

  return {
    allowed: true,
    remaining: fullConfig.maxExports - entry.count,
    resetTime: entry.firstExport + fullConfig.windowMs,
  };
}

/**
 * 记录导出完成
 * @param userId 用户ID
 * @param exportType 导出类型
 * @param recordCount 记录数
 * @param fileSize 文件大小
 */
export function logExportComplete(
  userId: string,
  exportType: string,
  recordCount: number,
  fileSize: number
): void {
  logger.info(`导出完成`, {
    userId: userId.substring(0, 8) + '...',
    exportType,
    recordCount,
    fileSize,
  });
}

/**
 * 重置用户的导出频率限制
 * @param userId 用户ID
 * @param exportType 导出类型（可选，不传则重置所有类型）
 */
export function resetExportRateLimit(
  userId: string,
  exportType?: string
): void {
  if (exportType) {
    const key = generateKey(userId, exportType);
    exportRateLimitStore.delete(key);
  } else {
    // 重置该用户的所有导出类型
    for (const key of exportRateLimitStore.keys()) {
      if (key.startsWith(`export:${userId}:`)) {
        exportRateLimitStore.delete(key);
      }
    }
  }
}

/**
 * 清理过期的限流记录
 */
export function cleanupExpiredExportLimits(): void {
  const now = Date.now();
  const defaultWindowMs = DEFAULT_CONFIG.windowMs;

  for (const [key, entry] of exportRateLimitStore.entries()) {
    if (entry.lastExport < now - defaultWindowMs) {
      exportRateLimitStore.delete(key);
    }
  }
}

/**
 * 获取导出频率限制状态
 */
export function getExportRateLimitStatus(
  userId: string,
  exportType: string
): {
  limited: boolean;
  count: number;
  remaining: number;
  resetTime: number;
} {
  const key = generateKey(userId, exportType);
  const entry = exportRateLimitStore.get(key);
  const now = Date.now();

  if (!entry) {
    return {
      limited: false,
      count: 0,
      remaining: DEFAULT_CONFIG.maxExports,
      resetTime: now + DEFAULT_CONFIG.windowMs,
    };
  }

  const windowStart = now - DEFAULT_CONFIG.windowMs;

  if (entry.firstExport < windowStart) {
    return {
      limited: false,
      count: 0,
      remaining: DEFAULT_CONFIG.maxExports,
      resetTime: now + DEFAULT_CONFIG.windowMs,
    };
  }

  return {
    limited: entry.count >= DEFAULT_CONFIG.maxExports,
    count: entry.count,
    remaining: Math.max(0, DEFAULT_CONFIG.maxExports - entry.count),
    resetTime: entry.firstExport + DEFAULT_CONFIG.windowMs,
  };
}
