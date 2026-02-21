/** @legacy 优先使用 /api/v1/follow-up-tasks，此路由保留以向后兼容 */
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { FollowUpTaskProcessor } from '@/lib/client/follow-up-task-processor';
import {
  FollowUpTaskPriority,
  FollowUpTaskQueryParams,
  FollowUpTaskStatus,
} from '@/types/client';
import { z } from 'zod';
import { getAuthUser } from '@/lib/middleware/auth';

const querySchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
  dueDateFrom: z.string().optional(),
  dueDateTo: z.string().optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
  sortBy: z.enum(['dueDate', 'priority', 'createdAt']).default('dueDate'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * GET /api/follow-up-tasks
 * 获取跟进任务列表
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
  const query = querySchema.parse(Object.fromEntries(searchParams));

  const params: FollowUpTaskQueryParams = {
    userId: authUser.userId,
    page: query.page,
    limit: query.limit,
    status: query.status as FollowUpTaskStatus | undefined,
    priority: query.priority as FollowUpTaskPriority | undefined,
    dueDateFrom: query.dueDateFrom ? new Date(query.dueDateFrom) : undefined,
    dueDateTo: query.dueDateTo ? new Date(query.dueDateTo) : undefined,
    sortBy: query.sortBy as 'dueDate' | 'priority' | 'createdAt',
    sortOrder: query.sortOrder as 'asc' | 'desc',
  };

  const result = await FollowUpTaskProcessor.getTasks(params);

  return createSuccessResponse(result, {
    pagination: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
      hasNext: result.page < result.totalPages,
      hasPrevious: result.page > 1,
    },
  });
});

/**
 * OPTIONS /api/follow-up-tasks
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
