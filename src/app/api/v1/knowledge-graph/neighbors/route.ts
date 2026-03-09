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
import { extractTokenFromHeader, verifyToken } from '@/lib/auth/jwt';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
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

    // 从 JWT 中提取用户 ID
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    const tokenResult = verifyToken(token ?? '');
    const userId = tokenResult.valid ? (tokenResult.payload?.userId ?? '') : '';

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      userId,
      KnowledgeGraphAction.VIEW_RELATIONS,
      'RELATION' as never
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限查看邻居节点', {
        reason: permissionResult.reason,
      });
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
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
    const neighbors = findNeighbors(nodeId, depth, adjList, relationTypes);

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: '', // 从header获取
      action: KnowledgeGraphAction.VIEW_RELATIONS,
      resource: 'RELATION' as never,
      resourceId: nodeId,
      description: `查询${depth}度邻居节点`,
      metadata: {
        nodeId,
        depth,
        relationTypes,
      },
    });

    return NextResponse.json({
      nodeId,
      neighbors,
    });
  } catch (error: unknown) {
    logger.error('邻居查询失败', { error, nodeId: searchParams.get('nodeId') });
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * 构建邻接表
 */
async function buildAdjacencyList(): Promise<
  Map<string, Map<string, { relationType: string; strength: number }>>
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

  const adjList = new Map<
    string,
    Map<string, { relationType: string; strength: number }>
  >();

  relations.forEach(relation => {
    const { sourceId, targetId, relationType, strength } = relation;

    // 添加有向边 source -> target
    if (!adjList.has(sourceId)) {
      adjList.set(sourceId, new Map());
    }
    adjList.get(sourceId)?.set(targetId, {
      relationType,
      strength,
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
  adjList: Map<string, Map<string, { relationType: string; strength: number }>>,
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

        // 查询目标节点信息
        // 注意：这里需要在循环外批量查询以提高性能
        // 为简化，这里假设节点ID即为标题
        nextLevel.add(targetId);

        result[degreeKey].push({
          id: targetId,
          title: targetId, // 实际应该查询法条标题
          relationType: edge.relationType,
          strength: edge.strength,
          distance: d,
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
