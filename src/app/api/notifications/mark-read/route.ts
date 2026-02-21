/**
 * 标记通知已读 API
 *
 * POST /api/notifications/mark-read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserNotificationService } from '@/lib/notification/user-notification-service';
import { logger } from '@/lib/logger';

/**
 * POST /api/notifications/mark-read
 * 标记通知为已读
 *
 * Body: { id: string } 或 { ids: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);

    if (!authUser) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ids } = body;

    const service = getUserNotificationService();

    // 批量标记
    if (ids && Array.isArray(ids) && ids.length > 0) {
      let successCount = 0;
      for (const notificationId of ids) {
        const success = await service.markAsRead(
          notificationId,
          authUser.userId
        );
        if (success) successCount++;
      }

      return NextResponse.json({
        success: true,
        data: { markedCount: successCount },
        message: `已标记 ${successCount} 条通知为已读`,
      });
    }

    // 单条标记
    if (!id) {
      return NextResponse.json(
        { error: '缺少 id 或 ids 参数' },
        { status: 400 }
      );
    }

    const success = await service.markAsRead(id, authUser.userId);

    if (!success) {
      return NextResponse.json({ error: '通知不存在或已读' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: '已标记为已读',
    });
  } catch (error) {
    logger.error('标记通知已读失败:', error);
    return NextResponse.json({ error: '标记通知已读失败' }, { status: 500 });
  }
}
