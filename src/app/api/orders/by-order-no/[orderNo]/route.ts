/**
 * 通过订单号查询订单API
 * GET /api/orders/by-order-no/[orderNo] - 通过订单号获取订单详情
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getOrderByOrderNo } from '@/lib/order/order-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/orders/by-order-no/[orderNo]
 * 通过订单号获取订单详情
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { orderNo: string } }
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

    const { orderNo } = params;

    // 验证订单号
    if (!orderNo) {
      return NextResponse.json(
        {
          success: false,
          message: '订单号不能为空',
          error: 'MISSING_ORDER_NO',
        },
        { status: 400 }
      );
    }

    // 查询订单
    const order = await getOrderByOrderNo(orderNo);

    if (!order) {
      return NextResponse.json(
        {
          success: false,
          message: '订单不存在',
          error: 'ORDER_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // 验证订单所有权
    if (order.userId !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          message: '无权访问该订单',
          error: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '查询成功',
      data: order,
    });
  } catch (error) {
    logger.error('[API] 通过订单号查询订单失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '查询订单详情失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
