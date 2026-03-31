/**
 * 知识图谱算法API端点
 *
 * 支持的算法：
 * - shortest-path: 最短路径
 * - degree-centrality: 度中心性
 * - pagerank: PageRank中心性
 * - connected-components: 连通分量分析
 * - label-propagation: 标签传播（社区检测）
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

// 支持的算法列表
const SUPPORTED_ALGORITHMS = [
  'shortest-path',
  'degree-centrality',
  'pagerank',
  'connected-components',
  'label-propagation',
] as const;

type AlgorithmType = (typeof SUPPORTED_ALGORITHMS)[number];

/**
 * GET /api/v1/knowledge-graph/algorithms/[algorithm]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ algorithm: string }> }
) {
  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    const algorithm = (await params).algorithm as AlgorithmType;

    // 验证算法类型
    if (!SUPPORTED_ALGORITHMS.includes(algorithm)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ALGORITHM',
            message: `不支持的算法: ${algorithm}。支持的算法: ${SUPPORTED_ALGORITHMS.join(', ')}`,
          },
        },
        { status: 400 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VIEW_STATS,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '权限不足' } },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;

    // 获取图谱数据（带限制防止内存溢出）
    const graphData = await GraphBuilder.buildFullGraph();

    if (graphData.nodes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'EMPTY_GRAPH', message: '图谱数据为空' },
        },
        { status: 404 }
      );
    }

    // 限制节点数量防止DoS
    const MAX_NODES = 10000;
    if (graphData.nodes.length > MAX_NODES) {
      logger.warn('图谱节点数量超过限制', {
        nodeCount: graphData.nodes.length,
        maxNodes: MAX_NODES,
        userId: authUser.userId,
      });
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GRAPH_TOO_LARGE',
            message: `图谱节点数量(${graphData.nodes.length})超过限制(${MAX_NODES})，请使用更具体的查询`,
          },
        },
        { status: 400 }
      );
    }

    // 根据算法类型路由
    let result: unknown;
    switch (algorithm) {
      case 'shortest-path':
        result = await handleShortestPath(
          searchParams,
          graphData,
          authUser.userId
        );
        break;

      case 'degree-centrality':
        result = await handleDegreeCentrality(
          searchParams,
          graphData,
          authUser.userId
        );
        break;

      case 'pagerank':
        result = await handlePageRank(searchParams, graphData, authUser.userId);
        break;

      case 'connected-components':
        result = await handleConnectedComponents(graphData, authUser.userId);
        break;

      case 'label-propagation':
        result = await handleLabelPropagation(
          searchParams,
          graphData,
          authUser.userId
        );
        break;

      default:
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_ALGORITHM',
              message: `不支持的算法: ${algorithm}`,
            },
          },
          { status: 400 }
        );
    }

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.VIEW_STATS,
      resource: KnowledgeGraphResource.GRAPH,
      description: `执行图算法: ${algorithm}`,
      metadata: {
        algorithm,
        nodeCount: graphData.nodes.length,
        linkCount: graphData.links.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    const algorithm = (await params).algorithm;
    logger.error('执行图算法失败', { algorithm, error });
    const errorMessage = '服务器错误';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
  }
}

/**
 * 处理最短路径算法
 */
async function handleShortestPath(
  searchParams: URLSearchParams,
  graphData: { nodes: GraphNode[]; links: GraphLink[] },
  _userId: string
): Promise<unknown> {
  const sourceId = searchParams.get('sourceId');
  const targetId = searchParams.get('targetId');

  // 参数验证
  if (!sourceId) {
    return { error: '缺少必需参数: sourceId', code: 'MISSING_PARAM' };
  }

  if (!targetId) {
    return { error: '缺少必需参数: targetId', code: 'MISSING_PARAM' };
  }

  // 验证节点存在
  const nodeIds = new Set(graphData.nodes.map(n => n.id));
  if (!nodeIds.has(sourceId)) {
    return { error: `源节点不存在: ${sourceId}`, code: 'NODE_NOT_FOUND' };
  }
  if (!nodeIds.has(targetId)) {
    return { error: `目标节点不存在: ${targetId}`, code: 'NODE_NOT_FOUND' };
  }

  // 执行算法
  const result = GraphAlgorithms.shortestPath(
    graphData.nodes,
    graphData.links,
    sourceId,
    targetId
  );

  return {
    algorithm: 'shortest-path',
    ...result,
  };
}

