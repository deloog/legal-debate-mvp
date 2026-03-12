/**
 * 邮件服务模块
 *
 * 提供邮件发送功能，支持跟进任务提醒、法庭日程提醒等。
 * 开发环境使用控制台输出，生产环境可集成SMTP或邮件服务API。
 * 
 * 安全特性：
 * - 发送频率限制（每小时最多20封）
 * - 敏感信息脱敏（日志中邮箱部分隐藏）
 * - 防邮件注入攻击
 */

import {
  EmailSendOptions,
  EmailSendResult,
  EmailTemplate,
} from '@/types/notification';
import { FollowUpTask } from '@/types/client';
import { logger } from '@/lib/logger';
import { checkRateLimit } from './rate-limiter';

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 脱敏邮箱地址（用于日志）
 * user@example.com -> u***@example.com
 */
function maskEmailAddress(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return email;
  
  const local = email.substring(0, atIndex);
  const domain = email.substring(atIndex);
  
  if (local.length <= 2) {
    return '*'.repeat(local.length) + domain;
  }
  
  return local.charAt(0) + '*'.repeat(local.length - 2) + local.charAt(local.length - 1) + domain;
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  // 基本邮箱格式验证
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * 防邮件头部注入攻击
 * 检查邮件地址和主题是否包含换行符
 */
function containsInjectionAttack(value: string): boolean {
  const injectionChars = ['\n', '\r', '\0'];
  return injectionChars.some(char => value.includes(char));
}

/**
 * 验证邮件发送选项
 */
function validateEmailOptions(options: EmailSendOptions): { valid: boolean; error?: string } {
  // 检查收件人
  const toEmails = Array.isArray(options.to) ? options.to : [options.to];
  
  for (const email of toEmails) {
    if (!isValidEmail(email)) {
      return { valid: false, error: `无效的收件人邮箱: ${email}` };
    }
    if (containsInjectionAttack(email)) {
      return { valid: false, error: '检测到非法字符' };
    }
  }

  // 检查主题
  if (options.subject && containsInjectionAttack(options.subject)) {
    return { valid: false, error: '邮件主题包含非法字符' };
  }

  // 检查抄送
  if (options.cc) {
    const ccEmails = Array.isArray(options.cc) ? options.cc : [options.cc];
    for (const email of ccEmails) {
      if (!isValidEmail(email)) {
        return { valid: false, error: `无效的抄送邮箱: ${email}` };
      }
      if (containsInjectionAttack(email)) {
        return { valid: false, error: '抄送地址包含非法字符' };
      }
    }
  }

  // 检查密送
  if (options.bcc) {
    const bccEmails = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
    for (const email of bccEmails) {
      if (!isValidEmail(email)) {
        return { valid: false, error: `无效的密送邮箱: ${email}` };
      }
      if (containsInjectionAttack(email)) {
        return { valid: false, error: '密送地址包含非法字符' };
      }
    }
  }

  return { valid: true };
}

// =============================================================================
// 邮件模板
// =============================================================================

/**
 * 获取跟进任务提醒邮件模板
 */
function getFollowUpTaskTemplate(
  task: FollowUpTask,
  clientEmail: string
): EmailTemplate {
  const formattedDate = task.dueDate.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  const priorityText =
    task.priority === 'HIGH'
      ? '高优先级'
      : task.priority === 'MEDIUM'
        ? '中优先级'
        : '低优先级';

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

  const textContent = `
您好，

您有一个${priorityText}的客户跟进任务即将到期：

客户：${task.clientName}
联系方式：${clientEmail}
跟进方式：${typeText}
任务摘要：${task.summary}
截止日期：${formattedDate}

请及时跟进。

如有疑问，请联系客服。

---
律伴助手
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>跟进任务提醒</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
    <h2 style="color: #4a90e2; margin-top: 0;">跟进任务提醒</h2>
    <p>您好，</p>
    <p>您有一个<span style="color: ${task.priority === 'HIGH' ? '#e74c3c' : '#4a90e2'}; font-weight: bold;">${priorityText}</span>的客户跟进任务即将到期：</p>
    
    <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>客户：</strong>${task.clientName}</p>
      <p style="margin: 5px 0;"><strong>联系方式：</strong>${clientEmail}</p>
      <p style="margin: 5px 0;"><strong>跟进方式：</strong>${typeText}</p>
      <p style="margin: 5px 0;"><strong>任务摘要：</strong>${task.summary}</p>
      <p style="margin: 5px 0;"><strong>截止日期：</strong>${formattedDate}</p>
    </div>
    
    <p>请及时跟进。</p>
    <p>如有疑问，请联系客服。</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="font-size: 12px; color: #999; margin-bottom: 0;">律伴助手</p>
  </div>
</body>
</html>
  `.trim();

  return {
    id: 'follow-up-reminder',
    name: '跟进任务提醒',
    subject: '律伴助手 - 跟进任务提醒',
    content: textContent,
    textContent,
    htmlContent,
    variables: [],
  };
}

// =============================================================================
// 开发环境邮件服务
// =============================================================================

/**
 * 开发环境邮件服务实现（控制台输出）
 */
class DevEmailService {
  private isDevEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    );
  }

  private logEmail(options: EmailSendOptions): void {
    const toStr = Array.isArray(options.to)
      ? options.to.map(maskEmailAddress).join(', ')
      : maskEmailAddress(options.to);
    
    logger.info('\n' + '='.repeat(60));
    logger.info('📧 邮件发送（开发环境）');
    logger.info('='.repeat(60));
    logger.info(`收件人: ${toStr}`);
    logger.info(`主题: ${options.subject}`);
    if (options.cc) {
      const ccStr = Array.isArray(options.cc)
        ? options.cc.map(maskEmailAddress).join(', ')
        : maskEmailAddress(options.cc);
      logger.info(`抄送: ${ccStr}`);
    }
    if (options.bcc) {
      const bccStr = Array.isArray(options.bcc)
        ? options.bcc.map(maskEmailAddress).join(', ')
        : maskEmailAddress(options.bcc);
      logger.info(`密送: ${bccStr}`);
    }
    logger.info('-'.repeat(60));
    logger.info('内容（纯文本）：');
    logger.info(options.text || options.content);
    if (options.html) {
      logger.info('-'.repeat(60));
      logger.info('内容（HTML）：');
      logger.info(options.html.substring(0, 500) + '...');
    }
    logger.info('='.repeat(60) + '\n');
  }

  async sendFollowUpTaskEmail(
    task: FollowUpTask,
    clientEmail: string
  ): Promise<EmailSendResult> {
    // 频率限制检查（每小时20封）
    const rateLimit = checkRateLimit(clientEmail, 'EMAIL', { maxRequests: 20 });
    if (!rateLimit.allowed) {
      logger.warn(`邮件发送频率限制`, {
        to: maskEmailAddress(clientEmail),
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
        error: '非开发环境，请使用生产邮件服务',
      };
    }

    // 验证邮箱格式
    if (!isValidEmail(clientEmail)) {
      logger.warn(`无效的邮箱格式`, { email: maskEmailAddress(clientEmail) });
      return {
        success: false,
        error: '无效的邮箱格式',
      };
    }

    const template = getFollowUpTaskTemplate(task, clientEmail);

    const options: EmailSendOptions = {
      to: clientEmail,
      subject: template.subject,
      content: template.content,
      text: template.textContent,
      html: template.htmlContent,
    };

    this.logEmail(options);

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      devMessage: `[开发模式] 邮件已发送到控制台，收件人：${maskEmailAddress(clientEmail)}，任务：${task.summary}`,
    };
  }

  async sendCustomEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    // 验证邮件选项
    const validation = validateEmailOptions(options);
    if (!validation.valid) {
      logger.warn(`邮件验证失败`, { error: validation.error });
      return {
        success: false,
        error: validation.error,
      };
    }

    // 频率限制检查（使用第一个收件人作为限制键）
    const primaryEmail = Array.isArray(options.to) ? options.to[0] : options.to;
    const rateLimit = checkRateLimit(primaryEmail, 'EMAIL', { maxRequests: 20 });
    if (!rateLimit.allowed) {
      logger.warn(`邮件发送频率限制`, {
        to: maskEmailAddress(primaryEmail),
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
        error: '非开发环境，请使用生产邮件服务',
      };
    }

    this.logEmail(options);

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      devMessage: `[开发模式] 邮件已发送到控制台，收件人：${maskEmailAddress(primaryEmail)}，主题：${options.subject}`,
    };
  }
}

