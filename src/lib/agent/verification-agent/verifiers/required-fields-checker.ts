/**
 * 必填字段完整性检查器
 * 检查必填字段是否完整、类型正确、长度符合要求
 */
import { RequiredFieldsCheck } from '../types';

/**
 * 必填字段配置
 */
interface RequiredFieldConfig {
  field: string;
  type?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
}

/**
 * 待验证数据接口
 */
interface DataToVerify {
  [key: string]: unknown;
}

/**
 * 默认必填字段配置
 */
const DEFAULT_REQUIRED_FIELDS: RequiredFieldConfig[] = [
  { field: 'title', minLength: 5, maxLength: 200 },
  { field: 'description', minLength: 10 },
  { field: 'type', pattern: /^[A-Z_]+$/ },
];

/**
 * 必填字段检查器类
 */
export class RequiredFieldsChecker {
  private requiredFields: RequiredFieldConfig[];

  constructor(requiredFields?: RequiredFieldConfig[]) {
    this.requiredFields = requiredFields || DEFAULT_REQUIRED_FIELDS;
  }

  /**
   * 检查必填字段完整性
   */
  async check(data: DataToVerify): Promise<RequiredFieldsCheck> {
    const missingFields: string[] = [];
    let filledFields = 0;

    for (const fieldConfig of this.requiredFields) {
      const value = data[fieldConfig.field];

      // 检查字段是否存在
      if (value === undefined || value === null || value === '') {
        missingFields.push(fieldConfig.field);
        continue;
      }

      // 类型检查
      if (fieldConfig.type && typeof value !== fieldConfig.type) {
        missingFields.push(`${fieldConfig.field}(类型错误)`);
        continue;
      }

      // 最小长度检查
      if (
        fieldConfig.minLength &&
        String(value).length < fieldConfig.minLength
      ) {
        missingFields.push(`${fieldConfig.field}(长度不足)`);
        continue;
      }

      // 最大长度检查
      if (
        fieldConfig.maxLength &&
        String(value).length > fieldConfig.maxLength
      ) {
        missingFields.push(`${fieldConfig.field}(长度超出)`);
        continue;
      }

      // 模式匹配检查
      if (fieldConfig.pattern && !fieldConfig.pattern.test(String(value))) {
        missingFields.push(`${fieldConfig.field}(格式不匹配)`);
        continue;
      }

      filledFields++;
    }

    const totalFields = this.requiredFields.length;
    const score = totalFields > 0 ? filledFields / totalFields : 1;

    return {
      totalFields,
      filledFields,
      missingFields,
      score,
      passed: missingFields.length === 0,
    };
  }

  /**
   * 创建空的必填字段结果
   */
  async getEmptyResult(): Promise<RequiredFieldsCheck> {
    return {
      totalFields: 0,
      filledFields: 0,
      missingFields: [],
      score: 1,
      passed: true,
    };
  }
}
