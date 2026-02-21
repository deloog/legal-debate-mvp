import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/app/api/lib/errors/error-handler';
import { createCreatedResponse } from '@/app/api/lib/responses/success';
import { prisma } from '@/lib/db/prisma';
import { getAuthUser } from '@/lib/middleware/auth';
import { z } from 'zod';
import { EvidenceRelationType } from '@/types/evidence';
import { logger } from '@/lib/logger';

/**
 * 创建证据关联的验证schema
 */
const createRelationSchema = z.object({
  relationType: z.enum(['LEGAL_REFERENCE', 'ARGUMENT', 'FACT', 'OTHER']),
  relatedId: z.string().min(1, '关联ID不能为空'),
  description: z.string().max(500).optional(),
});

/**
 * POST /api/evidence/[id]/relations - 创建证据关联
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

    const evidenceId = (await params).id;

    // 验证请求体
    const body = await request.json();
    const validatedData = createRelationSchema.parse(body);

    // 查询证据信息
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

    // 检查权限：用户只能为自己的证据创建关联
    if (evidence.case?.userId !== authUser.userId) {
      return NextResponse.json(
        { error: '无权限', message: '您没有权限为此证据创建关联' },
        { status: 403 }
      );
    }

    // 检查是否已存在相同的关联
    const existingRelation = await prisma.evidenceRelation.findFirst({
      where: {
        evidenceId,
        relationType: validatedData.relationType,
        relatedId: validatedData.relatedId,
      },
    });

    if (existingRelation) {
      return NextResponse.json(
        { error: '关联已存在', message: '该关联关系已存在' },
        { status: 409 }
      );
    }

    // 创建证据关联
    const relation = await prisma.evidenceRelation.create({
      data: {
        evidenceId,
        relationType: validatedData.relationType as EvidenceRelationType,
        relatedId: validatedData.relatedId,
        description: validatedData.description,
      },
    });

    // 获取关联的详细信息（可选：查询relatedId对应的信息）
    let relatedTitle: string | undefined;
    let relatedType: string | undefined;

    try {
      // 尝试查询是否为法条引用
      if (validatedData.relationType === 'LEGAL_REFERENCE') {
        const lawArticle = await prisma.lawArticle.findUnique({
          where: { id: validatedData.relatedId },
          select: { articleNumber: true },
        });
        if (lawArticle) {
          relatedTitle = lawArticle.articleNumber;
          relatedType = '法条';
        }
      }
      // 可以扩展其他类型的查询
    } catch (error) {
      // 忽略查询related信息的错误，不影响主流程
      logger.error('查询关联信息失败:', error);
    }

    const relationDetail = {
      id: relation.id,
      evidenceId: relation.evidenceId,
      relationType: relation.relationType,
      relatedId: relation.relatedId,
      description: relation.description,
      relatedTitle,
      relatedType,
      createdAt: relation.createdAt,
    };

    return createCreatedResponse(relationDetail, {
      message: '证据关联创建成功',
    });
  }
);

/**
 * OPTIONS /api/evidence/[id]/relations - CORS预检请求
 */
export const OPTIONS = withErrorHandler(async () => {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin':
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
});
