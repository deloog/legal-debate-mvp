// =============================================================================
// 知识图谱质量评分系统 - 质量预警API路由
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import {
  checkKnowledgeGraphPermission,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';
import { QualityScoreService } from '@/lib/knowledge-graph/quality-score/quality-score-service';

/**
 * GET /api/v1/knowledge-graph/quality-score/warning
 * 触发质量预警
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    // 检查权限
    const permissionCheck = await checkKnowledgeGraphPermission(
      authUser.userId,
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
    const warnings = await service.triggerQualityWarning();

    logger.info('Quality warning triggered', {
      userId: authUser.userId,
      warningCount: warnings.length,
    });

    return NextResponse.json({
      success: true,
      data: warnings,
    });
  } catch (error) {
    logger.error('Error triggering quality warning', { error });
    return NextResponse.json(
      {
        success: false,
        error: '触发质量预警失败',
      },
      { status: 500 }
    );
  }
}
