import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { getAuthUser } from '@/lib/middleware/auth';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const updateCaseExampleSchema = z
  .object({
    title: z.string().min(1, '标题不能为空').max(200).optional(),
    caseNumber: z.string().min(1, '案号不能为空').max(100).optional(),
    court: z.string().min(1, '法院不能为空').max(200).optional(),
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
    cause: z.string().max(200).optional(),
    facts: z.string().min(1, '事实不能为空').max(10000).optional(),
    judgment: z.string().min(1, '判决不能为空').max(10000).optional(),
    result: z.enum(['WIN', 'LOSE', 'PARTIAL', 'WITHDRAW']).optional(),
    judgmentDate: z.string().min(1, '判决日期不能为空').optional(),
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
  .partial();

/**
 * GET /api/case-examples/:id
 * 获取案例详情
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const example = await prisma.caseExample.findUnique({
      where: { id },
    });

    if (!example) {
      return NextResponse.json(
        { error: '案例不存在', message: '未找到指定的案例' },
        { status: 404 }
      );
    }

    return createSuccessResponse(example);
  }
);

/**
 * PUT /api/case-examples/:id
 * 更新案例
 */
export const PUT = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const body = await request.json();
    const validatedData = updateCaseExampleSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validatedData.title !== undefined) {
      updateData.title = validatedData.title;
    }
    if (validatedData.caseNumber !== undefined) {
      updateData.caseNumber = validatedData.caseNumber;
    }
    if (validatedData.court !== undefined) {
      updateData.court = validatedData.court;
    }
    if (validatedData.type !== undefined) {
      updateData.type = validatedData.type;
    }
    if (validatedData.cause !== undefined) {
      updateData.cause = validatedData.cause;
    }
    if (validatedData.facts !== undefined) {
      updateData.facts = validatedData.facts;
    }
    if (validatedData.judgment !== undefined) {
      updateData.judgment = validatedData.judgment;
    }
    if (validatedData.result !== undefined) {
      updateData.result = validatedData.result;
    }
    if (validatedData.judgmentDate !== undefined) {
      updateData.judgmentDate = new Date(validatedData.judgmentDate);
    }
    if (validatedData.metadata !== undefined) {
      updateData.metadata = validatedData.metadata;
    }

    const example = await prisma.caseExample.update({
      where: { id },
      data: updateData,
    });

    return createSuccessResponse(example);
  }
);

/**
 * DELETE /api/case-examples/:id
 * 删除案例
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    await prisma.caseExample.delete({
      where: { id },
    });

    return createSuccessResponse({ id }, { message: '案例已删除' });
  }
);

/**
 * OPTIONS /api/case-examples/:id
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
