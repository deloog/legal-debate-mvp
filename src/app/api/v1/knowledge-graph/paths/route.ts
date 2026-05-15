/**
 * 知识图谱路径查询API
 *
 * 功能：查找法条之间的最短路径
 *
 * 端点: GET /api/v1/knowledge-graph/paths
 * 参数:
 *   - sourceId: 源法条ID
 *   - targetId: 目标法条ID
 *   - maxDepth: 最大深度（可选，默认5，最大10）
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

// 最大路径深度限制
const MAX_PATH_DEPTH = 10;
const DEFAULT_MAX_DEPTH = 5;

/**
 * GET /api/v1/knowledge-graph/paths
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = new URL(request.url).searchParams;

  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VIEW_RELATIONS,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限查询路径', {
        userId: authUser.userId,
        reason: permissionResult.reason,
      });
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    // 参数验证
    const sourceId = searchParams.get('sourceId');
    const targetId = searchParams.get('targetId');

    if (!sourceId || !targetId) {
      logger.warn('路径查询缺少必需参数', { sourceId, targetId });
      return NextResponse.json(
        {
          error: sourceId ? '缺少必需参数: targetId' : '缺少必需参数: sourceId',
        },
        { status: 400 }
      );
    }

    // 验证节点ID格式（防止注入）
    const idPattern = /^[a-zA-Z0-9_-]+$/;
    if (!idPattern.test(sourceId) || !idPattern.test(targetId)) {
      return NextResponse.json({ error: '节点ID格式无效' }, { status: 400 });
    }

    const maxDepthParam = searchParams.get('maxDepth');
    let maxDepth = DEFAULT_MAX_DEPTH;

    if (maxDepthParam) {
      maxDepth = parseInt(maxDepthParam, 10);

      if (isNaN(maxDepth) || maxDepth < 1 || maxDepth > MAX_PATH_DEPTH) {
        return NextResponse.json(
          { error: `maxDepth参数必须在1-${MAX_PATH_DEPTH}之间` },
          { status: 400 }
        );
      }
    }

    // 获取图谱数据
    const graphData = await GraphBuilder.buildFullGraph();

    if (graphData.nodes.length === 0) {
      return NextResponse.json({ error: '图谱数据为空' }, { status: 404 });
    }

    // 验证节点是否存在
    const nodeIds = new Set(graphData.nodes.map(n => n.id));
    if (!nodeIds.has(sourceId)) {
      return NextResponse.json(
        { error: `源节点不存在: ${sourceId}` },
        { status: 404 }
      );
    }
    if (!nodeIds.has(targetId)) {
      return NextResponse.json(
        { error: `目标节点不存在: ${targetId}` },
        { status: 404 }
      );
    }

    // 执行最短路径算法
    const result = GraphAlgorithms.shortestPath(
      graphData.nodes,
      graphData.links,
      sourceId,
      targetId
    );

    // 如果路径长度超过限制，返回提示
    if (result.exists && result.pathLength > maxDepth) {
      return NextResponse.json({
        sourceId,
        targetId,
        path: [],
        pathLength: -1,
        relationTypes: [],
        exists: false,
        message: `路径长度(${result.pathLength})超过最大深度限制(${maxDepth})`,
      });
    }

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: KnowledgeGraphResource.GRAPH,
      description: `查询法条路径: ${sourceId} -> ${targetId}`,
      metadata: {
        sourceId,
        targetId,
        maxDepth,
        pathLength: result.pathLength,
        exists: result.exists,
      },
    });

    return NextResponse.json({
      sourceId,
      targetId,
      maxDepth,
      path: result.path,
      pathLength: result.pathLength,
      relationTypes: result.relationTypes,
      exists: result.exists,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    logger.error('路径查询失败', {
      error: errorMessage,
      sourceId: searchParams.get('sourceId'),
      targetId: searchParams.get('targetId'),
    });
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
  }
}
