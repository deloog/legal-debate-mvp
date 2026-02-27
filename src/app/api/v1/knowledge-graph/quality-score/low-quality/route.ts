// =============================================================================
// 知识图谱质量评分系统 - 低质量关系查询API路由
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
import { LowQualityRelationsInput, QualityLevel } from '@/lib/knowledge-graph/quality-score/types';

/**
 * GET /api/v1/knowledge-graph/quality-score/low-quality
 * 获取低质量关系列表
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
      KnowledgeGraphAction.VIEW_RELATIONS,
      KnowledgeGraphResource.RELATION
    );

    if (!permissionCheck.hasPermission) {
      return NextResponse.json(
        { error: permissionCheck.reason },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const input: LowQualityRelationsInput = {
      qualityLevel: (searchParams.get('qualityLevel') as QualityLevel | null) ?? 'low',
      limit: parseInt(searchParams.get('limit') || '10', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    };

    const service = new QualityScoreService();
    const results = await service.getLowQualityRelations(input);

    logger.info('Low quality relations retrieved', {
      userId: session.user.id,
      input,
    });

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    logger.error('Error getting low quality relations', { error });
    return NextResponse.json(
      {
        success: false,
        error: '获取低质量关系失败',
      },
      { status: 500 }
    );
  }
}
