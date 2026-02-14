/**
 * 法律法规数据验证器
 * 确保采集数据的质量和一致性
 */

import { LawCategory, LawType } from '@prisma/client';
import { CrawledLawArticle } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  quality: DataQuality;
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface DataQuality {
  completeness: number; // 0-1
  accuracy: number; // 0-1
  consistency: number; // 0-1
  timeliness: number; // 0-1
}

export class LawDataValidator {
  private readonly requiredFields = [
    'lawName',
    'articleNumber',
    'fullText',
    'lawType',
    'category',
    'effectiveDate',
  ];

  private readonly recommendedFields = [
    'issuingAuthority',
    'jurisdiction',
    'keywords',
    'tags',
  ];

  /**
   * 验证法条数据
   */
  validate(data: CrawledLawArticle): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 验证必填字段
    for (const field of this.requiredFields) {
      const value = data[field as keyof CrawledLawArticle];

      if (!value) {
        errors.push({
          field,
          message: `缺少必填字段: ${field}`,
          severity: 'critical',
        });
      } else if (typeof value === 'string' && !value.trim()) {
        errors.push({
          field,
          message: `字段不能为空: ${field}`,
          severity: 'critical',
        });
      }
    }

    // 验证字段格式
    if (
      data.effectiveDate instanceof Date &&
      isNaN(data.effectiveDate.getTime())
    ) {
      errors.push({
        field: 'effectiveDate',
        message: '无效的日期格式',
        severity: 'critical',
      });
    }

    // 验证枚举值
    if (data.lawType && !this.isValidLawType(data.lawType)) {
      errors.push({
        field: 'lawType',
        message: `无效的法律类型: ${data.lawType}`,
        severity: 'major',
      });
    }

    if (data.category && !this.isValidCategory(data.category)) {
      errors.push({
        field: 'category',
        message: `无效的法律类别: ${data.category}`,
        severity: 'major',
      });
    }

    // 验证文本长度
    if (data.fullText && data.fullText.length < 10) {
      warnings.push({
        field: 'fullText',
        message: '法条内容过短，可能不完整',
        suggestion: '请检查是否正确获取了法条全文',
      });
    }

    // 验证编号格式
    if (data.articleNumber && !this.isValidArticleNumber(data.articleNumber)) {
      warnings.push({
        field: 'articleNumber',
        message: '法条编号格式可能不正确',
        suggestion: '建议使用标准格式，如"第X条"或"第X款"',
      });
    }

    // 计算数据质量
    const quality = this.calculateQuality(data, errors, warnings);

    return {
      isValid: errors.filter(e => e.severity === 'critical').length === 0,
      errors,
      warnings,
      quality,
    };
  }

  /**
   * 验证法律类型
   */
  private isValidLawType(type: LawType): boolean {
    const validTypes = Object.values(LawType);
    return validTypes.includes(type);
  }

  /**
   * 验证法律类别
   */
  private isValidCategory(category: LawCategory): boolean {
    const validCategories = Object.values(LawCategory);
    return validCategories.includes(category);
  }

  /**
   * 验证法条编号格式
   */
  private isValidArticleNumber(number: string): boolean {
    // 常见格式: 第X条, 第X款, 第X项, X-Y
    const patterns = [
      /^第[一二三四五六七八九十百千0-9]+条$/,
      /^第[一二三四五六七八九十百千0-9]+款$/,
      /^第[一二三四五六七八九十百千0-9]+项$/,
      /^[0-9]+-[0-9]+$/,
      /^[0-9]+$/,
    ];

    return patterns.some(pattern => pattern.test(number));
  }

  /**
   * 计算数据质量分数
   */
  private calculateQuality(
    data: CrawledLawArticle,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): DataQuality {
    // 完整性：基于必填和推荐字段的填充情况
    const totalFields =
      this.requiredFields.length + this.recommendedFields.length;
    const filledFields =
      this.requiredFields.filter(f => data[f as keyof CrawledLawArticle])
        .length +
      this.recommendedFields.filter(f => data[f as keyof CrawledLawArticle])
        .length;
    const completeness = filledFields / totalFields;

    // 准确性：基于严重错误的数量
    const criticalErrors = errors.filter(e => e.severity === 'critical').length;
    const majorErrors = errors.filter(e => e.severity === 'major').length;
    const accuracy = Math.max(
      0,
      1 - (criticalErrors * 0.2 + majorErrors * 0.05)
    );

    // 一致性：基于警告数量
    const consistency = Math.max(0, 1 - warnings.length * 0.05);

    // 时效性：基于发布日期
    let timeliness = 1;
    if (data.effectiveDate) {
      const daysSinceEffective =
        (Date.now() - data.effectiveDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEffective > 365) {
        timeliness = 0.7;
      } else if (daysSinceEffective > 180) {
        timeliness = 0.85;
      } else if (daysSinceEffective > 30) {
        timeliness = 0.95;
      }
    }

    return {
      completeness: Math.round(completeness * 100) / 100,
      accuracy: Math.round(accuracy * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      timeliness: Math.round(timeliness * 100) / 100,
    };
  }

  /**
   * 批量验证
   */
  validateMany(datas: CrawledLawArticle[]): ValidationResult[] {
    return datas.map(data => this.validate(data));
  }

  /**
   * 获取验证统计
   */
  getValidationStats(results: ValidationResult[]): {
    total: number;
    valid: number;
    invalid: number;
    averageQuality: DataQuality;
    commonErrors: Record<string, number>;
  } {
    const valid = results.filter(r => r.isValid).length;
    const invalid = results.length - valid;

    const averageQuality: DataQuality = {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      timeliness: 0,
    };

    const commonErrors: Record<string, number> = {};

    for (const result of results) {
      averageQuality.completeness += result.quality.completeness;
      averageQuality.accuracy += result.quality.accuracy;
      averageQuality.consistency += result.quality.consistency;
      averageQuality.timeliness += result.quality.timeliness;

      for (const error of result.errors) {
        const key = `${error.field}: ${error.message}`;
        commonErrors[key] = (commonErrors[key] || 0) + 1;
      }
    }

    if (results.length > 0) {
      averageQuality.completeness /= results.length;
      averageQuality.accuracy /= results.length;
      averageQuality.consistency /= results.length;
      averageQuality.timeliness /= results.length;
    }

    return {
      total: results.length,
      valid,
      invalid,
      averageQuality: {
        completeness: Math.round(averageQuality.completeness * 100) / 100,
        accuracy: Math.round(averageQuality.accuracy * 100) / 100,
        consistency: Math.round(averageQuality.consistency * 100) / 100,
        timeliness: Math.round(averageQuality.timeliness * 100) / 100,
      },
      commonErrors,
    };
  }
}

export const lawDataValidator = new LawDataValidator();
