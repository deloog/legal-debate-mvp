/**
 * 合同邮件服务
 * 支持发送合同PDF、签署提醒、签署确认等邮件
 */

import nodemailer from 'nodemailer';
import * as path from 'path';
import { prisma } from '@/lib/db/prisma';
import { generateContractPDF } from '../contract/contract-pdf-generator';

/**
 * 发送合同邮件输入参数
 */
export interface SendContractEmailInput {
  contractId: string;
  recipientEmail: string;
  recipientName: string;
  subject?: string;
  message?: string;
  attachPDF?: boolean;
}

/**
 * 邮件发送结果
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 合同邮件服务类
 */
export class ContractEmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // 创建邮件传输器
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.example.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * 发送合同邮件
   * @param input 邮件参数
   * @returns 发送结果
   */
  async sendContract(input: SendContractEmailInput): Promise<EmailSendResult> {
    try {
      // 获取合同信息
      const contract = await prisma.contract.findUnique({
        where: { id: input.contractId },
      });

      if (!contract) {
        return {
          success: false,
          error: '合同不存在',
        };
      }

      // 生成PDF（如果需要附件）
      let pdfPath: string | undefined;
      if (input.attachPDF !== false) {
        pdfPath = await generateContractPDF(input.contractId);
      }

      // 生成邮件内容
      const emailHtml = this.generateContractEmailTemplate({
        recipientName: input.recipientName,
        contractNumber: contract.contractNumber,
        clientName: contract.clientName,
        caseType: contract.caseType,
        totalFee: Number(contract.totalFee),
        lawFirmName: contract.lawFirmName,
        lawyerName: contract.lawyerName,
        message: input.message,
        contractId: input.contractId,
      });

      // 准备邮件选项
      const mailOptions: nodemailer.SendMailOptions = {
        from: `${process.env.SMTP_FROM_NAME || '律伴律师事务所'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: input.recipientEmail,
        subject: input.subject || `【律伴】委托合同 - ${contract.contractNumber}`,
        html: emailHtml,
      };

      // 添加PDF附件
      if (pdfPath) {
        const absolutePath = path.join(process.cwd(), 'public', pdfPath);
        mailOptions.attachments = [
          {
            filename: `合同-${contract.contractNumber}.pdf`,
            path: absolutePath,
          },
        ];
      }

      // 发送邮件
      const info = await this.transporter.sendMail(mailOptions);

      console.log(`[ContractEmail] 邮件发送成功: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('[ContractEmail] 邮件发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      };
    }
  }

  /**
   * 发送签署提醒邮件
   * @param contractId 合同ID
   * @returns 发送结果
   */
  async sendSignatureReminder(contractId: string): Promise<EmailSendResult> {
    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        return {
          success: false,
          error: '合同不存在',
        };
      }

      if (!contract.clientContact) {
        return {
          success: false,
          error: '客户联系方式不存在',
        };
      }

      const emailHtml = this.generateSignatureReminderTemplate({
        clientName: contract.clientName,
        contractNumber: contract.contractNumber,
        caseType: contract.caseType,
        lawFirmName: contract.lawFirmName,
        lawyerName: contract.lawyerName,
        contractId,
      });

      const mailOptions: nodemailer.SendMailOptions = {
        from: `${process.env.SMTP_FROM_NAME || '律伴律师事务所'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: contract.clientContact,
        subject: `【律伴】合同签署提醒 - ${contract.contractNumber}`,
        html: emailHtml,
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`[ContractEmail] 签署提醒发送成功: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('[ContractEmail] 签署提醒发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      };
    }
  }

  /**
   * 发送签署确认邮件
   * @param contractId 合同ID
   * @returns 发送结果
   */
  async sendSignatureConfirmation(contractId: string): Promise<EmailSendResult> {
    try {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
      });

      if (!contract) {
        return {
          success: false,
          error: '合同不存在',
        };
      }

      if (!contract.clientContact) {
        return {
          success: false,
          error: '客户联系方式不存在',
        };
      }

      // 生成已签署的PDF
      const pdfPath = await generateContractPDF(contractId);
      const absolutePath = path.join(process.cwd(), 'public', pdfPath);

      const emailHtml = this.generateSignatureConfirmationTemplate({
        clientName: contract.clientName,
        contractNumber: contract.contractNumber,
        caseType: contract.caseType,
        lawFirmName: contract.lawFirmName,
        lawyerName: contract.lawyerName,
        signedAt: contract.signedAt || new Date(),
      });

      const mailOptions: nodemailer.SendMailOptions = {
        from: `${process.env.SMTP_FROM_NAME || '律伴律师事务所'} <${process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER}>`,
        to: contract.clientContact,
        subject: `【律伴】合同签署成功 - ${contract.contractNumber}`,
        html: emailHtml,
        attachments: [
          {
            filename: `合同-${contract.contractNumber}.pdf`,
            path: absolutePath,
          },
        ],
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`[ContractEmail] 签署确认发送成功: ${info.messageId}`);

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      console.error('[ContractEmail] 签署确认发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '发送失败',
      };
    }
  }

  /**
   * 生成合同邮件模板
   */
  private generateContractEmailTemplate(data: {
    recipientName: string;
    contractNumber: string;
    clientName: string;
    caseType: string;
    totalFee: number;
    lawFirmName: string;
    lawyerName: string;
    message?: string;
    contractId: string;
  }): string {
    const viewUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contracts/${data.contractId}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .info-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .info-row { display: flex; padding: 10px 0; border-bottom: 1px solid #eee; }
    .info-label { font-weight: bold; width: 120px; color: #666; }
    .info-value { flex: 1; color: #333; }
    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">📄 委托合同</h1>
      <p style="margin: 10px 0 0 0;">${data.lawFirmName}</p>
    </div>

    <div class="content">
      <p>尊敬的 ${data.recipientName}：</p>

      <p>您好！感谢您选择${data.lawFirmName}为您提供法律服务。</p>

      ${data.message ? `<p>${data.message}</p>` : ''}

      <div class="info-box">
        <h3 style="margin-top: 0; color: #667eea;">合同信息</h3>
        <div class="info-row">
          <div class="info-label">合同编号：</div>
          <div class="info-value">${data.contractNumber}</div>
        </div>
        <div class="info-row">
          <div class="info-label">委托人：</div>
          <div class="info-value">${data.clientName}</div>
        </div>
        <div class="info-row">
          <div class="info-label">案件类型：</div>
          <div class="info-value">${data.caseType}</div>
        </div>
        <div class="info-row">
          <div class="info-label">律师费用：</div>
          <div class="info-value">¥${data.totalFee.toFixed(2)}</div>
        </div>
        <div class="info-row" style="border-bottom: none;">
          <div class="info-label">承办律师：</div>
          <div class="info-value">${data.lawyerName}</div>
        </div>
      </div>

      <p>请查看附件中的合同PDF文件，或点击下方按钮在线查看：</p>

      <div style="text-align: center;">
        <a href="${viewUrl}" class="button">📋 在线查看合同</a>
      </div>

      <p style="margin-top: 30px; padding: 15px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
        <strong>温馨提示：</strong><br>
        如有任何疑问，请随时联系您的承办律师 ${data.lawyerName}。
      </p>
    </div>

    <div class="footer">
      <p>${data.lawFirmName}</p>
      <p>本邮件由系统自动发送，请勿直接回复</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * 生成签署提醒邮件模板
   */
  private generateSignatureReminderTemplate(data: {
    clientName: string;
    contractNumber: string;
    caseType: string;
    lawFirmName: string;
    lawyerName: string;
    contractId: string;
  }): string {
    const signUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/contracts/${data.contractId}/sign`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .button { display: inline-block; padding: 15px 40px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-size: 16px; font-weight: bold; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✍️ 合同签署提醒</h1>
    </div>

    <div class="content">
      <p>尊敬的 ${data.clientName}：</p>

      <p>您的委托合同（编号：${data.contractNumber}）已准备就绪，请尽快完成签署。</p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${signUrl}" class="button">🖊️ 立即签署合同</a>
      </div>

      <p style="padding: 15px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
        <strong>案件信息：</strong><br>
        案件类型：${data.caseType}<br>
        承办律师：${data.lawyerName}
      </p>
    </div>

    <div class="footer">
      <p>${data.lawFirmName}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * 生成签署确认邮件模板
   */
  private generateSignatureConfirmationTemplate(data: {
    clientName: string;
    contractNumber: string;
    caseType: string;
    lawFirmName: string;
    lawyerName: string;
    signedAt: Date;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .success-icon { font-size: 60px; text-align: center; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0;">✅ 合同签署成功</h1>
    </div>

    <div class="content">
      <div class="success-icon">🎉</div>

      <p>尊敬的 ${data.clientName}：</p>

      <p>恭喜！您的委托合同（编号：${data.contractNumber}）已成功签署。</p>

      <p style="padding: 15px; background: #e8f5e9; border-left: 4px solid #4caf50; border-radius: 4px;">
        <strong>签署信息：</strong><br>
        签署时间：${new Date(data.signedAt).toLocaleString('zh-CN')}<br>
        案件类型：${data.caseType}<br>
        承办律师：${data.lawyerName}
      </p>

      <p>已签署的合同PDF文件已作为附件发送给您，请妥善保管。</p>

      <p>我们将竭诚为您提供优质的法律服务，如有任何疑问，请随时联系您的承办律师。</p>
    </div>

    <div class="footer">
      <p>${data.lawFirmName}</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }
}

// 导出单例
export const contractEmailService = new ContractEmailService();
