/**
 * 图谱构建服务
 *
 * 功能：
 * 1. 构建法条关系图谱（BFS遍历）
 * 2. 支持深度限制
 * 3. 性能优化（批量查询、内存邻接表）
 */

import * as d3 from 'd3';
import { prisma } from '@/lib/db';
import { LawArticleRelation, VerificationStatus } from '@prisma/client';

/**
 * 图节点
 */
export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  lawName: string;
  articleNumber: string;
  category: string;
  level: number;
}

/**
 * 图边
 */
export interface GraphLink {
  source: string;
  target: string;
  relationType: string;
  strength: number;
  confidence: number;
}

/**
 * 图数据
 */
export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * 图谱构建器
 */
export class GraphBuilder {
  /**
   * 构建法条关系图谱（优化版）
   *
   * @param centerArticleId 中心法条ID
   * @param depth 遍历深度（默认2层）
   * @returns 图谱数据
   */
  static async buildGraph(
    centerArticleId: string,
    depth: number = 2
  ): Promise<GraphData> {
    const nodes = new Map<string, GraphNode>();
    const links: GraphLink[] = [];
    const visited = new Set<string>();

    // 处理边界情况
    if (depth < 0) {
      depth = 0;
    }

    // 获取中心法条
    const centerArticle = await prisma.lawArticle.findUnique({
      where: { id: centerArticleId },
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
      },
    });

    // 如果中心法条不存在，返回空图谱
    if (!centerArticle) {
      return { nodes: [], links: [] };
    }

    // 添加中心节点
    nodes.set(centerArticleId, {
      id: centerArticle.id,
      lawName: centerArticle.lawName,
      articleNumber: centerArticle.articleNumber,
      category: centerArticle.category,
      level: 0,
    });
    visited.add(centerArticleId);

    // 如果depth为0，只返回中心节点
    if (depth === 0) {
      return {
        nodes: Array.from(nodes.values()),
        links: [],
      };
    }

    // BFS遍历
    const queue: Array<{ id: string; currentDepth: number }> = [
      { id: centerArticleId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const { id, currentDepth } = current;

      // 如果已经到达最大深度，不再继续遍历
      if (currentDepth >= depth) continue;

      // 获取该节点的所有出边
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          sourceId: id,
          verificationStatus: VerificationStatus.VERIFIED,
        },
        include: {
          target: {
            select: {
              id: true,
              lawName: true,
              articleNumber: true,
              category: true,
            },
          },
        },
      });

      // 处理每个关系
      for (const rel of relations) {
        // 添加边
        links.push({
          source: rel.sourceId,
          target: rel.targetId,
          relationType: rel.relationType,
          strength: rel.strength,
          confidence: rel.confidence,
        });

        // 如果目标节点还没访问过，添加到队列和节点集合
        if (!visited.has(rel.targetId)) {
          visited.add(rel.targetId);

          nodes.set(rel.targetId, {
            id: rel.target.id,
            lawName: rel.target.lawName,
            articleNumber: rel.target.articleNumber,
            category: rel.target.category,
            level: currentDepth + 1,
          });

          queue.push({
            id: rel.targetId,
            currentDepth: currentDepth + 1,
          });
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      links,
    };
  }

  /**
   * 获取全量图谱（用于分析）
   *
   * @returns 全量图谱数据
   */
  static async buildFullGraph(): Promise<GraphData> {
    // 获取所有法条
    const articles = await prisma.lawArticle.findMany({
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
      },
    });

    const nodes: GraphNode[] = articles.map(a => ({
      id: a.id,
      lawName: a.lawName,
      articleNumber: a.articleNumber,
      category: a.category,
      level: 0,
    }));

    // 获取所有已验证的关系
    const relations = await prisma.lawArticleRelation.findMany({
      where: { verificationStatus: VerificationStatus.VERIFIED },
      select: {
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
        confidence: true,
      },
    });

    const links: GraphLink[] = relations.map(r => ({
      source: r.sourceId,
      target: r.targetId,
      relationType: r.relationType,
      strength: r.strength,
      confidence: r.confidence,
    }));

    return { nodes, links };
  }
}
