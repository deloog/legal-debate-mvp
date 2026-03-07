import { logger } from '@/lib/logger';

import type { GraphNode, GraphEdge, GraphData } from '../types';

/**
 * GML格式化器
 */
export class GMLFormatter {
  /**
   * 将图数据转换为GML格式
   */
  format(graphData: GraphData): string {
    logger.info('开始格式化为GML', {
      nodesCount: graphData.nodes.length,
      edgesCount: graphData.edges.length,
    });

    const header = 'graph [\n  directed 1\n';
    const nodesGml = graphData.nodes
      .map(node => '  ' + this.formatNode(node))
      .join('\n');
    const edgesGml = graphData.edges
      .map(edge => '  ' + this.formatEdge(edge))
      .join('\n');
    const footer = ']';

    const gml = header + nodesGml + '\n' + edgesGml + '\n' + footer;

    logger.info('GML格式化完成', {
      size: gml.length,
    });

    return gml;
  }

  /**
   * 格式化节点
   */
  private formatNode(node: GraphNode): string {
    const tags = node.tags.map(tag => `"${tag}"`).join(' ');
    const effectiveDate = node.effectiveDate.toISOString();

    return `node [
    id "${node.id}"
    label "${this.escapeGml(node.label)}"
    lawName "${this.escapeGml(node.lawName)}"
    articleNumber "${this.escapeGml(node.articleNumber)}"
    lawType "${this.escapeGml(node.lawType)}"
    category "${this.escapeGml(node.category)}"
    tags [ ${tags} ]
    effectiveDate "${effectiveDate}"
    status "${this.escapeGml(node.status)}"
  ]`;
  }

  /**
   * 格式化边
   */
  private formatEdge(edge: GraphEdge): string {
    let gmlEdge = `edge [
    source "${edge.source}"
    target "${edge.target}"
    id "${edge.id}"
    relationType "${this.escapeGml(edge.relationType)}"
    strength ${edge.strength}
    confidence ${edge.confidence}
    discoveryMethod "${this.escapeGml(edge.discoveryMethod)}"
    verificationStatus "${this.escapeGml(edge.verificationStatus)}"
    createdAt "${edge.createdAt.toISOString()}"
  `;

    if (edge.description) {
      gmlEdge += `\n    description "${this.escapeGml(edge.description)}"`;
    }

    if (edge.verifiedBy) {
      gmlEdge += `\n    verifiedBy "${this.escapeGml(edge.verifiedBy)}"`;
    }

    if (edge.verifiedAt) {
      gmlEdge += `\n    verifiedAt "${edge.verifiedAt.toISOString()}"`;
    }

    if (edge.aiProvider) {
      gmlEdge += `\n    aiProvider "${this.escapeGml(edge.aiProvider)}"`;
    }

    if (edge.aiModel) {
      gmlEdge += `\n    aiModel "${this.escapeGml(edge.aiModel)}"`;
    }

    if (edge.aiConfidence !== undefined) {
      gmlEdge += `\n    aiConfidence ${edge.aiConfidence}`;
    }

    gmlEdge += '\n  ]';

    return gmlEdge;
  }

  /**
   * 转义GML特殊字符
   */
  private escapeGml(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}
