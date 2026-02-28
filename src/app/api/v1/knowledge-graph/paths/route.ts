/**
 * 知识图谱路径查询API
 *
 * 功能：查找法条之间的最短路径
 *
 * 端点: GET /api/v1/knowledge-graph/paths
 * 参数:
 *   - sourceId: 源法条ID
 *   - targetId: 目标法条ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import { logger } from '@/lib/logger';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
} from '@/lib/middleware/knowledge-graph-permission';

/**
 * GET /api/v1/knowledge-graph/paths
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams;

  try {
    // 参数验证
    const sourceId = searchParams.get('sourceId');

    if (!sourceId) {
      return NextResponse.json(
        { error: '缺少必需参数: sourceId' },
        { status: 400 }
      );
    }

    const targetId = searchParams.get('targetId');

    if (!targetId) {
      return NextResponse.json(
        { error: '缺少必需参数: targetId' },
        { status: 400 }
      );
    }

    const maxDepthParam = searchParams.get('maxDepth');
    let maxDepth = 5; // 默认深度

    if (maxDepthParam) {
      maxDepth = parseInt(maxDepthParam, 10);

      if (isNaN(maxDepth) || maxDepth < 1 || maxDepth > 10) {
        return NextResponse.json(
          { error: 'maxDepth参数必须在1-10之间' },
          { status: 400 }
        );
      }
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      '', // 用户ID从header中获取
      KnowledgeGraphAction.VIEW_RELATIONS,
      'RELATION' as never
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限查询路径', {
        reason: permissionResult.reason,
      });
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 获取图谱数据
    const graphData = await GraphBuilder.buildFullGraph();

    if (graphData.nodes.length === 0) {
      return NextResponse.json({ error: '图谱数据为空' }, { status: 404 });
    }

    // 执行最短路径算法
    const result = GraphAlgorithms.shortestPath(
      graphData.nodes,
      graphData.links,
      sourceId,
      targetId
    );

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: '', // 从header获取
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: 'RELATION' as never,
      description: `查询法条路径: ${sourceId} -> ${targetId}`,
      metadata: {
        sourceId,
        targetId,
        pathLength: result.pathLength,
        exists: result.exists,
      },
    });

    return NextResponse.json({
      sourceId,
      targetId,
      path: result.path,
      pathLength: result.pathLength,
      relationTypes: result.relationTypes,
      exists: result.exists,
    });
  } catch (error: unknown) {
    logger.error('路径查询失败', {
      error,
      sourceId: searchParams.get('sourceId'),
    });
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
