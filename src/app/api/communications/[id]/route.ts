import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createNotFoundResponse,
  createUnauthorizedResponse,
} from '@/app/api/lib/responses/error-response';
import {
  createNoContentResponse,
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

const updateCommunicationSchema = z
  .object({
    type: z.enum(['PHONE', 'EMAIL', 'MEETING', 'WECHAT', 'OTHER']).optional(),
    summary: z.string().min(1, '摘要不能为空').max(1000).optional(),
    content: z.string().max(10000).optional(),
    nextFollowUpDate: z.string().datetime().optional(),
    isImportant: z.boolean().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .partial();

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
 * GET /api/communications/[id]
 * 获取沟通记录详情
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;

    const communication = await prisma.communicationRecord.findFirst({
      where: {
        id,
        userId: authUser.userId,
      },
    });

    if (!communication) {
      return createNotFoundResponse('未找到指定沟通记录');
    }

    const communicationDetail = await mapCommunicationRecord(communication);

    return createSuccessResponse(communicationDetail);
  }
);

/**
 * PATCH /api/communications/[id]
 * 更新沟通记录
 */
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateCommunicationSchema.parse(body);

    const communication = await prisma.communicationRecord.findFirst({
      where: {
        id,
        userId: authUser.userId,
      },
    });

    if (!communication) {
      return createNotFoundResponse('未找到指定沟通记录');
    }

    const updatedCommunication = await prisma.communicationRecord.update({
      where: {
        id,
      },
      data: {
        type: validatedData.type,
        summary: validatedData.summary,
        content: validatedData.content,
        nextFollowUpDate: validatedData.nextFollowUpDate
          ? new Date(validatedData.nextFollowUpDate)
          : undefined,
        isImportant: validatedData.isImportant,
        metadata: validatedData.metadata as Prisma.InputJsonValue,
      },
    });

    const communicationDetail =
      await mapCommunicationRecord(updatedCommunication);

    return createSuccessResponse(communicationDetail);
  }
);

/**
 * DELETE /api/communications/[id]
 * 删除沟通记录
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return createUnauthorizedResponse();
    }

    const { id } = await params;

    const communication = await prisma.communicationRecord.findFirst({
      where: {
        id,
        userId: authUser.userId,
      },
    });

    if (!communication) {
      return createNotFoundResponse('未找到指定沟通记录');
    }

    await prisma.communicationRecord.delete({
      where: {
        id,
      },
    });

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/communications/[id]
 * CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
});
