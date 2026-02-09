import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { uuidSchema } from '@/app/api/lib/validation/schemas';
import { validatePathParam } from '@/app/api/lib/validation/validator';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  EvidenceListItem,
  EvidenceStatus,
  EvidenceType,
} from '@/types/evidence';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * 案件证据列表查询参数schema
 */
const evidenceQuerySchema = z.object({
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
  minRelevanceScore: z
    .string()
    .transform(val => Number.parseFloat(val))
    .pipe(z.number().min(0).max(1))
    .optional(),
  maxRelevanceScore: z
    .string()
    .transform(val => Number.parseFloat(val))
    .pipe(z.number().min(0).max(1))
    .optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'relevanceScore', 'name'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

async function mapEvidenceToListItem(
  evidence: unknown
): Promise<EvidenceListItem> {
  if (!evidence || typeof evidence !== 'object') {
    throw new Error('Invalid evidence data');
  }

  const evidenceObj = evidence as Record<string, unknown>;
  return {
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
    relations: evidenceObj.relations as unknown[] | undefined,
  };
}

/**
 * GET /api/cases/[id]/evidence - 获取案件证据列表
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
    const validatedCaseId = validatePathParam(id, uuidSchema);

    const { searchParams } = new URL(request.url);
    const query = evidenceQuerySchema.parse(Object.fromEntries(searchParams));

    // 检查案件权限
    const caseItem = await prisma.case.findFirst({
      where: {
        id: validatedCaseId,
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        title: true,
      },
    });

    if (!caseItem) {
      return NextResponse.json(
        { error: '案件不存在', message: '请求的案件不存在' },
        { status: 404 }
      );
    }

    if (caseItem.userId !== authUser.userId) {
      return NextResponse.json(
        { error: '无权限', message: '您没有权限访问此案件' },
        { status: 403 }
      );
    }

    const where: Record<string, unknown> = {
      caseId: validatedCaseId,
      deletedAt: null,
    };

    if (query.type) {
      where.type = query.type as EvidenceType;
    }

    if (query.status) {
      where.status = query.status as EvidenceStatus;
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
          relations: {
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      }),
      prisma.evidence.count({ where }),
    ]);

    const evidenceItems = await Promise.all(
      evidenceList.map((e: unknown) => mapEvidenceToListItem(e))
    );

    return createSuccessResponse({
      caseId: validatedCaseId,
      caseTitle: caseItem.title,
      evidence: evidenceItems,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    });
  }
);

/**
 * OPTIONS /api/cases/[id]/evidence - CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
