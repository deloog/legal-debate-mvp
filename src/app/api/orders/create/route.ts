/** @legacy 优先使用 /api/v1/orders/create，此路由保留以向后兼容 */
/**
 * 订单创建API
 * POST /api/orders/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import {
  CreateOrderResponse,
  OrderStatus,
  PaymentMethod,
} from '@/types/payment';
import { createOrder } from '@/lib/order/order-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/orders/create
 * 创建订单
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 获取认证用户（支持 JWT Bearer + Cookie）
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权，请先登录',
          error: 'UNAUTHORIZED',
        } as CreateOrderResponse,
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const {
      membershipTierId,
      paymentMethod,
      billingCycle = 'MONTHLY',
      autoRenew = false,
      description,
      metadata = {},
    } = body;

    // 验证必填字段
    if (!membershipTierId || typeof membershipTierId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级ID不能为空',
          error: 'MISSING_TIER_ID',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    // 验证支付方式
    if (
      !paymentMethod ||
      !Object.values(PaymentMethod).includes(paymentMethod)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: '支付方式无效，请选择微信支付或支付宝',
          error: 'INVALID_PAYMENT_METHOD',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    // 验证计费周期
    const validBillingCycles = ['MONTHLY', 'QUARTERLY', 'YEARLY', 'LIFETIME'];
    if (!validBillingCycles.includes(billingCycle)) {
      return NextResponse.json(
        {
          success: false,
          message: '计费周期无效',
          error: 'INVALID_BILLING_CYCLE',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    // 查询会员等级信息
    const tier = await prisma.membershipTier.findUnique({
      where: { id: membershipTierId },
    });

    if (!tier) {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级不存在',
          error: 'TIER_NOT_FOUND',
        } as CreateOrderResponse,
        { status: 404 }
      );
    }

    if (!tier.isActive) {
      return NextResponse.json(
        {
          success: false,
          message: '会员等级暂不可用',
          error: 'TIER_INACTIVE',
        } as CreateOrderResponse,
        { status: 400 }
      );
    }

    // 创建订单
    const order = await createOrder({
      userId: authUser.userId,
      membershipTierId,
      paymentMethod,
      billingCycle,
      autoRenew,
      description: description || `开通${tier.displayName}会员`,
      metadata: {
        ...metadata,
        billingCycle,
        autoRenew,
      },
    });

    return NextResponse.json({
      success: true,
      message: '订单创建成功',
      data: {
        orderId: order.id,
        orderNo: order.orderNo,
        amount: Number(order.amount),
        currency: order.currency,
        status: order.status as OrderStatus,
        expiredAt: order.expiredAt,
      },
    } as CreateOrderResponse);
  } catch (error) {
    logger.error('[API] 创建订单失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '创建订单失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      } as CreateOrderResponse,
      { status: 500 }
    );
  }
}
