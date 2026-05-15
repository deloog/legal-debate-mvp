/**
 * POST /api/contracts/[id]/send-email
 * 发送合同邮件
 */

import { NextRequest, NextResponse } from 'next/server';
import { contractEmailService } from '@/lib/email/contract-email-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import { getContractAccess } from '@/app/api/lib/middleware/contract-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 验证身份
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const { id } = await params;

    const access = await getContractAccess(id, user.userId);
    if (!access.exists) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '合同不存在' } },
        { status: 404 }
      );
    }

    if (!access.canManage) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: '无权访问此合同' },
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    // 验证必填字段及格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!body.recipientEmail || !emailRegex.test(String(body.recipientEmail))) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_EMAIL', message: '收件人邮箱格式不正确' },
        },
        { status: 400 }
      );
    }

    if (!body.recipientName || String(body.recipientName).trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MISSING_NAME', message: '收件人姓名不能为空' },
        },
        { status: 400 }
      );
    }

    if (String(body.recipientName).length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_NAME',
            message: '收件人姓名不能超过100个字符',
          },
        },
        { status: 400 }
      );
    }

    // subject / message 长度限制
    if (body.subject && String(body.subject).length > 200) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_SUBJECT',
            message: '邮件主题不能超过200个字符',
          },
        },
        { status: 400 }
      );
    }
    if (body.message && String(body.message).length > 5000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_MESSAGE',
            message: '邮件正文不能超过5000个字符',
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
          message: '发送邮件失败',
        },
      },
      { status: 500 }
    );
  }
}
