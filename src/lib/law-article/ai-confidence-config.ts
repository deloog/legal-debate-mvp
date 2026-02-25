/**
 * AI置信度阈值配置管理
 *
 * 功能：
 * 1. 管理不同关系类型的置信度阈值
 * 2. 提供阈值验证接口
 * 3. 支持动态调整阈值
 */

import { RelationType } from '@prisma/client';

/**
 * 置信度阈值配置
 */
export interface ConfidenceThresholdConfig {
  relationType: RelationType;
  minimumThreshold: number; // 最小阈值
  recommendedThreshold: number; // 推荐阈值
  requiresHumanReview: boolean; // 是否需要人工审核
  autoAccept: boolean; // 是否自动接受
}

/**
 * 阈值验证结果
 */
export interface ThresholdValidationResult {
  isValid: boolean;
  confidence: number;
  threshold: number;
  action: 'ACCEPT' | 'REVIEW' | 'REJECT';
  reason: string;
}

/**
 * 默认置信度阈值配置
 */
const DEFAULT_THRESHOLDS: Record<RelationType, ConfidenceThresholdConfig> = {
  // 引用关系：置信度要求较高
  CITES: {
    relationType: RelationType.CITES,
    minimumThreshold: 0.6,
    recommendedThreshold: 0.75,
    requiresHumanReview: true,
    autoAccept: false,
  },
  CITED_BY: {
    relationType: RelationType.CITED_BY,
    minimumThreshold: 0.6,
    recommendedThreshold: 0.75,
    requiresHumanReview: true,
    autoAccept: false,
  },

  // 冲突关系：置信度要求最高
  CONFLICTS: {
    relationType: RelationType.CONFLICTS,
    minimumThreshold: 0.75,
    recommendedThreshold: 0.85,
    requiresHumanReview: true,
    autoAccept: false,
  },

  // 补全关系：置信度要求中等
  COMPLETES: {
    relationType: RelationType.COMPLETES,
    minimumThreshold: 0.5,
    recommendedThreshold: 0.65,
    requiresHumanReview: true,
    autoAccept: false,
  },
  COMPLETED_BY: {
    relationType: RelationType.COMPLETED_BY,
    minimumThreshold: 0.5,
    recommendedThreshold: 0.65,
    requiresHumanReview: true,
    autoAccept: false,
  },

  // 替代关系：置信度要求较高
  SUPERSEDES: {
    relationType: RelationType.SUPERSEDES,
    minimumThreshold: 0.7,
    recommendedThreshold: 0.8,
    requiresHumanReview: true,
    autoAccept: false,
  },
  SUPERSEDED_BY: {
    relationType: RelationType.SUPERSEDED_BY,
    minimumThreshold: 0.7,
    recommendedThreshold: 0.8,
    requiresHumanReview: true,
    autoAccept: false,
  },

  // 实施关系：置信度要求中等
  IMPLEMENTS: {
    relationType: RelationType.IMPLEMENTS,
    minimumThreshold: 0.5,
    recommendedThreshold: 0.65,
    requiresHumanReview: true,
    autoAccept: false,
  },
  IMPLEMENTED_BY: {
    relationType: RelationType.IMPLEMENTED_BY,
    minimumThreshold: 0.5,
    recommendedThreshold: 0.65,
    requiresHumanReview: true,
    autoAccept: false,
  },

  // 一般关联：置信度要求较低
  RELATED: {
    relationType: RelationType.RELATED,
    minimumThreshold: 0.4,
    recommendedThreshold: 0.55,
    requiresHumanReview: false,
    autoAccept: true,
  },
};

/**
 * AI置信度阈值配置管理器
 */
export class AIConfidenceConfig {
  private static customThresholds: Map<string, ConfidenceThresholdConfig> =
    new Map();

  /**
   * 获取关系类型的阈值配置
   *
   * @param relationType 关系类型
   * @param aiProvider AI服务提供商（可选，用于特定提供商配置）
   * @param aiModel AI模型（可选，用于特定模型配置）
   * @returns 阈值配置
   */
  static getThreshold(
    relationType: RelationType,
    aiProvider?: string,
    aiModel?: string
  ): ConfidenceThresholdConfig {
    // 检查是否有特定提供商和模型的配置
    const customKey = this.buildCustomKey(relationType, aiProvider, aiModel);
    if (this.customThresholds.has(customKey)) {
      return this.customThresholds.get(customKey)!;
    }

    // 检查是否有特定提供商的配置
    const providerKey = this.buildCustomKey(relationType, aiProvider);
    if (this.customThresholds.has(providerKey)) {
      return this.customThresholds.get(providerKey)!;
    }

    // 返回默认配置
    return DEFAULT_THRESHOLDS[relationType];
  }

  /**
   * 验证置信度是否符合阈值
   *
   * @param confidence AI置信度
   * @param relationType 关系类型
   * @param options 可选参数
   * @returns 验证结果
   */
  static validateThreshold(
    confidence: number,
    relationType: RelationType,
    options?: {
      aiProvider?: string;
      aiModel?: string;
      customThreshold?: number;
    }
  ): ThresholdValidationResult {
    // 验证置信度范围
    if (confidence < 0 || confidence > 1) {
      return {
        isValid: false,
        confidence,
        threshold: 0,
        action: 'REJECT',
        reason: '置信度必须在0-1之间',
      };
    }

    const config = this.getThreshold(
      relationType,
      options?.aiProvider,
      options?.aiModel
    );
    const threshold = options?.customThreshold ?? config.recommendedThreshold;

    // 验证结果
    if (confidence >= threshold) {
      return {
        isValid: true,
        confidence,
        threshold,
        action: config.autoAccept ? 'ACCEPT' : 'REVIEW',
        reason: `置信度${(confidence * 100).toFixed(1)}%达到阈值${(threshold * 100).toFixed(1)}%`,
      };
    } else if (confidence >= config.minimumThreshold) {
      return {
        isValid: false,
        confidence,
        threshold,
        action: 'REVIEW',
        reason: `置信度${(confidence * 100).toFixed(1)}%低于推荐阈值，但高于最小阈值`,
      };
    } else {
      return {
        isValid: false,
        confidence,
        threshold,
        action: 'REJECT',
        reason: `置信度${(confidence * 100).toFixed(1)}%低于最小阈值${(config.minimumThreshold * 100).toFixed(1)}%`,
      };
    }
  }

