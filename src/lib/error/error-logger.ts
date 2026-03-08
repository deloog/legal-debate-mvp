/**
 * Error Logger
 *
 * 错误捕获和记录模块
 * 负责捕获所有类型错误、评估严重程度、存储到数据库
 */

import { logger } from '@/lib/logger';
import { ErrorContext, ErrorLog, ErrorSeverity, ErrorType } from './types';

/**
 * 错误日志记录器
 */
export class ErrorLogger {
  // 错误缓存（防止重复记录）
  private errorCache = new Map<string, number>();
  private readonly CACHE_TTL = 60000; // 1分钟

  // 严重程度评估规则
  private readonly SEVERITY_RULES = {
    [ErrorType.AI_TIMEOUT]: ErrorSeverity.MEDIUM,
    [ErrorType.AI_RATE_LIMIT]: ErrorSeverity.HIGH,
    [ErrorType.AI_QUOTA_EXCEEDED]: ErrorSeverity.HIGH,
    [ErrorType.DATABASE_CONNECTION_ERROR]: ErrorSeverity.CRITICAL,
    [ErrorType.DATABASE_CONSTRAINT_ERROR]: ErrorSeverity.HIGH,
    [ErrorType.AGENT_NOT_FOUND]: ErrorSeverity.CRITICAL,
    [ErrorType.MEMORY_EXPIRED]: ErrorSeverity.LOW,
    [ErrorType.MEMORY_NOT_FOUND]: ErrorSeverity.MEDIUM,
  };

  /**
   * 捕获错误
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 错误日志对象
   */
  async captureError(error: Error, context: ErrorContext): Promise<ErrorLog> {
    // 1. 防止重复记录
    const cacheKey = this.getCacheKey(error, context);
    if (this.isDuplicateError(cacheKey)) {
      logger.warn(`Duplicate error detected: ${cacheKey}`);
      throw new Error(`Duplicate error: ${cacheKey}`);
    }

    // 2. 提取错误信息
    const errorType = this.extractErrorType(error);
    const errorMessage = error.message || 'Unknown error';
    const stackTrace = this.extractStackTrace(error);

    // 3. 评估严重程度
    const severity = this.assessSeverity(error, errorType);

    // 4. 创建错误日志对象
    const errorLog: ErrorLog = {
      id: undefined,
      userId: context.executionEnvironment?.userId,
      caseId: context.executionEnvironment?.caseId,
      errorType,
      errorCode: this.extractErrorCode(error),
      errorMessage,
      stackTrace,
      context: this.sanitizeContext(context),
      severity,
      recoveryAttempts: 0,
      recovered: false,
      learned: false,
      createdAt: new Date(),
    };

    // 5. 存储到数据库
    await this.saveToDatabase(errorLog);

    // 6. 缓存错误
    this.cacheError(cacheKey);

    return errorLog;
  }

