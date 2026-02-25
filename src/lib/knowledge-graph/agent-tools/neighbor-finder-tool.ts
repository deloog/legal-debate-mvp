/**
 * 邻居查询工具
 *
 * 用于获取法条的N度邻居节点
 */

import type { PrismaClient } from '@prisma/client';
import type { RelationType } from '@prisma/client';
import { RelationType as PrismaRelationType } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  NeighborFinderParams,
  NeighborFinderResult,
  RelationNode,
  RelationEdge,
  ToolResult,
  ToolConfig,
} from './types';
import { DEFAULT_TOOL_CONFIG } from './types';

/**
 * 邻居查询工具类
 */
export class NeighborFinderTool {
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
    return 'kg_get_neighbors';
  }

  /**
   * 获取工具描述
   */
  getDescription(): string {
    return '获取法条的N度邻居节点，支持分层查询';
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
   * 执行邻居查询
   */
  async execute(
    params: NeighborFinderParams
  ): Promise<ToolResult<NeighborFinderResult>> {
    const startTime = Date.now();

    try {
      // 参数验证
      const validationResult = this.validateParams(params);
      if (!validationResult.valid) {
        logger.error('NeighborFinderTool 参数验证失败', {
          errors: validationResult.errors,
          params,
        });
        return {
          success: false,
          error: `参数验证失败: ${validationResult.errors.join(', ')}`,
          executionTime: Date.now() - startTime,
        };
      }

      const maxNodes = params.maxNodes ?? 1000;

      // 查询中心节点
      const centerArticle = await this.prisma.lawArticle.findUnique({
        where: { id: params.nodeId },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          category: true,
          status: true,
        },
      });

      if (!centerArticle) {
        return {
          success: false,
          error: `节点不存在: ${params.nodeId}`,
          executionTime: Date.now() - startTime,
        };
      }

      const centerNode: RelationNode = {
        id: centerArticle.id,
        title: `${centerArticle.lawName} 第${centerArticle.articleNumber}条`,
        category: centerArticle.category,
        status: centerArticle.status as RelationNode['status'],
      };

      // 执行分层邻居查询
      const layers: NeighborFinderResult['layers'] = [];
      const allNeighbors: RelationNode[] = [];
      const visitedNodeIds = new Set<string>([params.nodeId]);
      const totalNodesLimit = maxNodes;

      for (let level = 1; level <= params.depth; level++) {
        // 确定当前层的起始节点
        const startNodes =
          level === 1
            ? [params.nodeId]
            : layers[level - 2].nodes.map(n => n.id);

        // 查询当前层的邻居
        const levelResult = await this.findNeighborsAtLevel(
          startNodes,
          level,
          params.relationTypes,
          visitedNodeIds,
          totalNodesLimit - allNeighbors.length
        );

        if (levelResult.nodes.length === 0) {
          break; // 没有更多邻居了
        }

        layers.push(levelResult);
        allNeighbors.push(...levelResult.nodes);

        if (allNeighbors.length >= totalNodesLimit) {
          break;
        }
      }

      // 构建统计信息
      const byLevel: Record<number, number> = {};
      layers.forEach(layer => {
        byLevel[layer.level] = layer.nodes.length;
      });

      const stats = {
        totalNeighbors: allNeighbors.length,
        byLevel,
      };

      const result: NeighborFinderResult = {
        centerNode,
        layers,
        allNeighbors,
        stats,
      };

      logger.info('NeighborFinderTool 查询成功', {
        nodeId: params.nodeId,
        depth: params.depth,
        neighborCount: allNeighbors.length,
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
      logger.error('NeighborFinderTool 执行失败', {
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
  private validateParams(params: NeighborFinderParams): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!params.nodeId || typeof params.nodeId !== 'string') {
      errors.push('nodeId 是必需的字符串');
    }

    if (
      typeof params.depth !== 'number' ||
      params.depth < 1 ||
      params.depth > 5
    ) {
      errors.push('depth 必须是 1-5 之间的数字');
    }

    if (params.maxNodes !== undefined) {
      if (typeof params.maxNodes !== 'number' || params.maxNodes < 1) {
        errors.push('maxNodes 必须是正整数');
      }
    }

    if (params.relationTypes) {
      if (!Array.isArray(params.relationTypes)) {
        errors.push('relationTypes 必须是数组');
      } else {
        const validTypes = Object.values(PrismaRelationType);
        params.relationTypes.forEach(type => {
          if (!validTypes.includes(type as RelationType)) {
            errors.push(`无效的关系类型: ${type}`);
          }
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 查询指定层的邻居
   */
  private async findNeighborsAtLevel(
    startNodeIds: string[],
    level: number,
    relationTypes: RelationType[] | undefined,
    visitedNodeIds: Set<string>,
    maxNodes: number
  ): Promise<NeighborFinderResult['layers'][number]> {
    const edges: RelationEdge[] = [];
    const neighborIds: string[] = [];

    // 构建查询条件
    const where: Record<string, unknown> = {
      sourceId: { in: startNodeIds },
      targetId: { notIn: Array.from(visitedNodeIds) },
    };

    if (relationTypes && relationTypes.length > 0) {
      where.relationType = { in: relationTypes };
    }

    // 查询关系
    const relations = await this.prisma.lawArticleRelation.findMany({
      where,
      take: maxNodes,
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
        verificationStatus: true,
      },
    });

    for (const relation of relations) {
      // 跳过已访问的节点
      if (visitedNodeIds.has(relation.targetId)) {
        continue;
      }

      // 添加边
      edges.push({
        id: relation.id,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        relationType: relation.relationType as RelationType,
        strength: relation.strength,
        verificationStatus:
          relation.verificationStatus as RelationEdge['verificationStatus'],
      });

      neighborIds.push(relation.targetId);
      visitedNodeIds.add(relation.targetId);
    }

    // 批量查询邻居节点信息
    let nodes: RelationNode[] = [];

    if (neighborIds.length > 0) {
      const articles = await this.prisma.lawArticle.findMany({
        where: {
          id: { in: neighborIds },
        },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          category: true,
          status: true,
        },
      });

      nodes = articles.map(article => ({
        id: article.id,
        title: `${article.lawName} 第${article.articleNumber}条`,
        category: article.category,
        status: article.status as RelationNode['status'],
      }));
    }

    return {
      level,
      nodes,
      edges,
    };
  }
}
