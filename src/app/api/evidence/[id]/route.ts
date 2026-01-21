import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { EvidenceStatus } from '@/types/evidence';

const updateEvidenceSchema = z.object({
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
  name: z.string().min(1).max(200).optional(),
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
 * GET /api/evidence/[id] - 获取证据详情
 */
export const GET = withErrorHandler(
  async (request: NextRequest, { params }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const evidenceId = params.id;

    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        deletedAt: null,
      },
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
    });

    if (!evidence) {
      return NextResponse.json(
        { error: '证据不存在', message: '请求的证据不存在' },
        { status: 404 }
      );
    }

    const evidenceDetail = await mapEvidenceToDetail(evidence, true);

    return createSuccessResponse(evidenceDetail);
  }
);

/**
 * PUT /api/evidence/[id] - 更新证据
 */
export const PUT = withErrorHandler(
  async (request: NextRequest, { params }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const evidenceId = params.id;
    const body = await request.json();
    const validatedData = updateEvidenceSchema.parse(body);

    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        deletedAt: null,
      },
      include: {
        case: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: '证据不存在', message: '请求的证据不存在' },
        { status: 404 }
      );
    }

    if (evidence.case?.userId !== authUser.userId) {
      return NextResponse.json(
        { error: '无权限', message: '您没有权限修改此证据' },
        { status: 403 }
      );
    }

    const updatedEvidence = await prisma.evidence.update({
      where: {
        id: evidenceId,
      },
      data: {
        type: validatedData.type as
          | Prisma.EnumEvidenceTypeFieldUpdateOperationsInput
          | undefined,
        name: validatedData.name as string | undefined,
        description: validatedData.description,
        fileUrl: validatedData.fileUrl,
        submitter: validatedData.submitter as string | undefined,
        source: validatedData.source as string | undefined,
        status: validatedData.status as EvidenceStatus | undefined,
        relevanceScore: validatedData.relevanceScore,
        metadata: validatedData.metadata as Prisma.InputJsonValue | undefined,
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

    const evidenceDetail = await mapEvidenceToDetail(updatedEvidence, true);

    return createSuccessResponse(evidenceDetail, {
      message: '证据更新成功',
    });
  }
);

/**
 * DELETE /api/evidence/[id] - 删除证据
 */
export const DELETE = withErrorHandler(
  async (request: NextRequest, { params }) => {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: '未认证', message: '请先登录' },
        { status: 401 }
      );
    }

    const evidenceId = params.id;

    const evidence = await prisma.evidence.findFirst({
      where: {
        id: evidenceId,
        deletedAt: null,
      },
      include: {
        case: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!evidence) {
      return NextResponse.json(
        { error: '证据不存在', message: '请求的证据不存在' },
        { status: 404 }
      );
    }

    if (evidence.case?.userId !== authUser.userId) {
      return NextResponse.json(
        { error: '无权限', message: '您没有权限删除此证据' },
        { status: 403 }
      );
    }

    await prisma.evidence.update({
      where: {
        id: evidenceId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: '证据删除成功',
      },
      { status: 200 }
    );
  }
);