  /**
   * 更新自定义阈值配置
   *
   * @param config 阈值配置
   * @param options 可选参数
   */
  static setThreshold(
    config: ConfidenceThresholdConfig,
    options?: {
      aiProvider?: string;
      aiModel?: string;
    }
  ): void {
    const key = this.buildCustomKey(
      config.relationType,
      options?.aiProvider,
      options?.aiModel
    );
    this.customThresholds.set(key, config);
  }

  /**
   * 批量更新阈值配置
   *
   * @param configs 阈值配置数组
   * @param options 可选参数
   */
  static setThresholds(
    configs: ConfidenceThresholdConfig[],
    options?: {
      aiProvider?: string;
      aiModel?: string;
    }
  ): void {
    for (const config of configs) {
      this.setThreshold(config, options);
    }
  }

  /**
   * 重置为默认配置
   *
   * @param relationType 关系类型（可选，不提供则重置所有）
   * @param options 可选参数
   */
  static resetThreshold(
    relationType?: RelationType,
    options?: {
      aiProvider?: string;
      aiModel?: string;
    }
  ): void {
    if (relationType) {
      const key = this.buildCustomKey(
        relationType,
        options?.aiProvider,
        options?.aiModel
      );
      this.customThresholds.delete(key);
    } else {
      this.customThresholds.clear();
    }
  }

  /**
   * 获取所有阈值配置
   *
   * @returns 阈值配置映射
   */
  static getAllThresholds(): Map<RelationType, ConfidenceThresholdConfig> {
    const allThresholds = new Map<RelationType, ConfidenceThresholdConfig>();

    // 添加默认配置
    for (const [key, value] of Object.entries(DEFAULT_THRESHOLDS)) {
      allThresholds.set(key as RelationType, value);
    }

    // 覆盖自定义配置
    for (const [_key, value] of this.customThresholds) {
      allThresholds.set(value.relationType, value);
    }

    return allThresholds;
  }

  /**
   * 导出当前配置
   *
   * @returns 配置JSON
   */
  static exportConfig(): Record<string, ConfidenceThresholdConfig> {
    const config: Record<string, ConfidenceThresholdConfig> = {};

    for (const [key, value] of this.getAllThresholds()) {
      config[key] = value;
    }

    return config;
  }

  /**
   * 导入配置
   *
   * @param config 配置JSON
   */
  static importConfig(config: Record<string, ConfidenceThresholdConfig>): void {
    for (const [_key, value] of Object.entries(config)) {
      this.setThreshold(value);
    }
  }

  /**
   * 构建自定义配置键
   *
   * @param relationType 关系类型
   * @param aiProvider AI服务提供商
   * @param aiModel AI模型
   * @returns 配置键
   */
  private static buildCustomKey(
    relationType: RelationType,
    aiProvider?: string,
    aiModel?: string
  ): string {
    const parts: string[] = [relationType];
    if (aiProvider) {
      parts.push(aiProvider);
    }
    if (aiModel) {
      parts.push(aiModel);
    }
    return parts.join(':');
  }

  /**
   * 基于反馈数据推荐阈值
   *
   * @param relationType 关系类型
   * @param stats 反馈统计数据
   * @returns 推荐的阈值
   */
  static recommendThreshold(
    relationType: RelationType,
    stats: {
      avgAccuracy: number;
      avgConfidenceRating: number;
      totalFeedbacks: number;
    }
  ): number {
    const baseConfig = DEFAULT_THRESHOLDS[relationType];
    const { avgAccuracy, avgConfidenceRating, totalFeedbacks } = stats;

    // 如果没有足够的反馈数据，返回默认阈值
    if (totalFeedbacks < 10) {
      return baseConfig.recommendedThreshold;
    }

    let recommendedThreshold = baseConfig.recommendedThreshold;

    // 根据准确率调整阈值
    if (avgAccuracy < 0.5) {
      // 准确率低，提高阈值
      recommendedThreshold = Math.min(recommendedThreshold + 0.15, 0.95);
    } else if (avgAccuracy < 0.7) {
      // 准确率一般，略微提高阈值
      recommendedThreshold = Math.min(recommendedThreshold + 0.05, 0.9);
    } else if (avgAccuracy > 0.85) {
      // 准确率高，可以降低阈值
      recommendedThreshold = Math.max(recommendedThreshold - 0.05, 0.4);
    }

    // 根据置信度评分调整
    if (avgConfidenceRating < 3) {
      // 用户对置信度不满意，提高阈值
      recommendedThreshold = Math.min(recommendedThreshold + 0.1, 0.9);
    } else if (avgConfidenceRating > 4) {
      // 用户对置信度满意，可以降低阈值
      recommendedThreshold = Math.max(recommendedThreshold - 0.05, 0.4);
    }

    // 确保不低于最小阈值
    recommendedThreshold = Math.max(
      recommendedThreshold,
      baseConfig.minimumThreshold
    );

    return recommendedThreshold;
  }
}
