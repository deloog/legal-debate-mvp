import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/app/api/lib/errors/error-handler";
import {
  createPaginatedResponse,
  createCreatedResponse,
} from "@/app/api/lib/responses/api-response";
import {
  validateQueryParams,
  validateRequestBody,
} from "@/app/api/lib/validation/validator";
import {
  createCaseSchema,
  caseQuerySchema,
} from "@/app/api/lib/validation/schemas";
import { buildPaginationOptions } from "@/app/api/lib/responses/pagination";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

/**
 * GET /api/v1/cases
 * 获取案件列表（支持分页和搜索）
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  // 验证查询参数
  const query = validateQueryParams(request, caseQuerySchema);
  const { search, userId, page, limit } = query;

  // 构建查询选项
  const options = buildPaginationOptions(query);

  // 构建查询条件
  const where: Prisma.CaseWhereInput = {
    deletedAt: null,
  };

  // 如果提供了用户ID，只查询该用户的案件
  if (userId) {
    where.userId = userId;
  }

  // 如果提供了搜索关键词
  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ];
  }

  // 执行数据库查询
  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...options,
    }),
    prisma.case.count({ where }),
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

  return createPaginatedResponse(cases, pagination);
});

/**
 * POST /api/v1/cases
 * 创建新案件
 */
export const POST = withErrorHandler(async (request: NextRequest) => {
  // 验证请求体
  const body = await validateRequestBody(request, createCaseSchema);

  // 验证用户是否存在
  const user = await prisma.user.findUnique({
    where: { id: body.userId },
  });

  if (!user) {
    return NextResponse.json(
      { success: false, error: "用户不存在" },
      { status: 404 },
    );
  }

  // 转换类型枚举值
  const typeMap: Record<
    string,
    | "CIVIL"
    | "CRIMINAL"
    | "ADMINISTRATIVE"
    | "COMMERCIAL"
    | "LABOR"
    | "INTELLECTUAL"
    | "OTHER"
  > = {
    civil: "CIVIL",
    criminal: "CRIMINAL",
    administrative: "ADMINISTRATIVE",
    commercial: "COMMERCIAL",
    labor: "LABOR",
    intellectual: "INTELLECTUAL",
    other: "OTHER",
  };

  const statusMap: Record<
    string,
    "DRAFT" | "ACTIVE" | "COMPLETED" | "ARCHIVED"
  > = {
    draft: "DRAFT",
    active: "ACTIVE",
    completed: "COMPLETED",
    archived: "ARCHIVED",
  };

  // 创建案件
  const newCase = await prisma.case.create({
    data: {
      userId: body.userId,
      title: body.title,
      description: body.description,
      type: typeMap[body.type] || "CIVIL",
      status: statusMap[body.status] || "DRAFT",
      amount: body.amount ? new Prisma.Decimal(body.amount) : undefined,
      caseNumber: body.caseNumber,
      cause: body.cause,
      court: body.court,
      plaintiffName: body.plaintiffName,
      defendantName: body.defendantName,
      metadata: body.metadata,
    },
  });

  return createCreatedResponse(newCase);
});

/**
 * OPTIONS /api/v1/cases
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
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
