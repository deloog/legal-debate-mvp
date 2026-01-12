/**
 * 格式验证器
 * 检查字段格式是否符合要求（如邮箱、手机号等）
 */
import { FormatCheck, FormatError } from '../types';

/**
 * 格式验证配置
 */
interface FormatValidatorConfig {
  field: string;
  format: string;
  validator: (value: unknown) => boolean;
  errorMessage: string;
}

/**
 * 待验证数据接口
 */
interface DataToVerify {
  [key: string]: unknown;
}

/**
 * 默认格式验证配置
 */
const DEFAULT_FORMAT_VALIDATORS: FormatValidatorConfig[] = [
  {
    field: 'email',
    format: 'email',
    validator: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)),
    errorMessage: '邮箱格式无效',
  },
  {
    field: 'phone',
    format: 'phone',
    validator: value => /^1[3-9]\d{9}$/.test(String(value)),
    errorMessage: '手机号格式无效',
  },
];

/**
 * 格式检查器类
 */
export class FormatChecker {
  private formatValidators: FormatValidatorConfig[];

  constructor(formatValidators?: FormatValidatorConfig[]) {
    this.formatValidators = formatValidators || DEFAULT_FORMAT_VALIDATORS;
  }

  /**
   * 检查输出格式正确性
   */
  async check(data: DataToVerify): Promise<FormatCheck> {
    const formatErrors: FormatError[] = [];
    const formatWarnings: FormatError[] = [];

    for (const validator of this.formatValidators) {
      const value = data[validator.field];

      if (value === undefined || value === null || value === '') {
        continue;
      }

      const isValid = validator.validator(value);

      if (!isValid) {
        formatErrors.push({
          field: validator.field,
          error: validator.errorMessage,
          expected: validator.format,
          actual: String(value),
        });
      }
    }

    const passed = formatErrors.length === 0;

    return {
      passed,
      formatErrors,
      formatWarnings,
    };
  }

  /**
   * 创建空的格式检查结果
   */
  async getEmptyResult(): Promise<FormatCheck> {
    return {
      passed: true,
      formatErrors: [],
      formatWarnings: [],
    };
  }
}
