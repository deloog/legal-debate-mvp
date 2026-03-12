/**
 * 法条社区检测服务
 *
 * 使用标签传播算法（Label Propagation）对法条知识图谱进行社区划分，
 * 返回节点到社区颜色的映射，供前端图谱可视化使用。
 */

import { prisma } from '@/lib/db';
import { GraphAlgorithms } from '@/lib/knowledge-graph/graph-algorithms';
import type { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import { logger } from '@/lib/logger';

/** 社区颜色调色板（最多支持20个社区） */
const COMMUNITY_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#06b6d4', // cyan
  '#d946ef', // fuchsia
  '#eab308', // yellow
  '#10b981', // emerald
  '#8b5cf6', // violet
  '#f43f5e', // rose
  '#0ea5e9', // sky
  '#78716c', // stone
  '#64748b', // slate
  '#6b7280', // gray
];

export interface CommunityColorResult {
  /** 节点ID -> 社区颜色 HEX 值 */
  nodeColors: Record<string, string>;
  /** 社区图例 */
  communityLegend: Array<{ communityId: number; color: string; count: number }>;
  /** 检测到的社区数量 */
  communityCount: number;
}

/** 内存缓存：避免同一子图重复计算，TTL = 10 分钟 */
const cache = new Map<
  string,
  { result: CommunityColorResult; expiry: number }
>();

const CACHE_TTL_MS = 10 * 60 * 1000;

export class CommunityService {
  /**
   * 获取以指定法条为中心的子图的社区颜色映射
   */
  static async getCommunityColors(
    centerArticleId: string,
    depth: number = 2,
    maxNodes: number = 200
  ): Promise<CommunityColorResult> {
    const cacheKey = `${centerArticleId}:${depth}:${maxNodes}`;

    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.result;
    }

    try {
      const { nodes, links } = await CommunityService.loadSubgraph(
        centerArticleId,
        depth,
        maxNodes
      );

      if (nodes.length === 0) {
        return { nodeColors: {}, communityLegend: [], communityCount: 0 };
      }

      const communityMap = GraphAlgorithms.labelPropagation(nodes, links, 20);

      const communityCounts = new Map<number, number>();
      for (const communityId of communityMap.values()) {
        communityCounts.set(
          communityId,
          (communityCounts.get(communityId) ?? 0) + 1
        );
      }

      const sortedCommunities = Array.from(communityCounts.entries()).sort(
        (a, b) => b[1] - a[1]
      );
      const colorAssignment = new Map<number, string>(
        sortedCommunities.map(([communityId], idx) => [
          communityId,
          COMMUNITY_COLORS[idx % COMMUNITY_COLORS.length],
        ])
      );

      const nodeColors: Record<string, string> = {};
      for (const [nodeId, communityId] of communityMap.entries()) {
        nodeColors[nodeId] = colorAssignment.get(communityId) ?? '#6b7280';
      }

      const communityLegend = sortedCommunities.map(([communityId, count]) => ({
        communityId,
        color: colorAssignment.get(communityId) ?? '#6b7280',
        count,
      }));

      const result: CommunityColorResult = {
        nodeColors,
        communityLegend,
        communityCount: sortedCommunities.length,
      };

      cache.set(cacheKey, { result, expiry: Date.now() + CACHE_TTL_MS });

      return result;
    } catch (error) {
      logger.error('社区检测失败', error instanceof Error ? error : undefined, {
        centerArticleId,
      });
      return { nodeColors: {}, communityLegend: [], communityCount: 0 };
    }
  }

  /**
   * BFS 加载本地子图
   */
  private static async loadSubgraph(
    centerArticleId: string,
    depth: number,
    maxNodes: number
  ): Promise<{ nodes: GraphNode[]; links: GraphLink[] }> {
    const visitedIds = new Set<string>([centerArticleId]);
    let frontier = [centerArticleId];

    for (
      let d = 0;
      d < depth && frontier.length > 0 && visitedIds.size < maxNodes;
      d++
    ) {
      const relations = await prisma.lawArticleRelation.findMany({
        where: {
          OR: [{ sourceId: { in: frontier } }, { targetId: { in: frontier } }],
          verificationStatus: 'VERIFIED',
        },
        select: { sourceId: true, targetId: true },
        take: maxNodes * 3,
      });

      const nextFrontier: string[] = [];
      for (const rel of relations) {
        for (const id of [rel.sourceId, rel.targetId]) {
          if (!visitedIds.has(id) && visitedIds.size < maxNodes) {
            visitedIds.add(id);
            nextFrontier.push(id);
          }
        }
      }
      frontier = nextFrontier;
    }

    const allIds = Array.from(visitedIds);

    const articles = await prisma.lawArticle.findMany({
      where: { id: { in: allIds } },
      select: { id: true, lawName: true, articleNumber: true, category: true },
    });

    const nodes: GraphNode[] = articles.map(a => ({
      id: a.id,
      lawName: a.lawName,
      articleNumber: a.articleNumber,
      category: a.category,
      level: 0,
    }));

    const relations = await prisma.lawArticleRelation.findMany({
      where: {
        sourceId: { in: allIds },
        targetId: { in: allIds },
        verificationStatus: 'VERIFIED',
      },
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
