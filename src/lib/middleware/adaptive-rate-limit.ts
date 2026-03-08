/**
 * 自适应速率限制
 * 根据服务器负载、用户信誉等因素动态调整速率限制
 */

import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';
import os from 'os';
import { rateLimitConfig } from './rate-limit-config';

/**
 * 用户信誉等级
 */
export enum UserReputationLevel {
  UNKNOWN = 'unknown', // 新用户
  TRUSTED = 'trusted', // 可信用户
  NORMAL = 'normal', // 普通用户
  SUSPICIOUS = 'suspicious', // 可疑用户
  MALICIOUS = 'malicious', // 恶意用户
}

/**
 * 用户信誉数据
 */
export interface UserReputation {
  identifier: string; // IP或用户ID
  level: UserReputationLevel;
  score: number; // 0-100，分数越高越可信
  violationCount: number; // 违规次数
  successfulRequests: number; // 成功请求数
  lastViolation?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 服务器负载信息
 */
export interface ServerLoad {
  cpuUsage: number; // CPU使用率 0-100
  memoryUsage: number; // 内存使用率 0-100
  requestsPerSecond: number; // 当前请求速率
  activeConnections: number; // 活跃连接数
  timestamp: Date;
}

/**
 * 自适应速率限制管理器
 */
class AdaptiveRateLimitManager {
  private reputations: Map<string, UserReputation> = new Map();
  private serverLoad: ServerLoad = {
    cpuUsage: 0,
    memoryUsage: 0,
    requestsPerSecond: 0,
    activeConnections: 0,
    timestamp: new Date(),
  };

  private requestCounter = 0;
  private lastResetTime = Date.now();

  constructor() {
    // 定期更新服务器负载
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.updateServerLoad();
      }, 5000); // 每5秒更新一次

      // 定期重置请求计数器
      setInterval(() => {
        this.requestCounter = 0;
        this.lastResetTime = Date.now();
      }, 1000); // 每秒重置

