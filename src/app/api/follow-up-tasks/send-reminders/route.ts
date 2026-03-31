/**
 * 跟进提醒API端点
 *
 * 提供手动触发跟进提醒和获取统计信息的接口
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  sendFollowUpReminders,
  getFollowUpRemindersStats,
  getTasksExpiringSoon,
  markExpiredFollowUpTasks,
} from '@/lib/cron/send-follow-up-reminders';
import { logger } from '@/lib/agent/security/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';

// =============================================================================
// GET - 获取跟进提醒统计信息
// =============================================================================

/**
 * GET /api/follow-up-tasks/send-reminders
 * 获取跟进提醒统计信息
 */
async function requireAdmin(
  request: NextRequest
): Promise<NextResponse | null> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }
  const dbUser = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (dbUser?.role !== 'ADMIN' && dbUser?.role !== 'SUPER_ADMIN') {
    return NextResponse.json(
      { error: '权限不足，仅管理员可访问' },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(request: NextRequest) {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const searchParams = new URL(request.url).searchParams;
    const action = searchParams.get('action');

    if (action === 'expiring-soon') {
      // 获取即将到期的任务列表
      const hours = parseInt(searchParams.get('hours') || '24', 10);
      const limit = parseInt(searchParams.get('limit') || '20', 10);

      const tasks = await getTasksExpiringSoon(hours, limit);

      return NextResponse.json(
        {
          success: true,
          data: {
            tasks,
            count: tasks.length,
            hours,
            limit,
          },
        },
        { status: 200 }
      );
    }

    // 默认返回统计信息
    const stats = await getFollowUpRemindersStats();

    return NextResponse.json(
      {
        success: true,
        data: stats,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = '获取跟进提醒统计失败';
    logger.error('[API] 获取跟进提醒统计失败:', error as Error as never);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

// =============================================================================
// POST - 手动触发跟进提醒
// =============================================================================

/**
 * POST /api/follow-up-tasks/send-reminders
 * 手动触发跟进提醒发送
 */
export async function POST(request: NextRequest) {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const body = await request.json();
    const action = body.action;

    if (action === 'mark-expired') {
      // 标记已过期的跟进任务
      const result = await markExpiredFollowUpTasks();

      return NextResponse.json(
        {
          success: true,
          message: `已标记 ${result.cancelledCount} 个过期任务`,
          data: result,
        },
        { status: 200 }
      );
    }

    // 默认执行：发送跟进提醒
    const result = await sendFollowUpReminders();

    return NextResponse.json(
      {
        success: true,
        message: `检查了 ${result.totalTasksChecked} 个跟进任务，发送 ${result.tasksWithRemindersSent} 个提醒，失败 ${result.tasksFailedToSend} 个`,
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    const errorMessage = '发送跟进提醒失败';
    logger.error('[API] 发送跟进提醒失败:', error as Error as never);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