// =============================================================================
// 生产环境邮件服务占位符
// =============================================================================

/**
 * 生产环境邮件服务占位符
 *
 * 实际生产环境应该集成真实的邮件服务（如SMTP、SendGrid、Mailgun等）
 * 此处仅作为占位符，需要根据实际邮件服务商进行实现
 */
class ProdEmailService {
  async sendFollowUpTaskEmail(
    task: FollowUpTask,
    clientEmail: string
  ): Promise<EmailSendResult> {
    // 频率限制检查
    const rateLimit = checkRateLimit(clientEmail, 'EMAIL', { maxRequests: 20 });
    if (!rateLimit.allowed) {
      logger.warn(`邮件发送频率限制`, {
        to: maskEmailAddress(clientEmail),
        retryAfter: rateLimit.retryAfter,
      });
      return {
        success: false,
        error: `发送过于频繁，请${Math.ceil((rateLimit.retryAfter || 60000) / 1000)}秒后重试`,
      };
    }

    // 验证邮箱格式
    if (!isValidEmail(clientEmail)) {
      logger.warn(`无效的邮箱格式`, { email: maskEmailAddress(clientEmail) });
      return {
        success: false,
        error: '无效的邮箱格式',
      };
    }

    logger.warn(
      `[生产环境] 请集成真实邮件服务来发送跟进任务提醒邮件`,
      {
        to: maskEmailAddress(clientEmail),
        taskId: task.id,
      }
    );

    return {
      success: false,
      error: '生产邮件服务尚未配置',
    };
  }

  async sendCustomEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    // 验证邮件选项
    const validation = validateEmailOptions(options);
    if (!validation.valid) {
      logger.warn(`邮件验证失败`, { error: validation.error });
      return {
        success: false,
        error: validation.error,
      };
    }

    // 频率限制检查
    const primaryEmail = Array.isArray(options.to) ? options.to[0] : options.to;
    const rateLimit = checkRateLimit(primaryEmail, 'EMAIL', { maxRequests: 20 });
    if (!rateLimit.allowed) {
      logger.warn(`邮件发送频率限制`, {
        to: maskEmailAddress(primaryEmail),
        retryAfter: rateLimit.retryAfter,
      });
      return {
        success: false,
        error: `发送过于频繁，请${Math.ceil((rateLimit.retryAfter || 60000) / 1000)}秒后重试`,
      };
    }

    logger.warn(
      `[生产环境] 请集成真实邮件服务来发送自定义邮件`,
      {
        to: maskEmailAddress(primaryEmail),
        contentLength: options.content.length,
      }
    );

    return {
      success: false,
      error: '生产邮件服务尚未配置',
    };
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 获取邮件服务实例
 */
export function getEmailService() {
  const isDev =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  if (isDev) {
    return new DevEmailService();
  }

  return new ProdEmailService();
}

// =============================================================================
// 导出
// =============================================================================

export { DevEmailService, ProdEmailService, maskEmailAddress, isValidEmail };
export default getEmailService();
