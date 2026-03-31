/**
 * 法条社区检测 API
 *
 * GET /api/knowledge-graph/communities?articleId=<id>&depth=<n>
 *
 * 使用标签传播算法对以指定法条为中心的子图进行社区划分，
 * 返回节点ID到社区颜色的映射，供前端图谱可视化使用。
 */

import { NextRequest, NextResponse } from 'next/server';
import { CommunityService } from '@/lib/knowledge-graph/community/community-service';
import { getAuthUser } from '@/lib/middleware/auth';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, message: '请先登录' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const articleId = searchParams.get('articleId');
  const depth = Math.min(parseInt(searchParams.get('depth') ?? '2'), 3);

  if (!articleId) {
    return NextResponse.json(
      { success: false, message: '缺少 articleId 参数' },
      { status: 400 }
    );
  }

  try {
    const result = await CommunityService.getCommunityColors(articleId, depth);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error(
      '社区检测接口异常',
      error instanceof Error ? error : undefined,
      { articleId }
    );
    return NextResponse.json(
      { success: false, message: '服务器错误' },
      { status: 500 }
    );
  }
}
