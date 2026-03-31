/** @legacy 优先使用 /api/v1/invoices，此路由保留以向后兼容 */
/**
 * 发票列表API
 * GET /api/invoices - 查询发票列表
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { InvoiceType, InvoiceStatus } from '@/types/payment';
import {
  getUserInvoices,
  getInvoiceStats,
} from '@/lib/invoice/invoice-service';
import { logger } from '@/lib/logger';

/**
 * GET /api/invoices
 * 查询发票列表
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

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId') || undefined;
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = Number.parseInt(searchParams.get('page') || '1', 10);
    const limit = Number.parseInt(searchParams.get('limit') || '20', 10);
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // 验证状态参数
    const validStatuses = [
      'PENDING',
      'PROCESSING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
    ];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          message: '发票状态无效',
          error: 'INVALID_STATUS',
        },
        { status: 400 }
      );
    }

    // 验证类型参数
    const validTypes = ['PERSONAL', 'ENTERPRISE'];
    if (type && !validTypes.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          message: '发票类型无效',
          error: 'INVALID_TYPE',
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
    const validSortFields = ['createdAt', 'updatedAt', 'amount', 'issuedAt'];
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

    // 查询发票列表
    const { invoices, total } = await getUserInvoices(authUser.userId, {
      orderId,
      status: status as InvoiceStatus,
      type: type as InvoiceType,
      page,
      limit,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc',
    });

    // 查询统计信息
    const stats = await getInvoiceStats(authUser.userId);

    return NextResponse.json({
      success: true,
      message: '查询成功',
      data: {
        invoices,
        stats,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error('[API] 查询发票列表失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '查询发票列表失败，请稍后重试',
        error: 'INTERNAL_ERROR',
      },
      { status: 500 }
    );
  }
}
