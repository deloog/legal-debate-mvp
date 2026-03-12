/**
 * 图距离推荐器
 *
 * 利用法条关系图谱的多跳路径，计算候选法条与目标法条的图距离，
 * 生成比单跳邻居推荐更丰富的相关法条列表，并附带推理路径说明。
 */

import { prisma } from '../db';
import { VerificationStatus } from '@prisma/client';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import type { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import { logger } from '@/lib/logger';
import type { RecommendationResult } from './recommendation-service';

/** 图距离推荐结果（扩展基础推荐结果，增加路径信息） */
export interface GraphDistanceRecommendation extends RecommendationResult {
  pathInfo: {
    pathLength: number;
    relationTypes: string[];
    pathLabel: string; // 可读的关系链描述，如"替代 → 补全"
  };
}

/** 距离 → 基础分数映射 */
const DISTANCE_SCORE: Record<number, number> = { 1: 0.9, 2: 0.6, 3: 0.3 };

/** 关系类型权重（重要关系得分更高） */
const RELATION_WEIGHT: Record<string, number> = {
  SUPERSEDES: 1.0,
  SUPERSEDED_BY: 0.9,
  CONFLICTS: 0.85,
  COMPLETES: 0.85,
  COMPLETED_BY: 0.85,
  IMPLEMENTS: 0.75,
  IMPLEMENTED_BY: 0.75,
  CITES: 0.6,
  CITED_BY: 0.6,
  RELATED: 0.5,
};

/** 关系类型中文标签 */
const RELATION_LABEL: Record<string, string> = {
  SUPERSEDES: '替代',
  SUPERSEDED_BY: '被替代',
  CONFLICTS: '冲突',
  COMPLETES: '补全',
  COMPLETED_BY: '被补全',
  IMPLEMENTS: '实施',
  IMPLEMENTED_BY: '被实施',
  CITES: '引用',
  CITED_BY: '被引用',
  RELATED: '相关',
};

/** 子图最大节点数（防止 OOM） */
const MAX_NODES = 300;
/** 最大搜索深度 */
const MAX_DEPTH = 3;

export class GraphDistanceRecommender {
  /**
   * 基于图距离推荐相关法条
   * @param articleId 目标法条 ID
   * @param limit 返回数量上限
   */
  static async recommend(
    articleId: string,
    limit = 10
  ): Promise<GraphDistanceRecommendation[]> {
    try {
      // 1. 加载以 articleId 为中心的局部子图（最多 MAX_DEPTH 跳）
      const { nodes, links } = await this.loadLocalSubgraph(articleId);

      if (nodes.length <= 1) return [];

      // 2. 对每个候选节点计算最短路径
      const candidates = nodes.filter(n => n.id !== articleId);
      const scored: Array<{
        candidateId: string;
        pathLength: number;
        relationTypes: string[];
      }> = [];

      for (const candidate of candidates) {
        const result = GraphAlgorithms.shortestPath(
          nodes,
          links,
          articleId,
          candidate.id
        );
        if (result.exists && result.pathLength >= 1 && result.pathLength <= MAX_DEPTH) {
          scored.push({
            candidateId: candidate.id,
            pathLength: result.pathLength,
            relationTypes: result.relationTypes,
          });
        }
      }

      if (scored.length === 0) return [];

      // 3. 计算综合得分并排序
      const rankedCandidates = scored
        .map(item => {
          const distScore = DISTANCE_SCORE[item.pathLength] ?? 0.1;
          const maxTypeWeight =
            item.relationTypes.length > 0
              ? Math.max(
                  ...item.relationTypes.map(t => RELATION_WEIGHT[t] ?? 0.5)
                )
              : 0.5;
          return { ...item, score: distScore * maxTypeWeight };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit * 2); // 多取一些，兜底数据库查不到的情况

      // 4. 批量加载法条详情
      const candidateIds = rankedCandidates.map(c => c.candidateId);
      const articles = await prisma.lawArticle.findMany({
        where: { id: { in: candidateIds } },
      });
      const articleMap = new Map(articles.map(a => [a.id, a]));

      // 5. 组装结果
      const results: GraphDistanceRecommendation[] = [];
      for (const item of rankedCandidates) {
        const article = articleMap.get(item.candidateId);
        if (!article) continue;

        const pathLabel =
          item.relationTypes.length > 0
            ? item.relationTypes.map(t => RELATION_LABEL[t] ?? t).join(' → ')
            : '直接关联';

        results.push({
          article,
          score: item.score,
          reason:
            item.pathLength === 1
              ? `直接相关（${pathLabel}）`
              : `通过 ${item.pathLength} 步关系链关联：${pathLabel}`,
          pathInfo: {
            pathLength: item.pathLength,
            relationTypes: item.relationTypes,
            pathLabel,
          },
        });
      }

      return results.slice(0, limit);
    } catch (error) {
      logger.error(
        '图距离推荐失败',
        error instanceof Error ? error : undefined,
        { articleId }
      );
      return [];
    }
  }

  /**
   * 从数据库加载局部子图（BFS，限制节点数）
   */
  private static async loadLocalSubgraph(
    articleId: string
  ): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
    const visitedIds = new Set<string>([articleId]);
    const linkSet = new Set<string>(); // 去重用
    const allLinks: GraphLink[] = [];
    let frontier = [articleId];

    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      if (frontier.length === 0 || visitedIds.size >= MAX_NODES) break;

      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          OR: [
            { sourceId: { in: frontier } },
            { targetId: { in: frontier } },
          ],
          verificationStatus: VerificationStatus.VERIFIED,
        },
        select: {
          sourceId: true,
          targetId: true,
          relationType: true,
          strength: true,
          confidence: true,
        },
        take: MAX_NODES,
      });

      const newFrontier: string[] = [];

      for (const rel of relations) {
        const linkKey = `${rel.sourceId}-${rel.targetId}-${rel.relationType}`;
        if (!linkSet.has(linkKey)) {
          linkSet.add(linkKey);
          allLinks.push({
            source: rel.sourceId,
            target: rel.targetId,
            relationType: rel.relationType,
            strength: Number(rel.strength ?? 0.5),
            confidence: Number(rel.confidence ?? 0.5),
          });
        }

        for (const nodeId of [rel.sourceId, rel.targetId]) {
          if (!visitedIds.has(nodeId) && visitedIds.size < MAX_NODES) {
            visitedIds.add(nodeId);
            newFrontier.push(nodeId);
          }
        }
      }

      frontier = newFrontier;
    }

    // 批量加载节点法条数据
    const articles = await prisma.lawArticle.findMany({
      where: { id: { in: Array.from(visitedIds) } },
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

    return { nodes, links: allLinks };
  }
}
