import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createNoContentResponse,
} from '@/app/api/lib/responses/success';
import { reminderService } from '@/lib/notification/reminder-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import {
  NotificationChannel,
  ReminderStatus,
  UpdateReminderInput,
} from '@/types/notification';

const updateReminderSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(200).optional(),
  message: z.string().max(2000).optional(),
  reminderTime: z.coerce.date().optional(),
  channels: z.array(z.enum(['IN_APP', 'EMAIL', 'SMS'], {})).optional(),
  status: z.enum(['PENDING', 'SENT', 'READ', 'DISMISSED'], {}).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * PATCH /api/reminders/[id]
 * 更新提醒
 */
export const PATCH = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = updateReminderSchema.parse(body);

    const reminder = await reminderService.updateReminder(
      params.id,
      authUser.userId,
      validatedData as UpdateReminderInput
    );

    return createSuccessResponse(reminder);
  }
);

/**
 * DELETE /api/reminders/[id]
 * 删除提醒
 */
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const success = await reminderService.deleteReminder(
      params.id,
      authUser.userId
    );

    if (!success) {
      return NextResponse.json(
        { error: '删除失败', message: '提醒不存在或无权限' },
        { status: 404 }
      );
    }

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/reminders/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
