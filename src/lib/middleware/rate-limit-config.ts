/**
 * 速率限制配置管理系统
 * 支持动态调整速率限制参数，无需重启服务
 */

import { logger } from '@/lib/logger';

/**
 * 速率限制配置
 */
export interface RateLimitConfigItem {
  endpoint: string; // API端点路径模式（支持通配符）
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  limitType: 'strict' | 'moderate' | 'lenient' | 'custom';
  enabled: boolean; // 是否启用
  message?: string; // 自定义错误消息
  updatedAt: Date; // 最后更新时间
}

/**
 * 全局速率限制设置
 */
export interface GlobalRateLimitSettings {
  enabled: boolean; // 全局开关
  defaultWindowMs: number;
  defaultMaxRequests: number;
  autoBlockEnabled: boolean; // 自动封禁功能
  autoBlockThreshold: number; // 自动封禁阈值
  autoBlockDuration: number; // 自动封禁时长（分钟）
}

/**
 * 速率限制配置管理器
 */
class RateLimitConfigManager {
  private configs: Map<string, RateLimitConfigItem> = new Map();
  private globalSettings: GlobalRateLimitSettings = {
    enabled: true,
    defaultWindowMs: 60 * 1000, // 1分钟
    defaultMaxRequests: 30,
    autoBlockEnabled: false,
    autoBlockThreshold: 10,
    autoBlockDuration: 60,
  };

  constructor() {
    // 初始化默认配置
    this.initializeDefaults();
  }

  /**
   * 初始化默认配置
   */
  private initializeDefaults(): void {
    // 认证相关端点 - 严格限制
    this.setConfig('/api/auth/login', {
      endpoint: '/api/auth/login',
      windowMs: 60 * 1000,
      maxRequests: 5,
      limitType: 'strict',
      enabled: true,
      message: '登录请求过于频繁，请稍后再试',
      updatedAt: new Date(),
    });

    this.setConfig('/api/auth/register', {
      endpoint: '/api/auth/register',
      windowMs: 60 * 1000,
      maxRequests: 5,
      limitType: 'strict',
      enabled: true,
      message: '注册请求过于频繁，请稍后再试',
      updatedAt: new Date(),
    });

    this.setConfig('/api/auth/forgot-password', {
      endpoint: '/api/auth/forgot-password',
      windowMs: 60 * 1000,
      maxRequests: 5,
      limitType: 'strict',
      enabled: true,
      message: '密码重置请求过于频繁，请稍后再试',
      updatedAt: new Date(),
    });

    // Token刷新 - 中等限制
    this.setConfig('/api/auth/refresh', {
      endpoint: '/api/auth/refresh',
      windowMs: 60 * 1000,
      maxRequests: 30,
      limitType: 'moderate',
      enabled: true,
      updatedAt: new Date(),
    });

    // 普通API - 中等限制
    this.setConfig('/api/v1/*', {
      endpoint: '/api/v1/*',
      windowMs: 60 * 1000,
      maxRequests: 30,
      limitType: 'moderate',
      enabled: true,
      updatedAt: new Date(),
    });

    // 管理员API - 宽松限制
    this.setConfig('/api/admin/*', {
      endpoint: '/api/admin/*',
      windowMs: 60 * 1000,
      maxRequests: 100,
      limitType: 'lenient',
      enabled: true,
      updatedAt: new Date(),
    });
  }

  /**
   * 设置配置
   */
  setConfig(endpoint: string, config: RateLimitConfigItem): void {
    this.configs.set(endpoint, {
      ...config,
      updatedAt: new Date(),
    });

    if (process.env.NODE_ENV === 'development') {
      logger.info('[RateLimitConfig] Updated config for:', endpoint);
    }
  }

  /**
   * 获取配置
   */
  getConfig(endpoint: string): RateLimitConfigItem | undefined {
    // 首先尝试精确匹配
    const exactMatch = this.configs.get(endpoint);
    if (exactMatch) {
      return exactMatch;
    }

    // 然后尝试通配符匹配
    for (const [pattern, config] of this.configs.entries()) {
      if (this.matchPattern(endpoint, pattern)) {
        return config;
      }
    }

    return undefined;
  }

