/**
 * AI成本监控器
 *
 * 功能：
 * 1. 跟踪每日API调用次数
 * 2. 跟踪每日成本
 * 3. 检查是否超过限制
 * 4. 提供统计信息
 */

import { logger } from '@/lib/logger';
import { AI_DETECTOR_CONFIG } from './ai-detector-config';

/**
 * 成本统计信息
 */
export interface CostStats {
  dailyRequestCount: number;
  dailyCost: number;
  remainingRequests: number;
  remainingBudget: number;
  lastReset: number;
}

/**
 * AI成本监控器
 */
export class AICostMonitor {
  private static dailyRequestCount = 0;
  private static dailyCost = 0;
  private static lastReset = Date.now();

  /**
   * 跟踪API调用并检查限制
   *
   * @param cost 本次调用的成本（美元）
   * @returns 是否允许调用
   */
  static async trackCall(cost: number): Promise<boolean> {
    // 每日重置
    if (Date.now() - this.lastReset > 24 * 60 * 60 * 1000) {
      this.reset();
    }

    // 检查请求次数限制
    if (this.dailyRequestCount >= AI_DETECTOR_CONFIG.maxDailyRequests) {
      logger.warn('达到每日API调用限制', {
        currentCount: this.dailyRequestCount,
        maxCount: AI_DETECTOR_CONFIG.maxDailyRequests,
      });
      return false;
    }

    // 检查成本限制
    if (this.dailyCost + cost > AI_DETECTOR_CONFIG.maxCostPerDay) {
      logger.warn('达到每日成本预算', {
        currentCost: this.dailyCost,
        estimatedCost: this.dailyCost + cost,
        maxCost: AI_DETECTOR_CONFIG.maxCostPerDay,
      });
      return false;
    }

    // 更新计数
    this.dailyRequestCount++;
    this.dailyCost += cost;

    return true;
  }

  /**
   * 获取统计信息
   *
   * @returns 成本统计信息
   */
  static getStats(): CostStats {
    return {
      dailyRequestCount: this.dailyRequestCount,
      dailyCost: this.dailyCost,
      remainingRequests:
        AI_DETECTOR_CONFIG.maxDailyRequests - this.dailyRequestCount,
      remainingBudget: AI_DETECTOR_CONFIG.maxCostPerDay - this.dailyCost,
      lastReset: this.lastReset,
    };
  }

  /**
   * 重置计数器
   */
  static reset(): void {
    this.dailyRequestCount = 0;
    this.dailyCost = 0;
    this.lastReset = Date.now();
  }

  /**
   * 手动添加成本（用于测试或手动调整）
   *
   * @param cost 成本（美元）
   */
  static addCost(cost: number): void {
    this.dailyCost += cost;
  }

  /**
   * 手动添加请求计数（用于测试或手动调整）
   *
   * @param count 请求次数
   */
  static addRequestCount(count: number): void {
    this.dailyRequestCount += count;
  }

  /**
   * 检查是否可以进行调用（不更新计数）
   *
   * @param cost 预计成本（美元）
   * @returns 是否可以调用
   */
  static canMakeCall(cost: number): boolean {
    // 检查是否需要重置
    if (Date.now() - this.lastReset > 24 * 60 * 60 * 1000) {
      return true; // 新的一天，可以调用
    }

    // 检查限制
    if (this.dailyRequestCount >= AI_DETECTOR_CONFIG.maxDailyRequests) {
      return false;
    }

    if (this.dailyCost + cost > AI_DETECTOR_CONFIG.maxCostPerDay) {
      return false;
    }

    return true;
  }
}
