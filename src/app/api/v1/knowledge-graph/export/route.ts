/**
 * 知识图谱导出API
 *
 * 功能：导出图谱数据为JSON格式
 *
 * 端点: GET /api/v1/knowledge-graph/export
 * 参数:
 *   - format: 导出格式（默认json）
 *   - startDate: 开始日期（可选）
 *   - endDate: 结束日期（可选）
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
  KnowledgeGraphResource,
} from '@/lib/middleware/knowledge-graph-permission';

/**
 * 导出元数据
 */
interface ExportMetadata {
  exportedAt: string;
  format: string;
  nodeCount: number;
  linkCount: number;
  timeRange?: {
    start: string;
    end: string;
  };
}

/**
 * GET /api/v1/knowledge-graph/export
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const searchParams = request.nextUrl.searchParams;

  try {
    // 认证检查
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: '请先登录' },
        },
        { status: 401 }
      );
    }

    // 参数验证
    const format = searchParams.get('format') || 'json';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!['json'].includes(format)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FORMAT',
            message: `不支持的导出格式: ${format}`,
          },
        },
        { status: 400 }
      );
    }

    // 验证日期格式
    if (startDateParam) {
      const startDate = new Date(startDateParam);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'INVALID_DATE', message: '开始日期格式无效' },
          },
          { status: 400 }
        );
      }
    }

    if (endDateParam) {
      const endDate = new Date(endDateParam);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'INVALID_DATE', message: '结束日期格式无效' },
          },
          { status: 400 }
        );
      }
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      authUser.userId,
      KnowledgeGraphAction.EXPORT_DATA,
      KnowledgeGraphResource.GRAPH
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限导出图谱', {
        userId: authUser.userId,
        reason: permissionResult.reason,
      });
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: '权限不足' } },
        { status: 403 }
      );
    }

    // 构建查询条件
    const relationWhere: Record<string, unknown> = {
      verificationStatus: 'VERIFIED',
    };

    // 时间范围过滤
    if (startDateParam || endDateParam) {
      const createdAt: Record<string, Date> = {};
      if (startDateParam) {
        createdAt.gte = new Date(startDateParam);
      }
      if (endDateParam) {
        createdAt.lte = new Date(endDateParam);
      }
      relationWhere.createdAt = createdAt;
    }

    // 限制导出数量防止内存溢出
    const MAX_NODES = 10000;
    const MAX_LINKS = 50000;

    // 查询节点
    const nodes = await prisma.lawArticle.findMany({
      select: {
        id: true,
        lawName: true,
        articleNumber: true,
        category: true,
        status: true,
        effectiveDate: true,
      },
      take: MAX_NODES,
    });

    // 查询关系
    const relations = await prisma.lawArticleRelation.findMany({
      where: relationWhere,
      select: {
        id: true,
        sourceId: true,
        targetId: true,
        relationType: true,
        strength: true,
        verificationStatus: true,
        discoveryMethod: true,
        createdAt: true,
      },
      take: MAX_LINKS,
    });

    // 如果数据被截断，记录警告
    if (nodes.length === MAX_NODES) {
      logger.warn('导出节点数量达到上限', {
        userId: authUser.userId,
        limit: MAX_NODES,
      });
    }
    if (relations.length === MAX_LINKS) {
      logger.warn('导出关系数量达到上限', {
        userId: authUser.userId,
        limit: MAX_LINKS,
      });
    }

    // 构建导出数据
    const exportNodes = nodes.map(node => ({
      id: node.id,
      lawName: node.lawName,
      articleNumber: node.articleNumber,
      category: node.category,
      status: node.status,
      effectiveDate: node.effectiveDate?.toISOString(),
    }));

    const exportLinks = relations.map(relation => ({
      id: relation.id,
      source: relation.sourceId,
      target: relation.targetId,
      relationType: relation.relationType,
      strength: relation.strength,
      verificationStatus: relation.verificationStatus,
      discoveryMethod: relation.discoveryMethod,
      createdAt: relation.createdAt.toISOString(),
    }));

    // 构建元数据
    const metadata: ExportMetadata = {
      exportedAt: new Date().toISOString(),
      format,
      nodeCount: exportNodes.length,
      linkCount: exportLinks.length,
    };

    if (startDateParam || endDateParam) {
      metadata.timeRange = {
        start: startDateParam || '-',
        end: endDateParam || '-',
      };
    }

    // 记录操作日志
    await logKnowledgeGraphAction({
      userId: authUser.userId,
      action: KnowledgeGraphAction.EXPORT_DATA,
      resource: KnowledgeGraphResource.GRAPH,
      description: `导出图谱数据，${exportNodes.length}个节点，${exportLinks.length}个关系`,
      metadata: {
        format,
        nodeCount: exportNodes.length,
        linkCount: exportLinks.length,
        startDate: startDateParam,
        endDate: endDateParam,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        format,
        metadata,
        nodes: exportNodes,
        links: exportLinks,
      },
    });
  } catch (error: unknown) {
    logger.error('图谱导出失败', { error });
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: errorMessage },
      },
      { status: 500 }
    );
  }
}
