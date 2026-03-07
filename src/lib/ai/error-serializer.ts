import type { AIError, AIErrorType, AIProvider } from '../../types/ai-service';
import { logger } from '../agent/security/logger';

/**
 * AI错误序列化工具
 * 提供统一的错误信息格式化和序列化功能
 */

// =============================================================================
// 错误序列化配置
// =============================================================================

export interface ErrorSerializationConfig {
  includeStackTrace?: boolean;
  includeRequestContext?: boolean;
  maxMessageLength?: number;
  sanitizeSensitiveInfo?: boolean;
  prettyFormat?: boolean;
}

// =============================================================================
// 错误上下文信息
// =============================================================================

export interface ErrorContext {
  requestId?: string;
  provider?: string;
  model?: string;
  endpoint?: string;
  statusCode?: number;
  responseTime?: number;
  retryAttempt?: number;
  userAgent?: string;
  timestamp?: number;
}

// =============================================================================
// 序列化错误结果
// =============================================================================

export interface SerializedError {
  code: string;
  message: string;
  type: AIErrorType;
  provider?: string;
  statusCode?: number;
  timestamp: number;
  retryable: boolean;
  context?: ErrorContext;
  details?: Record<string, unknown>;
  serializedAt: number;
  version: string;
}

// =============================================================================
// 错误序列化器类
// =============================================================================

export class AIErrorSerializer {
  private static readonly VERSION = '1.0.0';
  private static readonly DEFAULT_CONFIG: ErrorSerializationConfig = {
    includeStackTrace: false,
    includeRequestContext: true,
    maxMessageLength: 1000,
    sanitizeSensitiveInfo: true,
    prettyFormat: false,
  };

  /**
   * 序列化AI错误对象
   */
  public static serialize(
    error: AIError | Error | unknown,
    context?: ErrorContext,
    config?: Partial<ErrorSerializationConfig>
  ): SerializedError {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };

    // 标准化错误对象
    const standardError = this.standardizeError(error);

    // 序列化错误
    const serialized: SerializedError = {
      code: standardError.code,
      message: this.truncateMessage(
        standardError.message,
        finalConfig.maxMessageLength
      ),
      type: standardError.type,
      provider: standardError.provider,
      statusCode: standardError.statusCode,
      timestamp: standardError.timestamp,
      retryable: standardError.retryable,
      context: finalConfig.includeRequestContext ? context : undefined,
      details: this.extractErrorDetails(error, finalConfig),
      serializedAt: Date.now(),
      version: this.VERSION,
    };

    // 敏感信息清理
    if (finalConfig.sanitizeSensitiveInfo) {
      return this.sanitizeError(serialized);
    }

