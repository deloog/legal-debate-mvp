import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createNotFoundResponse,
  createUnauthorizedResponse,
} from '@/app/api/lib/responses/error-response';
import {
  createSuccessResponse,
  createNoContentResponse,
} from '@/app/api/lib/responses/success';
import { FollowUpTaskProcessor } from '@/lib/client/follow-up-task-processor';
import { z } from 'zod';
import { getAuthUser } from '@/lib/middleware/auth';

const completeTaskSchema = z.object({
  notes: z.string().optional(),
});

const updateTaskSchema = z.object({
  type: z.enum(['PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER']).optional(),
  summary: z
    .string()
    .min(2, '摘要至少需要2个字符')
    .max(200, '摘要不能超过200字符')
    .optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/follow-up-tasks/[id]
 * 获取跟进任务详情
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return createUnauthorizedResponse();
    }

    const task = await FollowUpTaskProcessor.getTask(
      (await params).id,
      authUser.userId
    );

    if (!task) {
      return createNotFoundResponse('任务不存在或无权限访问');
    }

    return createSuccessResponse(task);
  }
);

/**
 * PUT /api/follow-up-tasks/[id]
 * 更新跟进任务
 */
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const validatedData = updateTaskSchema.parse(body);

    // 构建更新输入
    const updateInput: {
      type?: import('@/types/client').CommunicationType;
      summary?: string;
      priority?: import('@/types/client').FollowUpTaskPriority;
      dueDate?: Date;
      notes?: string;
    } = {};

    if (validatedData.type) {
      updateInput.type =
        validatedData.type as import('@/types/client').CommunicationType;
    }
    if (validatedData.summary !== undefined) {
      updateInput.summary = validatedData.summary;
    }
    if (validatedData.priority) {
      updateInput.priority =
        validatedData.priority as import('@/types/client').FollowUpTaskPriority;
    }
    if (validatedData.dueDate) {
      updateInput.dueDate = new Date(validatedData.dueDate);
    }
    if (validatedData.notes !== undefined) {
      updateInput.notes = validatedData.notes;
    }

    const task = await FollowUpTaskProcessor.updateTask(
      (await params).id,
      authUser.userId,
      updateInput
    );

    if (!task) {
      return createNotFoundResponse('任务不存在或无权限访问');
    }

    return createSuccessResponse(task);
  }
);

/**
 * PATCH /api/follow-up-tasks/[id]/complete
 * 标记任务为完成
 */
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return createUnauthorizedResponse();
    }

    const body = await request.json();
    const validatedData = completeTaskSchema.parse(body);

    const task = await FollowUpTaskProcessor.completeTask(
      (await params).id,
      authUser.userId,
      validatedData
    );

    if (!task) {
      return createNotFoundResponse('任务不存在或无权限访问');
    }

    return createSuccessResponse(task);
  }
);

/**
 * DELETE /api/follow-up-tasks/[id]
 * 取消跟进任务
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return createUnauthorizedResponse();
    }

    const success = await FollowUpTaskProcessor.cancelTask(
      (await params).id,
      authUser.userId
    );

    if (!success) {
      return createNotFoundResponse('任务不存在或无权限访问');
    }

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/follow-up-tasks/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
