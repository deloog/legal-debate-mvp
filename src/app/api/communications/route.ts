/** @legacy 优先使用 /api/v1/communications，此路由保留以向后兼容 */
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createCreatedResponse,
  createSuccessResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  CommunicationRecordDetail,
  CommunicationType,
} from '@/types/communication';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createCommunicationSchema = z
  .object({
    clientId: z.string().min(1, '客户ID不能为空'),
    type: z.enum(['PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER']),
    summary: z.string().min(1, '摘要不能为空').max(1000),
    content: z.string().max(10000).optional(),
    nextFollowUpDate: z.string().datetime().optional(),
    isImportant: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .required({ clientId: true, type: true, summary: true });

const queryCommunicationSchema = z.object({
  clientId: z.string().optional(),
  type: z.enum(['PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER']).optional(),
  isImportant: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'nextFollowUpDate']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

async function mapCommunicationRecord(
  record: unknown
): Promise<CommunicationRecordDetail> {
  if (!record || typeof record !== 'object') {
    throw new Error('Invalid communication record data');
  }

  const recordObj = record as Record<string, unknown>;
  return {
    id: String(recordObj.id || ''),
    clientId: String(recordObj.clientId || ''),
    userId: String(recordObj.userId || ''),
    type: recordObj.type as CommunicationType,
    summary: String(recordObj.summary || ''),
    content: recordObj.content as string | null,
    nextFollowUpDate: recordObj.nextFollowUpDate
      ? new Date(recordObj.nextFollowUpDate as string)
      : null,
    isImportant: Boolean(recordObj.isImportant),
    metadata: recordObj.metadata as Record<string, unknown> | null,
    createdAt: new Date(recordObj.createdAt as string),
    updatedAt: new Date(recordObj.updatedAt as string),
  };
}

/**
 * GET /api/communications
 * 获取沟通记录列表
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
  const query = queryCommunicationSchema.parse(
    Object.fromEntries(searchParams)
  );

  const where: Record<string, unknown> = {
    userId: authUser.userId,
  };

  if (query.clientId) {
    where.clientId = query.clientId;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.isImportant) {
    where.isImportant = query.isImportant === 'true';
  }

  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) {
      (where.createdAt as Record<string, unknown>).gte = new Date(
        query.startDate
      );
    }
    if (query.endDate) {
      (where.createdAt as Record<string, unknown>).lte = new Date(
        query.endDate
      );
    }
  }

  const orderBy: Record<string, 'asc' | 'desc'> = {
    [query.sortBy]: query.sortOrder,
  };

  const [communications, total] = await Promise.all([
    prisma.communicationRecord.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy,
    }),
    prisma.communicationRecord.count({ where }),
  ]);

  const communicationDetails = await Promise.all(
    communications.map((record: unknown) => mapCommunicationRecord(record))
  );

  return createSuccessResponse(
    { communications: communicationDetails, total },
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
 * POST /api/communications
 * 创建沟通记录
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
  const validatedData = createCommunicationSchema.parse(body);

  const communication = await prisma.communicationRecord.create({
    data: {
      clientId: validatedData.clientId,
      userId: authUser.userId,
      type: validatedData.type,
      summary: validatedData.summary,
      content: validatedData.content,
      nextFollowUpDate: validatedData.nextFollowUpDate
        ? new Date(validatedData.nextFollowUpDate)
        : undefined,
      isImportant: validatedData.isImportant || false,
      metadata: validatedData.metadata as Prisma.JsonValue,
    },
  });

  const communicationDetail = await mapCommunicationRecord(communication);

  return createCreatedResponse(communicationDetail);
});

/**
 * OPTIONS /api/communications
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
