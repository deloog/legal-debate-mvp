/**
 * 数据验证模块（Data Validation）
 * 包含：validate_data
 */

import type { ValidationResult } from './types';

/**
 * 6. validate_data - 数据验证
 * 根据规则验证数据有效性
 */
export async function validate_data(
  data: unknown,
  rules: Array<{
    field: string;
    type: string;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    customValidator?: (value: unknown) => boolean;
  }>
): Promise<ValidationResult> {
  const errors: Array<{ field: string; message: string }> = [];
  const warnings: string[] = [];

  for (const rule of rules) {
    const value = (data as Record<string, unknown>)[rule.field];

    if (rule.required && value === undefined) {
      errors.push({
        field: rule.field,
        message: `${rule.field} is required`,
      });
      continue;
    }

    if (value !== undefined) {
      if (typeof value !== rule.type) {
        errors.push({
          field: rule.field,
          message: `${rule.field} must be ${rule.type}`,
        });
      }

      if (rule.minLength && String(value).length < rule.minLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} is too short (min ${rule.minLength})`,
        });
      }

      if (rule.maxLength && String(value).length > rule.maxLength) {
        errors.push({
          field: rule.field,
          message: `${rule.field} is too long (max ${rule.maxLength})`,
        });
      }

      if (rule.pattern && !rule.pattern.test(String(value))) {
        errors.push({
          field: rule.field,
          message: `${rule.field} does not match required pattern`,
        });
      }

      if (rule.customValidator && !rule.customValidator(value)) {
        errors.push({
          field: rule.field,
          message: `${rule.field} failed custom validation`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
