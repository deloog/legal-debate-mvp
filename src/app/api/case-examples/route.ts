/** @legacy 优先使用 /api/v1/case-examples，此路由保留以向后兼容 */
import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/success';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

const createCaseExampleSchema = z
  .object({
    title: z.string().min(1, '标题不能为空').max(200),
    caseNumber: z.string().min(1, '案号不能为空').max(100),
    court: z.string().min(1, '法院不能为空').max(200),
    type: z.enum([
      'CIVIL',
      'CRIMINAL',
      'ADMINISTRATIVE',
      'COMMERCIAL',
      'LABOR',
      'INTELLECTUAL',
      'OTHER',
    ]),
    cause: z.string().max(200).optional(),
    facts: z.string().min(1, '事实不能为空').max(10000),
    judgment: z.string().min(1, '判决不能为空').max(10000),
    result: z.enum(['WIN', 'LOSE', 'PARTIAL', 'WITHDRAW']),
    judgmentDate: z.string().min(1, '判决日期不能为空'),
    metadata: z
      .union([
        z.object({}).passthrough(),
        z.array(z.unknown()),
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
      ])
      .optional(),
  })
  .required({
    title: true,
    caseNumber: true,
    court: true,
    type: true,
    facts: true,
    judgment: true,
    result: true,
    judgmentDate: true,
  });

const queryCaseExampleSchema = z.object({
  type: z
    .enum([
      'CIVIL',
      'CRIMINAL',
      'ADMINISTRATIVE',
      'COMMERCIAL',
      'LABOR',
      'INTELLECTUAL',
      'OTHER',
    ])
    .optional(),
  result: z.enum(['WIN', 'LOSE', 'PARTIAL', 'WITHDRAW']).optional(),
  court: z.string().max(200).optional(),
  cause: z.string().max(200).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(10),
  sortBy: z
    .enum(['judgmentDate', 'createdAt', 'title'])
    .default('judgmentDate'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * GET /api/case-examples
 * 获取案例列表
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
  const query = queryCaseExampleSchema.parse(Object.fromEntries(searchParams));

  const where: Record<string, unknown> = {};

  if (query.type) {
    where.type = query.type;
  }

  if (query.result) {
    where.result = query.result;
  }

  if (query.court) {
    where.court = { contains: query.court, mode: 'insensitive' };
  }

  if (query.cause) {
    where.cause = { contains: query.cause, mode: 'insensitive' };
  }

  if (query.startDate || query.endDate) {
    where.judgmentDate = {
      ...(query.startDate && { gte: new Date(query.startDate) }),
      ...(query.endDate && { lte: new Date(query.endDate) }),
    };
  }

  const orderBy: Record<string, 'asc' | 'desc'> = {
    [query.sortBy]: query.sortOrder,
  };

  const [examples, total] = await Promise.all([
    prisma.caseExample.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy,
    }),
    prisma.caseExample.count({ where }),
  ]);

  return createSuccessResponse(
    { examples, total },
    {
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        hasNext: (query.page - 1) * query.limit + query.limit < total,
        hasPrevious: query.page > 1,
      },
    }
  );
});

/**
 * POST /api/case-examples
 * 创建新案例
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
  const validatedData = createCaseExampleSchema.parse(body);

  const example = await prisma.caseExample.create({
    data: {
      title: validatedData.title,
      caseNumber: validatedData.caseNumber,
      court: validatedData.court,
      type: validatedData.type,
      cause: validatedData.cause,
      facts: validatedData.facts,
      judgment: validatedData.judgment,
      result: validatedData.result,
      judgmentDate: new Date(validatedData.judgmentDate),
      metadata: validatedData.metadata as Prisma.InputJsonValue,
    },
  });

  return createCreatedResponse(example);
});

/**
 * OPTIONS /api/case-examples
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
