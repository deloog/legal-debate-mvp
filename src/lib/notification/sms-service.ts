/**
 * 短信服务模块
 *
 * 提供短信发送功能，支持跟进任务提醒、法庭日程提醒等。
 * 开发环境使用控制台输出，生产环境可集成阿里云短信、腾讯云短信等。
 * 
 * 安全特性：
 * - 发送频率限制（每小时最多10条）
 * - 敏感信息脱敏（日志中手机号部分隐藏）
 * - 配置完整性验证
 * - 发送审计日志
 */

import {
  SMSSendOptions,
  SMSSendResult,
  SMSProvider,
} from '@/types/notification';
import { FollowUpTask } from '@/types/client';
import { logger } from '@/lib/logger';
import { checkRateLimit } from './rate-limiter';

// =============================================================================
// 短信服务配置类型
// =============================================================================

/**
 * 短信服务配置接口
 */
interface SMSConfig {
  provider: SMSProvider;
  accessKeyId?: string;
  accessKeySecret?: string;
  signName?: string;
  templateCode?: string;
  appKey?: string;
  appId?: string;
}

/**
 * 获取短信服务配置
 */
function getSMSConfig(): SMSConfig {
  const provider = (process.env.SMS_PROVIDER || 'console') as SMSProvider;

  const config: SMSConfig = {
    provider,
  };

  if (provider === SMSProvider.ALIYUN) {
    config.accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
    config.accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
    config.signName = process.env.ALIYUN_SMS_SIGN_NAME;
    config.templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  } else if (provider === SMSProvider.TENCENT) {
    config.appKey = process.env.TENCENT_SMS_APP_KEY;
    config.appId = process.env.TENCENT_SMS_APP_ID;
    config.signName = process.env.TENCENT_SMS_SIGN_NAME;
    config.templateCode = process.env.TENCENT_SMS_TEMPLATE_CODE;
  }

  return config;
}

/**
 * 验证短信服务配置是否完整
 */
function validateSMSConfig(config: SMSConfig): boolean {
  if (config.provider === SMSProvider.CONSOLE) {
    return true;
  }

  if (config.provider === SMSProvider.ALIYUN) {
    return !!(
      config.accessKeyId &&
      config.accessKeySecret &&
      config.signName &&
      config.templateCode
    );
  }

  if (config.provider === SMSProvider.TENCENT) {
    return !!(
      config.appKey &&
      config.appId &&
      config.signName &&
      config.templateCode
    );
  }

  return false;
}

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 脱敏手机号（用于日志）
 * 13812345678 -> 138****5678
 */
function maskPhoneNumber(phone: string): string {
  if (phone.length !== 11) return phone;
  return phone.substring(0, 3) + '****' + phone.substring(7);
}

/**
 * 验证手机号格式
 */
function isValidPhoneNumber(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

// =============================================================================
// 短信内容生成
// =============================================================================

/**
 * 生成跟进任务提醒短信内容
 */
function generateFollowUpTaskSMS(
  task: FollowUpTask,
  clientPhone: string
): string {
  const formattedDate = task.dueDate.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  });

  const priorityText =
    task.priority === 'HIGH' ? '高' : task.priority === 'MEDIUM' ? '中' : '低';

  const typeText =
    task.type === 'PHONE'
      ? '电话'
      : task.type === 'EMAIL'
        ? '邮件'
        : task.type === 'MEETING'
          ? '面谈'
          : task.type === 'WECHAT'
            ? '微信'
            : '其他';

  return `【律伴助手】您有一个${priorityText}优先级的客户跟进任务：${task.clientName}（${clientPhone}），${typeText}跟进，${formattedDate}截止。请及时跟进。`;
}

// =============================================================================
// 开发环境短信服务
// =============================================================================

/**
 * 开发环境短信服务实现（控制台输出）
 */
