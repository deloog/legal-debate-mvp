import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

import { GraphMLFormatter, GMLFormatter, JsonLdFormatter } from '../formatters';
import type {
  ExportFilterOptions,
  ExportFormat,
  ExportOptions,
  GraphData,
  GraphNode,
  GraphEdge,
} from '../types';

/**
 * 导出服务
 */
export class ExportService {
  /**
   * 导出知识图谱数据
   */
  async exportData(
    prisma: Prisma.TransactionClient | PrismaClient,
    options: ExportOptions
  ): Promise<GraphData> {
    const startTime = Date.now();

    logger.info('开始导出知识图谱数据', {
      format: options.format,
      filter: options.filter,
    });

    try {
      // 构建查询条件
      const relationWhere = this.buildRelationWhere(options.filter);

      // 获取所有相关的法条（节点）
      const articles = await prisma.lawArticle.findMany({
        where: {
          status: 'VALID',
        },
        select: {
          id: true,
          lawName: true,
          articleNumber: true,
          fullText: true,
          lawType: true,
          category: true,
          tags: true,
          effectiveDate: true,
          status: true,
        },
      });

      // 获取关系（边）
      const relations = await prisma.lawArticleRelation.findMany({
        where: relationWhere,
        select: {
          id: true,
          sourceId: true,
          targetId: true,
          relationType: true,
          strength: true,
          confidence: true,
          description: true,
          discoveryMethod: true,
          verificationStatus: true,
          verifiedBy: true,
          verifiedAt: true,
          aiProvider: true,
          aiModel: true,
          aiConfidence: true,
          createdAt: true,
        },
      });

      // 转换为图节点
      const nodes: GraphNode[] = articles.map(article => ({
        id: article.id,
        label: `${article.lawName} ${article.articleNumber}`,
        lawName: article.lawName,
        articleNumber: article.articleNumber,
        lawType: article.lawType,
        category: article.category,
        tags: article.tags,
        fullText: article.fullText ?? undefined,
        effectiveDate: article.effectiveDate,
        status: article.status,
      }));

      // 转换为图边
      const edges: GraphEdge[] = relations.map(relation => ({
        id: relation.id,
        source: relation.sourceId,
        target: relation.targetId,
        relationType: relation.relationType,
        strength: relation.strength,
        confidence: relation.confidence,
        description: relation.description ?? undefined,
        discoveryMethod: relation.discoveryMethod,
        verificationStatus: relation.verificationStatus,
        verifiedBy: relation.verifiedBy ?? undefined,
        verifiedAt: relation.verifiedAt ?? undefined,
        aiProvider: relation.aiProvider ?? undefined,
        aiModel: relation.aiModel ?? undefined,
        aiConfidence: relation.aiConfidence ?? undefined,
        createdAt: relation.createdAt,
      }));

      const graphData: GraphData = {
        nodes,
        edges,
        exportedAt: new Date(),
        totalCount: edges.length,
      };

      const processingTime = Date.now() - startTime;

      logger.info('知识图谱数据导出完成', {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        processingTime,
      });

      return graphData;
    } catch (error) {
      logger.error('导出知识图谱数据失败', {
        error: error instanceof Error ? error.message : String(error),
        options,
      });
      throw error;
    }
  }

  /**
   * 格式化导出数据
   */
  formatExportData(graphData: GraphData, format: ExportFormat): string {
    let formatter;

    switch (format) {
      case 'graphml':
        formatter = new GraphMLFormatter();
        break;
      case 'gml':
        formatter = new GMLFormatter();
        break;
      case 'json-ld':
        formatter = new JsonLdFormatter();
        break;
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }

    return formatter.format(graphData);
  }

  /**
   * 构建关系查询条件
   */
  private buildRelationWhere(
    filter?: ExportFilterOptions
  ): Prisma.LawArticleRelationWhereInput {
    const where: Prisma.LawArticleRelationWhereInput = {};

    if (!filter) {
      return where;
    }

    // 日期范围过滤
    if (filter.startDate || filter.endDate) {
      where.createdAt = {};
      if (filter.startDate) {
        where.createdAt.gte = filter.startDate;
      }
      if (filter.endDate) {
        where.createdAt.lte = filter.endDate;
      }
    }

    // 关系类型过滤
    if (filter.relationTypes && filter.relationTypes.length > 0) {
      where.relationType = {
        in: filter.relationTypes as unknown as (
          | 'CITES'
          | 'CITED_BY'
          | 'CONFLICTS'
          | 'COMPLETES'
          | 'COMPLETED_BY'
          | 'SUPERSEDES'
          | 'SUPERSEDED_BY'
          | 'IMPLEMENTS'
          | 'IMPLEMENTED_BY'
          | 'RELATED'
        )[],
      };
    }

    // 强度范围过滤
    if (filter.minStrength !== undefined || filter.maxStrength !== undefined) {
      where.strength = {};
      if (filter.minStrength !== undefined) {
        where.strength.gte = filter.minStrength;
      }
      if (filter.maxStrength !== undefined) {
        where.strength.lte = filter.maxStrength;
      }
    }

    // 验证状态过滤
    if (filter.verificationStatus && filter.verificationStatus.length > 0) {
      where.verificationStatus = {
        in: filter.verificationStatus as unknown as (
          | 'PENDING'
          | 'VERIFIED'
          | 'REJECTED'
        )[],
      };
    }

    // 发现方法过滤
    if (filter.discoveryMethod && filter.discoveryMethod.length > 0) {
      where.discoveryMethod = {
        in: filter.discoveryMethod as unknown as (
          | 'MANUAL'
          | 'RULE_BASED'
          | 'AI_DETECTED'
          | 'CASE_DERIVED'
        )[],
      };
    }

    return where;
  }

  /**
   * 生成导出文件名
   */
  generateFilename(format: ExportFormat): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, -5);
    const extension = this.getFileExtension(format);
    return `knowledge-graph-${timestamp}.${extension}`;
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(format: ExportFormat): string {
    switch (format) {
      case 'graphml':
        return 'graphml';
      case 'gml':
        return 'gml';
      case 'json-ld':
        return 'jsonld';
      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }
}