  /**
   * 匹配通配符模式
   */
  private matchPattern(endpoint: string, pattern: string): boolean {
    // 简单的通配符匹配（* 匹配任意字符）
    const regexPattern = pattern.replace(/\*/g, '.*').replace(/\//g, '\\/');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(endpoint);
  }

  /**
   * 获取所有配置
   */
  getAllConfigs(): RateLimitConfigItem[] {
    return Array.from(this.configs.values());
  }

  /**
   * 删除配置
   */
  deleteConfig(endpoint: string): boolean {
    return this.configs.delete(endpoint);
  }

  /**
   * 启用/禁用端点的速率限制
   */
  toggleEndpoint(endpoint: string, enabled: boolean): boolean {
    const config = this.configs.get(endpoint);
    if (!config) {
      return false;
    }

    config.enabled = enabled;
    config.updatedAt = new Date();
    return true;
  }

  /**
   * 更新全局设置
   */
  updateGlobalSettings(settings: Partial<GlobalRateLimitSettings>): void {
    this.globalSettings = {
      ...this.globalSettings,
      ...settings,
    };

    if (process.env.NODE_ENV === 'development') {
      logger.info(
        '[RateLimitConfig] Global settings updated:',
        this.globalSettings
      );
    }
  }

  /**
   * 获取全局设置
   */
  getGlobalSettings(): GlobalRateLimitSettings {
    return { ...this.globalSettings };
  }

  /**
   * 检查是否启用速率限制
   */
  isEnabled(endpoint?: string): boolean {
    // 首先检查全局开关
    if (!this.globalSettings.enabled) {
      return false;
    }

    // 如果指定了端点，检查端点配置
    if (endpoint) {
      const config = this.getConfig(endpoint);
      return config?.enabled ?? false;
    }

    return true;
  }

  /**
   * 批量更新配置
   */
  batchUpdateConfigs(
    configs: Array<{ endpoint: string; config: Partial<RateLimitConfigItem> }>
  ): void {
    configs.forEach(({ endpoint, config }) => {
      const existing = this.configs.get(endpoint);
      if (existing) {
        this.setConfig(endpoint, {
          ...existing,
          ...config,
          updatedAt: new Date(),
        });
      }
    });
  }

  /**
   * 导出配置（用于备份）
   */
  exportConfig(): {
    globalSettings: GlobalRateLimitSettings;
    endpoints: RateLimitConfigItem[];
  } {
    return {
      globalSettings: this.globalSettings,
      endpoints: this.getAllConfigs(),
    };
  }

  /**
   * 导入配置（用于恢复）
   */
  importConfig(data: {
    globalSettings?: GlobalRateLimitSettings;
    endpoints?: RateLimitConfigItem[];
  }): void {
    if (data.globalSettings) {
      this.globalSettings = data.globalSettings;
    }

    if (data.endpoints) {
      this.configs.clear();
      data.endpoints.forEach(config => {
        this.setConfig(config.endpoint, config);
      });
    }

    if (process.env.NODE_ENV === 'development') {
      logger.info('[RateLimitConfig] Configuration imported');
    }
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.configs.clear();
    this.globalSettings = {
      enabled: true,
      defaultWindowMs: 60 * 1000,
      defaultMaxRequests: 30,
      autoBlockEnabled: false,
      autoBlockThreshold: 10,
      autoBlockDuration: 60,
    };
    this.initializeDefaults();

    if (process.env.NODE_ENV === 'development') {
      logger.info('[RateLimitConfig] Reset to defaults');
    }
  }

  /**
   * 根据负载动态调整限制（自适应）
   */
  adjustForLoad(loadPercentage: number): void {
    // loadPercentage: 0-100，表示当前服务器负载
    // 负载越高，限制越严格

    if (loadPercentage < 50) {
      // 低负载，放宽限制
      this.adjustAllLimits(1.2); // 增加20%的限制
    } else if (loadPercentage > 80) {
      // 高负载，收紧限制
      this.adjustAllLimits(0.7); // 减少30%的限制
    }
    // 50-80%之间不调整
  }

  /**
   * 调整所有端点的限制
   */
  private adjustAllLimits(multiplier: number): void {
    for (const [endpoint, config] of this.configs.entries()) {
      const newMaxRequests = Math.round(config.maxRequests * multiplier);
      this.setConfig(endpoint, {
        ...config,
        maxRequests: Math.max(1, newMaxRequests), // 至少保留1个请求
      });
    }

    if (process.env.NODE_ENV === 'development') {
      logger.info(`[RateLimitConfig] Adjusted all limits by ${multiplier}x`);
    }
  }

  /**
   * 获取端点统计
   */
  getEndpointStats(): {
    totalEndpoints: number;
    enabledEndpoints: number;
    disabledEndpoints: number;
    byLimitType: Record<string, number>;
  } {
    const configs = this.getAllConfigs();

    const stats = {
      totalEndpoints: configs.length,
      enabledEndpoints: configs.filter(c => c.enabled).length,
      disabledEndpoints: configs.filter(c => !c.enabled).length,
      byLimitType: {} as Record<string, number>,
    };

    configs.forEach(config => {
      stats.byLimitType[config.limitType] =
        (stats.byLimitType[config.limitType] || 0) + 1;
    });

    return stats;
  }
}

// 导出单例实例
export const rateLimitConfig = new RateLimitConfigManager();

/**
 * 使用示例：
 *
 * ```typescript
 * // 1. 获取端点配置
 * const config = rateLimitConfig.getConfig('/api/auth/login');
 * logger.info(config?.maxRequests); // 5
 *
 * // 2. 动态调整配置
 * rateLimitConfig.setConfig('/api/auth/login', {
 *   endpoint: '/api/auth/login',
 *   windowMs: 60 * 1000,
 *   maxRequests: 10, // 从5增加到10
 *   limitType: 'strict',
 *   enabled: true,
 *   updatedAt: new Date(),
 * });
 *
 * // 3. 临时禁用端点限制
 * rateLimitConfig.toggleEndpoint('/api/auth/register', false);
 *
 * // 4. 根据负载自动调整
 * const cpuUsage = 75; // 假设CPU使用率75%
 * rateLimitConfig.adjustForLoad(cpuUsage);
 *
 * // 5. 导出配置用于备份
 * const backup = rateLimitConfig.exportConfig();
 * localStorage.setItem('rateLimit', JSON.stringify(backup));
 *
 * // 6. 恢复配置
 * const backup = JSON.parse(localStorage.getItem('rateLimit'));
 * rateLimitConfig.importConfig(backup);
 * ```
 */