class DevSMSService {
  private isDevEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    );
  }

  private logSMS(options: SMSSendOptions): void {
    const maskedTo = maskPhoneNumber(options.to);
    
    logger.info('\n' + '='.repeat(60));
    logger.info('📱 短信发送（开发环境）');
    logger.info('='.repeat(60));
    logger.info(`收件人: ${maskedTo}`);
    logger.info('-'.repeat(60));
    logger.info('内容：');
    logger.info(options.content);
    if (options.templateCode) {
      logger.info('-'.repeat(60));
      logger.info(`模板代码: ${options.templateCode}`);
      if (options.templateParams) {
        logger.info(`模板参数: ${JSON.stringify(options.templateParams)}`);
      }
    }
    logger.info('='.repeat(60) + '\n');
  }

  async sendFollowUpTaskSMS(
    task: FollowUpTask,
    clientPhone: string
  ): Promise<SMSSendResult> {
    // 频率限制检查
    const rateLimit = checkRateLimit(clientPhone, 'SMS');
    if (!rateLimit.allowed) {
      logger.warn(`短信发送频率限制`, {
        to: maskPhoneNumber(clientPhone),
        retryAfter: rateLimit.retryAfter,
      });
      return {
        success: false,
        error: `发送过于频繁，请${Math.ceil((rateLimit.retryAfter || 60000) / 1000)}秒后重试`,
      };
    }

    if (!this.isDevEnvironment()) {
      return {
        success: false,
        error: '非开发环境，请使用生产短信服务',
      };
    }

    // 验证手机号格式
    if (!isValidPhoneNumber(clientPhone)) {
      logger.warn(`无效的手机号格式`, { phone: maskPhoneNumber(clientPhone) });
      return {
        success: false,
        error: '无效的手机号格式',
      };
    }

    const content = generateFollowUpTaskSMS(task, clientPhone);

    const options: SMSSendOptions = {
      to: clientPhone,
      content,
    };

    this.logSMS(options);

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      devMessage: `[开发模式] 短信已发送到控制台，收件人：${maskPhoneNumber(clientPhone)}，任务：${task.summary}`,
    };
  }

  async sendCustomSMS(options: SMSSendOptions): Promise<SMSSendResult> {
    // 频率限制检查
    const rateLimit = checkRateLimit(options.to, 'SMS');
    if (!rateLimit.allowed) {
      logger.warn(`短信发送频率限制`, {
        to: maskPhoneNumber(options.to),
        retryAfter: rateLimit.retryAfter,
      });
      return {
        success: false,
        error: `发送过于频繁，请${Math.ceil((rateLimit.retryAfter || 60000) / 1000)}秒后重试`,
      };
    }

    if (!this.isDevEnvironment()) {
      return {
        success: false,
        error: '非开发环境，请使用生产短信服务',
      };
    }

    // 验证手机号格式
    if (!isValidPhoneNumber(options.to)) {
      logger.warn(`无效的手机号格式`, { phone: maskPhoneNumber(options.to) });
      return {
        success: false,
        error: '无效的手机号格式',
      };
    }

    this.logSMS(options);

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      devMessage: `[开发模式] 短信已发送到控制台，收件人：${maskPhoneNumber(options.to)}，内容：${options.content.substring(0, 20)}...`,
    };
  }
}

// =============================================================================
// 生产环境短信服务占位符
// =============================================================================

/**
 * 生产环境短信服务占位符
 *
 * 实际生产环境应该集成真实的短信服务（如阿里云短信、腾讯云短信等）
 * 此处仅作为占位符，需要根据实际短信服务商进行实现
 */
class ProdSMSService {
  private config: SMSConfig;

  constructor(config?: SMSConfig) {
    this.config = config || getSMSConfig();
  }

