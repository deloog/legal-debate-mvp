/** @legacy 优先使用 /api/v1/evidence，此路由保留以向后兼容 */
import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import {
  createSuccessResponse,
  createCreatedResponse,
} from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { EvidenceStatus } from '@/types/evidence';

const createEvidenceSchema = z.object({
  caseId: z.string().min(1, '案件ID不能为空'),
  type: z.enum([
    'DOCUMENT',
    'PHYSICAL',
    'WITNESS',
    'EXPERT_OPINION',
    'AUDIO_VIDEO',
    'OTHER',
  ]),
  name: z.string().min(1, '证据名称不能为空').max(200),
  description: z.string().max(5000).optional(),
  fileUrl: z.string().url().optional(),
  submitter: z.string().max(100).optional(),
  source: z.string().max(200).optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'QUESTIONED']).optional(),
  relevanceScore: z.number().min(0).max(1).optional(),
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
});

const queryEvidenceSchema = z.object({
  caseId: z.string().optional(),
  type: z
    .enum([
      'DOCUMENT',
      'PHYSICAL',
      'WITNESS',
      'EXPERT_OPINION',
      'AUDIO_VIDEO',
      'OTHER',
    ])
    .optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'QUESTIONED']).optional(),
  submitter: z.string().optional(),
  source: z.string().optional(),
  minRelevanceScore: z.number().min(0).max(1).optional(),
  maxRelevanceScore: z.number().min(0).max(1).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'relevanceScore', 'name'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

type EvidenceDetail = {
  id: string;
  caseId: string;
  type: string;
  name: string;
  description: string | null;
  fileUrl: string | null;
  submitter: string | null;
  source: string | null;
  status: string;
  relevanceScore: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  case?: {
    id: string;
    title: string;
  };
  relations?: unknown[];
};

type EvidenceListResponse = {
  evidence: EvidenceDetail[];
  total: number;
  caseId: string;
  page: number;
  limit: number;
  totalPages: number;
};

async function mapEvidenceToDetail(
  evidence: unknown,
  includeCase = true
): Promise<EvidenceDetail> {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('Invalid evidence data');
  }

  const evidenceObj = evidence as Record<string, unknown>;
  const detail: EvidenceDetail = {
    id: String(evidenceObj.id || ''),
    caseId: String(evidenceObj.caseId || ''),
    type: String(evidenceObj.type || ''),
    name: String(evidenceObj.name || ''),
    description: evidenceObj.description as string | null,
    fileUrl: evidenceObj.fileUrl as string | null,
    submitter: evidenceObj.submitter as string | null,
    source: evidenceObj.source as string | null,
    status: String(evidenceObj.status || ''),
    relevanceScore: evidenceObj.relevanceScore as number | null,
    metadata: evidenceObj.metadata as Record<string, unknown> | null,
    createdAt: new Date(evidenceObj.createdAt as string),
    updatedAt: new Date(evidenceObj.updatedAt as string),
    deletedAt: evidenceObj.deletedAt
      ? new Date(evidenceObj.deletedAt as string)
      : null,
  };

  if (includeCase) {
    const caseObj = evidenceObj.case as Record<string, unknown> | undefined;
    detail.case = {
      id: String(caseObj?.id || ''),
      title: String(caseObj?.title || ''),
    };
  }

  return detail;
}

/**
 * GET /api/evidence - 获取证据列表
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
  const query = queryEvidenceSchema.parse(Object.fromEntries(searchParams));

  const where: Record<string, unknown> = {
    deletedAt: null,
  };

  if (query.caseId) {
    where.caseId = query.caseId;
  }

  if (query.type) {
    where.type = query.type;
  }

  if (query.status) {
    where.status = query.status;
  }

  if (query.submitter) {
    where.submitter = query.submitter;
  }

  if (query.source) {
    where.source = query.source;
  }

  if (
    query.minRelevanceScore !== undefined ||
    query.maxRelevanceScore !== undefined
  ) {
    where.relevanceScore = {};
    if (query.minRelevanceScore !== undefined) {
      (where.relevanceScore as Record<string, unknown>).gte =
        query.minRelevanceScore;
    }
    if (query.maxRelevanceScore !== undefined) {
      (where.relevanceScore as Record<string, unknown>).lte =
        query.maxRelevanceScore;
    }
  }

  const orderBy: Record<string, 'asc' | 'desc'> = {
    [query.sortBy]: query.sortOrder,
  };

  const [evidenceList, total] = await Promise.all([
    prisma.evidence.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy,
      include: {
        case: {
          select: {
            id: true,
            title: true,
          },
        },
        relations: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    }),
    prisma.evidence.count({ where }),
  ]);

  const evidenceDetails = await Promise.all(
    evidenceList.map((e: unknown) => mapEvidenceToDetail(e, true))
  );

  const response: EvidenceListResponse = {
    evidence: evidenceDetails,
    total,
    caseId: query.caseId || '',
    page: query.page,
    limit: query.limit,
    totalPages: Math.ceil(total / query.limit),
  };

  return createSuccessResponse(response, {
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
      hasNext: (query.page - 1) * query.limit + query.limit < total,
      hasPrevious: query.page > 1,
    },
  });
});

/**
 * POST /api/evidence - 创建证据
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
  const validatedData = createEvidenceSchema.parse(body);

  const caseExists = await prisma.case.findFirst({
    where: {
      id: validatedData.caseId,
      userId: authUser.userId,
      deletedAt: null,
    },
  });

  if (!caseExists) {
    return NextResponse.json(
      { error: '案件不存在或无权限', message: '案件不存在或您没有权限访问' },
      { status: 404 }
    );
  }

  const evidence = await prisma.evidence.create({
    data: {
      caseId: validatedData.caseId,
      type: validatedData.type,
      name: validatedData.name,
      description: validatedData.description,
      fileUrl: validatedData.fileUrl,
      submitter: validatedData.submitter || authUser.email,
      source: validatedData.source,
      status: validatedData.status || EvidenceStatus.PENDING,
      relevanceScore: validatedData.relevanceScore,
      metadata: validatedData.metadata as Prisma.InputJsonValue,
    },
    include: {
      case: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  const evidenceDetail = await mapEvidenceToDetail(evidence, true);

  return createCreatedResponse(evidenceDetail);
});

/**
 * OPTIONS /api/evidence - CORS预检请求
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
