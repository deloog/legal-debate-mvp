/**
 * 重新生成发票PDF API
 * POST /api/invoices/[id]/regenerate - 重新生成发票PDF
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { regenerateInvoicePDF } from '@/lib/invoice/invoice-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/invoices/[id]/regenerate
 * 重新生成发票PDF
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    const invoiceId = (await params).id;

    // 重新生成发票PDF
    const filePath = await regenerateInvoicePDF(invoiceId, authUser.userId);

    return NextResponse.json({
      success: true,
      message: '重新生成发票PDF成功',
      data: {
        filePath,
      },
    });
  } catch (error) {
    logger.error('[API] 重新生成发票PDF失败:', error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : '重新生成发票PDF失败，请稍后重试';

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

    if (errorMessage.includes('发票状态不允许')) {
      return NextResponse.json(
        {
          success: false,
          message: errorMessage,
          error: 'INVALID_STATUS',
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
