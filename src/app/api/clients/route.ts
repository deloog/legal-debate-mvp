/** @legacy 优先使用 /api/v1/clients，此路由保留以向后兼容 */
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createCreatedResponse,
  createSuccessResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  ClientDetail,
  ClientSource,
  ClientStatus,
  ClientType,
} from '@/types/client';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const createClientSchema = z
  .object({
    clientType: z.enum(['INDIVIDUAL', 'ENTERPRISE', 'POTENTIAL']),
    name: z.string().min(1, '名称不能为空').max(200),
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
    tags: z.array(z.string()).default([]),
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
  .required({ name: true });

const queryClientSchema = z.object({
  clientType: z.enum(['INDIVIDUAL', 'ENTERPRISE', 'POTENTIAL']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'LOST', 'BLACKLISTED']).optional(),
  source: z
    .enum(['REFERRAL', 'ONLINE', 'EVENT', 'ADVERTISING', 'OTHER'])
    .optional(),
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  page: z.coerce.number().min(1, '页码必须大于0').default(1),
  limit: z.coerce
    .number()
    .min(1, '每页数量必须大于0')
    .max(100, '每页数量不能超过100')
    .default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

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

async function mapClientToDetail(
  client: unknown,
  includeCounts = false
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

  return detail;
}

/**
 * GET /api/clients
 * 获取客户列表
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
  const query = queryClientSchema.parse(Object.fromEntries(searchParams));

  const where: Record<string, unknown> = {
    userId: authUser.userId,
    deletedAt: null,
  };

  if (query.clientType) {
    where.clientType = query.clientType;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.source) {
    where.source = query.source;
  }

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { company: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.tags && query.tags.length > 0) {
    where.tags = {
      hasSome: query.tags,
    };
  }

  const orderBy: Record<string, 'asc' | 'desc'> = {
    [query.sortBy]: query.sortOrder,
  };

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy,
    }),
    prisma.client.count({ where }),
  ]);

  const clientDetails = await Promise.all(
    clients.map((client: unknown) => mapClientToDetail(client, true))
  );

  return createSuccessResponse(
    { clients: clientDetails, total },
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
 * POST /api/clients
 * 创建客户
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
  const validatedData = createClientSchema.parse(body);

  const client = await prisma.client.create({
    data: {
      userId: authUser.userId,
      clientType: validatedData.clientType,
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
      tags: validatedData.tags || [],
      notes: validatedData.notes,
      metadata: validatedData.metadata as Prisma.JsonValue,
    },
  });

  const clientDetail = await mapClientToDetail(client, true);

  return createCreatedResponse(clientDetail);
});

/**
 * OPTIONS /api/clients
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
