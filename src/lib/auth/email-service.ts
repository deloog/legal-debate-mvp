/**
 * 邮件服务模块
 *
 * 提供邮件发送功能：
 * - 开发环境：控制台输出
 * - 生产环境：SMTP 发送（nodemailer）
 *
 * 配置（环境变量）：
 * - SMTP_HOST: SMTP 服务器地址
 * - SMTP_PORT: SMTP 端口（默认 587）
 * - SMTP_USER: SMTP 用户名
 * - SMTP_PASS: SMTP 密码
 * - EMAIL_FROM: 发件人地址
 */

import { logger } from '@/lib/logger';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import type {
  EmailSendOptions,
  EmailSendResult,
  EmailTemplate,
  IEmailService,
} from '@/types/password-reset';

// =============================================================================
// 邮件模板
// =============================================================================

/**
 * 获取密码重置邮件模板
 */
function getPasswordResetTemplate(
  code: string,
  expiresAt: Date
): EmailTemplate {
  const formattedDate = expiresAt.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const textContent = `
您好，

您收到了一封密码重置邮件。

您的验证码是：${code}

验证码将在 ${formattedDate} 过期。

如果您没有请求密码重置，请忽略此邮件。

---
律伴助手
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>密码重置</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
    <h2 style="color: #4a90e2; margin-top: 0;">密码重置</h2>
    <p>您好，</p>
    <p>您收到了一封密码重置邮件。</p>
    <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; font-size: 18px; color: #4a90e2;">验证码</p>
      <p style="margin: 10px 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4a90e2;">${code}</p>
    </div>
    <p>验证码将在 <strong>${formattedDate}</strong> 过期。</p>
    <p>如果您没有请求密码重置，请忽略此邮件。</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="font-size: 12px; color: #999; margin-bottom: 0;">律伴助手</p>
  </div>
</body>
</html>
  `.trim();

  return {
    subject: '律伴助手 - 密码重置',
    textContent,
    htmlContent,
  };
}

/**
 * 获取邮箱验证邮件模板
 */
