// =============================================================================
// 知识图谱质量评分系统 - API路由
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
import {
  BatchQualityScoreInput,
  LowQualityRelationsInput,
  UpdateQualityScoreInput,
  RelationQualityData,
  QualityStats,
  LowQualityRelation,
} from '@/lib/knowledge-graph/quality-score/types';

/**
 * GET /api/v1/knowledge-graph/quality-score
 * 获取质量统计
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 检查权限
    const permissionCheck = await checkKnowledgeGraphPermission(
      session.user.id,
      KnowledgeGraphAction.VIEW_STATS,
      KnowledgeGraphResource.STATS
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.reason },
        { status: 403 }
      );
    }

    const service = new QualityScoreService();
    const stats = await service.getQualityStats();

    logger.info('Quality stats retrieved', { userId: session.user.id });

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Error getting quality stats', { error });
    return NextResponse.json(
      {
        success: false,
        error: '获取质量统计失败',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/knowledge-graph/quality-score
 * 批量计算质量分数
 */
export async function POST(request: NextRequest) {
  try {
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

    const input: BatchQualityScoreInput = await request.json();

    const service = new QualityScoreService();
    const results = await service.batchCalculateQuality(input);

    logger.info('Batch quality score calculation completed', {
      userId: session.user.id,
      count: results.length,
    });

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error in batch quality score calculation', { error });
    return NextResponse.json(
      {
        success: false,
        error: '批量计算质量分数失败',
      },
      { status: 500 }
    );
  }
}
