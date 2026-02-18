import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { ApiError } from '@/app/api/lib/errors/api-error';

/**
 * 完成任务Schema
 */
const completeTaskSchema = z.object({
  actualHours: z.number().nonnegative().max(1000).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * 获取任务ID
 */
function getTaskId(request: NextRequest): string {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const taskId = pathSegments[pathSegments.length - 2];
  if (!taskId || taskId === '[id]') {
    throw new ApiError(400, 'INVALID_TASK_ID', '无效的任务ID');
  }
  return taskId;
}

/**
 * POST /api/tasks/[id]/complete
 * 标记任务为已完成
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const taskId = getTaskId(request);
  const body = await request.json();
  const validatedData = completeTaskSchema.parse(body);

  const existingTask = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
    },
  });

  if (!existingTask) {
    return NextResponse.json(
      { error: '任务不存在', message: '任务不存在' },
      { status: 404 }
    );
  }

  if (existingTask.assignedTo !== authUser.userId) {
    return NextResponse.json(
      { error: '无权操作', message: '只有任务负责人才能标记任务完成' },
      { status: 403 }
    );
  }

  if (existingTask.status === 'COMPLETED') {
    return NextResponse.json(
      { error: '任务已完成', message: '任务已经被标记为完成' },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    status: 'COMPLETED',
    completedAt: new Date(),
  };

  if (validatedData.actualHours !== undefined) {
    updateData.actualHours = validatedData.actualHours;
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: updateData,
    include: {
      case: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
      },
      assignedUser: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
      createdByUser: {
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      },
    },
  });

  const taskDetail = {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as any,
    priority: task.priority as any,
    caseId: task.caseId,
    assignedTo: task.assignedTo,
    createdBy: task.createdBy,
    dueDate: task.dueDate,
    completedAt: task.completedAt,
    deletedAt: task.deletedAt,
    tags: task.tags,
    estimatedHours: task.estimatedHours,
    actualHours: task.actualHours,
    metadata: task.metadata as Record<string, unknown> | null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    case: task.case
      ? {
          id: task.case.id,
          title: task.case.title,
          type: task.case.type,
          status: task.case.status,
        }
      : undefined,
    assignedUser: task.assignedUser
      ? {
          id: task.assignedUser.id,
          name: task.assignedUser.name,
          email: task.assignedUser.email,
          avatar: task.assignedUser.avatar,
        }
      : undefined,
    createdByUser: task.createdByUser
      ? {
          id: task.createdByUser.id,
          name: task.createdByUser.name,
          email: task.createdByUser.email,
          avatar: task.createdByUser.avatar,
        }
      : undefined,
  };

  return createSuccessResponse(taskDetail);
});

/**
 * OPTIONS /api/tasks/[id]/complete
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
