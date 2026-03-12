/**
 * 图谱查询API
 *
 * GET /api/v1/law-articles/[id]/graph
 *
 * 功能：
 * 1. 获取指定法条的关系图谱
 * 2. 支持自定义深度参数
 * 3. 参数验证和错误处理
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 获取法条关系图谱
 *
 * @param request - Next.js请求对象
 * @param params - 路由参数
 * @returns 图谱数据或错误信息
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } },
      { status: 401 }
    );
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const depthRaw = parseInt(searchParams.get('depth') || '2', 10);

    // 参数验证（防 DoS：限制深度范围）
    const depth = isNaN(depthRaw) ? 2 : Math.min(Math.max(depthRaw, 0), 10);

    // 验证法条存在
    const article = await prisma.lawArticle.findUnique({
      where: { id },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: '法条不存在' } },
        { status: 404 }
      );
    }

    // 构建图谱数据
    const graph = await GraphBuilder.buildGraph(id, depth);

    return NextResponse.json({ success: true, data: graph });
  } catch (error) {
    logger.error('获取图谱数据失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: '服务器错误' },
      },
      { status: 500 }
    );
  }
}
