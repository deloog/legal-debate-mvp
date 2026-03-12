/**
 * 告警风暴防护模块
 *
 * 防止告警风暴，保护运维人员不被大量告警淹没
 * 提供全局速率限制、告警聚合和抑制功能
 */

import { logger } from '@/lib/logger';

interface AlertStormConfig {
  // 全局告警速率限制
  maxAlertsPerMinute: number;
  maxAlertsPerHour: number;
  // 告警聚合窗口（毫秒）
  aggregationWindowMs: number;
  // 相似告警抑制时间（毫秒）
  suppressionWindowMs: number;
  // 告警 burst 限制
  burstLimit: number;
  burstWindowMs: number;
}

const DEFAULT_CONFIG: AlertStormConfig = {
  maxAlertsPerMinute: 10,
  maxAlertsPerHour: 100,
  aggregationWindowMs: 5 * 60 * 1000, // 5分钟
  suppressionWindowMs: 15 * 60 * 1000, // 15分钟
  burstLimit: 5,
  burstWindowMs: 60 * 1000, // 1分钟
};

interface AlertRecord {
  ruleId: string;
  severity: string;
  message: string;
  timestamp: number;
  count: number;
}

interface AlertStormState {
  // 最近告警记录
  recentAlerts: AlertRecord[];
  // 已抑制告警记录
  suppressedAlerts: Map<string, number>;
  // 告警计数（用于速率限制）
  minuteCount: number;
  hourCount: number;
  burstCount: number;
  // 计数重置时间
  minuteResetTime: number;
  hourResetTime: number;
  burstResetTime: number;
}

class AlertStormProtection {
  private config: AlertStormConfig;
  private state: AlertStormState;