/**
 * 处理度中心性分析
 */
async function handleDegreeCentrality(
  searchParams: URLSearchParams,
  graphData: { nodes: GraphNode[]; links: GraphLink[] },
  _userId: string
): Promise<unknown> {
  const limitParam = searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 20;

  if (isNaN(limit) || limit < 1 || limit > 100) {
    return { error: 'limit参数必须在1-100之间', code: 'INVALID_PARAM' };
  }

  // 执行算法
  const results = GraphAlgorithms.degreeCentrality(
    graphData.nodes,
    graphData.links
  );

  // 限制返回数量
  const limitedResults = results.slice(0, limit);

  return {
    algorithm: 'degree-centrality',
    results: limitedResults,
    total: results.length,
    returned: limitedResults.length,
  };
}

/**
 * 处理PageRank分析
 */
async function handlePageRank(
  searchParams: URLSearchParams,
  graphData: { nodes: GraphNode[]; links: GraphLink[] },
  _userId: string
): Promise<unknown> {
  const limitParam = searchParams.get('limit');
  const iterationsParam = searchParams.get('iterations');
  const dampingFactorParam = searchParams.get('dampingFactor');

  const limit = limitParam ? parseInt(limitParam, 10) : 20;
  const iterations = iterationsParam ? parseInt(iterationsParam, 10) : 20;
  const dampingFactor = dampingFactorParam
    ? parseFloat(dampingFactorParam)
    : 0.85;

  // 参数验证
  if (isNaN(limit) || limit < 1 || limit > 100) {
    return { error: 'limit参数必须在1-100之间', code: 'INVALID_PARAM' };
  }

  if (isNaN(iterations) || iterations < 5 || iterations > 100) {
    return { error: 'iterations参数必须在5-100之间', code: 'INVALID_PARAM' };
  }

  if (isNaN(dampingFactor) || dampingFactor < 0 || dampingFactor > 1) {
    return { error: 'dampingFactor参数必须在0-1之间', code: 'INVALID_PARAM' };
  }

  // 执行算法
  const results = GraphAlgorithms.pageRank(
    graphData.nodes,
    graphData.links,
    iterations,
    dampingFactor
  );

  // 限制返回数量
  const limitedResults = results.slice(0, limit);

  return {
    algorithm: 'pagerank',
    iterations,
    dampingFactor,
    results: limitedResults,
    total: results.length,
    returned: limitedResults.length,
  };
}

/**
 * 处理连通分量分析
 */
async function handleConnectedComponents(
  graphData: { nodes: GraphNode[]; links: GraphLink[] },
  _userId: string
): Promise<unknown> {
  // 执行算法
  const components = GraphAlgorithms.connectedComponents(
    graphData.nodes,
    graphData.links
  );

  // 限制返回数量（默认返回前10个最大的分量）
  const limitParam = Math.min(components.length, 10);
  const limitedComponents = components.slice(0, limitParam);

  return {
    algorithm: 'connected-components',
    components: limitedComponents,
    total: components.length,
    returned: limitedComponents.length,
  };
}

/**
 * 处理标签传播算法（社区检测）
 */
async function handleLabelPropagation(
  searchParams: URLSearchParams,
  graphData: { nodes: GraphNode[]; links: GraphLink[] },
  _userId: string
): Promise<unknown> {
  const maxIterationsParam = searchParams.get('maxIterations');
  const maxIterations = maxIterationsParam
    ? parseInt(maxIterationsParam, 10)
    : 20;

  if (isNaN(maxIterations) || maxIterations < 1 || maxIterations > 100) {
    return { error: 'maxIterations参数必须在1-100之间', code: 'INVALID_PARAM' };
  }

  // 执行算法
  const communityMap = GraphAlgorithms.labelPropagation(
    graphData.nodes,
    graphData.links,
    maxIterations
  );

  // 转换为数组格式
  const communities = new Map<number, string[]>();
  for (const [nodeId, communityId] of communityMap.entries()) {
    if (!communities.has(communityId)) {
      communities.set(communityId, []);
    }
    communities.get(communityId)!.push(nodeId);
  }

  return {
    algorithm: 'label-propagation',
    maxIterations,
    communityCount: communities.size,
    communities: Array.from(communities.entries()).map(([id, nodes]) => ({
      id,
      nodeCount: nodes.length,
      nodes: nodes.slice(0, 100), // 限制每社区返回的节点数
    })),
  };
}
