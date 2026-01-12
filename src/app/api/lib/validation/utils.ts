import { NextRequest } from 'next/server';
import { ValidationError } from '../errors/api-error';
import { paginationSchema } from './schemas';
import { validateQueryParams } from './core';

/**
 * 分页参数验证中间件
 */
export function validatePagination(request: NextRequest) {
  return validateQueryParams(request, paginationSchema);
}

/**
 * UUID参数验证
 */
export function validateUUID(value: string, paramName: string = 'ID'): string {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    throw new ValidationError(`Invalid ${paramName} format`);
  }

  return value;
}

/**
 * 文件类型验证
 */
export function validateFileType(
  fileType: string,
  allowedTypes: string[]
): boolean {
  return allowedTypes.includes(fileType.toLowerCase());
}

/**
 * 文件大小验证（字节）
 */
export function validateFileSize(size: number, maxSize: number): void {
  if (size < 0) {
    throw new ValidationError('File size cannot be negative');
  }
  if (size > maxSize) {
    throw new ValidationError(
      `File size exceeds maximum allowed size of ${maxSize} bytes`
    );
  }
}

/**
 * 邮箱格式验证
 */
export function validateEmail(email: string): boolean {
  // 更严格的邮箱验证规则
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  // 额外检查一些无效格式
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
    return false;
  }

  if (/@.*@/.test(email)) {
    return false;
  }

  if (email.endsWith('@localhost') || email.endsWith('.')) {
    return false;
  }

  // 检查域名部分是否包含连续的点
  const [localPart, domain] = email.split('@');
  if (domain) {
    // 域名不能包含连续的点
    if (domain.includes('..')) {
      return false;
    }

    // 域名必须包含至少一个点
    if (!domain.includes('.')) {
      return false;
    }

    // 检查是否为IP地址格式（通常不被允许）
    if (/^\d+\.\d+\.\d+\.\d+$/.test(domain)) {
      return false;
    }

    // 域名不能以点开始或结束
    if (domain.startsWith('.') || domain.endsWith('.')) {
      return false;
    }
  }

  return emailRegex.test(email);
}

/**
 * 强度验证密码
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 按照测试期望的顺序检查错误
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*(),.?":{}|<>\[\]\\\/`~+=\-_;]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// 重新导出核心验证函数
export { validateQueryParams } from './core';
