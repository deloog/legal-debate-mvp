/**
 * 查询执行器
 *
 * 功能：执行图谱查询语言
 */

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/logger';
import {
  GraphQueryInput,
  GraphQueryResult,
  GraphQueryNode,
  GraphQueryLink,
  GraphQueryAggregate,
  parseQueryInput,
} from './types';

/**
 * 关系数据模型（从Prisma获取）
 */
interface RelationData {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  strength: number | null;
  verificationStatus: string | null;
  discoveryMethod: string | null;
}

/**
 * 图查询执行器类
 */
export class GraphQueryExecutor {
  /**
   * 执行图查询
   *
   * @param input 查询输入
   * @returns 查询结果
   */
  async executeQuery(input: GraphQueryInput): Promise<GraphQueryResult> {
    const startTime = Date.now();
    const parsed = parseQueryInput(input);

    logger.info('开始执行图查询', {
      startNode: parsed.startNode,
      direction: parsed.direction,
      depth: parsed.depth,
      filter: parsed.filter,
      aggregate: parsed.aggregate,
    });

    try {
      // 1. 验证起始节点是否存在
      const startNode = await prisma.lawArticle.findUnique({
        where: { id: parsed.startNode },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          category: true,
        },
      });

      if (!startNode) {
        throw new Error(`起始节点不存在: ${parsed.startNode}`);
      }

      // 2. 执行BFS查找相关节点
      const visitedNodes = await this.executeBFS(
        parsed.startNode,
        parsed.depth,
        parsed.direction
      );

      // 3. 获取所有相关节点信息
      const nodeIds = new Set([parsed.startNode, ...visitedNodes]);
      const articles = await prisma.lawArticle.findMany({
        where: { id: { in: Array.from(nodeIds) } },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          category: true,
        },
      });

      // 4. 构建节点列表
      const nodes: GraphQueryNode[] = articles.map(article => ({
        id: article.id,
        lawName: article.lawName,
        articleNumber: article.articleNumber,
        category: article.category ?? undefined,
        nodeType: 'lawArticle',
      }));