function getEmailVerificationTemplate(
  code: string,
  expiresAt: Date
): EmailTemplate {
  const formattedDate = expiresAt.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const textContent = `
您好，

欢迎使用律伴助手。

您的邮箱验证码是：${code}

验证码将在 ${formattedDate} 过期。

---
律伴助手
  `.trim();

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>邮箱验证</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
    <h2 style="color: #4a90e2; margin-top: 0;">邮箱验证</h2>
    <p>您好，</p>
    <p>欢迎使用律伴助手。</p>
    <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; font-size: 18px; color: #4a90e2;">验证码</p>
      <p style="margin: 10px 0; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #4a90e2;">${code}</p>
    </div>
    <p>验证码将在 <strong>${formattedDate}</strong> 过期。</p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="font-size: 12px; color: #999; margin-bottom: 0;">律伴助手</p>
  </div>
</body>
</html>
  `.trim();

  return {
    subject: '律伴助手 - 邮箱验证',
    textContent,
    htmlContent,
  };
}

// =============================================================================
// 开发环境邮件服务
// =============================================================================

/**
 * 开发环境邮件服务实现（控制台输出）
 */
class DevEmailService implements IEmailService {
  private isDevEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
    );
  }

  private logEmail(options: EmailSendOptions): void {
    logger.info('\n' + '='.repeat(60));
    logger.info('📧 邮件发送（开发环境）');
    logger.info('='.repeat(60));
    logger.info(`收件人: ${options.to}`);
    logger.info(`主题: ${options.subject}`);
    logger.info('-'.repeat(60));
    logger.info('内容（纯文本）：');
    logger.info(options.text);
    if (options.html) {
      logger.info('-'.repeat(60));
      logger.info('内容（HTML）：');
      logger.info(options.html);
    }
    logger.info('='.repeat(60) + '\n');
  }

  async sendPasswordResetEmail(
    email: string,
    code: string,
    expiresAt: Date
  ): Promise<EmailSendResult> {
    if (!this.isDevEnvironment()) {
      return {
        success: false,
        error: '非开发环境，请使用生产邮件服务',
      };
    }

    const template = getPasswordResetTemplate(code, expiresAt);

    const options: EmailSendOptions = {
      to: email,
      subject: template.subject,
      text: template.textContent,
      html: template.htmlContent,
    };

    this.logEmail(options);

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      devMessage: `[开发模式] 邮件已发送到控制台，收件人：${email}，验证码：${code}`,
    };
  }

  async sendVerificationEmail(
    email: string,
    code: string,
    expiresAt: Date
  ): Promise<EmailSendResult> {
    if (!this.isDevEnvironment()) {
      return {
        success: false,
        error: '非开发环境，请使用生产邮件服务',
      };
    }

    const template = getEmailVerificationTemplate(code, expiresAt);

    const options: EmailSendOptions = {
      to: email,
      subject: template.subject,
      text: template.textContent,
      html: template.htmlContent,
    };

    this.logEmail(options);

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      devMessage: `[开发模式] 邮件已发送到控制台，收件人：${email}，验证码：${code}`,
    };
  }

  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
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
      devMessage: `[开发模式] 邮件已发送到控制台，收件人：${options.to}`,
    };
  }
}

// =============================================================================
// 生产环境邮件服务
// =============================================================================

/**
 * 生产环境邮件服务
 *
 * 使用 nodemailer 通过 SMTP 发送邮件
 */
class ProdEmailService implements IEmailService {
  private transporter: Transporter | null = null;
  private initialized: boolean = false;

  /**
   * 初始化 SMTP 传输器
   */
  private async initTransporter(): Promise<boolean> {
    if (this.initialized) {
      return this.transporter !== null;
    }

    this.initialized = true;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      logger.warn(
        '[ProdEmailService] SMTP 配置不完整，请检查 SMTP_HOST, SMTP_USER, SMTP_PASS 环境变量'
      );
      return false;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for others
        auth: {
          user,
          pass,
        },
      });

      // 验证连接
      await this.transporter.verify();
      logger.info('[ProdEmailService] SMTP 连接成功');
      return true;
    } catch (error) {
      logger.error('[ProdEmailService] SMTP 连接失败:', error);
      this.transporter = null;
      return false;
    }
  }

  /**
   * 获取发件人地址
   */
  private getFromAddress(): string {
    return process.env.EMAIL_FROM || '律伴助手 <noreply@legal-debate.com>';
  }

  async sendPasswordResetEmail(
    email: string,
    code: string,
    expiresAt: Date
  ): Promise<EmailSendResult> {
    const ready = await this.initTransporter();

    if (!ready || !this.transporter) {
      logger.warn(
        `[ProdEmailService] SMTP 未配置，无法发送密码重置邮件到 ${email}`
      );
      return {
        success: false,
        error: 'SMTP 服务未配置，请联系管理员',
      };
    }

    const template = getPasswordResetTemplate(code, expiresAt);

    try {
      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: email,
        subject: template.subject,
        text: template.textContent,
        html: template.htmlContent,
      });

      logger.info(`[ProdEmailService] 密码重置邮件已发送: ${email}`, {
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error(`[ProdEmailService] 发送密码重置邮件失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      };
    }
  }

  async sendVerificationEmail(
    email: string,
    code: string,
    expiresAt: Date
  ): Promise<EmailSendResult> {
    const ready = await this.initTransporter();

    if (!ready || !this.transporter) {
      logger.warn(
        `[ProdEmailService] SMTP 未配置，无法发送验证邮件到 ${email}`
      );
      return {
        success: false,
        error: 'SMTP 服务未配置，请联系管理员',
      };
    }

    const template = getEmailVerificationTemplate(code, expiresAt);

    try {
      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: email,
        subject: template.subject,
        text: template.textContent,
        html: template.htmlContent,
      });

      logger.info(`[ProdEmailService] 验证邮件已发送: ${email}`, {
        messageId: info.messageId,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      logger.error(`[ProdEmailService] 发送验证邮件失败:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      };
    }
  }

  /**
   * 发送通用邮件
   */
  async sendEmail(options: EmailSendOptions): Promise<EmailSendResult> {
    const ready = await this.initTransporter();

    if (!ready || !this.transporter) {
      return {
        success: false,
        error: 'SMTP 服务未配置',
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      };
    }
  }
}

// =============================================================================
// 工厂函数
// =============================================================================

/**
 * 检查 SMTP 是否已配置
 */
function isSmtpConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
}

/**
 * 获取邮件服务实例
 *
 * 选择逻辑：
 * 1. 开发/测试环境 → DevEmailService（控制台输出，不发真实邮件）
 * 2. 生产环境 → ProdEmailService
 *
 * 注意：.env 中的占位 SMTP 配置（smtp.example.com 等）不触发真实发送，
 * 开发/测试环境始终使用 DevEmailService。
 */
export function getEmailService(): IEmailService {
  const isDev =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  // EMAIL_MOCK_MODE 支持在生产构建的 standalone 服务器中使用 mock 模式
  // （standalone 构建时 NODE_ENV 被固化为 'production'，无法用 NODE_ENV 区分 E2E 测试环境）
  const isMockMode = process.env.EMAIL_MOCK_MODE === 'true';

  // 开发/测试环境或 mock 模式始终使用控制台输出，不发真实邮件
  if (isDev || isMockMode) {
    return new DevEmailService();
  }

  // 生产环境使用 SMTP 服务
  return new ProdEmailService();
}

/**
 * 获取邮件服务状态
 */
export function getEmailServiceStatus(): {
  type: 'dev' | 'prod';
  smtpConfigured: boolean;
  host?: string;
} {
  const smtpConfigured = isSmtpConfigured();
  const isDev =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  return {
    type: isDev && !smtpConfigured ? 'dev' : 'prod',
    smtpConfigured,
    host: process.env.SMTP_HOST,
  };
}

// =============================================================================
// 导出
// =============================================================================

export { DevEmailService, ProdEmailService };