  /**
   * 提取错误类型
   * @param error 错误对象
   * @returns 错误类型枚举
   */
  private extractErrorType(error: Error): ErrorType {
    // 根据错误消息和类型判断
    const message = error.message?.toLowerCase() || '';

    if (message.includes('timeout')) {
      if (message.includes('ai')) {
        return ErrorType.AI_TIMEOUT;
      }
      if (message.includes('network')) {
        return ErrorType.NETWORK_TIMEOUT;
      }
      if (message.includes('agent')) {
        return ErrorType.AGENT_TIMEOUT;
      }
      // 默认超时错误识别为网络超时
      return ErrorType.NETWORK_TIMEOUT;
    }

    if (message.includes('rate limit')) {
      return ErrorType.AI_RATE_LIMIT;
    }

    if (message.includes('quota')) {
      return ErrorType.AI_QUOTA_EXCEEDED;
    }

    if (message.includes('connection')) {
      if (message.includes('database')) {
        return ErrorType.DATABASE_CONNECTION_ERROR;
      }
      if (message.includes('network')) {
        return ErrorType.NETWORK_CONNECTION_ERROR;
      }
    }

    if (message.includes('validation')) {
      if (message.includes('required')) {
        return ErrorType.VALIDATION_REQUIRED_FIELD;
      }
      if (message.includes('format')) {
        return ErrorType.VALIDATION_FORMAT_ERROR;
      }
      return ErrorType.VALIDATION_ERROR;
    }

    if (message.includes('not found')) {
      if (message.includes('file')) {
        return ErrorType.FILE_NOT_FOUND;
      }
      if (message.includes('memory')) {
        return ErrorType.MEMORY_NOT_FOUND;
      }
      if (message.includes('agent')) {
        return ErrorType.AGENT_NOT_FOUND;
      }
    }

    if (error.name?.includes('PrismaClientKnownRequestError')) {
      return ErrorType.DATABASE_ERROR;
    }

    if (error.name?.includes('PrismaClientInitializationError')) {
      return ErrorType.DATABASE_CONNECTION_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  /**
   * 评估严重程度
   * @param error 错误对象
   * @param errorType 错误类型
   * @returns 严重程度
   */
  private assessSeverity(error: Error, errorType: ErrorType): ErrorSeverity {
    // 1. 使用预定义规则
    if (this.SEVERITY_RULES[errorType]) {
      return this.SEVERITY_RULES[errorType];
    }

    // 2. 根据错误消息判断
    const message = error.message?.toLowerCase() || '';

    if (message.includes('critical') || message.includes('fatal')) {
      return ErrorSeverity.CRITICAL;
    }

    if (message.includes('failed') || message.includes('error')) {
      return ErrorSeverity.HIGH;
    }

    if (message.includes('warning') || message.includes('deprecated')) {
      return ErrorSeverity.MEDIUM;
    }

    // 默认MEDIUM
    return ErrorSeverity.MEDIUM;
  }

  /**
   * 提取堆栈跟踪
   * @param error 错误对象
   * @returns 堆栈跟踪字符串
   */
  private extractStackTrace(error: Error): string {
    if (!error.stack) {
      return '';
    }

    // 限制堆栈跟踪长度
    const maxLines = 20;
    const lines = error.stack.split('\n').slice(0, maxLines);
    return lines.join('\n');
  }

  /**
   * 提取错误码
   * @param error 错误对象
   * @returns 错误码
   */
  private extractErrorCode(error: Error): string | undefined {
    // 从错误对象中提取错误码
    if ('code' in error && typeof error.code === 'string') {
      return error.code;
    }

    if (error.name) {
      return error.name;
    }

    return undefined;
  }

  /**
   * 缓存键生成
   * @param error 错误对象
   * @param context 错误上下文
   * @returns 缓存键
   */
  private getCacheKey(error: Error, context: ErrorContext): string {
    const type = this.extractErrorType(error);
    const agent = context.agentName || 'unknown';
    const task = context.taskId || 'unknown';
    return `${type}_${agent}_${task}_${Date.now()}`;
  }

  /**
   * 检查是否为重复错误
   * @param cacheKey 缓存键
   * @returns 是否重复
   */
  private isDuplicateError(cacheKey: string): boolean {
    const cachedTime = this.errorCache.get(cacheKey);
    if (cachedTime === undefined) {
      return false;
    }

    // 检查是否在TTL内
    const now = Date.now();
    return now - cachedTime < this.CACHE_TTL;
  }

  /**
   * 缓存错误
   * @param cacheKey 缓存键
   */
  private cacheError(cacheKey: string): void {
    this.errorCache.set(cacheKey, Date.now());

    // 定期清理过期缓存
    if (this.errorCache.size > 1000) {
      this.cleanupCache();
    }
  }

  /**
   * 清理过期缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, time] of this.errorCache.entries()) {
      if (now - time > this.CACHE_TTL) {
        this.errorCache.delete(key);
      }
    }
  }

  /**
   * 脱敏上下文数据
   * @param context 原始上下文
   * @returns 脱敏后的上下文
   */
  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized = { ...context };

    // 脱敏输入数据
    if (sanitized.inputData) {
      sanitized.inputData = this.sanitizeInputData(sanitized.inputData);
    }

    // 脱敏执行环境
    if (sanitized.executionEnvironment) {
      const env = { ...sanitized.executionEnvironment };
      // 脱敏敏感字段
      if (env.userId) {
        env.userId = this.sanitizeUserId(env.userId);
      }
      sanitized.executionEnvironment = env;
    }

    return sanitized;
  }

  /**
   * 脱敏输入数据
   * @param data 输入数据
   * @returns 脱敏后的数据
   */
  private sanitizeInputData(
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'api_key',
      'apikey',
      'key',
    ];

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(k => lowerKey.includes(k))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'string' && value.length > 500) {
        // 限制字符串长度
        sanitized[key] = value.substring(0, 500) + '...';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * 脱敏用户ID
   * @param userId 用户ID
   * @returns 脱敏后的用户ID
   */
  private sanitizeUserId(userId: string): string {
    if (userId.length <= 4) {
      return '****';
    }
    return userId.substring(0, 2) + '***' + userId.substring(userId.length - 2);
  }

  /**
   * 保存到数据库
   * @param errorLog 错误日志对象
   */
  async saveToDatabase(errorLog: ErrorLog): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db/prisma');
      const result = await prisma.errorLog.create({
        data: {
          userId: errorLog.userId,
          caseId: errorLog.caseId,
          errorType: errorLog.errorType as unknown as never,
          errorCode: errorLog.errorCode || '',
          errorMessage: errorLog.errorMessage,
          stackTrace: errorLog.stackTrace,
          context: errorLog.context as unknown as never,
          severity: errorLog.severity as unknown as never,
          recoveryAttempts: errorLog.recoveryAttempts,
          recovered: errorLog.recovered,
          learned: errorLog.learned,
          createdAt: errorLog.createdAt,
        },
      });

      // 更新错误日志ID
      errorLog.id = result.id;
    } catch (dbError) {
      logger.error('Failed to save error to database:', dbError);
      // 不抛出异常，避免错误记录失败影响主流程
    }
  }

  /**
   * 更新错误日志
   * @param errorId 错误ID
   * @param updates 更新内容
   */
  async updateErrorLog(
    errorId: string,
    updates: Partial<ErrorLog>
  ): Promise<void> {
    try {
      const { prisma } = await import('@/lib/db/prisma');
      await prisma.errorLog.update({
        where: { id: errorId },
        data: {
          recovered: updates.recovered,
          recoveryMethod: updates.recoveryMethod,
          recoveryTime: updates.recoveryTime,
          recoveryAttempts: updates.recoveryAttempts,
          learned: updates.learned,
          learningNotes: updates.learningNotes,
          metadata: updates.metadata as never,
          updatedAt: updates.updatedAt || new Date(),
        },
      });
    } catch (dbError) {
      logger.error(`Failed to update error log ${errorId}:`, dbError);
    }
  }
}
