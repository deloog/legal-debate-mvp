/**
 * 知识图谱最新快照API
 *
 * - GET /api/v1/knowledge-graph/snapshots/latest - 获取最新快照
 */
import { NextRequest, NextResponse } from 'next/server';
import { snapshotService } from '@/lib/knowledge-graph/version-control';

/**
 * GET /api/v1/knowledge-graph/snapshots/latest
 * 获取最新快照
 */
export async function GET(_request: NextRequest) {
  try {
    const snapshot = await snapshotService.getLatestSnapshot();

    if (!snapshot) {
      return NextResponse.json(
        { success: false, error: '暂无快照' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: snapshot,
    });
  } catch (error) {
    console.error('获取最新快照失败:', error);
    return NextResponse.json(
      { success: false, error: '获取最新快照失败' },
      { status: 500 }
    );
  }
}
