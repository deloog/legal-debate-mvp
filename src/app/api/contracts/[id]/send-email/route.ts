/**
 * POST /api/contracts/[id]/send-email
 * 发送合同邮件
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractEmailService } from '@/lib/email/contract-email-service';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // 验证必填字段
    if (!body.recipientEmail) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_EMAIL',
            message: '收件人邮箱不能为空',
          },
        },
        { status: 400 }
      );
    }

    if (!body.recipientName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_NAME',
            message: '收件人姓名不能为空',
          },
        },
        { status: 400 }
      );
    }

    // 发送邮件
    const result = await contractEmailService.sendContract({
      contractId: id,
      recipientEmail: body.recipientEmail,
      recipientName: body.recipientName,
      subject: body.subject,
      message: body.message,
      attachPDF: body.attachPDF !== false,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMAIL_SEND_FAILED',
            message: result.error || '邮件发送失败',
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.messageId,
      },
      message: '邮件发送成功',
    });
  } catch (error) {
    logger.error('发送合同邮件失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : '发送邮件失败',
        },
      },
      { status: 500 }
    );
  }
}
