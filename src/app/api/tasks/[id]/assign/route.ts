import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { ApiError } from '@/app/api/lib/errors/api-error';
import { TaskStatus, TaskPriority } from '@/types/task';
import { reminderGenerator } from '@/lib/notification/reminder-generator';

/**
 * 分配任务Schema
 */
const assignTaskSchema = z.object({
  assignedTo: z.string(),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
 * POST /api/tasks/[id]/assign
 * 分配任务
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
  const validatedData = assignTaskSchema.parse(body);

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

  if (existingTask.createdBy !== authUser.userId) {
    return NextResponse.json(
      { error: '无权操作', message: '您没有权限分配此任务' },
      { status: 403 }
    );
  }

  const assignedUser = await prisma.user.findFirst({
    where: {
      id: validatedData.assignedTo,
      status: 'ACTIVE',
    },
  });

  if (!assignedUser) {
    return NextResponse.json(
      { error: '用户不存在', message: '指定的用户不存在或已被禁用' },
      { status: 404 }
    );
  }

  const updateData: Record<string, unknown> = {
    assignedTo: validatedData.assignedTo,
  };

  if (validatedData.dueDate !== undefined) {
    updateData.dueDate = validatedData.dueDate;
  }
  if (validatedData.priority !== undefined) {
    updateData.priority = validatedData.priority;
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
    status: task.status as unknown as TaskStatus,
    priority: task.priority as unknown as TaskPriority,
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

  // 为任务生成提醒（如果需要的话，可以注释掉或删除）
  // if (task.dueDate) {
  //   reminderGenerator.generateTaskReminders(task.id).catch(error => {
  //     console.error('生成任务提醒失败:', error);
  //   });
  // }

  return createSuccessResponse(taskDetail);
});

/**
 * OPTIONS /api/tasks/[id]/assign
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
