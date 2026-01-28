/**
 * 未读通知数量 API
 *
 * GET /api/notifications/unread-count
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserNotificationService } from '@/lib/notification/user-notification-service';

/**
 * GET /api/notifications/unread-count
 * 获取当前用户的未读通知数量
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const service = getUserNotificationService();
    const count = await service.getUnreadCount(authUser.userId);

    return NextResponse.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('获取未读通知数量失败:', error);
    return NextResponse.json(
      { error: '获取未读通知数量失败' },
      { status: 500 }
    );
  }
}
