/**
 * 订单取消API
 * POST /api/orders/[id]/cancel
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { cancelOrder, isOrderExpired } from '@/lib/order/order-service';
import { prisma } from '@/lib/db/prisma';

/**
 * POST /api/orders/[id]/cancel
 * 取消订单
 */
export async function POST(
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

    const { id } = params;

    // 验证订单ID
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: '订单ID不能为空',
          error: 'MISSING_ORDER_ID',
        },
        { status: 400 }
      );
    }

    // 查询订单
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        membershipTier: true,
      },
    });

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
          message: '无权操作该订单',
          error: 'FORBIDDEN',
        },
        { status: 403 }
      );
    }

    // 验证订单状态
    const validStatuses = ['PENDING', 'PROCESSING'];
    if (!validStatuses.includes(order.status)) {
      const statusText =
        {
          PAID: '已支付',
          FAILED: '已失败',
          CANCELLED: '已取消',
          REFUNDED: '已退款',
          EXPIRED: '已过期',
        }[order.status] || order.status;

      return NextResponse.json(
        {
          success: false,
          message: `订单${statusText}，无法取消`,
          error: 'INVALID_ORDER_STATUS',
        },
        { status: 400 }
      );
    }

    // 检查订单是否过期
    if (isOrderExpired(order.expiredAt)) {
      return NextResponse.json(
        {
          success: false,
          message: '订单已过期，无法取消',
          error: 'ORDER_EXPIRED',
        },
        { status: 400 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { reason } = body as { reason?: string };

    // 取消订单
    const updatedOrder = await cancelOrder(id, reason);

    return NextResponse.json({
      success: true,
      message: '订单取消成功',
      data: {
        orderId: updatedOrder.id,
        orderNo: updatedOrder.orderNo,
        status: updatedOrder.status,
      },
    });
  } catch (error) {
    console.error('[API] 取消订单失败:', error);

    // 处理已知的错误类型
    if (error instanceof Error) {
      // 订单不存在或状态不允许取消
      if (
        error.message.includes('订单不存在') ||
        error.message.includes('订单状态不允许取消')
      ) {
        return NextResponse.json(
          {
            success: false,
            message: error.message,
            error: 'ORDER_CANCEL_FAILED',
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        message: '取消订单失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
