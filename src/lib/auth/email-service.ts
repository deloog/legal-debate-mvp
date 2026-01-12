/**
 * 邮件服务模块
 *
 * 提供邮件发送功能，开发环境使用控制台输出，
 * 生产环境可集成SMTP或邮件服务API。
 */

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
    console.log('\n' + '='.repeat(60));
    console.log('📧 邮件发送（开发环境）');
    console.log('='.repeat(60));
    console.log(`收件人: ${options.to}`);
    console.log(`主题: ${options.subject}`);
    console.log('-'.repeat(60));
    console.log('内容（纯文本）：');
    console.log(options.text);
    if (options.html) {
      console.log('-'.repeat(60));
      console.log('内容（HTML）：');
      console.log(options.html);
    }
    console.log('='.repeat(60) + '\n');
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
class ProdEmailService implements IEmailService {
  async sendPasswordResetEmail(
    email: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _code: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _expiresAt: Date
  ): Promise<EmailSendResult> {
    // TODO: 集成真实邮件服务
    // 示例：使用nodemailer
    // const transporter = nodemailer.createTransport({ ... });
    // await transporter.sendMail({ ... });

    console.warn(`[生产环境] 请集成真实邮件服务来发送密码重置邮件到 ${email}`);

    return {
      success: false,
      error: '生产邮件服务尚未配置',
    };
  }

  async sendVerificationEmail(
    email: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _code: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _expiresAt: Date
  ): Promise<EmailSendResult> {
    // TODO: 集成真实邮件服务

    console.warn(`[生产环境] 请集成真实邮件服务来发送验证邮件到 ${email}`);

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
export function getEmailService(): IEmailService {
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

export { DevEmailService, ProdEmailService };
