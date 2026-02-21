/**
 * 知识图谱浏览器API
 *
 * GET /api/v1/knowledge-graph/browse
 *
 * 功能：
 * 1. 获取全量图谱数据
 * 2. 支持搜索（法条名称、条文号、全文）
 * 3. 支持过滤（分类、关系类型）
 * 4. 支持分页
 * 5. 性能优化（只查询必要字段）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { LawCategory, RelationType, VerificationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * 图节点类型
 */
interface GraphNode {
  id: string;
  lawName: string;
  articleNumber: string;
  category: string;
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
 * 响应数据类型
 */
interface BrowseResponse {
  nodes: GraphNode[];
  links: GraphLink[];
  pagination: Pagination;
}

/**
 * 获取知识图谱浏览数据
 *
 * @param request - Next.js请求对象
 * @returns 图谱数据或错误信息
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<BrowseResponse | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const search = searchParams.get('search') || undefined;
    const categoryParam = searchParams.get('category') || undefined;
    const relationTypeParam = searchParams.get('relationType') || undefined;
    let page = parseInt(searchParams.get('page') || '1');
    let pageSize = parseInt(searchParams.get('pageSize') || '100');

    // 参数验证和规范化
    if (isNaN(page) || page < 1) {
      page = 1;
    }
    if (isNaN(pageSize) || pageSize < 1) {
      pageSize = 100;
    }
    // 限制最大页面大小
    if (pageSize > 500) {
      pageSize = 500;
    }

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

    // 构建查询条件
    const where: {
      category?: LawCategory;
      OR?: Array<{
        lawName?: { contains: string; mode: 'insensitive' };
        articleNumber?: { contains: string; mode: 'insensitive' };
        fullText?: { contains: string; mode: 'insensitive' };
      }>;
    } = {};

    // 添加分类过滤
    if (category) {
      where.category = category;
    }

    // 添加搜索条件
    if (search) {
      where.OR = [
        { lawName: { contains: search, mode: 'insensitive' } },
        { articleNumber: { contains: search, mode: 'insensitive' } },
        { fullText: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 查询法条总数
    const total = await prisma.lawArticle.count({ where });

    // 计算总页数
    const totalPages = Math.ceil(total / pageSize);

    // 查询法条数据（分页）
    const articles = await prisma.lawArticle.findMany({
      where,
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ lawName: 'asc' }, { articleNumber: 'asc' }],
    });

    // 转换为图节点
    const nodes: GraphNode[] = articles.map(article => ({
      id: article.id,
      lawName: article.lawName,
      articleNumber: article.articleNumber,
      category: article.category,
    }));

    // 获取节点ID集合
    const nodeIds = new Set(articles.map(a => a.id));

    // 构建关系查询条件
    const relationWhere: {
      verificationStatus: VerificationStatus;
      relationType?: RelationType;
      OR?: Array<{
        sourceId?: { in: string[] };
        targetId?: { in: string[] };
      }>;
    } = {
      verificationStatus: VerificationStatus.VERIFIED,
    };

    // 添加关系类型过滤
    if (relationType) {
      relationWhere.relationType = relationType;
    }

    // 只查询当前页面节点之间的关系
    if (nodeIds.size > 0) {
      const nodeIdArray = Array.from(nodeIds);
      relationWhere.OR = [
        { sourceId: { in: nodeIdArray } },
        { targetId: { in: nodeIdArray } },
      ];
    }

    // 查询关系数据
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

    // 过滤出两端都在当前页面的关系
    const links: GraphLink[] = relations
      .filter(rel => nodeIds.has(rel.sourceId) && nodeIds.has(rel.targetId))
      .map(rel => ({
        source: rel.sourceId,
        target: rel.targetId,
        relationType: rel.relationType,
        strength: rel.strength,
        confidence: rel.confidence,
      }));

    // 构建响应数据
    const response: BrowseResponse = {
      nodes,
      links,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('获取知识图谱数据失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
