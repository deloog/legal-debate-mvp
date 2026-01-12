/**
 * 质量阈值检查器
 * 检查数据质量指标是否达到预定义的阈值
 */
import { QualityThresholdCheck } from '../types';

/**
 * 质量阈值配置
 */
interface QualityThresholdConfig {
  name: string;
  threshold: number;
  evaluator: (data: Record<string, unknown>) => number;
}

/**
 * 待验证数据接口
 */
interface DataToVerify {
  [key: string]: unknown;
}

/**
 * 默认质量阈值配置
 */
const DEFAULT_QUALITY_THRESHOLDS: QualityThresholdConfig[] = [
  {
    name: 'description_length',
    threshold: 50,
    evaluator: data => String(data.description || '').length,
  },
  {
    name: 'content_quality',
    threshold: 0.8,
    evaluator: data => QualityThresholdChecker.calculateContentQuality(data),
  },
];

/**
 * 质量阈值检查器类
 */
export class QualityThresholdChecker {
  private qualityThresholds: QualityThresholdConfig[];

  constructor(qualityThresholds?: QualityThresholdConfig[]) {
    this.qualityThresholds = qualityThresholds || DEFAULT_QUALITY_THRESHOLDS;
  }

  /**
   * 检查质量阈值
   */
  async check(data: DataToVerify): Promise<QualityThresholdCheck> {
    const thresholds: Record<
      string,
      { actual: number; threshold: number; passed: boolean }
    > = {};

    for (const qualityConfig of this.qualityThresholds) {
      try {
        const actual = qualityConfig.evaluator(data);
        const passed = actual >= qualityConfig.threshold;

        thresholds[qualityConfig.name] = {
          actual,
          threshold: qualityConfig.threshold,
          passed,
        };
      } catch {
        thresholds[qualityConfig.name] = {
          actual: 0,
          threshold: qualityConfig.threshold,
          passed: false,
        };
      }
    }

    const values = Object.values(thresholds);
    const score =
      values.length > 0
        ? values.filter(v => v.passed).length / values.length
        : 1;

    const passed = values.every(v => v.passed);

    return {
      score,
      thresholds,
      passed,
    };
  }

  /**
   * 创建空的质量阈值结果
   */
  async getEmptyResult(): Promise<QualityThresholdCheck> {
    return {
      score: 1,
      thresholds: {},
      passed: true,
    };
  }

  /**
   * 计算内容质量分数
   */
  public static calculateContentQuality(data: Record<string, unknown>): number {
    const content = String(data.description || data.content || '');

    if (content.length === 0) {
      return 0;
    }

    let quality = 0.5; // 基础分

    // 长度评分（越长越好，但有上限）
    if (content.length > 100) quality += 0.1;
    if (content.length > 500) quality += 0.1;
    if (content.length > 1000) quality += 0.1;

    // 结构评分（包含段落标记）
    if (content.includes('\n')) quality += 0.05;
    if (content.split('\n').length > 3) quality += 0.05;

    // 内容丰富度（数字、标点等）
    if (/[0-9]/.test(content)) quality += 0.05;
    if (/[，。！？；：]/.test(content)) quality += 0.05;

    return Math.min(1, quality);
  }
}
