import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createNoContentResponse,
  createSuccessResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  CaseSummary,
  ClientDetail,
  ClientSource,
  ClientStatus,
  ClientType,
} from '@/types/client';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const updateClientSchema = z
  .object({
    name: z.string().min(1, '名称不能为空').max(200).optional(),
    gender: z.string().optional(),
    age: z.number().int().min(0).max(150).optional(),
    profession: z.string().optional(),
    phone: z
      .string()
      .regex(/^1[3-9]\d{9}$/)
      .optional()
      .or(
        z
          .string()
          .regex(/^[0-9]{11}$/)
          .optional()
      ),
    email: z.string().email().optional(),
    address: z.string().max(500).optional(),
    idCardNumber: z
      .string()
      .regex(/^\d{17}[\dXx]$/)
      .optional(),
    company: z.string().max(200).optional(),
    creditCode: z
      .string()
      .regex(/^[0-9A-H]{18}$/)
      .optional(),
    legalRep: z.string().max(100).optional(),
    source: z
      .enum(['REFERRAL', 'ONLINE', 'EVENT', 'ADVERTISING', 'OTHER'])
      .optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'LOST', 'BLACKLISTED']).optional(),
    notes: z.string().max(5000).optional(),
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

async function getClientCount(clientId: string): Promise<number> {
  const [cases, communications] = await Promise.all([
    prisma.case.count({
      where: {
        clientId,
        deletedAt: null,
      },
    }),
    prisma.communicationRecord.count({
      where: {
        clientId,
      },
    }),
  ]);
  return cases + communications;
}

async function getClientCaseHistory(clientId: string): Promise<CaseSummary[]> {
  const cases = await prisma.case.findMany({
    where: {
      clientId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      cause: true,
      amount: true,
      court: true,
      caseNumber: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return cases.map(caseItem => ({
    id: caseItem.id,
    title: caseItem.title,
    type: caseItem.type,
    status: caseItem.status,
    createdAt: caseItem.createdAt,
    updatedAt: caseItem.updatedAt,
    cause: caseItem.cause,
    amount: caseItem.amount ? Number(caseItem.amount) : null,
    court: caseItem.court,
    caseNumber: caseItem.caseNumber,
  }));
}

async function mapClientToDetail(
  client: unknown,
  includeCounts = false,
  includeCases = false
): Promise<ClientDetail> {
  if (!client || typeof client !== 'object') {
    throw new Error('Invalid client data');
  }

  const clientObj = client as Record<string, unknown>;
  const detail: ClientDetail = {
    id: String(clientObj.id || ''),
    userId: String(clientObj.userId || ''),
    clientType: clientObj.clientType as ClientType,
    name: String(clientObj.name || ''),
    gender: clientObj.gender as string | null,
    age: clientObj.age as number | null,
    profession: clientObj.profession as string | null,
    phone: clientObj.phone as string | null,
    email: clientObj.email as string | null,
    address: clientObj.address as string | null,
    idCardNumber: clientObj.idCardNumber as string | null,
    company: clientObj.company as string | null,
    creditCode: clientObj.creditCode as string | null,
    legalRep: clientObj.legalRep as string | null,
    source: clientObj.source as ClientSource | null,
    tags: Array.isArray(clientObj.tags) ? (clientObj.tags as string[]) : [],
    status: clientObj.status as ClientStatus,
    notes: clientObj.notes as string | null,
    metadata: clientObj.metadata as Record<string, unknown> | null,
    createdAt: new Date(clientObj.createdAt as string),
    updatedAt: new Date(clientObj.updatedAt as string),
    deletedAt: clientObj.deletedAt
      ? new Date(clientObj.deletedAt as string)
      : null,
  };

  if (includeCounts && clientObj.id) {
    const counts = await getClientCount(String(clientObj.id));
    detail.cases = counts;
  }

  if (includeCases && clientObj.id) {
    const caseHistory = await getClientCaseHistory(String(clientObj.id));
    detail.caseHistory = caseHistory;
  }

  return detail;
}

/**
 * GET /api/clients/[id]
 * 获取客户详情
 * 支持include参数：include=cases 表示包含案件历史
 */
export const GET = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: { id: string } | Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // 安全地获取searchParams
    let includeCases = false;
    if (request.nextUrl && request.nextUrl.searchParams) {
      const include = request.nextUrl.searchParams.get('include');
      includeCases = include === 'cases';
    }

    const client = await prisma.client.findFirst({
      where: {
        id,
        userId: authUser.userId,
        deletedAt: null,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: '客户不存在', message: '未找到指定客户' },
        { status: 404 }
      );
    }

    const clientDetail = await mapClientToDetail(client, true, includeCases);

    return createSuccessResponse(clientDetail);
  }
);

/**
 * PATCH /api/clients/[id]
 * 更新客户信息
 */
export const PATCH = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: { id: string } | Promise<{ id: string }> }
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
    const validatedData = updateClientSchema.parse(body);

    const client = await prisma.client.findFirst({
      where: {
        id,
        userId: authUser.userId,
        deletedAt: null,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: '客户不存在', message: '未找到指定客户' },
        { status: 404 }
      );
    }

    const updatedClient = await prisma.client.update({
      where: {
        id,
      },
      data: {
        name: validatedData.name,
        gender: validatedData.gender,
        age: validatedData.age,
        profession: validatedData.profession,
        phone: validatedData.phone,
        email: validatedData.email,
        address: validatedData.address,
        idCardNumber: validatedData.idCardNumber,
        company: validatedData.company,
        creditCode: validatedData.creditCode,
        legalRep: validatedData.legalRep,
        source: validatedData.source,
        tags: validatedData.tags,
        status: validatedData.status,
        notes: validatedData.notes,
        metadata: validatedData.metadata as Prisma.InputJsonValue,
      },
    });

    const clientDetail = await mapClientToDetail(updatedClient, true);

    return createSuccessResponse(clientDetail);
  }
);

/**
 * DELETE /api/clients/[id]
 * 删除客户
 */
export const DELETE = withErrorHandler(
  async (
    request: NextRequest,
    { params }: { params: { id: string } | Promise<{ id: string }> }
  ) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const client = await prisma.client.findFirst({
      where: {
        id,
        userId: authUser.userId,
        deletedAt: null,
      },
    });

    if (!client) {
      return NextResponse.json(
        { error: '客户不存在', message: '未找到指定客户' },
        { status: 404 }
      );
    }

    await prisma.client.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return createNoContentResponse();
  }
);

/**
 * OPTIONS /api/clients/[id]
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
