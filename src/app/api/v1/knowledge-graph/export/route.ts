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
import {
  checkKnowledgeGraphPermission,
  logKnowledgeGraphAction,
  KnowledgeGraphAction,
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
    // 参数验证
    const format = searchParams.get('format') || 'json';
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!['json'].includes(format)) {
      return NextResponse.json(
        { error: `不支持的导出格式: ${format}` },
        { status: 400 }
      );
    }

    // 权限检查
    const permissionResult = await checkKnowledgeGraphPermission(
      '', // 用户ID从header中获取
      KnowledgeGraphAction.EXPORT_DATA,
      'RELATION' as never
    );

    if (!permissionResult.hasPermission) {
      logger.warn('用户无权限导出图谱', {
        reason: permissionResult.reason,
      });
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
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
    });

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
      userId: '', // 从header获取
      action: KnowledgeGraphAction.EXPORT_DATA,
      resource: 'RELATION' as never,
      description: `导出图谱数据，${exportNodes.length}个节点，${exportLinks.length}个关系`,
      metadata: {
        format,
        nodeCount: exportNodes.length,
        linkCount: exportLinks.length,
      },
    });

    return NextResponse.json({
      format,
      metadata,
      nodes: exportNodes,
      links: exportLinks,
    });
  } catch (error: unknown) {
    logger.error('图谱导出失败', { error });
    const errorMessage = error instanceof Error ? error.message : '服务器错误';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
