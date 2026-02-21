/**
 * 支付宝订单查询API
 * POST /api/payments/alipay/query
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { getAlipay } from '@/lib/payment/alipay';
import { isPaymentSuccess, isPaymentFailed } from '@/lib/payment/alipay-utils';
import {
  handlePaymentSuccess,
  handlePaymentFailure,
} from '@/lib/order/order-service';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';

/**
 * POST /api/payments/alipay/query
 * 查询支付宝订单
 */
export async function POST(request: NextRequest) {
  try {
    // 获取用户会话
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          success: false,
          message: '未授权',
          error: 'UNAUTHORIZED',
        },
        { status: 401 }
      );
    }

    // 解析请求体
    const body = await request.json();
    const { orderNo, orderId } = body;

    // 验证必填字段
    if (!orderNo && !orderId) {
      return NextResponse.json(
        {
          success: false,
          message: '订单号或订单ID不能为空',
          error: 'MISSING_ORDER_ID',
        },
        { status: 400 }
      );
    }

    // 获取订单号
    let targetOrderNo = orderNo;
    if (!targetOrderNo) {
      // 根据orderId查询订单
      const order = await prisma.order.findUnique({
        where: { id: orderId },
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

      targetOrderNo = order.orderNo;
    }

    // 调用支付宝API查询订单
    try {
      const alipay = getAlipay();
      const queryResponse = await alipay.queryOrder({
        outTradeNo: targetOrderNo,
      });

      // 判断响应是否成功
      if (queryResponse.code !== '10000') {
        logger.error('[API] 支付宝查询订单失败:', queryResponse);
        return NextResponse.json(
          {
            success: false,
            message: queryResponse.msg || '查询订单失败',
            error: 'ALIPAY_ERROR',
          },
          { status: 500 }
        );
      }

      // 查询数据库订单
      const order = await prisma.order.findUnique({
        where: { orderNo: targetOrderNo },
        include: {
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

      // 判断是否需要更新订单状态
      const tradeStatus = queryResponse.tradeStatus;

      // 如果订单已支付但数据库未更新
      if (isPaymentSuccess(tradeStatus) && order.status !== 'PAID') {
        try {
          await handlePaymentSuccess(
            order.id,
            queryResponse.tradeNo,
            queryResponse.tradeNo
          );
          logger.info('[API] 支付宝订单状态更新成功:', targetOrderNo);
        } catch (error) {
          logger.error('[API] 更新支付宝订单状态失败:', error);
        }
      }
      // 如果订单已关闭但数据库未更新
      else if (
        isPaymentFailed(tradeStatus) &&
        order.status !== 'FAILED' &&
        order.status !== 'CANCELLED'
      ) {
        try {
          await handlePaymentFailure(order.id, 'TRADE_CLOSED', '交易已关闭');
          logger.info('[API] 支付宝订单状态更新成功:', targetOrderNo);
        } catch (error) {
          logger.error('[API] 更新支付宝订单状态失败:', error);
        }
      }

      // 返回查询结果
      return NextResponse.json({
        success: true,
        message: '查询成功',
        data: {
          order: {
            id: order.id,
            orderNo: order.orderNo,
            amount: Number(order.amount),
            currency: order.currency,
            status: order.status,
            expiredAt: order.expiredAt,
            paidAt: order.paidAt,
            createdAt: order.createdAt,
            membershipTier: {
              id: order.membershipTier.id,
              name: order.membershipTier.name,
              displayName: order.membershipTier.displayName,
            },
          },
          alipayStatus: tradeStatus,
          alipayTradeNo: queryResponse.tradeNo,
          alipayBuyerId: queryResponse.buyerId,
          alipayBuyerLogonId: queryResponse.buyerLogonId,
        },
      });
    } catch (error) {
      logger.error('[API] 调用支付宝查询失败:', error);
      return NextResponse.json(
        {
          success: false,
          message: '查询订单失败',
          error: 'ALIPAY_ERROR',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('[API] 查询支付宝订单失败:', error);
    return NextResponse.json(
      {
        success: false,
        message: '查询订单失败',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