      // 定期清理过期的信誉数据
      setInterval(
        () => {
          this.cleanupOldReputations();
        },
        60 * 60 * 1000
      ); // 每小时清理一次
    }
  }

  /**
   * 更新服务器负载
   */
  private updateServerLoad(): void {
    try {
      // CPU使用率
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });

      const cpuUsage = 100 - Math.floor((100 * totalIdle) / totalTick);

      // 内存使用率
      const totalMemory = os.totalmem();
      const freeMemory = os.freemem();
      const memoryUsage = Math.floor(
        ((totalMemory - freeMemory) / totalMemory) * 100
      );

      // 请求速率
      const elapsedSeconds = (Date.now() - this.lastResetTime) / 1000;
      const requestsPerSecond = Math.floor(
        this.requestCounter / elapsedSeconds
      );

      this.serverLoad = {
        cpuUsage,
        memoryUsage,
        requestsPerSecond,
        activeConnections: this.requestCounter, // 简化实现
        timestamp: new Date(),
      };

      // 根据负载自动调整限制
      if (this.serverLoad.cpuUsage > 80 || this.serverLoad.memoryUsage > 85) {
        const loadLevel = Math.max(
          this.serverLoad.cpuUsage,
          this.serverLoad.memoryUsage
        );
        rateLimitConfig.adjustForLoad(loadLevel);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        logger.error('[AdaptiveRateLimit] Error updating server load:', error);
      }
    }
  }

  /**
   * 记录请求（用于计算请求速率）
   */
  recordRequest(): void {
    this.requestCounter++;
  }

  /**
   * 获取服务器负载
   */
  getServerLoad(): ServerLoad {
    return { ...this.serverLoad };
  }

  /**
   * 获取用户信誉
   */
  getReputation(identifier: string): UserReputation {
    let reputation = this.reputations.get(identifier);

    if (!reputation) {
      // 创建新的信誉记录
      reputation = {
        identifier,
        level: UserReputationLevel.UNKNOWN,
        score: 50, // 新用户从中等分数开始
        violationCount: 0,
        successfulRequests: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.reputations.set(identifier, reputation);
    }

    return reputation;
  }

  /**
   * 记录成功请求（提升信誉）
   */
  recordSuccess(identifier: string): void {
    const reputation = this.getReputation(identifier);
    reputation.successfulRequests++;
    reputation.updatedAt = new Date();

    // 提升分数（最多到100）
    reputation.score = Math.min(100, reputation.score + 0.1);

    // 更新等级
    this.updateReputationLevel(reputation);
  }

  /**
   * 记录违规（降低信誉）
   */
  recordViolation(identifier: string): void {
    const reputation = this.getReputation(identifier);
    reputation.violationCount++;
    reputation.lastViolation = new Date();
    reputation.updatedAt = new Date();

    // 降低分数（最少到0）
    reputation.score = Math.max(0, reputation.score - 5);

    // 更新等级
    this.updateReputationLevel(reputation);

    if (process.env.NODE_ENV !== 'test') {
      logger.warn('[AdaptiveRateLimit] Violation recorded:', {
        identifier: identifier.substring(0, 20) + '...',
        violationCount: reputation.violationCount,
        score: reputation.score,
        level: reputation.level,
      });
    }
  }

  /**
   * 更新信誉等级
   */
  private updateReputationLevel(reputation: UserReputation): void {
    const { score, violationCount } = reputation;

    if (violationCount >= 10) {
      reputation.level = UserReputationLevel.MALICIOUS;
    } else if (violationCount >= 5 || score < 20) {
      reputation.level = UserReputationLevel.SUSPICIOUS;
    } else if (score >= 80 && violationCount === 0) {
      reputation.level = UserReputationLevel.TRUSTED;
    } else if (score >= 40) {
      reputation.level = UserReputationLevel.NORMAL;
    } else {
      reputation.level = UserReputationLevel.UNKNOWN;
    }
  }

  /**
   * 计算用户的自适应速率限制
   */
  calculateAdaptiveLimit(
    identifier: string,
    baseLimit: number
  ): {
    maxRequests: number;
    multiplier: number;
    reason: string;
  } {
    const reputation = this.getReputation(identifier);
    const load = this.serverLoad;

    let multiplier = 1.0;
    const reasons: string[] = [];

    // 1. 根据用户信誉调整
    switch (reputation.level) {
      case UserReputationLevel.TRUSTED:
        multiplier *= 1.5; // 可信用户增加50%
        reasons.push('可信用户');
        break;
      case UserReputationLevel.SUSPICIOUS:
        multiplier *= 0.5; // 可疑用户减少50%
        reasons.push('可疑用户');
        break;
      case UserReputationLevel.MALICIOUS:
        multiplier *= 0.1; // 恶意用户减少90%
        reasons.push('恶意用户');
        break;
      case UserReputationLevel.NORMAL:
        multiplier *= 1.0; // 普通用户不变
        break;
      case UserReputationLevel.UNKNOWN:
        multiplier *= 0.8; // 新用户略微降低
        reasons.push('新用户');
        break;
    }

    // 2. 根据服务器负载调整
    if (load.cpuUsage > 80) {
      multiplier *= 0.7; // CPU高负载，减少30%
      reasons.push('CPU高负载');
    } else if (load.cpuUsage < 30) {
      multiplier *= 1.2; // CPU低负载，增加20%
      reasons.push('CPU低负载');
    }

    if (load.memoryUsage > 85) {
      multiplier *= 0.7; // 内存高负载，减少30%
      reasons.push('内存高负载');
    }

    // 3. 根据请求速率调整
    if (load.requestsPerSecond > 1000) {
      multiplier *= 0.8; // 高并发，收紧限制
      reasons.push('高并发');
    }

    // 计算最终限制
    const maxRequests = Math.max(1, Math.floor(baseLimit * multiplier));

    return {
      maxRequests,
      multiplier: Math.round(multiplier * 100) / 100,
      reason: reasons.join(', ') || '正常',
    };
  }

  /**
   * 清理旧的信誉数据（超过30天未更新）
   */
  private cleanupOldReputations(): void {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [identifier, reputation] of this.reputations.entries()) {
      if (reputation.updatedAt < thirtyDaysAgo) {
        this.reputations.delete(identifier);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0 && process.env.NODE_ENV === 'development') {
      logger.info(
        `[AdaptiveRateLimit] Cleaned up ${cleanedCount} old reputation records`
      );
    }
  }

  /**
   * 获取所有信誉数据
   */
  getAllReputations(): UserReputation[] {
    return Array.from(this.reputations.values());
  }

  /**
   * 重置用户信誉
   */
  resetReputation(identifier: string): void {
    this.reputations.delete(identifier);
  }

  /**
   * 手动设置用户信誉等级
   */
  setReputationLevel(identifier: string, level: UserReputationLevel): void {
    const reputation = this.getReputation(identifier);
    reputation.level = level;

    // 根据等级设置分数
    switch (level) {
      case UserReputationLevel.TRUSTED:
        reputation.score = 90;
        break;
      case UserReputationLevel.NORMAL:
        reputation.score = 50;
        break;
      case UserReputationLevel.SUSPICIOUS:
        reputation.score = 25;
        break;
      case UserReputationLevel.MALICIOUS:
        reputation.score = 0;
        break;
      default:
        reputation.score = 50;
    }

    reputation.updatedAt = new Date();
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const reputations = this.getAllReputations();

    const stats = {
      totalUsers: reputations.length,
      byLevel: {} as Record<UserReputationLevel, number>,
      averageScore: 0,
      serverLoad: this.serverLoad,
    };

    let totalScore = 0;
    for (const level of Object.values(UserReputationLevel)) {
      stats.byLevel[level] = 0;
    }

    reputations.forEach(rep => {
      stats.byLevel[rep.level]++;
      totalScore += rep.score;
    });

    stats.averageScore =
      reputations.length > 0 ? Math.round(totalScore / reputations.length) : 0;

    return stats;
  }
}

