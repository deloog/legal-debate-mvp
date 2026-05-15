/**
 * 知识图谱邻居查询API
 *
 * 功能：获取法条的N度邻居节点
 *
 * 端点: GET /api/v1/knowledge-graph/neighbors
 * 参数:
 *   - nodeId: 节点ID
 *   - depth: 深度（1-5）
 *   - relationTypes: 关系类型过滤（可选）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

/**
 * 邻居节点信息
 */
interface NeighborInfo {
  id: string;
  title: string;
  relationType: string;
  strength: number;
  distance: number;
  category?: string;
  sourceId: string;
  targetId: string;
  direction: 'outgoing' | 'incoming';
}

interface NeighborEdge {
  neighborId: string;
  relationType: string;
  strength: number;
  sourceId: string;
  targetId: string;
  direction: 'outgoing' | 'incoming';
}

/**
 * GET /api/v1/knowledge-graph/neighbors
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  try {
    // 参数验证
    const nodeId = searchParams.get('nodeId');
    const depthParam = searchParams.get('depth');
    const relationTypesParam = searchParams.get('relationTypes');

    if (!nodeId) {
      logger.warn('邻居查询缺少 nodeId 参数');
      return NextResponse.json(
        { error: '缺少必需参数: nodeId' },
        { status: 400 }
      );
    }

    const depth = parseInt(depthParam || '1', 10);

    if (isNaN(depth) || depth < 1 || depth > 5) {
      return NextResponse.json(
        { error: 'depth参数必须在1-5之间' },
        { status: 400 }
      );
    }

    // 解析关系类型过滤
    let relationTypes: string[] = [];
    if (relationTypesParam) {
      relationTypes = relationTypesParam
        .split(',')
        .map(type => type.trim())
        .filter(type => type.length > 0);
    }

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

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.VIEW_RELATIONS,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限查看邻居节点', {
        userId: authUser.userId,
        reason: permissionResult.reason,
      });
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '权限不足' } },
        { status: 403 }
      );
    }

    // 查询源节点
    const sourceNode = await prisma.lawArticle.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
      },
    });

    if (!sourceNode) {
      return NextResponse.json({ error: '未找到该节点' }, { status: 404 });
    }

    // 构建邻接表
    const adjList = await buildAdjacencyList();

    // 查找N度邻居
    const neighbors = await hydrateNeighbors(
      findNeighbors(nodeId, depth, adjList, relationTypes)
    );

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: KnowledgeGraphResource.GRAPH,
      resourceId: nodeId,
      description: `查询${depth}度邻居节点`,
      metadata: {
        nodeId,
        depth,
        relationTypes,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        nodeId,
        neighbors,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    logger.error('邻居查询失败', {
      error: errorMessage,
      nodeId: searchParams.get('nodeId'),
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

/**
 * 构建邻接表
 */
async function buildAdjacencyList(): Promise<
  Map<string, Map<string, NeighborEdge>>
> {
  const relations = await prisma.lawArticleRelation.findMany({
    where: {
      verificationStatus: 'VERIFIED',
    },
    select: {
      sourceId: true,
      targetId: true,
      relationType: true,
      strength: true,
    },
  });

  const adjList = new Map<string, Map<string, NeighborEdge>>();

  relations.forEach(relation => {
    const { sourceId, targetId, relationType, strength } = relation;

    // 邻居探索按无向图展开，避免只存在入边的法条在用户侧“消失”。
    // 但返回时保留原始 source/target，前端仍可解释真实法条关系方向。
    if (!adjList.has(sourceId)) {
      adjList.set(sourceId, new Map());
    }
    adjList.get(sourceId)?.set(targetId, {
      neighborId: targetId,
      relationType,
      strength,
      sourceId,
      targetId,
      direction: 'outgoing',
    });

    if (!adjList.has(targetId)) {
      adjList.set(targetId, new Map());
    }
    adjList.get(targetId)?.set(sourceId, {
      neighborId: sourceId,
      relationType,
      strength,
      sourceId,
      targetId,
      direction: 'incoming',
    });
  });

  return adjList;
}

/**
 * 查找N度邻居
 */
function findNeighbors(
  nodeId: string,
  depth: number,
  adjList: Map<string, Map<string, NeighborEdge>>,
  relationTypes: string[]
): Record<string, NeighborInfo[]> {
  const result: Record<string, NeighborInfo[]> = {
    degree1: [],
    degree2: [],
    degree3: [],
    degree4: [],
    degree5: [],
  };

  const visited = new Set<string>([nodeId]);
  const currentLevel = new Set<string>([nodeId]);

  for (let d = 1; d <= depth; d++) {
    const nextLevel = new Set<string>();
    const degreeKey = `degree${d}` as keyof typeof result;

    for (const currentId of currentLevel) {
      const edges = adjList.get(currentId) || new Map();

      for (const [targetId, edge] of edges.entries()) {
        // 跳过已访问节点
        if (visited.has(targetId)) {
          continue;
        }

        // 跳过不符合关系类型过滤的边
        if (
          relationTypes.length > 0 &&
          !relationTypes.includes(edge.relationType)
        ) {
          continue;
        }

        nextLevel.add(targetId);

        result[degreeKey].push({
          id: targetId,
          title: targetId,
          relationType: edge.relationType,
          strength: edge.strength,
          distance: d,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          direction: edge.direction,
        });
      }
    }

    // 添加新访问的节点
    nextLevel.forEach(id => visited.add(id));

    // 下一层的起点是当前层的终点
    currentLevel.clear();
    nextLevel.forEach(id => currentLevel.add(id));
  }

  return result;
}

async function hydrateNeighbors(
  neighbors: Record<string, NeighborInfo[]>
): Promise<Record<string, NeighborInfo[]>> {
  const neighborIds = Array.from(
    new Set(
      Object.values(neighbors).flatMap(items => items.map(item => item.id))
    )
  );

  if (neighborIds.length === 0) {
    return neighbors;
  }

  const articles = await prisma.lawArticle.findMany({
    where: { id: { in: neighborIds } },
    select: {
      id: true,
      lawName: true,
      articleNumber: true,
      category: true,
    },
  });

  const articleMap = new Map(articles.map(article => [article.id, article]));

  return Object.fromEntries(
    Object.entries(neighbors).map(([degree, items]) => [
      degree,
      items.map(item => {
        const article = articleMap.get(item.id);
        if (!article) {
          return item;
        }

        return {
          ...item,
          title: `${article.lawName}${article.articleNumber}`,
          category: article.category ?? undefined,
        };
      }),
    ])
  ) as Record<string, NeighborInfo[]>;
}
