import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createCreatedResponse,
  createSuccessResponse,
} from '@/app/api/lib/responses/success';
import { FollowUpTaskGenerator } from '@/lib/client/follow-up-task-generator';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import type { CommunicationRecordDetail } from '@/types/communication';
import type { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createCommunicationSchema = z
  .object({
    type: z.enum(['PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER']),
    summary: z.string().min(1, '摘要不能为空').max(1000),
    content: z.string().max(10000).optional(),
    nextFollowUpDate: z.string().datetime().optional(),
    isImportant: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .required({ type: true, summary: true });

const queryCommunicationSchema = z.object({
  type: z.enum(['PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER']).optional(),
  isImportant: z.string().optional(),
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
    type: recordObj.type as 'PHONE' | 'EMAIL' | 'MEETING' | 'WECHAT' | 'OTHER',
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
 * 验证客户所有权
 * @param clientId 客户ID
 * @param userId 用户ID
 * @returns 客户是否存在且属于该用户
 */
async function verifyClientOwnership(
  clientId: string,
  userId: string
): Promise<boolean> {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      userId,
      deletedAt: null,
    },
    select: { id: true },
  });
  return !!client;
}

/**
 * GET /api/clients/[id]/communications
 * 获取客户沟通记录列表
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

    const { id: clientId } = await params;

    // 验证客户所有权
    const hasOwnership = await verifyClientOwnership(clientId, authUser.userId);
    if (!hasOwnership) {
      logger.warn('用户尝试访问无权限的客户沟通记录:', {
        userId: authUser.userId,
        clientId,
      });
      return NextResponse.json(
        { error: '无权限', message: '您没有权限访问此客户的沟通记录' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = queryCommunicationSchema.parse(
      Object.fromEntries(searchParams)
    );

    const where: Record<string, unknown> = {
      clientId,
      userId: authUser.userId,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.isImportant) {
      where.isImportant = query.isImportant === 'true';
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
  }
);

/**
 * POST /api/clients/[id]/communications
 * 创建客户沟通记录
 */
export const POST = withErrorHandler(
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

    const { id: clientId } = await params;
    const body = await request.json();
    const validatedData = createCommunicationSchema.parse(body);

    // 验证客户所有权（关键安全验证）
    const hasOwnership = await verifyClientOwnership(clientId, authUser.userId);
    if (!hasOwnership) {
      logger.warn('用户尝试为无权限的客户创建沟通记录:', {
        userId: authUser.userId,
        clientId,
      });
      return NextResponse.json(
        { error: '无权限', message: '您没有权限为此客户创建沟通记录' },
        { status: 403 }
      );
    }

    const communication = await prisma.communicationRecord.create({
      data: {
        clientId,
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

    // 如果设置了跟进日期，自动生成跟进任务
    if (validatedData.nextFollowUpDate) {
      await FollowUpTaskGenerator.generateFromCommunication(communication.id);
    }

    logger.info('沟通记录创建成功:', {
      userId: authUser.userId,
      clientId,
      communicationId: communication.id,
    });

    return createCreatedResponse(communicationDetail);
  }
);

/**
 * OPTIONS /api/clients/[id]/communications
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