// 导出单例实例
export const adaptiveRateLimit = new AdaptiveRateLimitManager();

/**
 * 从请求中提取标识符
 */
export function getIdentifier(request: NextRequest): string {
  // 优先使用用户ID（如果已认证）
  // 这里简化处理，实际应从token或session中获取
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // 假设token格式: Bearer <token>
    // 实际使用时应该解析token获取用户ID
    return `user:${authHeader.substring(0, 20)}`;
  }

  // 未认证用户使用IP
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown';

  return `ip:${ip}`;
}

/**
 * 使用示例：
 *
 * ```typescript
 * import { adaptiveRateLimit, getIdentifier } from '@/lib/middleware/adaptive-rate-limit';
 *
 * // 1. 在中间件中使用自适应限制
 * const identifier = getIdentifier(request);
 * const baseLimit = 30; // 基础限制
 *
 * const { maxRequests, multiplier, reason } = adaptiveRateLimit.calculateAdaptiveLimit(
 *   identifier,
 *   baseLimit
 * );
 *
 * logger.info(`用户限制: ${maxRequests} (${multiplier}x, ${reason})`);
 *
 * // 2. 记录成功请求
 * adaptiveRateLimit.recordSuccess(identifier);
 *
 * // 3. 记录违规
 * adaptiveRateLimit.recordViolation(identifier);
 *
 * // 4. 查看服务器负载
 * const load = adaptiveRateLimit.getServerLoad();
 * logger.info('CPU使用率:', load.cpuUsage + '%');
 *
 * // 5. 查看用户信誉
 * const reputation = adaptiveRateLimit.getReputation(identifier);
 * logger.info('用户等级:', reputation.level);
 * logger.info('信誉分数:', reputation.score);
 * ```
 */