    return serialized;
  }

  /**
   * 序列化为JSON字符串
   */
  public static serializeToJson(
    error: AIError | Error | unknown,
    context?: ErrorContext,
    config?: Partial<ErrorSerializationConfig>
  ): string {
    const serialized = this.serialize(error, context, config);

    if (config?.prettyFormat) {
      return JSON.stringify(serialized, null, 2);
    }

    return JSON.stringify(serialized);
  }

  /**
   * 反序列化JSON字符串为错误对象
   */
  public static deserializeFromJson(jsonString: string): SerializedError {
    try {
      const parsed = JSON.parse(jsonString);

      // 验证版本兼容性
      if (parsed.version !== this.VERSION) {
        logger.warn(
          `Error serialization version mismatch: expected ${this.VERSION}, got ${parsed.version}`
        );
      }

      return parsed as SerializedError;
    } catch (error) {
      throw new Error(
        `Failed to deserialize error JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 创建用户友好的错误消息
   */
  public static createUserFriendlyMessage(
    error: SerializedError,
    locale: string = 'zh-CN'
  ): string {
    const messages = this.getLocalizedMessage(locale);

    // 基础错误消息
    let message = messages[error.type] || messages.unknown_error;

    // 添加提供商信息
    if (error.provider) {
      message = `${message} (提供商: ${error.provider})`;
    }

    // 添加状态码信息
    if (error.statusCode) {
      message = `${message} (状态码: ${error.statusCode})`;
    }

    // 添加重试信息
    if (error.retryable) {
      message = `${message} (可重试)`;
    }

    return message;
  }

  /**
   * 生成错误摘要
   */
  public static generateSummary(errors: SerializedError[]): {
    totalErrors: number;
    errorTypes: Record<string, number>;
    providers: Record<string, number>;
    mostCommonError: string;
    mostProblematicProvider: string;
    retryableErrors: number;
    nonRetryableErrors: number;
  } {
    const errorTypes: Record<string, number> = {};
    const providers: Record<string, number> = {};
    let retryableErrors = 0;
    let nonRetryableErrors = 0;

    errors.forEach(error => {
      // 统计错误类型
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;

      // 统计提供商
      if (error.provider) {
        providers[error.provider] = (providers[error.provider] || 0) + 1;
      }

      // 统计可重试性
      if (error.retryable) {
        retryableErrors++;
      } else {
        nonRetryableErrors++;
      }
    });

    // 找出最常见的错误类型
    const mostCommonError =
      Object.entries(errorTypes).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'unknown_error';

    // 找出问题最多的提供商
    const mostProblematicProvider =
      Object.entries(providers).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'zhipu';

    return {
      totalErrors: errors.length,
      errorTypes,
      providers,
      mostCommonError,
      mostProblematicProvider,
      retryableErrors,
      nonRetryableErrors,
    };
  }

  // =============================================================================
  // 私有辅助方法
  // =============================================================================

  /**
   * 标准化错误对象
   */
  private static standardizeError(error: AIError | Error | unknown): AIError {
    if (this.isAIError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return {
        code: error.name || 'UNKNOWN_ERROR',
        message: error.message,
        type: this.inferErrorType(error),
        provider: 'zhipu' as AIProvider, // 使用默认提供商
        timestamp: Date.now(),
        retryable: this.isRetryableError(error),
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
      type: 'unknown_error',
      provider: 'zhipu' as AIProvider, // 使用默认提供商
      timestamp: Date.now(),
      retryable: false,
    };
  }

  /**
   * 检查是否为AI错误
   */
  private static isAIError(error: unknown): error is AIError {
    return (
      error !== null &&
      typeof error === 'object' &&
      'type' in error &&
      'provider' in error
    );
  }

  /**
   * 推断错误类型
   */
  private static inferErrorType(error: Error): AIErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) return 'timeout_error';
    if (message.includes('network') || message.includes('connection'))
      return 'network_error';
    if (message.includes('authentication') || message.includes('unauthorized'))
      return 'authentication_error';
    if (message.includes('permission') || message.includes('forbidden'))
      return 'permission_error';
    if (message.includes('rate limit') || message.includes('too many requests'))
      return 'rate_limit_error';
    if (message.includes('not found') || message.includes('does not exist'))
      return 'not_found_error';
    if (message.includes('quota') || message.includes('limit'))
      return 'insufficient_quota';
    if (message.includes('validation') || message.includes('invalid'))
      return 'validation_error';
    if (message.includes('model') && message.includes('not available'))
      return 'model_not_available';

    return 'unknown_error';
  }

  /**
   * 判断错误是否可重试
   */
  private static isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('rate limit')
    );
  }

  /**
   * 截断错误消息
   */
  private static truncateMessage(message: string, maxLength?: number): string {
    if (!maxLength || message.length <= maxLength) {
      return message;
    }

    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * 提取错误详情
   */
  private static extractErrorDetails(
    error: unknown,
    config: ErrorSerializationConfig
  ): Record<string, unknown> | undefined {
    const details: Record<string, unknown> = {};

    // 添加堆栈跟踪
    if (config.includeStackTrace && error instanceof Error && error.stack) {
      details.stack = error.stack;
    }

    // 添加原始错误类型
    if (error instanceof Error) {
      details.originalName = error.name;
    }

    // 如果没有详情，返回undefined
    return Object.keys(details).length > 0 ? details : undefined;
  }

  /**
   * 清理敏感信息
   */
  private static sanitizeError(error: SerializedError): SerializedError {
    const sanitized = { ...error };

    // 清理消息中的敏感信息
    if (sanitized.message) {
      sanitized.message = this.sanitizeMessage(sanitized.message);
    }

    // 清理详情中的敏感信息
    if (sanitized.details) {
      sanitized.details = this.sanitizeObject(sanitized.details) as Record<
        string,
        unknown
      >;
    }

    return sanitized;
  }

  /**
   * 清理消息中的敏感信息
   */
  private static sanitizeMessage(message: string): string {
    return message
      .replace(/api[_-]?key[s]?[:\s=]+[a-zA-Z0-9_-]+/gi, 'api_key:***')
      .replace(/token[:\s=]+[a-zA-Z0-9._-]+/gi, 'token:***')
      .replace(/password[:\s=]+[^\s]+/gi, 'password:***')
      .replace(/secret[:\s=]+[^\s]+/gi, 'secret:***');
  }

  /**
   * 递归清理对象中的敏感信息
   */
  private static sanitizeObject(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = this.sanitizeObject(value);
      }
    }

    return sanitized;
  }

  /**
   * 检查是否为敏感键名
   */
  private static isSensitiveKey(key: string): boolean {
    const sensitiveKeys = [
      'apikey',
      'api_key',
      'api-key',
      'token',
      'accesstoken',
      'access_token',
      'access-token',
      'password',
      'passwd',
      'pwd',
      'secret',
      'privatekey',
      'private_key',
      'private-key',
      'authorization',
      'auth',
    ];

    return sensitiveKeys.some(sensitive =>
      key.toLowerCase().includes(sensitive.toLowerCase())
    );
  }

  /**
   * 获取本地化消息
   */
  private static getLocalizedMessage(
    locale: string
  ): Record<AIErrorType, string> {
    const messages: Record<string, Record<AIErrorType, string>> = {
      'zh-CN': {
        authentication_error: '认证失败，请检查API密钥',
        permission_error: '权限不足，无法执行该操作',
        not_found_error: '请求的资源不存在',
        rate_limit_error: '请求频率过高，请稍后重试',
        api_error: 'API服务错误',
        timeout_error: '请求超时，请检查网络连接',
        network_error: '网络连接错误',
        validation_error: '请求参数验证失败',
        insufficient_quota: '配额不足，请检查账户余额',
        model_not_available: '指定的模型不可用',
        content_filter: '内容被过滤',
        unknown_error: '未知错误',
      },
      'en-US': {
        authentication_error: 'Authentication failed, please check API key',
        permission_error: 'Insufficient permissions to perform this operation',
        not_found_error: 'Requested resource not found',
        rate_limit_error: 'Rate limit exceeded, please try again later',
        api_error: 'API service error',
        timeout_error: 'Request timeout, please check network connection',
        network_error: 'Network connection error',
        validation_error: 'Request parameter validation failed',
        insufficient_quota: 'Insufficient quota, please check account balance',
        model_not_available: 'Specified model is not available',
        content_filter: 'Content was filtered',
        unknown_error: 'Unknown error',
      },
    };

    return messages[locale] || messages['en-US'];
  }
}

// =============================================================================
// 默认导出
// =============================================================================

export default AIErrorSerializer;
