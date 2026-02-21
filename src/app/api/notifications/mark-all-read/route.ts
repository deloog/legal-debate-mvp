/**
 * 标记所有通知已读 API
 *
 * POST /api/notifications/mark-all-read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserNotificationService } from '@/lib/notification/user-notification-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/notifications/mark-all-read
 * 标记所有通知为已读
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const service = getUserNotificationService();
    const count = await service.markAllAsRead(authUser.userId);

    return NextResponse.json({
      success: true,
      data: { markedCount: count },
      message: `已标记 ${count} 条通知为已读`,
    });
  } catch (error) {
    logger.error('标记所有通知已读失败:', error);
    return NextResponse.json(
      { error: '标记所有通知已读失败' },
      { status: 500 }
    );
  }
}
