/**
 * 订单管理API - 管理员专用
 * 支持分页、筛选、搜索、批量操作
 */

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
} from '@/lib/api-response';
import type { OrderStatus, PaymentMethod } from '@/types/payment';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 订单列表查询参数
 */
interface OrderListQueryParams {
  page?: string;
  limit?: string;
  status?: string;
  paymentMethod?: string;
  userId?: string;
  membershipTierId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
}

/**
 * 订单列表响应数据
 */
interface OrderListResponse {
  orders: Array<{
    id: string;
    orderNo: string;
    userId: string;
    userEmail: string;
    userName: string | null;
    membershipTierId: string;
    membershipTierName: string;
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
  }>;
  summary: {
    total: number;
    paidCount: number;
    paidAmount: number;
    pendingCount: number;
    pendingAmount: number;
    failedCount: number;
    failedAmount: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * 订单统计响应数据
 */
interface OrderStatsResponse {
  totalOrders: number;
  paidOrders: number;
  paidAmount: number;
  pendingOrders: number;
  pendingAmount: number;
  failedOrders: number;
  failedAmount: number;
  cancelledOrders: number;
  refundedOrders: number;
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 验证订单状态枚举值
 */
function isValidOrderStatus(status: string): status is OrderStatus {
  const validStatuses = [
    'PENDING',
    'PAID',
    'FAILED',
    'CANCELLED',
    'REFUNDED',
    'EXPIRED',
  ];
  return validStatuses.includes(status as OrderStatus);
}

/**
 * 验证支付方式枚举值
 */
function isValidPaymentMethod(method: string): method is PaymentMethod {
  const validMethods = ['WECHAT', 'ALIPAY'];
  return validMethods.includes(method as PaymentMethod);
}

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): OrderListQueryParams {
  const url = new URL(request.url);
  return {
    page: url.searchParams.get('page') ?? '1',
    limit: url.searchParams.get('limit') ?? '20',
    status: url.searchParams.get('status') ?? undefined,
    paymentMethod: url.searchParams.get('paymentMethod') ?? undefined,
    userId: url.searchParams.get('userId') ?? undefined,
    membershipTierId: url.searchParams.get('membershipTierId') ?? undefined,
    startDate: url.searchParams.get('startDate') ?? undefined,
    endDate: url.searchParams.get('endDate') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    sortBy: url.searchParams.get('sortBy') ?? 'createdAt',
    sortOrder: url.searchParams.get('sortOrder') ?? 'desc',
  };
}

/**
 * 构建Prisma查询条件
 */
function buildWhereClause(params: OrderListQueryParams) {
  const where: Record<string, unknown> = {};

  // 订单状态筛选
  if (params.status && isValidOrderStatus(params.status)) {
    where.status = params.status;
  }

  // 支付方式筛选
  if (params.paymentMethod && isValidPaymentMethod(params.paymentMethod)) {
    where.paymentMethod = params.paymentMethod;
  }

  // 用户ID筛选
  if (params.userId) {
    where.userId = params.userId;
  }

  // 会员等级筛选
  if (params.membershipTierId) {
    where.membershipTierId = params.membershipTierId;
  }

  // 时间范围筛选
  if (params.startDate && params.endDate) {
    where.createdAt = {
      gte: new Date(params.startDate),
      lte: new Date(params.endDate),
    };
  } else if (params.startDate) {
    where.createdAt = {
      gte: new Date(params.startDate),
    };
  } else if (params.endDate) {
    where.createdAt = {
      lte: new Date(params.endDate),
    };
  }

  // 搜索功能（订单号、用户邮箱）
  if (params.search && params.search.trim() !== '') {
    where.OR = [
      { orderNo: { contains: params.search, mode: 'insensitive' } },
      { user: { email: { contains: params.search, mode: 'insensitive' } } },
    ];
  }

  return where;
}

/**
 * 计算订单统计
 */
async function calculateOrderStats(
  where: Record<string, unknown> | undefined
): Promise<OrderStatsResponse> {
  const [
    totalOrders,
    paidOrders,
    pendingOrders,
    failedOrders,
    cancelledOrders,
    refundedOrders,
  ] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.count({ where: { ...where, status: 'PAID' } }),
    prisma.order.count({ where: { ...where, status: 'PENDING' } }),
    prisma.order.count({ where: { ...where, status: 'FAILED' } }),
    prisma.order.count({ where: { ...where, status: 'CANCELLED' } }),
    prisma.order.count({ where: { ...where, status: 'REFUNDED' } }),
  ]);

  // 计算支付金额
  const [paidAmount, pendingAmount, failedAmount] = await Promise.all([
    prisma.order.aggregate({
      where: { ...where, status: 'PAID' },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: { ...where, status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.order.aggregate({
      where: { ...where, status: 'FAILED' },
      _sum: { amount: true },
    }),
  ]);

  return {
    totalOrders,
    paidOrders,
    paidAmount: paidAmount._sum.amount?.toNumber() ?? 0,
    pendingOrders,
    pendingAmount: pendingAmount._sum.amount?.toNumber() ?? 0,
    failedOrders,
    failedAmount: failedAmount._sum.amount?.toNumber() ?? 0,
    cancelledOrders,
    refundedOrders,
  };
}

// =============================================================================
// API处理函数
// =============================================================================

/**
 * GET /api/admin/orders
 * 获取订单列表（管理员权限）
 */
export async function GET(request: NextRequest): Promise<Response> {
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
    // 解析查询参数
    const params = parseQueryParams(request);
    const page = Math.max(1, Number.parseInt(params.page, 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(params.limit, 10)));
    const skip = (page - 1) * limit;

    // 验证排序参数
    const validSortFields = [
      'createdAt',
      'updatedAt',
      'amount',
      'paidAt',
      'expiredAt',
      'orderNo',
    ];
    const sortBy = validSortFields.includes(params.sortBy ?? 'createdAt')
      ? params.sortBy
      : 'createdAt';

    const validSortOrders = ['asc', 'desc'];
    const sortOrder = validSortOrders.includes(params.sortOrder ?? 'desc')
      ? params.sortOrder
      : 'desc';

    // 构建查询条件
    const where = buildWhereClause(params);

    // 查询订单总数和统计
    const [total, stats] = await Promise.all([
      prisma.order.count({ where }),
      calculateOrderStats(where),
    ]);

    // 查询订单列表
    const orders = await prisma.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        membershipTier: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
        paymentRecords: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    // 构建响应数据
    const responseData: OrderListResponse = {
      orders: orders.map(order => ({
        id: order.id,
        orderNo: order.orderNo,
        userId: order.userId,
        userEmail: order.user.email,
        userName: order.user.name,
        membershipTierId: order.membershipTierId,
        membershipTierName: order.membershipTier.displayName,
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
      })),
      summary: {
        total,
        paidCount: stats.paidOrders,
        paidAmount: stats.paidAmount,
        pendingCount: stats.pendingOrders,
        pendingAmount: stats.pendingAmount,
        failedCount: stats.failedOrders,
        failedAmount: stats.failedAmount,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return successResponse(responseData, '获取订单列表成功');
  } catch (error) {
    console.error('[API] 获取订单列表失败:', error);
    return serverErrorResponse('获取订单列表失败');
  }
}
