import { logger } from '@/lib/logger';

import type {
  GraphNode,
  GraphEdge,
  GraphData,
} from '../types';

/**
 * GraphML格式化器
 */
export class GraphMLFormatter {
  /**
   * 将图数据转换为GraphML格式
   */
  format(graphData: GraphData): string {
    logger.info('开始格式化为GraphML', {
      nodesCount: graphData.nodes.length,
      edgesCount: graphData.edges.length,
    });

    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<graphml xmlns="http://graphml.graphdrawing.org/xmlns"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns
         http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">
  <key id="label" for="node" attr.name="label" attr.type="string"/>
  <key id="lawName" for="node" attr.name="lawName" attr.type="string"/>
  <key id="articleNumber" for="node" attr.name="articleNumber" attr.type="string"/>
  <key id="lawType" for="node" attr.name="lawType" attr.type="string"/>
  <key id="category" for="node" attr.name="category" attr.type="string"/>
  <key id="tags" for="node" attr.name="tags" attr.type="string"/>
  <key id="fullText" for="node" attr.name="fullText" attr.type="string"/>
  <key id="effectiveDate" for="node" attr.name="effectiveDate" attr.type="string"/>
  <key id="status" for="node" attr.name="status" attr.type="string"/>
  <key id="relationType" for="edge" attr.name="relationType" attr.type="string"/>
  <key id="strength" for="edge" attr.name="strength" attr.type="double"/>
  <key id="confidence" for="edge" attr.name="confidence" attr.type="double"/>
  <key id="description" for="edge" attr.name="description" attr.type="string"/>
  <key id="discoveryMethod" for="edge" attr.name="discoveryMethod" attr.type="string"/>
  <key id="verificationStatus" for="edge" attr.name="verificationStatus" attr.type="string"/>
  <key id="verifiedBy" for="edge" attr.name="verifiedBy" attr.type="string"/>
  <key id="verifiedAt" for="edge" attr.name="verifiedAt" attr.type="string"/>
  <key id="aiProvider" for="edge" attr.name="aiProvider" attr.type="string"/>
  <key id="aiModel" for="edge" attr.name="aiModel" attr.type="string"/>
  <key id="aiConfidence" for="edge" attr.name="aiConfidence" attr.type="double"/>
  <key id="createdAt" for="edge" attr.name="createdAt" attr.type="string"/>
  <graph id="G" edgedefault="directed">
`;

    const nodesXml = graphData.nodes.map((node) => this.formatNode(node)).join('\n    ');
    const edgesXml = graphData.edges.map((edge) => this.formatEdge(edge)).join('\n    ');

    const xmlFooter = `
  </graph>
</graphml>`;

    const graphml = xmlHeader + nodesXml + '\n    ' + edgesXml + xmlFooter;

    logger.info('GraphML格式化完成', {
      size: graphml.length,
    });

    return graphml;
  }

  /**
   * 格式化节点
   */
  private formatNode(node: GraphNode): string {
    const tags = this.escapeXml(node.tags.join(','));
    const effectiveDate = this.escapeXml(node.effectiveDate.toISOString());
    const status = this.escapeXml(node.status);

    let dataXml = `
      <node id="${this.escapeXml(node.id)}">
        <data key="label">${this.escapeXml(node.label)}</data>
        <data key="lawName">${this.escapeXml(node.lawName)}</data>
        <data key="articleNumber">${this.escapeXml(node.articleNumber)}</data>
        <data key="lawType">${this.escapeXml(node.lawType)}</data>
        <data key="category">${this.escapeXml(node.category)}</data>
        <data key="tags">${tags}</data>`;

    if (node.fullText) {
      dataXml += `\n        <data key="fullText">${this.escapeXml(node.fullText)}</data>`;
    }

    dataXml += `
        <data key="effectiveDate">${effectiveDate}</data>
        <data key="status">${status}</data>
      </node>`;

    return dataXml;
  }

  /**
   * 格式化边
   */
  private formatEdge(edge: GraphEdge): string {
    let dataXml = `
      <edge id="${this.escapeXml(edge.id)}" source="${this.escapeXml(edge.source)}" target="${this.escapeXml(edge.target)}">
        <data key="relationType">${this.escapeXml(edge.relationType)}</data>
        <data key="strength">${edge.strength}</data>
        <data key="confidence">${edge.confidence}</data>
        <data key="discoveryMethod">${this.escapeXml(edge.discoveryMethod)}</data>
        <data key="verificationStatus">${this.escapeXml(edge.verificationStatus)}</data>`;

    if (edge.description) {
      dataXml += `\n        <data key="description">${this.escapeXml(edge.description)}</data>`;
    }

    if (edge.verifiedBy) {
      dataXml += `\n        <data key="verifiedBy">${this.escapeXml(edge.verifiedBy)}</data>`;
    }

    if (edge.verifiedAt) {
      dataXml += `\n        <data key="verifiedAt">${this.escapeXml(edge.verifiedAt.toISOString())}</data>`;
    }

    if (edge.aiProvider) {
      dataXml += `\n        <data key="aiProvider">${this.escapeXml(edge.aiProvider)}</data>`;
    }

    if (edge.aiModel) {
      dataXml += `\n        <data key="aiModel">${this.escapeXml(edge.aiModel)}</data>`;
    }

    if (edge.aiConfidence !== undefined) {
      dataXml += `\n        <data key="aiConfidence">${edge.aiConfidence}</data>`;
    }

    dataXml += `
        <data key="createdAt">${this.escapeXml(edge.createdAt.toISOString())}</data>
      </edge>`;

    return dataXml;
  }

  /**
   * 转义XML特殊字符
   * 使用unicode转义来避免格式化器自动转换
   */
  private escapeXml(text: string): string {
    const AMP = String.fromCharCode(38) + 'amp;';
    const LT = String.fromCharCode(60) + 'lt;';
    const GT = String.fromCharCode(62) + 'gt;';
    const QUOT = String.fromCharCode(34) + 'quot;';
    const APOS = String.fromCharCode(39) + 'apos;';

    return text
      .replace(String.fromCharCode(38), AMP)
      .replace(String.fromCharCode(60), LT)
      .replace(String.fromCharCode(62), GT)
      .replace(String.fromCharCode(34), QUOT)
      .replace(String.fromCharCode(39), APOS);
  }
}
