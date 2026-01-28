/**
 * 单个通知 API 路由
 *
 * GET    /api/notifications/[id] - 获取通知详情
 * DELETE /api/notifications/[id] - 删除通知
 * PATCH  /api/notifications/[id] - 归档通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserNotificationService } from '@/lib/notification/user-notification-service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/notifications/[id]
 * 获取通知详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const service = getUserNotificationService();
    const notification = await service.getNotificationById(id, authUser.userId);

    if (!notification) {
      return NextResponse.json({ error: '通知不存在' }, { status: 404 });
    }

    // 自动标记为已读
    await service.markAsRead(id, authUser.userId);

    return NextResponse.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    console.error('获取通知详情失败:', error);
    return NextResponse.json({ error: '获取通知详情失败' }, { status: 500 });
  }
}

/**
 * DELETE /api/notifications/[id]
 * 删除通知
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const service = getUserNotificationService();
    const success = await service.deleteNotification(id, authUser.userId);

    if (!success) {
      return NextResponse.json({ error: '通知不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '通知已删除',
    });
  } catch (error) {
    console.error('删除通知失败:', error);
    return NextResponse.json({ error: '删除通知失败' }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications/[id]
 * 归档通知
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const service = getUserNotificationService();

    if (action === 'archive') {
      const success = await service.archiveNotification(id, authUser.userId);

      if (!success) {
        return NextResponse.json({ error: '通知不存在' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: '通知已归档',
      });
    }

    if (action === 'mark-read') {
      const success = await service.markAsRead(id, authUser.userId);

      if (!success) {
        return NextResponse.json(
          { error: '通知不存在或已读' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: '通知已标记为已读',
      });
    }

    return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
  } catch (error) {
    console.error('更新通知失败:', error);
    return NextResponse.json({ error: '更新通知失败' }, { status: 500 });
  }
}
