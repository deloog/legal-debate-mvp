// =============================================================================
// 知识图谱质量评分系统 - 单个关系质量分数API路由
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/auth-options';
import { logger } from '@/lib/logger';
import {
  checkKnowledgeGraphPermission,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { QualityScoreService } from '@/lib/knowledge-graph/quality-score/quality-score-service';
import { UpdateQualityScoreInput } from '@/lib/knowledge-graph/quality-score/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/knowledge-graph/quality-score/[id]
 * 获取单个关系的质量分数
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 检查权限
    const permissionCheck = await checkKnowledgeGraphPermission(
      session.user.id,
      KnowledgeGraphAction.VIEW_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.reason },
        { status: 403 }
      );
    }

    const service = new QualityScoreService();
    const result = await service.getRelationQualityScore(id);

    logger.info('Relation quality score retrieved', {
      userId: session.user.id,
      relationId: id,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error getting relation quality score', { error });

    if ((error as Error).message === 'Quality score not found') {
      return NextResponse.json(
        {
          success: false,
          error: '质量分数不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: '获取质量分数失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/knowledge-graph/quality-score/[id]
 * 更新单个关系的质量分数
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;

    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 检查权限
    const permissionCheck = await checkKnowledgeGraphPermission(
      session.user.id,
      KnowledgeGraphAction.MANAGE_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.reason },
        { status: 403 }
      );
    }

    const input: UpdateQualityScoreInput = await request.json();
    input.relationId = id;

    const service = new QualityScoreService();
    const result = await service.updateRelationScore(input);

    logger.info('Relation quality score updated', {
      userId: session.user.id,
      relationId: id,
      input,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Error updating relation quality score', { error });
    return NextResponse.json(
      {
        success: false,
        error: '更新质量分数失败',
      },
      { status: 500 }
    );
  }
}
