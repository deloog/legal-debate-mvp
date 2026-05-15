/**
 * 申请发票API
 * POST /api/invoices/apply - 申请发票
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { InvoiceType } from '@/types/payment';
import { applyInvoice } from '@/lib/invoice/invoice-service';
import { validateInvoiceFields } from '@/lib/invoice/invoice-utils';
import { logger } from '@/lib/logger';

/**
 * POST /api/invoices/apply
 * 申请发票
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权，请先登录',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 获取请求体
    const body = await request.json();
    const { orderId, type, title, taxNumber, email } = body;

    // 验证必填字段
    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          message: '订单ID不能为空',
          error: 'INVALID_ORDER_ID',
        },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        {
          success: false,
          message: '发票类型不能为空',
          error: 'INVALID_TYPE',
        },
        { status: 400 }
      );
    }

    // 验证发票类型
    const validTypes = ['PERSONAL', 'ENTERPRISE'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: '发票类型无效',
          error: 'INVALID_TYPE',
        },
        { status: 400 }
      );
    }

    // 验证发票字段
    const validation = validateInvoiceFields(
      type as InvoiceType,
      title,
      taxNumber,
      email
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          message: validation.errors.join('; '),
          error: 'INVALID_FIELDS',
        },
        { status: 400 }
      );
    }

    // 申请发票
    const invoice = await applyInvoice({
      userId: authUser.userId,
      orderId,
      type: type as InvoiceType,
      title,
      taxNumber,
      email,
    });

    return NextResponse.json({
      success: true,
      message: '发票申请成功，正在生成中',
      data: invoice,
    });
  } catch (error) {
    logger.error('[API] 申请发票失败:', error);

    const errorMessage =
      error instanceof Error ? error.message : '申请发票失败，请稍后重试';

    // 根据错误信息返回不同的状态码
    if (errorMessage.includes('不存在')) {
      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
          error: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    if (errorMessage.includes('无权')) {
      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
          error: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    if (errorMessage.includes('已申请过发票')) {
      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
          error: 'ALREADY_APPLIED',
        },
        { status: 409 }
      );
    }

    if (
      errorMessage.includes('未支付') ||
      errorMessage.includes('无效') ||
      errorMessage.includes('不能为空')
    ) {
      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
          error: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        message: errorMessage,
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
