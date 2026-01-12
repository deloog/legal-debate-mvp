import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createPaginatedResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/api-response';
import {
  validateQueryParams,
  validateRequestBody,
} from '@/app/api/lib/validation/validator';
import {
  createDebateSchema,
  paginationSchema,
} from '@/app/api/lib/validation/schemas';
import { buildPaginationOptions } from '@/app/api/lib/responses/pagination';
import { prisma } from '@/lib/db/prisma';
import { DebateStatus } from '@prisma/client';
import { getAuthUser } from '@/lib/middleware/auth';
import { isAdminRole } from '@/lib/middleware/resource-permission';
import { UserRole } from '@/types/auth';

/**
 * GET /api/v1/debates
 * 获取辩论列表（支持分页和搜索）
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 获取认证用户
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 验证查询参数
  const query = validateQueryParams(request, paginationSchema);
  const { search, page, limit } = query;

  // 构建查询选项
  const options = buildPaginationOptions(query);

  // 获取可选的userId过滤参数
  const { searchParams } = new URL(request.url);
  const userIdFilter = searchParams.get('userId');

  // 构建查询条件
  const whereCondition: Record<string, unknown> = {
    deletedAt: null,
  };

  // 权限过滤：非管理员只能看到自己创建的辩论
  if (!isAdminRole(authUser.role as UserRole)) {
    whereCondition.userId = authUser.userId;
  } else if (userIdFilter) {
    // 管理员可以根据userId参数过滤
    whereCondition.userId = userIdFilter;
  }

  // 添加搜索条件
  if (search) {
    whereCondition.OR = [
      { title: { contains: search, mode: 'insensitive' as const } },
      {
        case: { title: { contains: search, mode: 'insensitive' as const } },
      },
    ];
  }

  // 并行执行数据查询和总数统计
  const [debates, total] = await Promise.all([
    prisma.debate.findMany({
      where: whereCondition,
      include: {
        case: {
          select: {
            id: true,
            title: true,
            type: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
        _count: {
          select: {
            rounds: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      ...options,
    }),
    prisma.debate.count({
      where: whereCondition,
    }),
  ]);

  // 计算分页信息
  const pagination = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };

  return createPaginatedResponse(debates, pagination);
});

/**
 * POST /api/v1/debates
 * 创建新辩论
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // 获取认证用户
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { error: '未认证', message: '请先登录' },
      { status: 401 }
    );
  }

  // 验证请求体
  const body = await validateRequestBody(request, createDebateSchema);

  // 验证案件是否存在
  const existingCase = await prisma.case.findUnique({
    where: { id: body.caseId },
    select: { id: true, title: true, type: true },
  });

  if (!existingCase) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CASE_NOT_FOUND',
          message: '指定的案件不存在',
        },
      },
      { status: 404 }
    );
  }

  // 从token获取用户ID
  const userId = authUser.userId;

  // 创建新的辩论和初始轮次
  const bodyInput = body as {
    caseId: string;
    title: string;
    config?: unknown;
    status?: string;
  };
  const debateStatus = bodyInput.status
    ? (bodyInput.status as DebateStatus)
    : DebateStatus.DRAFT;
  const newDebate = await prisma.debate.create({
    data: {
      caseId: body.caseId,
      userId,
      title: body.title,
      debateConfig: body.config,
      status: debateStatus,
      currentRound: 0,
      rounds: {
        create: {
          roundNumber: 1,
          status:
            debateStatus === DebateStatus.IN_PROGRESS
              ? 'IN_PROGRESS'
              : 'PENDING',
        },
      },
    },
    include: {
      case: {
        select: {
          id: true,
          title: true,
          type: true,
        },
      },
      user: {
        select: {
          id: true,
          username: true,
          name: true,
        },
      },
      rounds: {
        orderBy: {
          roundNumber: 'asc',
        },
      },
    },
  });

  return createCreatedResponse(newDebate);
});

/**
 * OPTIONS /api/v1/debates
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
