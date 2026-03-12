import { NextRequest, NextResponse } from 'next/server';
import type { EvidenceStatus, EvidenceType } from '@prisma/client';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createSuccessResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';

import { logger } from '@/lib/logger';

// 更新证据验证模式
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

// 证据详情类型
interface EvidenceDetail {
  id: string;
  caseId: string;
  type: EvidenceType;
  name: string;
  description: string | null;
  fileUrl: string | null;
  submitter: string | null;
  source: string | null;
  status: EvidenceStatus;
  relevanceScore: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  case?: {
    id: string;
    title: string;
    userId: string;
  };
  relations?: unknown[];
}

// 映射证据到详情
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
    type: String(evidenceObj.type || '') as EvidenceType,
    name: String(evidenceObj.name || ''),
    description: evidenceObj.description as string | null,
    fileUrl: evidenceObj.fileUrl as string | null,
    submitter: evidenceObj.submitter as string | null,
    source: evidenceObj.source as string | null,
    status: String(evidenceObj.status || '') as EvidenceStatus,
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
      userId: String(caseObj?.userId || ''),
    };
  }

  const relationsObj = evidenceObj.relations;
  if (relationsObj && Array.isArray(relationsObj)) {
    detail.relations = relationsObj;
  }

  return detail;
}

/**
 * 权限检查函数
 * 检查用户是否有权访问指定证据
 */
async function checkEvidenceOwnership(
  evidenceId: string,
  userId: string
): Promise<{
  evidence: Record<string, unknown> | null;
  hasPermission: boolean;
}> {
  const evidence = await prisma.evidence.findFirst({
    where: { id: evidenceId, deletedAt: null },
    include: {
      case: {
        select: { id: true, title: true, userId: true },
      },
      relations: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!evidence) {
    return { evidence: null, hasPermission: false };
  }

  // 检查所有权
  const evidenceObj = evidence as unknown as Record<string, unknown>;
  const caseObj = evidenceObj.case as Record<string, unknown> | undefined;
  const hasPermission = caseObj?.userId === userId;

  return { evidence: evidenceObj, hasPermission };
}

/**
 * GET /api/evidence/[id]
 * 获取证据详情
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

    const { id: evidenceId } = await params;

    const { evidence, hasPermission } = await checkEvidenceOwnership(
      evidenceId,
      authUser.userId
    );

    if (!evidence) {
      return NextResponse.json(
        { error: '证据不存在', message: '请求的证据不存在' },
        { status: 404 }
      );
    }

    if (!hasPermission) {
      logger.warn('用户尝试访问无权访问的证据:', {
        userId: authUser.userId,
        evidenceId,
      });
      return NextResponse.json(
        { error: '无权限', message: '您没有权限查看此证据' },
        { status: 403 }
      );
    }

    return createSuccessResponse(await mapEvidenceToDetail(evidence, true));
  }
);

/**
 * PUT /api/evidence/[id]
 * 更新证据
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

    const { id: evidenceId } = await params;

    const { evidence, hasPermission } = await checkEvidenceOwnership(
      evidenceId,
      authUser.userId
    );

    if (!evidence) {
      return NextResponse.json(
        { error: '证据不存在', message: '请求的证据不存在' },
        { status: 404 }
      );
    }

    if (!hasPermission) {
      logger.warn('用户尝试更新无权访问的证据:', {
        userId: authUser.userId,
        evidenceId,
      });
      return NextResponse.json(
        { error: '无权限', message: '您没有权限修改此证据' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = updateEvidenceSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.description !== undefined)
      updateData.description = validatedData.description;
    if (validatedData.fileUrl !== undefined)
      updateData.fileUrl = validatedData.fileUrl;
    if (validatedData.submitter !== undefined)
      updateData.submitter = validatedData.submitter;
    if (validatedData.source !== undefined)
      updateData.source = validatedData.source;
    if (validatedData.status !== undefined)
      updateData.status = validatedData.status;
    if (validatedData.relevanceScore !== undefined)
      updateData.relevanceScore = validatedData.relevanceScore;
    if (validatedData.metadata !== undefined)
      updateData.metadata = validatedData.metadata;

    const updatedEvidence = await prisma.evidence.update({
      where: { id: evidenceId },
      data: updateData,
      include: {
        case: { select: { id: true, title: true, userId: true } },
        relations: { orderBy: { createdAt: 'desc' } },
      },
    });

    logger.info('证据更新成功:', {
      userId: authUser.userId,
      evidenceId,
      updatedFields: Object.keys(updateData),
    });

    return createSuccessResponse(
      await mapEvidenceToDetail(updatedEvidence, true)
    );
  }
);

/**
 * DELETE /api/evidence/[id]
 * 删除证据（软删除）
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

    const { id: evidenceId } = await params;

    const { evidence, hasPermission } = await checkEvidenceOwnership(
      evidenceId,
      authUser.userId
    );

    if (!evidence) {
      return NextResponse.json(
        { error: '证据不存在', message: '请求的证据不存在' },
        { status: 404 }
      );
    }

    if (!hasPermission) {
      logger.warn('用户尝试删除无权访问的证据:', {
        userId: authUser.userId,
        evidenceId,
      });
      return NextResponse.json(
        { error: '无权限', message: '您没有权限删除此证据' },
        { status: 403 }
      );
    }

    await prisma.evidence.update({
      where: { id: evidenceId },
      data: { deletedAt: new Date() },
    });

    logger.info('证据删除成功:', {
      userId: authUser.userId,
      evidenceId,
    });

    return NextResponse.json(
      { success: true, message: '证据删除成功' },
      { status: 200 }
    );
  }
);
