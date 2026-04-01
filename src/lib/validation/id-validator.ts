/**
 * ID 格式验证工具
 *
 * 支持验证：
 * - CUID (c_xxxxxxxxxxxxxxxx)
 * - UUID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
 * - 短 ID (至少 8 个字符的字母数字)
 */

import { z } from 'zod';

// CUID 格式验证
const cuidRegex = /^c_[a-z0-9]{24}$/;

// UUID 格式验证
const uuidSchema = z.string().uuid();

// 短 ID 格式（最小 8 字符，仅字母数字和下划线）
const shortIdRegex = /^[a-zA-Z0-9_-]{8,}$/;

/**
 * 验证 ID 是否为有效的 CUID
 */
export function isValidCUID(id: string): boolean {
  return cuidRegex.test(id);
}

/**
 * 验证 ID 是否为有效的 UUID
 */
export function isValidUUID(id: string): boolean {
  const result = uuidSchema.safeParse(id);
  return result.success;
}

/**
 * 验证 ID 是否为有效的短 ID
 */
export function isValidShortID(id: string): boolean {
  return shortIdRegex.test(id);
}

/**
 * 验证 ID 格式（接受 CUID、UUID 或短 ID）
 */
export function isValidID(id: string): boolean {
  return isValidCUID(id) || isValidUUID(id) || isValidShortID(id);
}

/**
 * 验证 ID 并返回标准化的错误响应
 */
export function validateID(
  id: string,
  fieldName: string = 'id'
): { valid: true } | { valid: false; error: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: `${fieldName} 不能为空` };
  }

  if (!isValidID(id)) {
    return {
      valid: false,
      error: `${fieldName} 格式无效，应为有效的 CUID、UUID 或至少 8 个字符的 ID`,
    };
  }

  return { valid: true };
}

/**
 * Zod 验证模式
 */
export const idSchema = z
  .string()
  .refine(
    val => isValidID(val),
    'ID 格式无效，应为有效的 CUID、UUID 或至少 8 个字符的 ID'
  );

/**
 * 批量验证多个 ID
 */
export function validateIDs(ids: string[]):
  | {
      valid: true;
    }
  | {
      valid: false;
      invalidIds: Array<{ index: number; id: string; error: string }>;
    } {
  const invalidIds: Array<{ index: number; id: string; error: string }> = [];

  for (let i = 0; i < ids.length; i++) {
    const result = validateID(ids[i], `ID[${i}]`);
    if (!result.valid) {
      invalidIds.push({ index: i, id: ids[i], error: result.error });
    }
  }

  if (invalidIds.length > 0) {
    return { valid: false, invalidIds };
  }

  return { valid: true };
}
