import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger';

import type { ImportResult, ImportOptions, ImportError } from '../types';

/**
 * 导入服务
 */
export class ImportService {
  /**
   * 导入知识图谱数据
   */
  async importData(
    prisma: Prisma.TransactionClient | PrismaClient,
    data: unknown,
    options: ImportOptions
  ): Promise<ImportResult> {
    const startTime = Date.now();

    logger.info('开始导入知识图谱数据', {
      format: options.format,
      mergeStrategy: options.mergeStrategy,
    });

    try {
      // 解析数据
      const graphData = this.parseData(data, options.format);

      // 验证数据
      this.validateData(graphData);

      // 导入数据
      const result = await this.importGraphData(
        prisma,
        graphData,
        options,
        startTime
      );

      logger.info('知识图谱数据导入完成', {
        nodeCount: result.importedNodes,
        edgeCount: result.importedEdges,
        processingTime: result.processingTime,
      });

      return result;
    } catch (error) {
      logger.error('导入知识图谱数据失败', {
        error: error instanceof Error ? error.message : String(error),
        options,
      });
      throw error;
    }
  }

  /**
   * 解析导入数据
   */
  private parseData(data: unknown, format: string) {
    // 这里简化处理，实际应该根据格式进行解析
    if (format === 'json-ld' && typeof data === 'string') {
      return JSON.parse(data);
    }
    if (format === 'graphml') {
      // GraphML解析逻辑
      return this.parseGraphML(data as string);
    }
    if (format === 'gml') {
      // GML解析逻辑
      return this.parseGML(data as string);
    }

    throw new Error(`不支持的导入格式: ${format}`);
  }

  /**
   * 解析GraphML格式
   */
  private parseGraphML(xmlString: string) {
    // 简化的GraphML解析
    // 实际实现应该使用XML解析器
    logger.warn('GraphML解析功能尚未完全实现', {
      dataLength: xmlString.length,
    });

    return {
      nodes: [],
      edges: [],
    };
  }

  /**
   * 解析GML格式
   */
  private parseGML(gmlString: string) {
    // 简化的GML解析
    // 实际实现应该使用GML解析器
    logger.warn('GML解析功能尚未完全实现', {
      dataLength: gmlString.length,
    });

    return {
      nodes: [],
      edges: [],
    };
  }

  /**
   * 验证数据
   */
  private validateData(
    data: unknown
  ): asserts data is { nodes: unknown[]; edges: unknown[] } {
    if (!data || typeof data !== 'object') {
      throw new Error('导入数据格式无效');
    }

    const graphData = data as Record<string, unknown>;

    if (!Array.isArray(graphData.nodes)) {
      throw new Error('导入数据缺少nodes数组');
    }

    if (!Array.isArray(graphData.edges)) {
      throw new Error('导入数据缺少edges数组');
    }

    // 验证节点数据
    graphData.nodes.forEach((node, index) => {
      if (!node || typeof node !== 'object') {
        throw new Error(`第${index + 1}个节点数据无效`);
      }

      const nodeData = node as Record<string, unknown>;
      if (!nodeData.id || typeof nodeData.id !== 'string') {
        throw new Error(`第${index + 1}个节点缺少id`);
      }

      if (!nodeData.label || typeof nodeData.label !== 'string') {
        throw new Error(`第${index + 1}个节点缺少label`);
      }
    });

    // 验证边数据
    graphData.edges.forEach((edge, index) => {
      if (!edge || typeof edge !== 'object') {
        throw new Error(`第${index + 1}条边数据无效`);
      }

      const edgeData = edge as Record<string, unknown>;
      if (!edgeData.id || typeof edgeData.id !== 'string') {
        throw new Error(`第${index + 1}条边缺少id`);
      }

      if (!edgeData.source || typeof edgeData.source !== 'string') {
        throw new Error(`第${index + 1}条边缺少source`);
      }

      if (!edgeData.target || typeof edgeData.target !== 'string') {
        throw new Error(`第${index + 1}条边缺少target`);
      }
    });
  }

