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

// =============================================================================
// GET - 获取跟进提醒统计信息
// =============================================================================

/**
 * GET /api/follow-up-tasks/send-reminders
 * 获取跟进提醒统计信息
 */
export async function GET(request: NextRequest) {
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
    const errorMessage =
      error instanceof Error ? error.message : '获取跟进提醒统计失败';
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
    const errorMessage =
      error instanceof Error ? error.message : '发送跟进提醒失败';
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
