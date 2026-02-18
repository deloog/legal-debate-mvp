import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
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

/**
 * GET /api/follow-up-tasks/[id]
 * 获取跟进任务详情
 */
export const GET = withErrorHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const task = await FollowUpTaskProcessor.getTask(
      params.id,
      authUser.userId
    );

    if (!task) {
      return NextResponse.json(
        { error: '任务不存在或无权限访问' },
        { status: 404 }
      );
    }

    return createSuccessResponse(task);
  }
);

/**
 * PATCH /api/follow-up-tasks/[id]/complete
 * 标记任务为完成
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
    const validatedData = completeTaskSchema.parse(body);

    const task = await FollowUpTaskProcessor.completeTask(
      params.id,
      authUser.userId,
      validatedData
    );

    if (!task) {
      return NextResponse.json(
        { error: '任务不存在或无权限访问' },
        { status: 404 }
      );
    }

    return createSuccessResponse(task);
  }
);

/**
 * DELETE /api/follow-up-tasks/[id]
 * 取消跟进任务
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

    const success = await FollowUpTaskProcessor.cancelTask(
      params.id,
      authUser.userId
    );

    if (!success) {
      return NextResponse.json(
        { error: '任务不存在或无权限访问' },
        { status: 404 }
      );
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
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
