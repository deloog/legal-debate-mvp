import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { TaskStatus, TaskPriority } from '@/types/task';
import { Prisma } from '@prisma/client';
import { reminderGenerator } from '@/lib/notification/reminder-generator';

/**
 * 创建任务Schema
 */
const createTaskSchema = z.object({
  title: z.string().min(1, '任务标题不能为空').max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  caseId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
  estimatedHours: z.number().nonnegative().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 查询任务Schema
 */
const queryTaskSchema = z.object({
  caseId: z.string().optional(),
  assignedTo: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDateFrom: z.coerce.date().optional(),
  dueDateTo: z.coerce.date().optional(),
  tags: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'dueDate', 'priority'] as const)
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/tasks
 * 获取任务列表
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
  const query = queryTaskSchema.parse(Object.fromEntries(searchParams));

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (query.assignedTo) {
    where.assignedTo = query.assignedTo;
  } else {
    where.OR = [
      { createdBy: authUser.userId },
      { assignedTo: authUser.userId },
    ];
  }

  if (query.caseId) {
    where.caseId = query.caseId;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.priority) {
    where.priority = query.priority;
  }

  if (query.dueDateFrom || query.dueDateTo) {
    where.dueDate = {};
    if (query.dueDateFrom) {
      (where.dueDate as Record<string, unknown>).gte = query.dueDateFrom;
    }
    if (query.dueDateTo) {
      (where.dueDate as Record<string, unknown>).lte = query.dueDateTo;
    }
  }

  if (query.tags) {
    const tagArray = query.tags.split(',').filter(tag => tag.trim());
    if (tagArray.length > 0) {
      where.tags = {
        hasSome: tagArray,
      };
    }
  }

  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Record<string, 'asc' | 'desc'> = {
    [query.sortBy]: query.sortOrder,
  };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy,
      include: {
        case: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            caseNumber: true,
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
    }),
    prisma.task.count({ where }),
  ]);

  const taskDetails = tasks.map(task => {
    return {
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
  });

  const response = {
    tasks: taskDetails,
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };

  return createSuccessResponse(response, {
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNext: (query.page - 1) * query.limit + query.limit < total,
      hasPrevious: query.page > 1,
    },
  });
});

/**
 * POST /api/tasks
 * 创建任务
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
  const validatedData = createTaskSchema.parse(body);

  const task = await prisma.task.create({
    data: {
      title: validatedData.title,
      description: validatedData.description,
      status: validatedData.status || 'TODO',
      priority: validatedData.priority || 'MEDIUM',
      caseId: validatedData.caseId,
      assignedTo: validatedData.assignedTo,
      createdBy: authUser.userId,
      dueDate: validatedData.dueDate,
      tags: validatedData.tags || [],
      estimatedHours: validatedData.estimatedHours,
      metadata: validatedData.metadata as
        | Prisma.InputJsonValue
        | Prisma.NullableJsonNullValueInput
        | null,
    },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
          caseNumber: true,
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
    assigneeId: task.assignedTo,
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
          caseNumber: task.case.caseNumber,
        }
      : undefined,
    assignee: task.assignedUser
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

  // 为有截止日期的任务异步生成提醒（不阻塞响应）
  if (task.dueDate) {
    reminderGenerator.generateTaskItemReminders(task.id).catch(() => {
      // 提醒生成失败不影响任务创建，错误已在 reminderGenerator 内部记录
    });
  }

  return createCreatedResponse(taskDetail);
});

/**
 * OPTIONS /api/tasks
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
