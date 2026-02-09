import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createNoContentResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { ApiError } from '@/app/api/lib/errors/api-error';
import { TaskStatus, TaskPriority } from '@/types/task';
import { reminderGenerator } from '@/lib/notification/reminder-generator';

/**
 * 更新任务Schema
 */
const updateTaskSchema = z.object({
  title: z.string().min(1, '任务标题不能为空').max(200).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  caseId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  tags: z.array(z.string()).optional(),
  estimatedHours: z.number().nonnegative().max(1000).optional(),
  actualHours: z.number().nonnegative().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 获取任务ID
 */
function getTaskId(request: NextRequest): string {
  const url = new URL(request.url);
  const pathSegments = url.pathname.split('/');
  const taskId = pathSegments[pathSegments.length - 1];
  if (!taskId || taskId === '[id]') {
    throw new ApiError(400, 'INVALID_TASK_ID', 'Invalid task ID');
  }
  return taskId;
}

/**
 * GET /api/tasks/[id]
 * 获取任务详情
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const taskId = getTaskId(request);

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      OR: [{ createdBy: authUser.userId }, { assignedTo: authUser.userId }],
    },
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

  if (!task) {
    return NextResponse.json(
      { error: '任务不存在', message: '任务不存在或无权访问' },
      { status: 404 }
    );
  }

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

  return createSuccessResponse(taskDetail);
});

/**
 * PUT /api/tasks/[id]
 * 更新任务
 */
export const PUT = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const taskId = getTaskId(request);
  const body = await request.json();
  const validatedData = updateTaskSchema.parse(body);

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

  if (
    existingTask.createdBy !== authUser.userId &&
    existingTask.assignedTo !== authUser.userId
  ) {
    return NextResponse.json(
      { error: '无权操作', message: '您没有权限更新此任务' },
      { status: 403 }
    );
  }

  const updateData: Record<string, unknown> = {};

  if (validatedData.title !== undefined) {
    updateData.title = validatedData.title;
  }
  if (validatedData.description !== undefined) {
    updateData.description = validatedData.description;
  }
  if (validatedData.status !== undefined) {
    updateData.status = validatedData.status;
  }
  if (validatedData.priority !== undefined) {
    updateData.priority = validatedData.priority;
  }
  if (validatedData.caseId !== undefined) {
    updateData.caseId = validatedData.caseId;
  }
  if (validatedData.assignedTo !== undefined) {
    updateData.assignedTo = validatedData.assignedTo;
  }
  if (validatedData.dueDate !== undefined) {
    updateData.dueDate = validatedData.dueDate;
  }
  if (validatedData.completedAt !== undefined) {
    updateData.completedAt = validatedData.completedAt;
  }
  if (validatedData.tags !== undefined) {
    updateData.tags = validatedData.tags;
  }
  if (validatedData.estimatedHours !== undefined) {
    updateData.estimatedHours = validatedData.estimatedHours;
  }
  if (validatedData.actualHours !== undefined) {
    updateData.actualHours = validatedData.actualHours;
  }
  if (validatedData.metadata !== undefined) {
    updateData.metadata = validatedData.metadata;
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

  // 更新提醒：如果状态变为已完成或已取消，清理相关提醒（方法不存在，暂时注释）
  // if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
  //   reminderGenerator.cleanupCompletedTaskReminders(taskId).catch(error => {
  //     console.error('清理已完成任务的提醒失败:', error);
  //   });
  // }
  // 如果任务状态变为进行中或待办，且有截止日期，生成提醒
  // else if (task.dueDate) {
  //   reminderGenerator.generateTaskReminders(task.id).catch(error => {
  //     console.error('生成任务提醒失败:', error);
  //   });
  // }
  // 如果截止日期发生变化，重新生成提醒
  // else if (
  //   validatedData.dueDate !== undefined &&
  //   existingTask.dueDate?.toISOString() !== validatedData.dueDate.toISOString()
  // ) {
  //   reminderGenerator.generateTaskReminders(task.id).catch(error => {
  //     console.error('生成任务提醒失败:', error);
  //   });
  // }

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

  return createSuccessResponse(taskDetail);
});

/**
 * DELETE /api/tasks/[id]
 * 删除任务（软删除）
 */
export const DELETE = withErrorHandler(async (request: NextRequest) => {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  const taskId = getTaskId(request);

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
      { error: '无权操作', message: '您没有权限删除此任务' },
      { status: 403 }
    );
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { deletedAt: new Date() },
  });

  return createNoContentResponse();
});

/**
 * OPTIONS /api/tasks/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
