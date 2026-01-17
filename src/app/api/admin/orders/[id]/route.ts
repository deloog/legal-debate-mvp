/**
 * 订单详情API - 管理员专用
 * 支持查看订单详情、更新订单状态
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import type { OrderStatus } from '@/types/payment';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 订单详情响应数据
 */
interface OrderDetailResponse {
  id: string;
  orderNo: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  userPhone: string | null;
  membershipTierId: string;
  membershipTierName: string;
  membershipTierPrice: number;
  paymentMethod: string;
  status: string;
  amount: number;
  currency: string;
  description: string;
  expiredAt: Date;
  paidAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
  userMemberships: Array<{
    id: string;
    status: string;
    startDate: Date;
    endDate: Date;
    tierName: string;
  }>;
  paymentRecords: Array<{
    id: string;
    paymentMethod: string;
    amount: number;
    status: string;
    transactionId: string | null;
    thirdPartyOrderNo: string | null;
    createdAt: Date;
  }>;
  refundRecords: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string | null;
    createdAt: Date;
  }>;
  invoices: Array<{
    id: string;
    title: string | null;
    status: string;
    amount: number;
    issuedAt: Date | null;
    createdAt: Date;
  }>;
}

/**
 * 更新订单状态请求
 */
interface UpdateOrderStatusRequest {
  status: OrderStatus;
  paidAt?: string;
  failedReason?: string;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 获取订单详情
 */
async function getOrderDetail(
  orderId: string
): Promise<OrderDetailResponse | null> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
        membershipTier: {
          select: {
            id: true,
            name: true,
            displayName: true,
            price: true,
          },
        },
        paymentRecords: {
          orderBy: { createdAt: 'desc' },
        },
        refundRecords: {
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return null;
    }

    // 获取用户的会员信息
    const userMemberships = await prisma.userMembership.findMany({
      where: { userId: order.userId },
      include: {
        tier: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      id: order.id,
      orderNo: order.orderNo,
      userId: order.userId,
      userEmail: order.user.email,
      userName: order.user.name,
      userPhone: order.user.phone,
      membershipTierId: order.membershipTierId,
      membershipTierName: order.membershipTier.displayName,
      membershipTierPrice: order.membershipTier.price.toNumber(),
      paymentMethod: order.paymentMethod,
      status: order.status,
      amount: order.amount.toNumber(),
      currency: order.currency,
      description: order.description,
      expiredAt: order.expiredAt,
      paidAt: order.paidAt,
      failedReason: order.failedReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      metadata: (order.metadata as Record<string, unknown>) ?? {},
      userMemberships: userMemberships.map(membership => ({
        id: membership.id,
        status: membership.status,
        startDate: membership.startDate,
        endDate: membership.endDate,
        tierName: membership.tier.name,
      })),
      paymentRecords: order.paymentRecords.map(record => ({
        id: record.id,
        paymentMethod: record.paymentMethod,
        amount: record.amount.toNumber(),
        status: record.status,
        transactionId: record.transactionId,
        thirdPartyOrderNo: record.thirdPartyOrderNo,
        createdAt: record.createdAt,
      })),
      refundRecords: order.refundRecords.map(record => ({
        id: record.id,
        amount: record.amount.toNumber(),
        status: record.status,
        reason: record.reason,
        createdAt: record.createdAt,
      })),
      invoices: order.invoices.map(invoice => ({
        id: invoice.id,
        title: invoice.title,
        status: invoice.status,
        amount: invoice.amount.toNumber(),
        issuedAt: invoice.issuedAt,
        createdAt: invoice.createdAt,
      })),
    };
  } catch (error) {
    console.error('[API] 获取订单详情失败:', error);
    return null;
  }
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/orders/[id]
 * 获取订单详情（管理员权限）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'order:read');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { id } = params;

    // 获取订单详情
    const order = await getOrderDetail(id);

    if (!order) {
      return notFoundResponse('订单不存在');
    }

    return successResponse(order, '获取订单详情成功');
  } catch (error) {
    console.error('[API] 获取订单详情失败:', error);
    return serverErrorResponse('获取订单详情失败');
  }
}

/**
 * PATCH /api/admin/orders/[id]
 * 更新订单状态（管理员权限）
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<Response> {
  // 验证用户身份
  const user = await getAuthUser(request);
  if (!user) {
    return unauthorizedResponse();
  }

  // 检查权限
  const permissionError = await validatePermissions(request, 'order:write');
  if (permissionError) {
    return permissionError;
  }

  try {
    const { id } = params;
    const body = (await request.json()) as UpdateOrderStatusRequest;

    // 验证订单是否存在
    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      return notFoundResponse('订单不存在');
    }

    // 验证订单状态（使用Prisma中的定义）
    const validStatuses: string[] = [
      'PENDING',
      'PAID',
      'FAILED',
      'CANCELLED',
      'REFUNDED',
      'EXPIRED',
    ];
    if (!validStatuses.includes(body.status)) {
      return Response.json(
        {
          success: false,
          message: '订单状态无效',
          error: 'INVALID_STATUS',
        },
        { status: 400 }
      );
    }

    // 构建更新数据
    const updateData: Record<string, unknown> = {
      status: body.status,
    };

    if (body.paidAt) {
      updateData.paidAt = new Date(body.paidAt);
    }

    if (body.failedReason) {
      updateData.failedReason = body.failedReason;
    }

    // 更新订单
    const updatedOrder = await prisma.order.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
          },
        },
        membershipTier: {
          select: {
            id: true,
            name: true,
            displayName: true,
            price: true,
          },
        },
      },
    });

    console.log('[API] 订单状态已更新:', {
      orderId: id,
      newStatus: body.status,
      updatedBy: user.userId,
    });

    return successResponse(
      {
        id: updatedOrder.id,
        orderNo: updatedOrder.orderNo,
        status: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt,
      },
      '订单状态更新成功'
    );
  } catch (error) {
    console.error('[API] 更新订单状态失败:', error);
    return serverErrorResponse('更新订单状态失败');
  }
}
