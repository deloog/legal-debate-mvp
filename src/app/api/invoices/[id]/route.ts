/**
 * 发票详情API
 * GET /api/invoices/[id] - 查询发票详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getInvoice, cancelInvoice } from '@/lib/invoice/invoice-service';

/**
 * GET /api/invoices/[id]
 * 查询发票详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 获取用户会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权，请先登录',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const invoiceId = params.id;

    // 查询发票详情
    const invoice = await getInvoice(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        {
          success: false,
          message: '发票不存在',
          error: 'NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 验证所有权
    if (invoice.userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          message: '无权访问该发票',
          error: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '查询成功',
      data: invoice,
    });
  } catch (error) {
    console.error('[API] 查询发票详情失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '查询发票详情失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/invoices/[id]
 * 取消发票
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // 获取用户会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权，请先登录',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    const invoiceId = params.id;

    // 获取请求体中的取消原因
    const body = await request.json();
    const reason = body.reason as string | undefined;

    // 取消发票
    const invoice = await cancelInvoice(invoiceId, session.user.id, reason);

    return NextResponse.json({
      success: true,
      message: '取消发票成功',
      data: invoice,
    });
  } catch (error) {
    console.error('[API] 取消发票失败:', error);

    const errorMessage =
      error instanceof Error ? error.message : '取消发票失败，请稍后重试';

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
