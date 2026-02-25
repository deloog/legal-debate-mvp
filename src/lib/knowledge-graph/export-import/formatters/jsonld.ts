import { logger } from '@/lib/logger';

import type {
  GraphNode,
  GraphEdge,
  GraphData,
} from '../types';

/**
 * JSON-LD格式化器
 */
export class JsonLdFormatter {
  /**
   * 将图数据转换为JSON-LD格式
   */
  format(graphData: GraphData): string {
    logger.info('开始格式化为JSON-LD', {
      nodesCount: graphData.nodes.length,
      edgesCount: graphData.edges.length,
    });

    const jsonLd = {
      '@context': this.createContext(),
      '@graph': [...graphData.nodes.map((node) => this.formatNode(node)), ...graphData.edges.map((edge) => this.formatEdge(edge))],
      exportedAt: graphData.exportedAt.toISOString(),
    };

    const jsonString = JSON.stringify(jsonLd, null, 2);

    logger.info('JSON-LD格式化完成', {
      size: jsonString.length,
    });

    return jsonString;
  }

  /**
   * 创建JSON-LD上下文
   */
  private createContext() {
    return {
      node: 'http://example.org/ns#node',
      edge: 'http://example.org/ns#edge',
      source: 'http://example.org/ns#source',
      target: 'http://example.org/ns#target',
      label: 'http://www.w3.org/2000/01/rdf-schema#label',
      relationType: 'http://example.org/ns#relationType',
      strength: 'http://example.org/ns#strength',
      confidence: 'http://example.org/ns#confidence',
      description: 'http://example.org/ns#description',
      discoveryMethod: 'http://example.org/ns#discoveryMethod',
      verificationStatus: 'http://example.org/ns#verificationStatus',
      verifiedBy: 'http://example.org/ns#verifiedBy',
      verifiedAt: 'http://example.org/ns#verifiedAt',
      aiProvider: 'http://example.org/ns#aiProvider',
      aiModel: 'http://example.org/ns#aiModel',
      aiConfidence: 'http://example.org/ns#aiConfidence',
      createdAt: 'http://example.org/ns#createdAt',
      xsd: 'http://www.w3.org/2001/XMLSchema#',
      lawName: 'http://example.org/ns#lawName',
      articleNumber: 'http://example.org/ns#articleNumber',
      lawType: 'http://example.org/ns#lawType',
      category: 'http://example.org/ns#category',
      tags: 'http://example.org/ns#tags',
      fullText: 'http://example.org/ns#fullText',
      effectiveDate: 'http://example.org/ns#effectiveDate',
      status: 'http://example.org/ns#status',
    };
  }

  /**
   * 格式化节点
   */
  private formatNode(node: GraphNode): Record<string, unknown> {
    return {
      '@type': 'node',
      '@id': node.id,
      label: node.label,
      lawName: node.lawName,
      articleNumber: node.articleNumber,
      lawType: node.lawType,
      category: node.category,
      tags: node.tags,
      effectiveDate: node.effectiveDate.toISOString(),
      status: node.status,
      ...(node.fullText && { fullText: node.fullText }),
    };
  }

  /**
   * 格式化边
   */
  private formatEdge(edge: GraphEdge): Record<string, unknown> {
    const edgeData: Record<string, unknown> = {
      '@type': 'edge',
      '@id': edge.id,
      source: edge.source,
      target: edge.target,
      relationType: edge.relationType,
      strength: edge.strength,
      confidence: edge.confidence,
      discoveryMethod: edge.discoveryMethod,
      verificationStatus: edge.verificationStatus,
      createdAt: edge.createdAt.toISOString(),
    };

    if (edge.description) {
      edgeData.description = edge.description;
    }

    if (edge.verifiedBy) {
      edgeData.verifiedBy = edge.verifiedBy;
    }

    if (edge.verifiedAt) {
      edgeData.verifiedAt = edge.verifiedAt.toISOString();
    }

    if (edge.aiProvider) {
      edgeData.aiProvider = edge.aiProvider;
    }

    if (edge.aiModel) {
      edgeData.aiModel = edge.aiModel;
    }

    if (edge.aiConfidence !== undefined) {
      edgeData.aiConfidence = edge.aiConfidence;
    }

    return edgeData;
  }
}
