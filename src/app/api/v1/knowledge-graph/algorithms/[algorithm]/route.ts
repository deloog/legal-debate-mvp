/**
 * 知识图谱算法API端点
 *
 * 支持的算法：
 * - shortest-path: 最短路径
 * - degree-centrality: 度中心性
 * - pagerank: PageRank中心性
 * - connected-components: 连通分量分析
 */

import { NextRequest, NextResponse } from 'next/server';
import { GraphBuilder } from '@/lib/law-article/graph-builder';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import { logger } from '@/lib/logger';

/**
 * GET /api/v1/knowledge-graph/algorithms/[algorithm]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { algorithm: string } }
) {
  const algorithm = params.algorithm;
  const searchParams = request.nextUrl.searchParams;

  try {
    // 获取图谱数据
    const graphData = await GraphBuilder.buildFullGraph();

    if (graphData.nodes.length === 0) {
      return NextResponse.json({ error: '图谱数据为空' }, { status: 404 });
    }

    // 根据算法类型路由
    switch (algorithm) {
      case 'shortest-path':
        return handleShortestPath(searchParams, graphData);

      case 'degree-centrality':
        return handleDegreeCentrality(searchParams, graphData);

      case 'pagerank':
        return handlePageRank(searchParams, graphData);

      case 'connected-components':
        return handleConnectedComponents(graphData);

      default:
        return NextResponse.json(
          { error: `不支持的算法: ${algorithm}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    logger.error('执行图算法失败', { algorithm, error });
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 处理最短路径算法
 */
async function handleShortestPath(
  searchParams: URLSearchParams,
  graphData: { nodes: unknown[]; links: unknown[] }
): Promise<NextResponse> {
  const sourceId = searchParams.get('sourceId');
  const targetId = searchParams.get('targetId');

  // 参数验证
  if (!sourceId) {
    return NextResponse.json(
      { error: '缺少必需参数: sourceId' },
      { status: 400 }
    );
  }

  if (!targetId) {
    return NextResponse.json(
      { error: '缺少必需参数: targetId' },
      { status: 400 }
    );
  }

  // 执行算法
  const result = GraphAlgorithms.shortestPath(
    graphData.nodes as GraphNode[],
    graphData.links as GraphLink[],
    sourceId,
    targetId
  );

  return NextResponse.json(result);
}

/**
 * 处理度中心性分析
 */
async function handleDegreeCentrality(
  searchParams: URLSearchParams,
  graphData: { nodes: unknown[]; links: unknown[] }
): Promise<NextResponse> {
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (isNaN(limit) || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: 'limit参数必须在1-100之间' },
      { status: 400 }
    );
  }

  // 执行算法
  const results = GraphAlgorithms.degreeCentrality(
    graphData.nodes as GraphNode[],
    graphData.links as GraphLink[]
  );

  // 限制返回数量
  const limitedResults = results.slice(0, limit);

  return NextResponse.json({
    method: 'degree-centrality',
    results: limitedResults,
    total: results.length,
    returned: limitedResults.length,
  });
}

/**
 * 处理PageRank分析
 */
async function handlePageRank(
  searchParams: URLSearchParams,
  graphData: { nodes: unknown[]; links: unknown[] }
): Promise<NextResponse> {
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const iterations = parseInt(searchParams.get('iterations') || '20', 10);
  const dampingFactor = parseFloat(searchParams.get('dampingFactor') || '0.85');

  // 参数验证
  if (isNaN(limit) || limit < 1 || limit > 100) {
    return NextResponse.json(
      { error: 'limit参数必须在1-100之间' },
      { status: 400 }
    );
  }

  if (isNaN(iterations) || iterations < 5 || iterations > 100) {
    return NextResponse.json(
      { error: 'iterations参数必须在5-100之间' },
      { status: 400 }
    );
  }

  if (isNaN(dampingFactor) || dampingFactor < 0 || dampingFactor > 1) {
    return NextResponse.json(
      { error: 'dampingFactor参数必须在0-1之间' },
      { status: 400 }
    );
  }

  // 执行算法
  const results = GraphAlgorithms.pageRank(
    graphData.nodes as GraphNode[],
    graphData.links as GraphLink[],
    iterations,
    dampingFactor
  );

  // 限制返回数量
  const limitedResults = results.slice(0, limit);

  return NextResponse.json({
    method: 'pagerank',
    iterations,
    dampingFactor,
    results: limitedResults,
    total: results.length,
    returned: limitedResults.length,
  });
}

/**
 * 处理连通分量分析
 */
async function handleConnectedComponents(graphData: {
  nodes: unknown[];
  links: unknown[];
}): Promise<NextResponse> {
  const limit = graphData.nodes.length;

  // 执行算法
  const components = GraphAlgorithms.connectedComponents(
    graphData.nodes as GraphNode[],
    graphData.links as GraphLink[]
  );

  // 限制返回数量（默认返回前10个最大的分量）
  const limitParam = Math.min(limit, 10);
  const limitedComponents = components.slice(0, limitParam);

  return NextResponse.json({
    method: 'connected-components',
    components: limitedComponents,
    total: components.length,
    returned: limitedComponents.length,
  });
}
