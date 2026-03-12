/**
 * 路径查找工具
 *
 * 用于查找法条之间的路径
 */

import type { PrismaClient } from '@prisma/client';
import type { RelationType } from '@prisma/client';
import { GraphAlgorithms } from '../graph-algorithms';
import type { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import { logger } from '@/lib/logger';
import type {
  PathFinderParams,
  PathFinderResult,
  Path,
  ToolResult,
  ToolConfig,
} from './types';
import { DEFAULT_TOOL_CONFIG } from './types';

/**
 * 路径查找工具类
 */
export class PathFinderTool {
  private readonly prisma: PrismaClient;
  private config: ToolConfig;

  constructor(prisma: PrismaClient, config: Partial<ToolConfig> = {}) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_TOOL_CONFIG, ...config };
  }

  /**
   * 获取工具名称
   */
  getName(): string {
    return 'kg_find_path';
  }

  /**
   * 获取工具描述
   */
  getDescription(): string {
    return '查找法条之间的路径，支持最短路径和最强路径';
  }

  /**
   * 获取工具配置
   */
  getConfig(): ToolConfig {
    return { ...this.config };
  }

  /**
   * 更新工具配置
   */
  updateConfig(updates: Partial<ToolConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * 执行路径查找
   */
  async execute(
    params: PathFinderParams
  ): Promise<ToolResult<PathFinderResult>> {
    const startTime = Date.now();

    try {
      // 参数验证
      const validationResult = this.validateParams(params);
      if (!validationResult.valid) {
        logger.error('PathFinderTool 参数验证失败', {
          errors: validationResult.errors,
          params,
        });
        return {
          success: false,
          error: `参数验证失败: ${validationResult.errors.join(', ')}`,
          executionTime: Date.now() - startTime,
        };
      }

      const findShortest = params.findShortest ?? true;
      const findStrongest = params.findStrongest ?? true;
      const maxHops = params.maxHops ?? 10;

      // 加载图数据
      const graph = await this.loadGraphData(params.relationTypes);

      if (graph.nodes.length === 0) {
        return {
          success: false,
          error: '图数据为空',
          executionTime: Date.now() - startTime,
        };
      }

      // 查找源节点和目标节点
      const sourceNode = graph.nodes.find(n => n.id === params.sourceId);
      const targetNode = graph.nodes.find(n => n.id === params.targetId);

      if (!sourceNode || !targetNode) {
        return {
          success: false,
          error: `源节点或目标节点不存在`,
          executionTime: Date.now() - startTime,
        };
      }

      const sourceTitle = `${sourceNode.lawName} 第${sourceNode.articleNumber}条`;
      const targetTitle = `${targetNode.lawName} 第${targetNode.articleNumber}条`;

      // 查找最短路径
      let shortestPath: Path | undefined;
      if (findShortest) {
        shortestPath = await this.findShortestPath(
          graph.nodes,
          graph.links,
          params.sourceId,
          params.targetId,
          maxHops
        );
      }

      // 查找最强路径
      let strongestPath: Path | undefined;
      if (findStrongest) {
        strongestPath = await this.findStrongestPath(
          graph.nodes,
          graph.links,
          params.sourceId,
          params.targetId,
          maxHops
        );
      }

      // 构建统计信息
      const stats = {
        graphSize: graph.nodes.length,
        foundPath: shortestPath?.exists || strongestPath?.exists || false,
      };

      const result: PathFinderResult = {
        sourceId: params.sourceId,
        targetId: params.targetId,
        sourceTitle,
        targetTitle,
        shortestPath,
        strongestPath,
        stats,
      };

      logger.info('PathFinderTool 查找成功', {
        sourceId: params.sourceId,
        targetId: params.targetId,
        foundPath: stats.foundPath,
        executionTime: Date.now() - startTime,
      });

      return {
        success: true,
        data: result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('PathFinderTool 执行失败', {
        error: errorMessage,
        params,
      });
      return {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 验证参数
   */
  private validateParams(params: PathFinderParams): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!params.sourceId || typeof params.sourceId !== 'string') {
      errors.push('sourceId 是必需的字符串');
    }

    if (!params.targetId || typeof params.targetId !== 'string') {
      errors.push('targetId 是必需的字符串');
    }

    if (params.sourceId === params.targetId) {
      errors.push('sourceId 和 targetId 不能相同');
    }

    if (params.maxHops !== undefined) {
      if (
        typeof params.maxHops !== 'number' ||
        params.maxHops < 1 ||
        params.maxHops > 20
      ) {
        errors.push('maxHops 必须是 1-20 之间的数字');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 加载图数据
   */
  private async loadGraphData(
    relationTypes: RelationType[] | undefined
  ): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
    // 构建查询条件
    const where: Record<string, unknown> = {};
    if (relationTypes && relationTypes.length > 0) {
      where.relationType = { in: relationTypes };
    }

    // 加载节点
    const articles = await this.prisma.lawArticle.findMany({
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
      },
    });

    const nodes: GraphNode[] = articles.map(article => ({
      id: article.id,
      lawName: article.lawName,
      articleNumber: article.articleNumber,
      category: article.category,
      level: 0,
    }));

    // 加载边
    const relations = await this.prisma.lawArticleRelation.findMany({
      where,
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
        confidence: true,
      },
    });

    const links: GraphLink[] = relations.map(relation => ({
      source: relation.sourceId,
      target: relation.targetId,
      relationType: relation.relationType,
      strength: relation.strength,
      confidence: relation.confidence,
    }));

    return { nodes, links };
  }

  /**
   * 查找最短路径（使用BFS算法）
   */
  private async findShortestPath(
    nodes: GraphNode[],
    links: GraphLink[],
    sourceId: string,
    targetId: string,
    maxHops: number
  ): Promise<Path> {
    // 使用现有的图算法
    const shortestPathResult = GraphAlgorithms.shortestPath(
      nodes,
      links,
      sourceId,
      targetId
    );

    if (!shortestPathResult.exists || shortestPathResult.pathLength > maxHops) {
      return {
        path: [],
        pathLength: 0,
        hops: 0,
        strength: 0,
        exists: false,
      };
    }

    // 构建路径详情
    const pathDetails = this.buildPathDetails(
      shortestPathResult.path,
      nodes,
      links
    );

    return {
      path: shortestPathResult.path,
      pathLength: shortestPathResult.pathLength,
      hops: shortestPathResult.pathLength,
      strength: pathDetails.strength,
      exists: true,
      nodeDetails: pathDetails.nodeDetails,
    };
  }

  /**
   * 查找最强路径（使用加权算法）
   */
  private async findStrongestPath(
    nodes: GraphNode[],
    links: GraphLink[],
    sourceId: string,
    targetId: string,
    maxHops: number
  ): Promise<Path> {
    // 使用带权重的BFS，优先访问强度高的边
    const linkMap = new Map<string, GraphLink>();
    links.forEach(link => {
      const key = `${link.source}-${link.target}`;
      linkMap.set(key, link);
    });

    // 优先队列：{ nodeId, path, strength, hops }
    const queue: Array<{
      nodeId: string;
      path: string[];
      strength: number;
      hops: number;
    }> = [
      {
        nodeId: sourceId,
        path: [sourceId],
        strength: 0,
        hops: 0,
      },
    ];
    const visited = new Map<string, number>(); // nodeId -> max strength seen

    let bestPath: Path = {
      path: [],
      pathLength: 0,
      hops: 0,
      strength: 0,
      exists: false,
    };

    while (queue.length > 0) {
      // 按强度降序排序
      queue.sort((a, b) => b.strength - a.strength);
      const current = queue.shift();
      if (!current) continue;

      // 如果已经找到目标，且当前强度不比最佳路径强，则停止
      if (bestPath.exists && current.strength <= bestPath.strength) {
        continue;
      }

      const { nodeId, path, strength, hops } = current;

      // 检查是否已经访问过，且当前强度不高于之前的最大强度
      const maxStrengthSeen = visited.get(nodeId) || 0;
      if (strength < maxStrengthSeen) {
        continue;
      }
      visited.set(nodeId, strength);

      // 找到目标
      if (nodeId === targetId) {
        if (!bestPath.exists || strength > bestPath.strength) {
          const pathDetails = this.buildPathDetails(path, nodes, links);
          bestPath = {
            path,
            pathLength: path.length - 1,
            hops,
            strength,
            exists: true,
            nodeDetails: pathDetails.nodeDetails,
          };
        }
        continue;
      }

      // 超过最大跳数
      if (hops >= maxHops) {
        continue;
      }

      // 获取邻居
      const neighbors = links
        .filter(link => link.source === nodeId)
        .map(link => ({
          targetId: link.target,
          edgeStrength: link.strength,
        }));

      // 添加到队列
      for (const neighbor of neighbors) {
        const newStrength = strength + neighbor.edgeStrength;
        const newHops = hops + 1;

        queue.push({
          nodeId: neighbor.targetId,
          path: [...path, neighbor.targetId],
          strength: newStrength,
          hops: newHops,
        });
      }
    }

    return bestPath;
  }

  /**
   * 构建路径详情
   */
  private buildPathDetails(
    path: string[],
    nodes: GraphNode[],
    links: GraphLink[]
  ): { nodeDetails: Path['nodeDetails']; strength: number } {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const linkMap = new Map<string, GraphLink>();
    links.forEach(link => {
      const key = `${link.source}-${link.target}`;
      linkMap.set(key, link);
    });

    const nodeDetails: Path['nodeDetails'] = [];
    let totalStrength = 0;

    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      const node = nodeMap.get(nodeId);

      if (node) {
        const detail: NonNullable<Path['nodeDetails']>[number] = {
          articleId: nodeId,
          title: `${node.lawName} 第${node.articleNumber}条`,
          category: node.category,
        };

        // 添加边信息（除了最后一个节点）
        if (i < path.length - 1) {
          const nextNodeId = path[i + 1];
          const key = `${nodeId}-${nextNodeId}`;
          const link = linkMap.get(key);

          if (link) {
            detail.relationType = link.relationType as RelationType;
            detail.strength = link.strength;
            totalStrength += link.strength;
          }
        }

        nodeDetails.push(detail);
      }
    }

    // 计算平均强度
    const strength = path.length > 1 ? totalStrength / (path.length - 1) : 0;

    return { nodeDetails, strength };
  }
}
