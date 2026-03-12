import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { validatePermissions } from '@/lib/middleware/permission-check';

/**
 * GET /api/admin/memberships/export/history
 * 获取会员导出历史记录（基于MembershipHistory）
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: '未认证',
        },
        { status: 401 }
      );
    }

    // 检查权限 - 使用 membership:read 权限
    const permissionError = await validatePermissions(
      request,
      'membership:read'
    );
    if (permissionError) {
      return permissionError;
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);

    // 获取会员历史变更记录（模拟导出历史）
    const [historyItems, totalCount] = await Promise.all([
      prisma.membershipHistory.findMany({
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.membershipHistory.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: historyItems.map(item => ({
        id: item.id,
        fileName: `membership_history_${item.createdAt.toISOString().slice(0, 10)}.csv`,
        format: 'CSV',
        recordCount: 1,
        filters: {
          userId: item.userId,
          changeType: item.changeType,
        },
        exportedAt: item.createdAt,
        status: 'COMPLETED',
        user: item.user,
      })),
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (error) {
    logger.error('[ExportHistory] 获取导出历史失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取导出历史失败',
      },
      { status: 500 }
    );
  }
}
