/**
 * 关系查询工具
 *
 * 用于查询法条之间的关系网络
 */

import type { PrismaClient } from '@prisma/client';
import type { RelationType } from '@prisma/client';
import { RelationType as PrismaRelationType } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  RelationSearchParams,
  RelationSearchResult,
  RelationNode,
  RelationEdge,
  ToolResult,
  ToolConfig,
} from './types';
import { DEFAULT_TOOL_CONFIG } from './types';

/**
 * 关系查询工具类
 */
export class RelationSearchTool {
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
    return 'kg_search_relations';
  }

  /**
   * 获取工具描述
   */
  getDescription(): string {
    return '查询法条之间的关系网络，包括引用、冲突、补全、替代等关系';
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
   * 执行关系查询
   */
  async execute(
    params: RelationSearchParams
  ): Promise<ToolResult<RelationSearchResult>> {
    const startTime = Date.now();

    try {
      // 参数验证
      const validationResult = this.validateParams(params);
      if (!validationResult.valid) {
        logger.error('RelationSearchTool 参数验证失败', {
          errors: validationResult.errors,
          params,
        });
        return {
          success: false,
          error: `参数验证失败: ${validationResult.errors.join(', ')}`,
          executionTime: Date.now() - startTime,
        };
      }

      // 查询中心法条
      const centerArticle = await this.prisma.lawArticle.findUnique({
        where: { id: params.articleId },
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
          error: `法条不存在: ${params.articleId}`,
          executionTime: Date.now() - startTime,
        };
      }

      const centerNode: RelationNode = {
        id: centerArticle.id,
        title: `${centerArticle.lawName} 第${centerArticle.articleNumber}条`,
        category: centerArticle.category,
        status: centerArticle.status as RelationNode['status'],
      };

      // 查询关系
      const edges: RelationEdge[] = [];
      const nodes: RelationNode[] = [];
      const visitedNodeIds = new Set<string>([params.articleId]);
      const depth = params.depth ?? 1;

      // 执行多跳查询
      await this.searchRelations(
        params.articleId,
        1,
        depth,
        params.relationTypes,
        params.bidirectional ?? false,
        edges,
        nodes,
        visitedNodeIds,
        this.config.maxResults
      );

      // 构建统计信息
      const stats = this.buildStats(edges, nodes);

      const result: RelationSearchResult = {
        centerNode,
        nodes,
        edges,
        stats,
      };

      logger.info('RelationSearchTool 查询成功', {
        articleId: params.articleId,
        depth,
        nodeCount: nodes.length,
        edgeCount: edges.length,
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
      logger.error('RelationSearchTool 执行失败', {
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
  private validateParams(params: RelationSearchParams): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!params.articleId || typeof params.articleId !== 'string') {
      errors.push('articleId 是必需的字符串');
    }

    if (params.depth !== undefined) {
      if (
        typeof params.depth !== 'number' ||
        params.depth < 1 ||
        params.depth > 3
      ) {
        errors.push('depth 必须是 1-3 之间的数字');
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
   * 递归搜索关系（多跳查询）
   */
  private async searchRelations(
    currentNodeId: string,
    currentDepth: number,
    maxDepth: number,
    relationTypes?: RelationType[],
    bidirectional: boolean = false,
    edges: RelationEdge[] = [],
    nodes: RelationNode[] = [],
    visitedNodeIds: Set<string> = new Set(),
    maxResults: number = 1000
  ): Promise<void> {
    // 如果达到最大深度或结果数量限制，停止
    if (currentDepth > maxDepth || nodes.length >= maxResults) {
      return;
    }

    // 构建查询条件
    const where: Record<string, unknown> = {};

    if (bidirectional) {
      where.OR = [{ sourceId: currentNodeId }, { targetId: currentNodeId }];
    } else {
      where.sourceId = currentNodeId;
    }

    if (relationTypes && relationTypes.length > 0) {
      where.relationType = { in: relationTypes };
    }

    // 查询关系
    const relations = await this.prisma.lawArticleRelation.findMany({
      where,
      take: maxResults - nodes.length,
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
        verificationStatus: true,
      },
    });

    // 处理查询结果
    const neighborIds: string[] = [];

    for (const relation of relations) {
      // 确定邻居节点ID
      const neighborId =
        relation.sourceId === currentNodeId
          ? relation.targetId
          : relation.sourceId;

      // 跳过已访问的节点
      if (visitedNodeIds.has(neighborId)) {
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

      neighborIds.push(neighborId);
      visitedNodeIds.add(neighborId);
    }

    // 批量查询邻居节点信息
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

      for (const article of articles) {
        nodes.push({
          id: article.id,
          title: `${article.lawName} 第${article.articleNumber}条`,
          category: article.category,
          status: article.status as RelationNode['status'],
        });
      }

      // 递归查询下一层
      for (const nodeId of neighborIds) {
        if (nodes.length >= maxResults) {
          break;
        }
        await this.searchRelations(
          nodeId,
          currentDepth + 1,
          maxDepth,
          relationTypes,
          bidirectional,
          edges,
          nodes,
          visitedNodeIds,
          maxResults
        );
      }
    }
  }

  /**
   * 构建统计信息
   */
  private buildStats(
    edges: RelationEdge[],
    nodes: RelationNode[]
  ): RelationSearchResult['stats'] {
    // 按类型统计边
    const byRelationType: Record<string, number> = {};
    for (const edge of edges) {
      byRelationType[edge.relationType] =
        (byRelationType[edge.relationType] || 0) + 1;
    }

    return {
      totalNodes: nodes.length + 1, // 包括中心节点
      totalEdges: edges.length,
      byRelationType: byRelationType as Record<RelationType, number>,
    };
  }
}