  async sendFollowUpTaskSMS(
    task: FollowUpTask,
    clientPhone: string
  ): Promise<SMSSendResult> {
    // 频率限制检查
    const rateLimit = checkRateLimit(clientPhone, 'SMS');
    if (!rateLimit.allowed) {
      logger.warn(`短信发送频率限制`, {
        to: maskPhoneNumber(clientPhone),
        retryAfter: rateLimit.retryAfter,
      });
      return {
        success: false,
        error: `发送过于频繁，请${Math.ceil((rateLimit.retryAfter || 60000) / 1000)}秒后重试`,
      };
    }

    // 验证手机号格式
    if (!isValidPhoneNumber(clientPhone)) {
      logger.warn(`无效的手机号格式`, { phone: maskPhoneNumber(clientPhone) });
      return {
        success: false,
        error: '无效的手机号格式',
      };
    }

    const provider = this.config.provider;

    if (provider === SMSProvider.ALIYUN) {
      logger.warn(
        `[生产环境] 请集成阿里云短信服务来发送跟进任务提醒短信`,
        {
          provider: 'aliyun',
          taskId: task.id,
          to: maskPhoneNumber(clientPhone),
        }
      );
    } else if (provider === SMSProvider.TENCENT) {
      logger.warn(
        `[生产环境] 请集成腾讯云短信服务来发送跟进任务提醒短信`,
        {
          provider: 'tencent',
          taskId: task.id,
          to: maskPhoneNumber(clientPhone),
        }
      );
    } else {
      logger.warn(
        `[生产环境] 请集成真实短信服务来发送跟进任务提醒短信`,
        {
          provider,
          taskId: task.id,
          to: maskPhoneNumber(clientPhone),
        }
      );
    }

    return {
      success: false,
      error: '生产短信服务尚未配置',
    };
  }

  async sendCustomSMS(options: SMSSendOptions): Promise<SMSSendResult> {
    // 频率限制检查
    const rateLimit = checkRateLimit(options.to, 'SMS');
    if (!rateLimit.allowed) {
      logger.warn(`短信发送频率限制`, {
        to: maskPhoneNumber(options.to),
        retryAfter: rateLimit.retryAfter,
      });
      return {
        success: false,
        error: `发送过于频繁，请${Math.ceil((rateLimit.retryAfter || 60000) / 1000)}秒后重试`,
      };
    }

    // 验证手机号格式
    if (!isValidPhoneNumber(options.to)) {
      logger.warn(`无效的手机号格式`, { phone: maskPhoneNumber(options.to) });
      return {
        success: false,
        error: '无效的手机号格式',
      };
    }

    const provider = this.config.provider;

    if (provider === SMSProvider.ALIYUN) {
      logger.warn(
        `[生产环境] 请集成阿里云短信服务来发送自定义短信`,
        {
          provider: 'aliyun',
          contentLength: options.content.length,
          to: maskPhoneNumber(options.to),
        }
      );
    } else if (provider === SMSProvider.TENCENT) {
      logger.warn(
        `[生产环境] 请集成腾讯云短信服务来发送自定义短信`,
        {
          provider: 'tencent',
          contentLength: options.content.length,
          to: maskPhoneNumber(options.to),
        }
      );
    } else {
      logger.warn(
        `[生产环境] 请集成真实短信服务来发送自定义短信`,
        {
          provider,
          contentLength: options.content.length,
          to: maskPhoneNumber(options.to),
        }
      );
    }

    return {
      success: false,
      error: '生产短信服务尚未配置',
    };
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 获取短信服务实例
 */
export function getSMSService() {
  const config = getSMSConfig();
  const isDev =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  // 开发环境默认使用控制台输出
  if (isDev && config.provider === SMSProvider.CONSOLE) {
    return new DevSMSService();
  }

  // 生产环境使用配置的短信服务
  if (
    config.provider === SMSProvider.ALIYUN ||
    config.provider === SMSProvider.TENCENT
  ) {
    if (!validateSMSConfig(config)) {
      logger.warn(`短信服务配置不完整，使用开发环境服务`, {
        provider: config.provider,
      });
      return new DevSMSService();
    }
    return new ProdSMSService(config);
  }

  // 默认使用开发环境服务
  return new DevSMSService();
}

// =============================================================================
// 导出
// =============================================================================

export { DevSMSService, ProdSMSService, getSMSConfig, validateSMSConfig, maskPhoneNumber };
export default getSMSService();
