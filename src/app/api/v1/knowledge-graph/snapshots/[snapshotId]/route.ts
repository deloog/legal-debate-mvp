/**
 * 知识图谱快照详情API
 *
 * 提供单个快照的操作接口：
 * - GET /api/v1/knowledge-graph/snapshots/[snapshotId] - 获取快照详情
 * - GET /api/v1/knowledge-graph/snapshots/[snapshotId]/compare - 比较快照
 */
import { NextRequest, NextResponse } from 'next/server';
import { snapshotService } from '@/lib/knowledge-graph/version-control';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/knowledge-graph/snapshots/[snapshotId]
 * 获取快照详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ snapshotId: string }> }
) {
  try {
    const { snapshotId } = await params;
    const snapshot = await snapshotService.getSnapshot(snapshotId);

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: '快照不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    logger.error('获取快照详情失败:', error);
    return NextResponse.json(
      { success: false, error: '获取快照详情失败' },
      { status: 500 }
    );
  }
}
