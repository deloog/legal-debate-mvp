/**
 * 订单详情API
 * GET /api/orders/[id] - 获取订单详情
 * PUT /api/orders/[id] - 更新订单
 * DELETE /api/orders/[id] - 删除订单
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getOrder, cancelOrder } from '@/lib/order/order-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/orders/[id]
 * 获取订单详情
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Next.js 15中params是Promise，需要先await
    const { id } = await params;

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
    const order = await getOrder(id);

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
    logger.error('[API] 查询订单详情失败:', error);

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

/**
 * PUT /api/orders/[id]
 * 更新订单（目前只支持取消订单）
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Next.js 15中params是Promise，需要先await
    const { id } = await params;

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

    // 解析请求体
    const body = await request.json();
    const { action, reason } = body;

    // 验证操作类型
    if (action !== 'cancel') {
      return NextResponse.json(
        {
          success: false,
          message: '不支持的订单操作',
          error: 'UNSUPPORTED_ACTION',
        },
        { status: 400 }
      );
    }

    // 查询订单
    const order = await getOrder(id);

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

    // 取消订单
    const updatedOrder = await cancelOrder(id, reason);

    return NextResponse.json({
      success: true,
      message: '订单取消成功',
      data: updatedOrder,
    });
  } catch (error) {
    logger.error('[API] 更新订单失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '更新订单失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}

// 注意：DELETE方法暂未实现，因为Prisma schema中Order模型没有deletedAt字段
// 如果需要软删除功能，需要在schema中添加deletedAt字段
