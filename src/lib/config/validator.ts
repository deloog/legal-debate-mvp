/**
 * 配置验证规则模块
 * 提供配置值的验证功能
 */

import { ConfigType } from '@prisma/client';

/**
 * 验证规则接口
 */
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  custom?: (value: unknown) => string | null;
}

/**
 * 验证结果接口
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 验证配置值
 */
export function validateConfigValue(
  value: unknown,
  type: ConfigType,
  rules?: ValidationRule | null
): ValidationResult {
  // 基本类型验证
  const typeValidation = validateType(value, type);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  // 如果没有规则，直接返回有效
  if (!rules) {
    return { valid: true };
  }

  // 必填验证
  if (rules.required) {
    if (value === null || value === undefined || value === '') {
      return { valid: false, error: '此配置项为必填项' };
    }
  }

  // 根据类型进行特定验证
  switch (type) {
    case 'STRING':
      return validateString(value as string, rules);
    case 'NUMBER':
      return validateNumber(value as number, rules);
    case 'BOOLEAN':
      return { valid: true }; // 布尔值无需额外验证
    case 'ARRAY':
      return validateArray(value as unknown[], rules);
    case 'OBJECT':
      return validateObject(value as Record<string, unknown>, rules);
    default:
      return { valid: true };
  }
}

/**
 * 验证类型
 */
function validateType(value: unknown, type: ConfigType): ValidationResult {
  switch (type) {
    case 'STRING':
      if (typeof value !== 'string') {
        return { valid: false, error: '值必须是字符串' };
      }
      break;
    case 'NUMBER':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return { valid: false, error: '值必须是数字' };
      }
      break;
    case 'BOOLEAN':
      if (typeof value !== 'boolean') {
        return { valid: false, error: '值必须是布尔值' };
      }
      break;
    case 'ARRAY':
      if (!Array.isArray(value)) {
        return { valid: false, error: '值必须是数组' };
      }
      break;
    case 'OBJECT':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return { valid: false, error: '值必须是对象' };
      }
      break;
  }
  return { valid: true };
}

/**
 * 验证字符串
 */
function validateString(
  value: string,
  rules: ValidationRule
): ValidationResult {
  if (rules.minLength && value.length < rules.minLength) {
    return {
      valid: false,
      error: `长度不能少于${rules.minLength}个字符`,
    };
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    return {
      valid: false,
      error: `长度不能超过${rules.maxLength}个字符`,
    };
  }

  if (rules.pattern) {
    const regex = new RegExp(rules.pattern);
    if (!regex.test(value)) {
      return { valid: false, error: '格式不符合要求' };
    }
  }

  if (rules.enum && !rules.enum.includes(value)) {
    return {
      valid: false,
      error: `值必须是以下之一：${rules.enum.join(', ')}`,
    };
  }

  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return { valid: false, error: customError };
    }
  }

  return { valid: true };
}

/**
 * 验证数字
 */
function validateNumber(
  value: number,
  rules: ValidationRule
): ValidationResult {
  if (rules.min !== undefined && value < rules.min) {
    return {
      valid: false,
      error: `值不能小于${rules.min}`,
    };
  }

  if (rules.max !== undefined && value > rules.max) {
    return {
      valid: false,
      error: `值不能大于${rules.max}`,
    };
  }

  if (rules.enum && !rules.enum.includes(value)) {
    return {
      valid: false,
      error: `值必须是以下之一：${rules.enum.join(', ')}`,
    };
  }

  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return { valid: false, error: customError };
    }
  }

  return { valid: true };
}

/**
 * 验证数组
 */
function validateArray(
  value: unknown[],
  rules: ValidationRule
): ValidationResult {
  if (rules.minLength && value.length < rules.minLength) {
    return {
      valid: false,
      error: `数组长度不能少于${rules.minLength}个元素`,
    };
  }

  if (rules.maxLength && value.length > rules.maxLength) {
    return {
      valid: false,
      error: `数组长度不能超过${rules.maxLength}个元素`,
    };
  }

  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return { valid: false, error: customError };
    }
  }

  return { valid: true };
}

/**
 * 验证对象
 */
function validateObject(
  value: Record<string, unknown>,
  rules: ValidationRule
): ValidationResult {
  const keys = Object.keys(value);

  if (rules.minLength && keys.length < rules.minLength) {
    return {
      valid: false,
      error: `对象属性不能少于${rules.minLength}个`,
    };
  }

  if (rules.maxLength && keys.length > rules.maxLength) {
    return {
      valid: false,
      error: `对象属性不能超过${rules.maxLength}个`,
    };
  }

  if (rules.custom) {
    const customError = rules.custom(value);
    if (customError) {
      return { valid: false, error: customError };
    }
  }

  return { valid: true };
}

/**
 * 预定义的验证规则
 */
export const PREDEFINED_VALIDATION_RULES = {
  // URL 验证
  url: {
    pattern: '^https?://[^\\s/$.?#].[^\\s]*$',
  } as ValidationRule,

  // 邮箱验证
  email: {
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
  } as ValidationRule,

  // 端口号验证
  port: {
    min: 1,
    max: 65535,
  } as ValidationRule,

  // 百分比验证
  percentage: {
    min: 0,
    max: 100,
  } as ValidationRule,

  // 正整数验证
  positiveInteger: {
    min: 1,
  } as ValidationRule,

  // 非负数验证
  nonNegative: {
    min: 0,
  } as ValidationRule,

  // API 密钥格式验证（简化版）
  apiKey: {
    minLength: 16,
    maxLength: 128,
    pattern: '^[a-zA-Z0-9_-]+$',
  } as ValidationRule,

  // 配置键格式验证
  configKey: {
    minLength: 1,
    maxLength: 100,
    pattern: '^[a-zA-Z][a-zA-Z0-9_]*$',
  } as ValidationRule,

  // 文件路径验证
  filePath: {
    minLength: 1,
    maxLength: 500,
    pattern: '^[a-zA-Z0-9_\\\\/\\\\-\\\\.]+$',
  } as ValidationRule,
};
