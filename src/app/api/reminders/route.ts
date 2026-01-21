import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/success';
import { reminderService } from '@/lib/notification/reminder-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import {
  CreateReminderInput,
  NotificationChannel,
  ReminderType,
} from '@/types/notification';

const createReminderSchema = z
  .object({
    type: z
      .enum(['COURT_SCHEDULE', 'DEADLINE', 'FOLLOW_UP', 'CUSTOM'], {})
      .optional(),
    title: z.string().min(1, '标题不能为空').max(200),
    message: z.string().max(2000).optional(),
    reminderTime: z.coerce.date(),
    channels: z
      .array(z.enum(['IN_APP', 'EMAIL', 'SMS'], {}))
      .min(1, '至少选择一个通知渠道'),
    relatedType: z.string().optional(),
    relatedId: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .required({ type: true, title: true, reminderTime: true, channels: true });

const queryRemindersSchema = z.object({
  type: z
    .enum(['COURT_SCHEDULE', 'DEADLINE', 'FOLLOW_UP', 'CUSTOM'], {})
    .optional(),
  status: z.enum(['PENDING', 'SENT', 'READ', 'DISMISSED'], {}).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
});

/**
 * GET /api/reminders
 * 获取提醒列表
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const query = queryRemindersSchema.parse(Object.fromEntries(searchParams));

  const result = await reminderService.getReminders({
    userId: authUser.userId,
    type: query.type as ReminderType,
    status: query.status as never,
    startTime: query.startTime,
    endTime: query.endTime,
    page: query.page,
    limit: query.limit,
  });

  return createSuccessResponse(
    { reminders: result.reminders },
    {
      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
        hasNext: (query.page - 1) * query.limit + query.limit < result.total,
        hasPrevious: query.page > 1,
      },
    }
  );
});

/**
 * POST /api/reminders
 * 创建提醒
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const validatedData = createReminderSchema.parse(body);

  const input: CreateReminderInput = {
    userId: authUser.userId,
    type: validatedData.type as ReminderType,
    title: validatedData.title,
    message: validatedData.message,
    reminderTime: validatedData.reminderTime,
    channels: validatedData.channels as NotificationChannel[],
    relatedType: validatedData.relatedType,
    relatedId: validatedData.relatedId,
    metadata: validatedData.metadata,
  };

  const reminder = await reminderService.createReminder(input);

  return createCreatedResponse(reminder);
});

/**
 * OPTIONS /api/reminders
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
