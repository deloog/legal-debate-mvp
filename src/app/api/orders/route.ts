/** @legacy 优先使用 /api/v1/orders，此路由保留以向后兼容 */
/**
 * 订单列表API
 * GET /api/orders
 */

import { getUserOrders } from '@/lib/order/order-service';
import { Order, OrderStatus } from '@/types/payment';
import { getAuthUser } from '@/lib/middleware/auth';
import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET /api/orders
 * 查询订单列表
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 获取认证用户（支持 JWT Bearer + Cookie）
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

    // 获取查询参数（不接受客户端传入 userId，强制使用认证用户ID）
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const targetUserId = authUser.userId;

    // 验证状态参数
    const validStatuses = [
      'PENDING',
      'PROCESSING',
      'PAID',
      'FAILED',
      'CANCELLED',
      'REFUNDED',
      'EXPIRED',
    ];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: '订单状态无效',
          error: 'INVALID_STATUS',
        },
        { status: 400 }
      );
    }

    // 验证分页参数
    if (page < 1 || page > 1000) {
      return NextResponse.json(
        {
          success: false,
          message: '页码无效',
          error: 'INVALID_PAGE',
        },
        { status: 400 }
      );
    }

    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          success: false,
          message: '每页数量无效',
          error: 'INVALID_LIMIT',
        },
        { status: 400 }
      );
    }

    // 验证排序参数
    const validSortFields = ['createdAt', 'updatedAt', 'amount', 'paidAt'];
    if (!validSortFields.includes(sortBy)) {
      return NextResponse.json(
        {
          success: false,
          message: '排序字段无效',
          error: 'INVALID_SORT_FIELD',
        },
        { status: 400 }
      );
    }

    const validSortOrders = ['asc', 'desc'];
    if (!validSortOrders.includes(sortOrder)) {
      return NextResponse.json(
        {
          success: false,
          message: '排序方向无效',
          error: 'INVALID_SORT_ORDER',
        },
        { status: 400 }
      );
    }

    // 查询订单列表
    const { orders, total } = await getUserOrders(targetUserId, {
      status: status as OrderStatus,
      page,
      limit,
    });

    // 处理排序
    const sortedOrders = [...orders].sort((a, b) => {
      const aVal = a[sortBy as keyof Order];
      const bVal = b[sortBy as keyof Order];

      if (aVal === undefined || bVal === undefined) {
        return 0;
      }

      if (aVal < bVal) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return NextResponse.json({
      success: true,
      message: '查询成功',
      data: {
        orders: sortedOrders,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('[API] 查询订单列表失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '查询订单列表失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
