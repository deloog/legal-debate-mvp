/**
 * 短信服务模块
 *
 * 提供短信发送功能，支持跟进任务提醒、法庭日程提醒等。
 * 开发环境使用控制台输出，生产环境可集成阿里云短信、腾讯云短信等。
 */

import { SMSSendOptions, SMSSendResult } from '@/types/notification';
import { FollowUpTask } from '@/types/client';
import { logger } from '@/lib/agent/security/logger';

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
    console.log('\n' + '='.repeat(60));
    console.log('📱 短信发送（开发环境）');
    console.log('='.repeat(60));
    console.log(`收件人: ${options.to}`);
    console.log('-'.repeat(60));
    console.log('内容：');
    console.log(options.content);
    if (options.templateCode) {
      console.log('-'.repeat(60));
      console.log(`模板代码: ${options.templateCode}`);
      if (options.templateParams) {
        console.log(`模板参数: ${JSON.stringify(options.templateParams)}`);
      }
    }
    console.log('='.repeat(60) + '\n');
  }

  async sendFollowUpTaskSMS(
    task: FollowUpTask,
    clientPhone: string
  ): Promise<SMSSendResult> {
    if (!this.isDevEnvironment()) {
      return {
        success: false,
        error: '非开发环境，请使用生产短信服务',
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
      devMessage: `[开发模式] 短信已发送到控制台，收件人：${clientPhone}，任务：${task.summary}`,
    };
  }

  async sendCustomSMS(options: SMSSendOptions): Promise<SMSSendResult> {
    if (!this.isDevEnvironment()) {
      return {
        success: false,
        error: '非开发环境，请使用生产短信服务',
      };
    }

    this.logSMS(options);

    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      devMessage: `[开发模式] 短信已发送到控制台，收件人：${options.to}，内容：${options.content.substring(0, 20)}...`,
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
  async sendFollowUpTaskSMS(
    task: FollowUpTask,
    clientPhone: string
  ): Promise<SMSSendResult> {
    logger.warn(
      `[生产环境] 请集成真实短信服务来发送跟进任务提醒短信到 ${clientPhone}`
    );

    return {
      success: false,
      error: '生产短信服务尚未配置',
    };
  }

  async sendCustomSMS(options: SMSSendOptions): Promise<SMSSendResult> {
    logger.warn(
      `[生产环境] 请集成真实短信服务来发送自定义短信到 ${options.to}`
    );

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
  const isDev =
    process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

  if (isDev) {
    return new DevSMSService();
  }

  return new ProdSMSService();
}

// =============================================================================
// 导出
// =============================================================================

export { DevSMSService, ProdSMSService };
export default getSMSService();
