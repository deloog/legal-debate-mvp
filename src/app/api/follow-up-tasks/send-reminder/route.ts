/**
 * 发送跟进任务提醒API
 *
 * POST /api/follow-up-tasks/send-reminder
 * 用于手动触发任务提醒或系统定时任务调用
 */

import { logger } from '@/lib/agent/security/logger';
import {
  createErrorResponse,
  createForbiddenResponse,
  createNotFoundResponse,
  createUnauthorizedResponse,
} from '@/app/api/lib/responses/error-response';
import { FollowUpTaskProcessor } from '@/lib/client/follow-up-task-processor';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { notificationService } from '@/lib/notification/notification-service';
import { FollowUpTaskStatus } from '@/types/client';
import { NotificationChannel } from '@/types/notification';
import { NextRequest, NextResponse } from 'next/server';

// 设置为Cron任务，每小时执行一次
export const dynamic = 'force-dynamic';

/**
 * 发送跟进任务提醒
 */
export async function POST(request: NextRequest) {
  // ─── 认证：仅管理员或系统调用 ────────────────────────────────────────────────
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return createUnauthorizedResponse('未授权');
  }
  const callerDb = await prisma.user.findUnique({
    where: { id: authUser.userId },
    select: { role: true },
  });
  if (callerDb?.role !== 'ADMIN' && callerDb?.role !== 'SUPER_ADMIN') {
    return createForbiddenResponse('权限不足，仅管理员可触发提醒');
  }

  try {
    const body = await request.json();
    const { taskId, forceSend } = body;

    // 如果指定了任务ID，只发送该任务的提醒
    if (taskId) {
      const prismaTask = await prisma.followUpTask.findUnique({
        where: { id: taskId },
        include: { client: true },
      });

      if (!prismaTask) {
        return createNotFoundResponse('任务不存在');
      }

      if (prismaTask.status !== FollowUpTaskStatus.PENDING) {
        return createErrorResponse(
          'INVALID_TASK_STATUS',
          '任务状态不是待处理，无需提醒',
          400
        );
      }

      const task = FollowUpTaskProcessor.toFollowUpTask({
        ...prismaTask,
        clientName: prismaTask.client?.name,
        clientPhone: prismaTask.client?.phone ?? null,
        clientEmail: prismaTask.client?.email ?? null,
      });

      const channels = notificationService.getNotificationChannelsForTask(task);
      const hoursBeforeDue =
        notificationService.getReminderHoursBeforeDue(task);

      const shouldSend =
        forceSend ||
        notificationService.shouldSendReminder(task, hoursBeforeDue);

      if (!shouldSend) {
        return NextResponse.json({
          success: true,
          message: '未到提醒时间',
          taskId: task.id,
        });
      }

      const result = await notificationService.sendFollowUpTaskReminder(
        task,
        channels
      );

      return NextResponse.json({
        success: result.success,
        taskId: task.id,
        channels,
        result,
      });
    }

    // 否则，检查所有待处理任务并发送提醒
    const pendingTasks = await prisma.followUpTask.findMany({
      where: {
        status: FollowUpTaskStatus.PENDING,
      },
      include: {
        client: true,
      },
    });

    const results: Array<{
      taskId: string;
      success: boolean;
      channels: NotificationChannel[];
      shouldSend: boolean;
      reason?: string;
    }> = [];

    for (const pendingTask of pendingTasks) {
      const task = FollowUpTaskProcessor.toFollowUpTask({
        ...pendingTask,
        clientName: pendingTask.client?.name,
        clientPhone: pendingTask.client?.phone ?? null,
        clientEmail: pendingTask.client?.email ?? null,
      });

      const channels = notificationService.getNotificationChannelsForTask(task);
      const hoursBeforeDue =
        notificationService.getReminderHoursBeforeDue(task);
      const shouldSend = notificationService.shouldSendReminder(
        task,
        hoursBeforeDue
      );

      if (!shouldSend) {
        results.push({
          taskId: task.id,
          success: true,
          channels: [NotificationChannel.IN_APP],
          shouldSend: false,
          reason: '未到提醒时间',
        });
        continue;
      }

      const result = await notificationService.sendFollowUpTaskReminder(
        task,
        channels
      );

      results.push({
        taskId: task.id,
        success: result.success,
        channels,
        shouldSend: true,
      });

      // 更新最后提醒时间
      await prisma.followUpTask.update({
        where: { id: task.id },
        data: {
          updatedAt: new Date(),
        },
      });
    }

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    logger.info(`跟进任务提醒批量发送完成: ${successCount}/${totalCount}`, {
      results,
    });

    return NextResponse.json({
      success: true,
      total: totalCount,
      successCount,
      failedCount: totalCount - successCount,
      results,
    });
  } catch (error) {
    logger.error('发送跟进任务提醒失败', error as Error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '发送提醒失败',
        },
      },
      { status: 500 }
    );
  }
}