  constructor(config: Partial<AlertStormConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      recentAlerts: [],
      suppressedAlerts: new Map(),
      minuteCount: 0,
      hourCount: 0,
      burstCount: 0,
      minuteResetTime: Date.now(),
      hourResetTime: Date.now(),
      burstResetTime: Date.now(),
    };
  }

  /**
   * 检查是否应该发送告警
   * @param ruleId 规则ID
   * @param severity 严重程度
   * @param message 告警消息
   * @returns 检查结果
   */
  shouldSendAlert(
    ruleId: string,
    severity: string,
    message: string
  ): {
    allowed: boolean;
    reason?: string;
    aggregated?: boolean;
    suppressed?: boolean;
    aggregatedCount?: number;
  } {
    const now = Date.now();

    // 清理过期记录
    this.cleanupExpiredRecords(now);

    // 更新计数器
    this.updateCounters(now);

    // 检查 burst 限制
    if (this.state.burstCount >= this.config.burstLimit) {
      logger.warn('告警 burst 限制触发', {
        ruleId,
        burstCount: this.state.burstCount,
        limit: this.config.burstLimit,
      });
      return {
        allowed: false,
        reason: `告警 burst 限制：${this.state.burstCount}/${this.config.burstLimit}`,
        suppressed: true,
      };
    }

    // 检查每分钟限制
    if (this.state.minuteCount >= this.config.maxAlertsPerMinute) {
      logger.warn('告警每分钟速率限制触发', {
        ruleId,
        minuteCount: this.state.minuteCount,
        limit: this.config.maxAlertsPerMinute,
      });
      return {
        allowed: false,
        reason: `告警速率限制：${this.state.minuteCount}/${this.config.maxAlertsPerMinute} 每分钟`,
        suppressed: true,
      };
    }

    // 检查每小时限制
    if (this.state.hourCount >= this.config.maxAlertsPerHour) {
      logger.warn('告警每小时速率限制触发', {
        ruleId,
        hourCount: this.state.hourCount,
        limit: this.config.maxAlertsPerHour,
      });
      return {
        allowed: false,
        reason: `告警速率限制：${this.state.hourCount}/${this.config.maxAlertsPerHour} 每小时`,
        suppressed: true,
      };
    }

    // 检查相似告警抑制
    const suppressionKey = this.getSuppressionKey(ruleId, severity, message);
    const lastSuppressedTime = this.state.suppressedAlerts.get(suppressionKey);
    if (
      lastSuppressedTime &&
      now - lastSuppressedTime < this.config.suppressionWindowMs
    ) {
      // 更新聚合计数
      this.updateAggregationCount(ruleId, severity, message, now);
      return {
        allowed: false,
        reason: '相似告警抑制中',
        suppressed: true,
      };
    }

    // 检查告警聚合
    const similarAlert = this.findSimilarAlert(ruleId, severity, message, now);
    if (similarAlert) {
      // 更新聚合计数
      similarAlert.count++;
      similarAlert.timestamp = now;
      return {
        allowed: true,
        aggregated: true,
        aggregatedCount: similarAlert.count,
      };
    }

    // 允许发送告警
    this.recordAlert(ruleId, severity, message, now);
    this.state.minuteCount++;
    this.state.hourCount++;
    this.state.burstCount++;

    return { allowed: true };
  }

  /**
   * 记录告警发送
   */
  recordSent(ruleId: string, severity: string, message: string): void {
    const now = Date.now();
    const suppressionKey = this.getSuppressionKey(ruleId, severity, message);
    this.state.suppressedAlerts.set(suppressionKey, now);
  }

  /**
   * 获取聚合的告警统计
   */
  getAggregatedStats(): {
    totalRecentAlerts: number;
    suppressedCount: number;
    aggregatedGroups: number;
    currentRate: {
      perMinute: number;
      perHour: number;
      burst: number;
    };
  } {
    const now = Date.now();
    this.cleanupExpiredRecords(now);

    return {
      totalRecentAlerts: this.state.recentAlerts.length,
      suppressedCount: this.state.suppressedAlerts.size,
      aggregatedGroups: this.state.recentAlerts.filter(a => a.count > 1).length,
      currentRate: {
        perMinute: this.state.minuteCount,
        perHour: this.state.hourCount,
        burst: this.state.burstCount,
      },
    };
  }

  /**
   * 重置所有限制（用于测试或紧急情况）
   */
  resetAll(): void {
    this.state = {
      recentAlerts: [],
      suppressedAlerts: new Map(),
      minuteCount: 0,
      hourCount: 0,
      burstCount: 0,
      minuteResetTime: Date.now(),
      hourResetTime: Date.now(),
      burstResetTime: Date.now(),
    };
    logger.info('告警风暴防护已重置');
  }

  /**
   * 更新计数器
   */
  private updateCounters(now: number): void {
    // 重置每分钟计数
    if (now - this.state.minuteResetTime >= 60000) {
      this.state.minuteCount = 0;
      this.state.minuteResetTime = now;
    }

    // 重置每小时计数
    if (now - this.state.hourResetTime >= 3600000) {
      this.state.hourCount = 0;
      this.state.hourResetTime = now;
    }

    // 重置 burst 计数
    if (now - this.state.burstResetTime >= this.config.burstWindowMs) {
      this.state.burstCount = 0;
      this.state.burstResetTime = now;
    }
  }

  /**
   * 清理过期记录
   */
  private cleanupExpiredRecords(now: number): void {
    // 清理近期告警记录
    this.state.recentAlerts = this.state.recentAlerts.filter(
      alert => now - alert.timestamp < this.config.aggregationWindowMs
    );

    // 清理抑制记录
    for (const [key, time] of this.state.suppressedAlerts.entries()) {
      if (now - time > this.config.suppressionWindowMs) {
        this.state.suppressedAlerts.delete(key);
      }
    }
  }

  /**
   * 记录告警
   */
  private recordAlert(
    ruleId: string,
    severity: string,
    message: string,
    timestamp: number
  ): void {
    this.state.recentAlerts.push({
      ruleId,
      severity,
      message,
      timestamp,
      count: 1,
    });
  }

  /**
   * 查找相似告警
   */
  private findSimilarAlert(
    ruleId: string,
    severity: string,
    message: string,
    now: number
  ): AlertRecord | undefined {
    return this.state.recentAlerts.find(
      alert =>
        alert.ruleId === ruleId &&
        alert.severity === severity &&
        this.isSimilarMessage(alert.message, message) &&
        now - alert.timestamp < this.config.aggregationWindowMs
    );
  }

  /**
   * 更新聚合计数
   */
  private updateAggregationCount(
    ruleId: string,
    severity: string,
    message: string,
    now: number
  ): void {
    const alert = this.findSimilarAlert(ruleId, severity, message, now);
    if (alert) {
      alert.count++;
      alert.timestamp = now;
    }
  }

  /**
   * 判断消息是否相似（简化版）
   */
  private isSimilarMessage(msg1: string, msg2: string): boolean {
    // 提取消息的关键部分（忽略动态值）
    const key1 = this.extractMessageKey(msg1);
    const key2 = this.extractMessageKey(msg2);
    return key1 === key2;
  }

  /**
   * 提取消息关键部分
   */
  private extractMessageKey(message: string): string {
    // 移除动态值（如数字、ID等）
    return message
      .replace(/\d+/g, 'N')
      .replace(/[a-f0-9]{8,}/gi, 'ID')
      .substring(0, 100);
  }

  /**
   * 获取抑制键
   */
  private getSuppressionKey(
    ruleId: string,
    severity: string,
    message: string
  ): string {
    const messageKey = this.extractMessageKey(message);
    return `${ruleId}:${severity}:${messageKey}`;
  }
}

// 导出单例实例
export const alertStormProtection = new AlertStormProtection();

// 导出类以便自定义配置
export { AlertStormProtection };