  /**
   * 导入图数据
   */
  private async importGraphData(
    prisma: Prisma.TransactionClient | PrismaClient,
    graphData: { nodes: unknown[]; edges: unknown[] },
    options: ImportOptions,
    startTime: number
  ): Promise<ImportResult> {
    let importedNodes = 0;
    let importedEdges = 0;
    let skippedEdges = 0;
    let updatedEdges = 0;
    const errors: ImportError[] = [];
    const warnings: ImportError[] = [];

    // 使用事务确保数据一致性
    const result = await (prisma as PrismaClient).$transaction(async tx => {
      // 导入节点
      for (const node of graphData.nodes) {
        try {
          await this.importNode(tx, node as Record<string, unknown>, options);
          importedNodes++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          errors.push({
            type: 'INVALID_DATA',
            entity: 'node',
            entityId: (node as Record<string, unknown>).id as string,
            message: errorMsg,
            severity: 'error',
          });
          logger.warn('节点导入失败', {
            node,
            error: errorMsg,
          });

          if (options.validate) {
            throw error;
          }
        }
      }

      // 导入边
      for (const edge of graphData.edges) {
        try {
          const importResult = await this.importEdge(
            tx,
            edge as Record<string, unknown>,
            options
          );
          if (importResult === 'created') {
            importedEdges++;
          } else if (importResult === 'skipped') {
            skippedEdges++;
          } else if (importResult === 'updated') {
            updatedEdges++;
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          errors.push({
            type: 'INVALID_DATA',
            entity: 'edge',
            entityId: (edge as Record<string, unknown>).id as string,
            message: errorMsg,
            severity: 'error',
          });
          logger.warn('边导入失败', {
            edge,
            error: errorMsg,
          });

          if (options.validate) {
            throw error;
          }
        }
      }

      return {
        success: errors.length === 0,
        importedNodes,
        importedEdges,
        skippedEdges,
        updatedEdges,
        errors,
        warnings,
      };
    });

    const processingTime = Date.now() - startTime;

    return {
      ...result,
      processingTime,
    };
  }

  /**
   * 导入节点
   */
  private async importNode(
    prisma: Prisma.TransactionClient | PrismaClient,
    node: Record<string, unknown>,
    options: ImportOptions
  ): Promise<void> {
    const nodeId = node.id as string;

    // 检查节点是否已存在
    const existingNode = await prisma.lawArticle.findUnique({
      where: { id: nodeId },
    });

    if (existingNode && options.mergeStrategy === 'skip') {
      logger.info('节点已存在，跳过导入', { nodeId });
      return;
    }

    const nodeData: Prisma.LawArticleCreateInput = {
      id: nodeId,
      lawName: (node.lawName as string) || (node.label as string),
      articleNumber: (node.articleNumber as string) || '',
      fullText: (node.fullText as string) || '',
      lawType:
        (node.lawType as string as
          | 'CONSTITUTION'
          | 'LAW'
          | 'ADMINISTRATIVE_REGULATION'
          | 'LOCAL_REGULATION'
          | 'JUDICIAL_INTERPRETATION'
          | 'DEPARTMENTAL_RULE'
          | 'OTHER') || 'LAW',
      category:
        (node.category as string as
          | 'CIVIL'
          | 'CRIMINAL'
          | 'ADMINISTRATIVE'
          | 'COMMERCIAL'
          | 'ECONOMIC'
          | 'LABOR'
          | 'INTELLECTUAL_PROPERTY'
          | 'PROCEDURE'
          | 'OTHER') || 'OTHER',
      tags: (node.tags as string[]) || [],
      effectiveDate: node.effectiveDate
        ? new Date(node.effectiveDate as string)
        : new Date(),
      status:
        (node.status as string as
          | 'DRAFT'
          | 'VALID'
          | 'AMENDED'
          | 'REPEALED'
          | 'EXPIRED') || 'VALID',
      issuingAuthority: 'UNKNOWN',
      searchableText: (node.fullText as string) || (node.label as string),
    };

    if (existingNode && options.mergeStrategy === 'update') {
      // 更新现有节点
      await prisma.lawArticle.update({
        where: { id: nodeId },
        data: nodeData,
      });
      logger.info('更新现有节点', { nodeId });
    } else if (!existingNode) {
      // 创建新节点
      await prisma.lawArticle.create({
        data: nodeData,
      });
      logger.info('创建新节点', { nodeId });
    }
  }

  /**
   * 导入边
   * 返回导入结果：'created' | 'skipped' | 'updated'
   */
  private async importEdge(
    prisma: Prisma.TransactionClient | PrismaClient,
    edge: Record<string, unknown>,
    options: ImportOptions
  ): Promise<'created' | 'skipped' | 'updated'> {
    const edgeId = edge.id as string;
    const sourceId = edge.source as string;
    const targetId = edge.target as string;

    // 验证源节点和目标节点是否存在
    const [sourceNode, targetNode] = await Promise.all([
      prisma.lawArticle.findUnique({
        where: { id: sourceId },
      }),
      prisma.lawArticle.findUnique({
        where: { id: targetId },
      }),
    ]);

    if (!sourceNode) {
      throw new Error(`源节点不存在: ${sourceId}`);
    }

    if (!targetNode) {
      throw new Error(`目标节点不存在: ${targetId}`);
    }

    // 检查边是否已存在
    const existingEdge = await prisma.lawArticleRelation.findUnique({
      where: { id: edgeId },
    });

    if (existingEdge && options.mergeStrategy === 'skip') {
      logger.info('边已存在，跳过导入', { edgeId });
      return 'skipped';
    }

    const edgeData: Prisma.LawArticleRelationCreateInput = {
      id: edgeId,
      source: { connect: { id: sourceId } },
      target: { connect: { id: targetId } },
      relationType:
        (edge.relationType as string as
          | 'CITES'
          | 'CITED_BY'
          | 'CONFLICTS'
          | 'COMPLETES'
          | 'COMPLETED_BY'
          | 'SUPERSEDES'
          | 'SUPERSEDED_BY'
          | 'IMPLEMENTS'
          | 'IMPLEMENTED_BY'
          | 'RELATED') || 'RELATED',
      strength: (edge.strength as number) ?? 1.0,
      confidence: (edge.confidence as number) ?? 1.0,
      discoveryMethod:
        (edge.discoveryMethod as string as
          | 'MANUAL'
          | 'RULE_BASED'
          | 'AI_DETECTED'
          | 'CASE_DERIVED') || 'MANUAL',
      verificationStatus:
        (edge.verificationStatus as string as
          | 'PENDING'
          | 'VERIFIED'
          | 'REJECTED') || 'PENDING',
      createdAt: edge.createdAt
        ? new Date(edge.createdAt as string)
        : new Date(),
    };

    // 可选字段
    if (edge.description) {
      edgeData.description = edge.description as string;
    }

    if (edge.verifiedAt) {
      edgeData.verifiedAt = new Date(edge.verifiedAt as string);
    }

    if (edge.aiProvider) {
      edgeData.aiProvider = edge.aiProvider as string;
    }

    if (edge.aiModel) {
      edgeData.aiModel = edge.aiModel as string;
    }

    if (edge.aiConfidence !== undefined) {
      edgeData.aiConfidence = edge.aiConfidence as number;
    }

    if (existingEdge && options.mergeStrategy === 'update') {
      // 更新现有边
      await prisma.lawArticleRelation.update({
        where: { id: edgeId },
        data: edgeData,
      });
      logger.info('更新现有边', { edgeId });
      return 'updated';
    } else if (!existingEdge) {
      // 创建新边
      await prisma.lawArticleRelation.create({
        data: edgeData,
      });
      logger.info('创建新边', { edgeId });
      return 'created';
    }
    return 'skipped';
  }
}