      // 5. 查询相关关系
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          OR: [
            { sourceId: { in: Array.from(nodeIds) } },
            { targetId: { in: Array.from(nodeIds) } },
          ],
        },
      });

      // 6. 应用过滤条件
      const filteredRelations = this.applyFilters(relations, parsed.filter);

      // 7. 构建边列表
      const links: GraphQueryLink[] = filteredRelations.map(rel => ({
        id: rel.id,
        source: rel.sourceId,
        target: rel.targetId,
        relationType: rel.relationType,
        strength: rel.strength ?? undefined,
      }));

      // 8. 如果有聚合要求，计算聚合值
      let aggregateResult: GraphQueryResult['aggregate'];
      if (parsed.aggregate) {
        const aggregateValue = this.aggregateResults(links, parsed.aggregate);
        aggregateResult = {
          type: parsed.aggregate,
          value: aggregateValue,
          field: 'strength',
        };
      }

      // 9. 应用排序和分页
      const sortedLinks = this.sortLinks(
        links,
        parsed.sortBy,
        parsed.sortOrder
      );
      const paginatedLinks = this.paginateLinks(
        sortedLinks,
        parsed.offset,
        parsed.limit
      );

      const queryTime = Date.now() - startTime;

      logger.info('图查询执行完成', {
        nodeCount: nodes.length,
        linkCount: paginatedLinks.length,
        queryTime,
      });

      return {
        nodes,
        links: paginatedLinks,
        aggregate: aggregateResult,
        stats: {
          queryTime,
          nodeCount: nodes.length,
          linkCount: paginatedLinks.length,
        },
      };
    } catch (error) {
      logger.error('图查询执行失败', {
        error,
        startNode: parsed.startNode,
      });
      throw error;
    }
  }

  /**
   * 广度优先搜索（BFS）查找相关节点
   *
   * @param startNodeId 起始节点ID
   * @param maxDepth 最大深度
   * @param direction 查询方向
   * @returns 访问过的节点ID集合
   */
  async executeBFS(
    startNodeId: string,
    maxDepth: number,
    direction: 'in' | 'out' | 'both'
  ): Promise<string[]> {
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = [
      { nodeId: startNodeId, depth: 0 },
    ];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;

      if (visited.has(nodeId) || depth > maxDepth) {
        continue;
      }

      visited.add(nodeId);

      if (depth >= maxDepth) {
        continue;
      }

      // 查询当前节点的关系
      const whereClause: Record<string, unknown> = {};

      if (direction === 'in') {
        whereClause.targetId = nodeId;
      } else if (direction === 'out') {
        whereClause.sourceId = nodeId;
      } else {
        whereClause.OR = [{ sourceId: nodeId }, { targetId: nodeId }];
      }

      const relations = await prisma.lawArticleRelation.findMany({
        where: whereClause,
        select: {
          sourceId: true,
          targetId: true,
        },
      });

      // 添加相邻节点到队列
      for (const rel of relations) {
        if (direction === 'in' || direction === 'both') {
          if (!visited.has(rel.sourceId)) {
            queue.push({ nodeId: rel.sourceId, depth: depth + 1 });
          }
        }
        if (direction === 'out' || direction === 'both') {
          if (!visited.has(rel.targetId)) {
            queue.push({ nodeId: rel.targetId, depth: depth + 1 });
          }
        }
      }
    }

    // 移除起始节点，只返回相邻节点
    visited.delete(startNodeId);
    return Array.from(visited);
  }

  /**
   * 应用过滤条件
   *
   * @param relations 关系列表
   * @param filter 过滤条件
   * @returns 过滤后的关系列表
   */
  private applyFilters(
    relations: RelationData[],
    filter?: GraphQueryInput['filter']
  ): RelationData[] {
    if (!filter) {
      return relations;
    }

    return relations.filter(rel => {
      // 关系类型过滤
      if (filter.relationType && rel.relationType !== filter.relationType) {
        return false;
      }

      // 最小强度过滤
      if (
        filter.minStrength !== undefined &&
        (rel.strength === null || rel.strength < filter.minStrength)
      ) {
        return false;
      }

      // 验证状态过滤
      if (
        filter.verificationStatus &&
        rel.verificationStatus !== filter.verificationStatus
      ) {
        return false;
      }

      // 发现方法过滤
      if (
        filter.discoveryMethod &&
        rel.discoveryMethod !== filter.discoveryMethod
      ) {
        return false;
      }

      return true;
    });
  }

  /**
   * 聚合查询结果
   *
   * @param links 边列表
   * @param aggregateType 聚合类型
   * @returns 聚合结果
   */
  aggregateResults(
    links: Array<{ strength?: number }>,
    aggregateType: GraphQueryAggregate
  ): number {
    if (links.length === 0) {
      return 0;
    }

    const strengths = links
      .map(l => l.strength ?? 0)
      .filter(s => typeof s === 'number');

    switch (aggregateType) {
      case 'count':
        return strengths.length;

      case 'sum':
        return strengths.reduce((sum, s) => sum + s, 0);

      case 'avg':
        if (strengths.length === 0) return 0;
        return strengths.reduce((sum, s) => sum + s, 0) / strengths.length;

      case 'max':
        return Math.max(...strengths, 0);

      case 'min':
        return Math.min(...strengths, 1);

      default:
        return 0;
    }
  }

  /**
   * 排序边列表
   *
   * @param links 边列表
   * @param sortBy 排序字段
   * @param sortOrder 排序方向
   * @returns 排序后的边列表
   */
  private sortLinks(
    links: GraphQueryLink[],
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): GraphQueryLink[] {
    if (!sortBy) {
      return links;
    }

    return [...links].sort((a, b) => {
      let aVal: unknown;
      let bVal: unknown;

      if (sortBy === 'strength') {
        aVal = a.strength ?? 0;
        bVal = b.strength ?? 0;
      } else if (sortBy === 'relationType') {
        aVal = a.relationType;
        bVal = b.relationType;
      } else {
        return 0;
      }

      let comparison = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal;
      } else if (typeof aVal === 'string' && typeof bVal === 'string') {
        comparison = aVal.localeCompare(bVal);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * 分页边列表
   *
   * @param links 边列表
   * @param offset 偏移量
   * @param limit 限制数量
   * @returns 分页后的边列表
   */
  private paginateLinks(
    links: GraphQueryLink[],
    offset: number,
    limit: number
  ): GraphQueryLink[] {
    return links.slice(offset, offset + limit);
  }
}

/**
 * 创建查询执行器实例
 */
export function createQueryExecutor(): GraphQueryExecutor {
  return new GraphQueryExecutor();
}
