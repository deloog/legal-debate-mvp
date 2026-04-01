/**
 * 知识图谱浏览器API
 *
 * GET /api/v1/knowledge-graph/browse
 *
 * 功能：
 * 1. 从有关系的核心节点出发，展开到邻居节点，构建可见的连通图
 * 2. 支持搜索（法条名称、条文号）
 * 3. 支持按分类和关系类型过滤
 * 4. 支持分页（基于种子节点分页）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { LawCategory, RelationType, VerificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';

/**
 * 图节点类型
 */
interface GraphNode {
  id: string;
  lawName: string;
  articleNumber: string;
  category: string;
  level: number;
}

/**
 * 图边类型
 */
interface GraphLink {
  source: string;
  target: string;
  relationType: string;
  strength: number;
  confidence: number;
}

/**
 * 分页信息类型
 */
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 响应数据类型 - 统一格式 { success, data, pagination }
 */
interface BrowseResponse {
  success: boolean;
  data: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
  pagination: Pagination;
}

/**
 * 获取知识图谱浏览数据
 *
 * 策略：先查"种子"法条（有 VERIFIED 关系的法条，按出度排序），
 * 再拉取它们的关系，并补充关系对端节点，确保图中有可见连接。
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<BrowseResponse | { error: string }>> {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: '未授权，请先登录' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const search = searchParams.get('search') || undefined;
    const categoryParam = searchParams.get('category') || undefined;
    const relationTypeParam = searchParams.get('relationType') || undefined;
    let page = parseInt(searchParams.get('page') || '1');
    let pageSize = parseInt(searchParams.get('pageSize') || '80');

    // 参数验证和规范化
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 80;
    if (pageSize > 200) pageSize = 200;

    // 验证分类参数
    let category: LawCategory | undefined = undefined;
    if (
      categoryParam &&
      Object.values(LawCategory).includes(categoryParam as LawCategory)
    ) {
      category = categoryParam as LawCategory;
    }

    // 验证关系类型参数
    let relationType: RelationType | undefined = undefined;
    if (
      relationTypeParam &&
      Object.values(RelationType).includes(relationTypeParam as RelationType)
    ) {
      relationType = relationTypeParam as RelationType;
    }

    // ── Step 1: 查找有 VERIFIED 关系的种子法条 ──────────────────────────────
    // 只展示有关系的法条，避免孤立节点充斥图谱
    const seedWhere: {
      category?: LawCategory;
      OR?: Array<{
        lawName?: { contains: string; mode: 'insensitive' };
        articleNumber?: { contains: string; mode: 'insensitive' };
      }>;
      sourceRelations?: {
        some: {
          verificationStatus: VerificationStatus;
          relationType?: RelationType;
        };
      };
    } = {
      sourceRelations: {
        some: {
          verificationStatus: VerificationStatus.VERIFIED,
          ...(relationType ? { relationType } : {}),
        },
      },
    };

    if (category) seedWhere.category = category;

    if (search) {
      seedWhere.OR = [
        { lawName: { contains: search, mode: 'insensitive' } },
        { articleNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 统计种子法条总数（用于分页）
    let total = await prisma.lawArticle.count({ where: seedWhere });

    // 查询本页种子法条（按出度排序：出度高的节点优先显示）
    let seedArticles = await prisma.lawArticle.findMany({
      where: seedWhere,
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
      },
      orderBy: [
        { sourceRelations: { _count: 'desc' } },
        { lawName: 'asc' },
        { articleNumber: 'asc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 降级策略：如果没有 VERIFIED 关系的法条，返回普通法条列表
    if (seedArticles.length === 0) {
      logger.warn('未找到有 VERIFIED 关系的法条，降级为返回普通法条列表');

      const fallbackWhere: {
        category?: LawCategory;
        OR?: Array<{
          lawName?: { contains: string; mode: 'insensitive' };
          articleNumber?: { contains: string; mode: 'insensitive' };
        }>;
      } = {};

      if (category) fallbackWhere.category = category;
      if (search) {
        fallbackWhere.OR = [
          { lawName: { contains: search, mode: 'insensitive' } },
          { articleNumber: { contains: search, mode: 'insensitive' } },
        ];
      }

      // 并行执行查询和计数，减少数据库往返
      const [countResult, articlesResult] = await Promise.all([
        prisma.lawArticle.count({ where: fallbackWhere }),
        prisma.lawArticle.findMany({
          where: fallbackWhere,
          select: {
            id: true,
            lawName: true,
            articleNumber: true,
            category: true,
          },
          orderBy: [{ lawName: 'asc' }, { articleNumber: 'asc' }],
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
      ]);

      total = countResult;
      seedArticles = articlesResult;

      if (seedArticles.length === 0) {
        return NextResponse.json({
          success: true,
          data: { nodes: [], links: [] },
          pagination: { page, pageSize, total: 0, totalPages: 0 },
        });
      }
    }

    const totalPages = Math.ceil(total / pageSize);

    const seedIds = seedArticles.map(a => a.id);
    const seedIdSet = new Set(seedIds);

    // ── Step 2: 拉取种子节点的关系 ──────────────────────────
    // 注意：正常情况下（种子来自 VERIFIED 查询），限制 VERIFIED
    // 降级情况下（种子来自普通法条查询），放宽关系查询条件
    const isNormalQuery =
      seedWhere.sourceRelations?.some?.verificationStatus ===
      VerificationStatus.VERIFIED;

    const relationWhere: {
      verificationStatus?: VerificationStatus;
      relationType?: RelationType;
      sourceId: { in: string[] };
    } = {
      sourceId: { in: seedIds },
    };

    // 只有在正常查询情况下才限制 VERIFIED
    if (isNormalQuery) {
      relationWhere.verificationStatus = VerificationStatus.VERIFIED;
    }

    if (relationType) relationWhere.relationType = relationType;

    const relations = await prisma.lawArticleRelation.findMany({
      where: relationWhere,
      select: {
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
        confidence: true,
      },
    });

    // 如果没有找到关系，至少返回种子节点
    if (relations.length === 0) {
      logger.warn('未找到任何关系数据，仅返回种子节点');
      return NextResponse.json({
        success: true,
        data: {
          nodes: seedArticles.map(a => ({
            id: a.id,
            lawName: a.lawName,
            articleNumber: a.articleNumber,
            category: a.category,
            level: 0,
          })),
          links: [],
        },
        pagination: {
          page,
          pageSize,
          total,
          totalPages,
        },
      });
    }

    // ── Step 3: 收集对端节点 ID，补充节点数据 ─────────────────────────────
    const neighborIds = relations
      .map(r => r.targetId)
      .filter(id => !seedIdSet.has(id));

    const uniqueNeighborIds = [...new Set(neighborIds)];

    // 限制邻居节点数量，避免图过于庞大
    const neighborIdsBatch = uniqueNeighborIds.slice(0, 500);

    const neighborArticles =
      neighborIdsBatch.length > 0
        ? await prisma.lawArticle.findMany({
            where: { id: { in: neighborIdsBatch } },
            select: {
              id: true,
              lawName: true,
              articleNumber: true,
              category: true,
            },
          })
        : [];

    // ── Step 4: 合并节点，构建响应 ─────────────────────────────────────────
    const neighborIdSet = new Set(neighborArticles.map(a => a.id));
    const allNodeIds = new Set([...seedIdSet, ...neighborIdSet]);

    const nodes: GraphNode[] = [
      ...seedArticles.map(a => ({
        id: a.id,
        lawName: a.lawName,
        articleNumber: a.articleNumber,
        category: a.category,
        level: 0, // 种子节点
      })),
      ...neighborArticles.map(a => ({
        id: a.id,
        lawName: a.lawName,
        articleNumber: a.articleNumber,
        category: a.category,
        level: 1, // 邻居节点
      })),
    ];

    // 只保留两端节点都在当前图中的关系
    const links: GraphLink[] = relations
      .filter(
        rel => allNodeIds.has(rel.sourceId) && allNodeIds.has(rel.targetId)
      )
      .map(rel => ({
        source: rel.sourceId,
        target: rel.targetId,
        relationType: rel.relationType,
        strength: rel.strength,
        confidence: rel.confidence,
      }));

    return NextResponse.json({
      success: true,
      data: { nodes, links },
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error) {
    logger.error('获取知识图谱数据失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
