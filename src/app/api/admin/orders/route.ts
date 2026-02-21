/**
 * 订单管理API - 管理员专用
 * 支持分页、筛选、搜索、批量操作
 */

import {
  serverErrorResponse,
  successResponse,
  unauthorizedResponse,
} from '@/lib/api-response';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';
import {
  validateSortBy,
  validateSortOrder,
  validatePagination,
} from '@/lib/validation/query-params';
import type {
  OrderListQueryParams,
  OrderListResponse,
  OrderStatsResponse,
} from '@/types/admin-order';
import type { OrderStatus, PaymentMethod } from '@/types/payment';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';

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
 * 允许的排序字段白名单
 */
const ALLOWED_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'amount',
  'status',
  'paymentMethod',
  'orderNo',
  'expiredAt',
  'paidAt',
] as const;

/**
 * 解析查询参数
 */
function parseQueryParams(request: NextRequest): OrderListQueryParams {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  // 验证分页参数
  const pagination = validatePagination({
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    pageSize: searchParams.get('pageSize'),
  });

  // 验证排序参数
  const sortBy = validateSortBy(
    searchParams.get('sortBy'),
    [...ALLOWED_SORT_FIELDS],
    'createdAt'
  );
  const sortOrder = validateSortOrder(searchParams.get('sortOrder'), 'desc');

  return {
    page: pagination.page.toString(),
    pageSize: pagination.limit.toString(),
    status: searchParams.get('status') ?? undefined,
    paymentMethod: searchParams.get('paymentMethod') ?? undefined,
    userId: searchParams.get('userId') ?? undefined,
    membershipTierId: searchParams.get('membershipTierId') ?? undefined,
    startDate: searchParams.get('startDate') ?? undefined,
    endDate: searchParams.get('endDate') ?? undefined,
    search:
      searchParams.get('search') ?? searchParams.get('keyword') ?? undefined,
    sortBy,
    sortOrder,
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
    const pageSize = Math.min(
      100,
      Math.max(1, Number.parseInt(params.pageSize || params.limit || '20', 10))
    );
    const skip = (page - 1) * pageSize;

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
      take: pageSize,
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
        pageSize,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };

    return successResponse(responseData, '获取订单列表成功');
  } catch (error) {
    logger.error('[API] 获取订单列表失败:', error);
    return serverErrorResponse('获取订单列表失败');
  }
}
