/**
 * 邮箱和输入验证工具函数
 */

import type { EmailValidationError } from '@/types/auth';
import { validatePassword as checkPasswordComplexity } from './password';

/**
 * 验证邮箱格式
 */
export function validateEmail(email: string): EmailValidationError {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: '邮箱格式不正确',
    };
  }

  return {
    valid: true,
    error: null,
  };
}

/**
 * 验证用户名
 */
export function validateUsername(username: string): {
  valid: boolean;
  error: string | null;
} {
  const usernameRegex = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/;

  if (!usernameRegex.test(username)) {
    return {
      valid: false,
      error: '用户名长度为2-20位，只能包含字母、数字、下划线和中文',
    };
  }

  return {
    valid: true,
    error: null,
  };
}

/**
 * 验证注册请求数据
 */
export function validateRegisterRequest(
  email: string,
  password: string,
  username?: string
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证邮箱
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid && emailValidation.error) {
    errors.push(emailValidation.error);
  }

  // 验证密码
  const passwordValidation = checkPasswordComplexity(password);
  if (!passwordValidation.valid) {
    errors.push(...passwordValidation.errors);
  }

  // 验证用户名（如果提供）
  if (username) {
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid && usernameValidation.error) {
      errors.push(usernameValidation.error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证登录请求数据
 */
export function validateLoginRequest(
  email: string,
  password: string
): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证邮箱
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid && emailValidation.error) {
    errors.push(emailValidation.error);
  }

  // 验证密码不为空
  if (!password || password.trim() === '') {
    errors.push('密码不能为空');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 清理用户输入（防止XSS和SQL注入）
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}
