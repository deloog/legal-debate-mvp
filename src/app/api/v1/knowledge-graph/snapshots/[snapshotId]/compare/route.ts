/**
 * 知识图谱快照比较API
 *
 * - GET /api/v1/knowledge-graph/snapshots/[snapshotId]/compare?compareWithId=xxx - 比较快照
 */
import { NextRequest, NextResponse } from 'next/server';
import { snapshotService } from '@/lib/knowledge-graph/version-control';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';
import {
  checkKnowledgeGraphPermission,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

/**
 * GET /api/v1/knowledge-graph/snapshots/[snapshotId]/compare
 * 比较两个快照
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: '未授权' },
      { status: 401 }
    );
  }

  const permissionResult = await checkKnowledgeGraphPermission(
    authUser.userId,
    KnowledgeGraphAction.VIEW_STATS,
    KnowledgeGraphResource.GRAPH
  );

  if (!permissionResult.hasPermission) {
    return NextResponse.json(
      { success: false, error: '权限不足' },
      { status: 403 }
    );
  }

  try {
    const { snapshotId } = await params;
    const { searchParams } = new URL(request.url);
    const compareWithId = searchParams.get('compareWithId');

    if (!compareWithId) {
      return NextResponse.json(
        { success: false, error: '缺少compareWithId参数' },
        { status: 400 }
      );
    }

    const comparison = await snapshotService.compareSnapshots(
      snapshotId,
      compareWithId
    );

    if (!comparison) {
      return NextResponse.json(
        { success: false, error: '快照不存在或比较失败' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    logger.error('比较快照失败:', error);
    return NextResponse.json(
      { success: false, error: '比较快照失败' },
      { status: 500 }
    );
  }
}
