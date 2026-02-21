/**
 * 关系审核API
 * POST /api/v1/law-article-relations/[id]/verify
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { VerificationStatus } from '@prisma/client';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { logger } from '@/lib/logger';

interface VerifyRequestBody {
  approved: boolean;
  verifiedBy: string;
  note?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 解析请求体
    let body: VerifyRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: '无效的请求体',
        },
        { status: 400 }
      );
    }

    // 参数验证
    if (typeof body.approved !== 'boolean') {
      return NextResponse.json(
        {
          success: false,
          error: 'approved参数是必需的且必须是布尔值',
        },
        { status: 400 }
      );
    }

    if (!body.verifiedBy || typeof body.verifiedBy !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'verifiedBy参数是必需的',
        },
        { status: 400 }
      );
    }

    if (body.verifiedBy.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'verifiedBy不能为空',
        },
        { status: 400 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      body.verifiedBy,
      KnowledgeGraphAction.VERIFY_RELATION,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        {
          success: false,
          error: permissionResult.reason || '权限不足',
        },
        { status: 403 }
      );
    }

    // 查询关系是否存在
    const relation = await prisma.lawArticleRelation.findUnique({
      where: { id: params.id },
    });

    if (!relation) {
      return NextResponse.json(
        {
          success: false,
          error: '关系不存在',
        },
        { status: 404 }
      );
    }

    // 检查是否已经被审核
    if (relation.verificationStatus !== VerificationStatus.PENDING) {
      return NextResponse.json(
        {
          success: false,
          error: '该关系已经被审核',
        },
        { status: 400 }
      );
    }

    // 更新审核状态
    const updatedRelation = await prisma.lawArticleRelation.update({
      where: { id: params.id },
      data: {
        verificationStatus: body.approved
          ? VerificationStatus.VERIFIED
          : VerificationStatus.REJECTED,
        verifiedBy: body.verifiedBy,
        verifiedAt: new Date(),
      },
    });

    // 记录审核操作日志
    try {
      const ipAddress =
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown';
      const userAgent = request.headers.get('user-agent') || 'unknown';

      await logKnowledgeGraphAction({
        userId: body.verifiedBy,
        action: KnowledgeGraphAction.VERIFY_RELATION,
        resource: KnowledgeGraphResource.RELATION,
        resourceId: params.id,
        description: `${body.approved ? '通过' : '拒绝'}法条关系审核`,
        ipAddress,
        userAgent,
        metadata: {
          approved: body.approved,
          note: body.note,
          sourceId: relation.sourceId,
          targetId: relation.targetId,
          relationType: relation.relationType,
        },
      });
    } catch (logError) {
      // 日志记录失败不应影响主流程
      logger.error('记录审核日志失败:', logError);
    }

    return NextResponse.json({
      success: true,
      data: updatedRelation,
    });
  } catch (error) {
    logger.error('审核关系失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '审核关系失败',
      },
      { status: 500 }
    );
  }
}
