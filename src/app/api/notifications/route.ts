/**
 * 通知 API 路由
 *
 * GET  /api/notifications - 获取通知列表
 * POST /api/notifications - 创建通知（管理员）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/middleware/auth';
import {
  getUserNotificationService,
  type NotificationFilters,
  type NotificationListOptions,
} from '@/lib/notification/user-notification-service';
import {
  NotificationStatus,
  NotificationType,
  NotificationPriority,
} from '@prisma/client';

/**
 * GET /api/notifications
 * 获取当前用户的通知列表
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const filters: NotificationFilters = {
      userId: authUser.userId,
    };

    const statusParam = searchParams.get('status');
    if (
      statusParam &&
      Object.values(NotificationStatus).includes(
        statusParam as NotificationStatus
      )
    ) {
      filters.status = statusParam as NotificationStatus;
    }

    const typeParam = searchParams.get('type');
    if (
      typeParam &&
      Object.values(NotificationType).includes(typeParam as NotificationType)
    ) {
      filters.type = typeParam as NotificationType;
    }

    const priorityParam = searchParams.get('priority');
    if (
      priorityParam &&
      Object.values(NotificationPriority).includes(
        priorityParam as NotificationPriority
      )
    ) {
      filters.priority = priorityParam as NotificationPriority;
    }

    const options: NotificationListOptions = {
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: Math.min(parseInt(searchParams.get('pageSize') || '20'), 100),
      sortBy:
        (searchParams.get('sortBy') as 'createdAt' | 'priority') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    };

    const service = getUserNotificationService();
    const result = await service.getNotifications(filters, options);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    return NextResponse.json({ error: '获取通知列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/notifications
 * 创建通知（仅管理员）
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    // 检查管理员权限
    const hasAdminRole = await isAdmin(request);
    if (!hasAdminRole) {
      return NextResponse.json({ error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const {
      userId,
      userIds,
      type,
      title,
      content,
      priority,
      link,
      metadata,
      expiresAt,
    } = body;

    if (!type || !title || !content) {
      return NextResponse.json(
        { error: '缺少必要参数: type, title, content' },
        { status: 400 }
      );
    }

    const service = getUserNotificationService();

    // 批量发送
    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      const count = await service.createBulkNotifications(userIds, {
        type,
        title,
        content,
        priority,
        link,
        metadata,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      });

      return NextResponse.json({
        success: true,
        data: { count },
        message: `已向 ${count} 个用户发送通知`,
      });
    }

    // 单用户发送
    if (!userId) {
      return NextResponse.json(
        { error: '缺少 userId 或 userIds 参数' },
        { status: 400 }
      );
    }

    const notification = await service.createNotification({
      userId,
      type,
      title,
      content,
      priority,
      link,
      metadata,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    return NextResponse.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('创建通知失败:', error);
    return NextResponse.json({ error: '创建通知失败' }, { status: 500 });
  }
}
