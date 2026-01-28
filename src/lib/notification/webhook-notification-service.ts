/**
 * Webhook通知服务模块
 *
 * 提供Webhook通知功能，将提醒信息发送到外部系统。
 * 支持重试机制、签名验证、错误处理等特性。
 */

import { logger } from '@/lib/agent/security/logger';
import { NotificationChannel, NotificationType } from '@/types/notification';
import * as crypto from 'node:crypto';

// =============================================================================
// Webhook配置接口
// =============================================================================

interface WebhookConfig {
  url: string;
  enabled: boolean;
  secret?: string; // 用于HMAC签名
  headers?: Record<string, string>;
  timeout?: number; // 请求超时时间（毫秒）
  retryCount?: number; // 重试次数
  retryDelay?: number; // 重试延迟（毫秒）
}

interface WebhookPayload {
  notificationId: string;
  userId: string;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface WebhookSendResult {
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
  responseBody?: string;
}

// =============================================================================
// Webhook通知服务
// =============================================================================

class WebhookNotificationService {
  private readonly defaultTimeout = 10000; // 10秒超时
  private readonly defaultRetryCount = 3;
  private readonly defaultRetryDelay = 1000; // 1秒延迟

  /**
   * 发送Webhook通知
   * @param payload Webhook负载
   * @param config Webhook配置
   * @returns 发送结果
   */
  async send(
    payload: WebhookPayload,
    config: WebhookConfig
  ): Promise<WebhookSendResult> {
    if (!config.enabled) {
      logger.debug('Webhook通知已禁用');
      return {
        success: false,
        errorMessage: 'Webhook通知已禁用',
      };
    }

    const retryCount = config.retryCount ?? this.defaultRetryCount;
    const retryDelay = config.retryDelay ?? this.defaultRetryDelay;

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        const result = await this.attemptSend(payload, config);

        if (result.success) {
          logger.info(`Webhook通知发送成功: ${config.url}`, {
            notificationId: payload.notificationId,
            attempt: attempt + 1,
          } as never);
          return result;
        }

        // 如果是最后一次尝试，返回失败结果
        if (attempt === retryCount) {
          logger.error(
            `Webhook通知发送失败（重试${retryCount}次后）: ${config.url}`,
            {
              notificationId: payload.notificationId,
              statusCode: result.statusCode,
              errorMessage: result.errorMessage,
            } as never
          );
          return result;
        }

        // 等待后重试
        await this.delay(retryDelay * (attempt + 1));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        logger.error(
          `Webhook通知发送异常（第${attempt + 1}次尝试）: ${config.url}`,
          error as Error
        );

        if (attempt === retryCount) {
          return {
            success: false,
            errorMessage,
          };
        }

        await this.delay(retryDelay * (attempt + 1));
      }
    }

    return {
      success: false,
      errorMessage: 'Webhook通知发送失败',
    };
  }

  /**
   * 尝试发送Webhook请求
   * @param payload Webhook负载
   * @param config Webhook配置
   * @returns 发送结果
   */
  private async attemptSend(
    payload: WebhookPayload,
    config: WebhookConfig
  ): Promise<WebhookSendResult> {
    const timeout = config.timeout ?? this.defaultTimeout;
    const headers = this.buildHeaders(payload, config);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseBody = await response.text();

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          responseBody,
        };
      }

      return {
        success: false,
        statusCode: response.status,
        errorMessage: `HTTP ${response.status}: ${response.statusText}`,
        responseBody,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          return {
            success: false,
            errorMessage: '请求超时',
          };
        }
      }

      throw error;
    }
  }

  /**
   * 构建请求头
   * @param payload Webhook负载
   * @param config Webhook配置
   * @returns 请求头
   */
  private buildHeaders(
    payload: WebhookPayload,
    config: WebhookConfig
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    // 添加时间戳
    headers['X-Timestamp'] = payload.timestamp;

    // 添加签名（如果配置了secret）
    if (config.secret) {
      const signature = this.generateSignature(payload, config.secret);
      headers['X-Signature'] = signature;
    }

    return headers;
  }

  /**
   * 生成HMAC签名
   * @param payload Webhook负载
   * @param secret 密钥
   * @returns 签名字符串
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const payloadString = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadString);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * 验证签名
   * @param payload Webhook负载
   * @param signature 签名
   * @param secret 密钥
   * @returns 是否有效
   */
  verifySignature(
    payload: WebhookPayload,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return signature === expectedSignature;
  }

  /**
   * 延迟指定毫秒数
   * @param ms 毫秒数
   * @returns Promise
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 创建Webhook负载
   * @param notificationId 通知ID
   * @param userId 用户ID
   * @param type 通知类型
   * @param title 标题
   * @param content 内容
   * @param metadata 元数据
   * @returns Webhook负载
   */
  createPayload(
    notificationId: string,
    userId: string,
    type: NotificationType,
    title: string,
    content: string,
    metadata?: Record<string, unknown>
  ): WebhookPayload {
    return {
      notificationId,
      userId,
      type,
      channel: NotificationChannel.WEBHOOK,
      title,
      content,
      timestamp: new Date().toISOString(),
      metadata,
    };
  }
}

// =============================================================================
// 导出
// =============================================================================

export const webhookNotificationService = new WebhookNotificationService();
export default webhookNotificationService;
export type { WebhookConfig, WebhookPayload, WebhookSendResult };
