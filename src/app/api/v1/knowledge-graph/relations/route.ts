/**
 * 知识图谱关系创建API
 *
 * 功能：独立创建法条关系的端点（与审核端点分离）
 *
 * 端点: POST /api/v1/knowledge-graph/relations
 * 参数:
 *   - sourceId: 源法条ID
 *   - targetId: 目标法条ID
 *   - relationType: 关系类型
 *   - confidence: 置信度（可选，默认0.7）
 *   - createdBy: 创建人ID
 *   - evidence: 证据（可选）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { RelationType } from '@prisma/client';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { logger } from '@/lib/logger';

interface CreateRelationRequestBody {
  sourceId: string;
  targetId: string;
  relationType: RelationType;
  confidence?: number;
  createdBy: string;
  evidence?: Record<string, unknown>;
}

interface CreateRelationResponse {
  success: boolean;
  relation?: Record<string, unknown>;
  error?: string;
}

// 默认置信度
const DEFAULT_CONFIDENCE = 0.7;

/**
 * POST /api/v1/knowledge-graph/relations
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateRelationResponse>> {
  try {
    // 解析请求体
    let body: CreateRelationRequestBody;
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
    if (!body.sourceId || typeof body.sourceId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数: sourceId',
        },
        { status: 400 }
      );
    }

    if (!body.targetId || typeof body.targetId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数: targetId',
        },
        { status: 400 }
      );
    }

    if (!body.relationType || typeof body.relationType !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数: relationType',
        },
        { status: 400 }
      );
    }

    if (!body.createdBy || typeof body.createdBy !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: '缺少必需参数: createdBy',
        },
        { status: 400 }
      );
    }

    if (body.createdBy.trim() === '') {
      return NextResponse.json(
        {
          success: false,
          error: 'createdBy不能为空',
        },
        { status: 400 }
      );
    }

    // 验证confidence参数
    let confidence = body.confidence ?? DEFAULT_CONFIDENCE;
    if (typeof confidence === 'number') {
      if (confidence < 0 || confidence > 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'confidence参数必须在0-1之间',
          },
          { status: 400 }
        );
      }
    } else {
      confidence = DEFAULT_CONFIDENCE;
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      body.createdBy,
      KnowledgeGraphAction.MANAGE_RELATIONS,
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

    // 验证源法条和目标法条是否存在
    const sourceArticle = await prisma.lawArticle.findUnique({
      where: { id: body.sourceId },
      select: { id: true, lawName: true, articleNumber: true },
    });

    if (!sourceArticle) {
      return NextResponse.json(
        {
          success: false,
          error: '源法条不存在',
        },
        { status: 404 }
      );
    }

    const targetArticle = await prisma.lawArticle.findUnique({
      where: { id: body.targetId },
      select: { id: true, lawName: true, articleNumber: true },
    });

    if (!targetArticle) {
      return NextResponse.json(
        {
          success: false,
          error: '目标法条不存在',
        },
        { status: 404 }
      );
    }

    // 检查关系是否已存在
    const existingRelation = await prisma.lawArticleRelation.findFirst({
      where: {
        sourceId: body.sourceId,
        targetId: body.targetId,
        relationType: body.relationType,
      },
    });

    if (existingRelation) {
      return NextResponse.json(
        {
          success: false,
          error: '关系已存在',
        },
        { status: 409 }
      );
    }

    // 创建关系
    const createData = {
      sourceId: body.sourceId,
      targetId: body.targetId,
      relationType: body.relationType,
      confidence,
      strength: confidence,
      verificationStatus: 'PENDING' as const,
      createdBy: body.createdBy,
      discoveryMethod: 'MANUAL' as const,
      ...(body.evidence ? { evidence: body.evidence as never } : {}),
    };

    const newRelation = await prisma.lawArticleRelation.create({
      data: createData,
    });

    // 记录操作日志
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    await logKnowledgeGraphAction({
      userId: body.createdBy,
      action: KnowledgeGraphAction.MANAGE_RELATIONS,
      resource: KnowledgeGraphResource.RELATION,
      resourceId: newRelation.id,
      description: `创建法条关系: ${sourceArticle.lawName}${sourceArticle.articleNumber} -> ${targetArticle.lawName}${targetArticle.articleNumber}`,
      ipAddress,
      userAgent,
      metadata: {
        sourceId: body.sourceId,
        targetId: body.targetId,
        relationType: body.relationType,
        confidence,
      },
    });

    return NextResponse.json(
      {
        success: true,
        relation: newRelation,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('创建关系失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: '创建关系失败',
      },
      { status: 500 }
    );
  }
}
