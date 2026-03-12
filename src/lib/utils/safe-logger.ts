/**
 * 安全日志工具
 * 防止敏感信息（如密码、token、数据库连接字符串等）泄露到日志中
 */

import { logger } from '@/lib/logger';

/**
 * 敏感字段列表（不区分大小写）
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'credentials',
  'private',
  'passphrase',
  'salt',
  'jwt',
  'bearer',
];

/**
 * 检查键名是否为敏感字段
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_KEYS.some(sensitiveKey => lowerKey.includes(sensitiveKey));
}

/**
 * 过滤对象中的敏感字段
 */
function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item =>
        item && typeof item === 'object'
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 安全地提取错误信息（不包含敏感数据）
 */
export function sanitizeError(error: unknown): {
  message: string;
  type: string;
  code?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      type: error.name,
      code: 'code' in error ? String(error.code) : undefined,
    };
  }

  return {
    message: String(error),
    type: 'UnknownError',
  };
}

/**
 * 安全地记录错误信息
 */
export function logError(message: string, error: unknown): void {
  const sanitized = sanitizeError(error);
  logger.error(`${message}:`, {
    type: sanitized.type,
    message: sanitized.message,
    ...(sanitized.code && { code: sanitized.code }),
  });
}

/**
 * 安全地记录对象（移除敏感字段）
 */
export function logObject(
  label: string,
  obj: unknown,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    const sanitized = sanitizeObject(obj as Record<string, unknown>);
    logger[level](label, sanitized);
  } else {
    logger[level](label, obj);
  }
}

/**
 * 安全地记录警告信息
 */
export function logWarning(message: string, data?: unknown): void {
  if (data && typeof data === 'object') {
    const sanitized = sanitizeObject(data as Record<string, unknown>);
    logger.warn(message, sanitized);
  } else {
    logger.warn(message, data);
  }
}

/**
 * 安全地记录信息（用于开发环境调试）
 */
export function logInfo(message: string, data?: unknown): void {
  if (process.env.NODE_ENV !== 'production') {
    if (data && typeof data === 'object') {
      const sanitized = sanitizeObject(data as Record<string, unknown>);
      logger.info(message, sanitized);
    } else {
      logger.info(message, data);
    }
  }
}
