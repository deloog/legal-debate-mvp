import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import {
  createSuccessResponse,
  createPaginatedResponse,
  createCreatedResponse,
} from "@/app/api/lib/responses/api-response";
import {
  validateQueryParams,
  validateRequestBody,
} from "@/app/api/lib/validation/validator";
import {
  createDebateSchema,
  paginationSchema,
} from "@/app/api/lib/validation/schemas";
import { buildPaginationOptions } from "@/app/api/lib/responses/pagination";
import { prisma } from "@/lib/db/prisma";
import { DebateStatus } from "@prisma/client";

/**
 * GET /api/v1/debates
 * 获取辩论列表（支持分页和搜索）
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 验证查询参数
  const query = validateQueryParams(request, paginationSchema);
  const { search, page, limit } = query;

  // 构建查询选项
  const options = buildPaginationOptions(query);

  // 构建搜索条件
  const whereCondition = search
    ? {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          {
            case: { title: { contains: search, mode: "insensitive" as const } },
          },
        ],
      }
    : {};

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
        createdAt: "desc",
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
          code: "CASE_NOT_FOUND",
          message: "指定的案件不存在",
        },
      },
      { status: 404 },
    );
  }

  // TODO: 从认证中获取实际用户ID，这里临时使用第一个用户
  const userId = (await prisma.user.findFirst({ select: { id: true } }))?.id;

  if (!userId) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "USER_NOT_FOUND",
          message: "系统用户不存在",
        },
      },
      { status: 500 },
    );
  }

  // 创建新的辩论
  const newDebate = await prisma.debate.create({
    data: {
      caseId: body.caseId,
      userId: userId,
      title: body.title,
      debateConfig: body.config,
      status: DebateStatus.DRAFT,
      currentRound: 0,
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
    },
  });

  return createCreatedResponse(newDebate);
});

/**
 * OPTIONS /api/v1/debates
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async (request: NextRequest) => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400",
    },
  });
});
