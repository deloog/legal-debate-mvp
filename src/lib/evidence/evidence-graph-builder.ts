/**
 * EvidenceGraphBuilder - 证据图构建器
 *
 * 功能：构建证据关系图，用于证据链分析
 */

import type {
  EvidenceChainNode,
  EvidenceChainEdge,
  EvidenceChainGraph,
  EvidenceChainRelationType,
  EvidenceRelationStrength,
} from '../../types/evidence-chain';

/**
 * 证据图构建器类
 */
export class EvidenceGraphBuilder {
  /**
   * 构建证据链图
   */
  buildGraph(
    evidences: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      relevanceScore: number | null;
    }>,
    relations: Array<{
      evidenceId: string;
      relationType: EvidenceChainRelationType;
      relatedId: string;
      description?: string;
      strength: EvidenceRelationStrength;
      confidence: number;
    }>
  ): EvidenceChainGraph {
    // 创建节点映射
    const nodes = this.buildNodes(evidences);

    // 创建边映射
    const edges = this.buildEdges(relations, evidences);

    // 计算核心证据和孤证证据
    const { coreEvidences, isolatedEvidences } = this.analyzeGraphStructure(
      nodes,
      edges
    );

    // 计算统计信息
    const statistics = this.calculateStatistics(nodes, edges);

    return {
      nodes,
      edges,
      coreEvidences,
      isolatedEvidences,
      statistics,
    };
  }

  /**
   * 构建证据节点
   */
  private buildNodes(
    evidences: Array<{
      id: string;
      name: string;
      type: string;
      status: string;
      relevanceScore: number | null;
    }>
  ): EvidenceChainNode[] {
    return evidences.map(evidence => ({
      evidenceId: evidence.id,
      evidenceName: evidence.name,
      evidenceType: evidence.type,
      status: evidence.status,
      relevanceScore: evidence.relevanceScore,
      outgoingRelations: [],
      incomingRelations: [],
      metadata: {},
    }));
  }

  /**
   * 构建证据边（关系）
   */
  private buildEdges(
    relations: Array<{
      evidenceId: string;
      relationType: EvidenceChainRelationType;
      relatedId: string;
      description?: string;
      strength: EvidenceRelationStrength;
      confidence: number;
    }>,
    evidences: Array<{ id: string }>
  ): EvidenceChainEdge[] {
    const edges: EvidenceChainEdge[] = [];

    for (const relation of relations) {
      // 验证证据ID存在
      const fromExists = evidences.some(e => e.id === relation.evidenceId);
      const toExists = evidences.some(e => e.id === relation.relatedId);

      if (!fromExists || !toExists) {
        continue;
      }

      edges.push({
        id: this.generateEdgeId(
          relation.evidenceId,
          relation.relatedId,
          relation.relationType
        ),
        fromEvidenceId: relation.evidenceId,
        toEvidenceId: relation.relatedId,
        relationType: relation.relationType,
        strength: relation.strength,
        description: relation.description,
        confidence: relation.confidence,
        relatedId: relation.relatedId,
        relatedType: 'evidence',
        metadata: {},
      });
    }

    return edges;
  }

  /**
   * 生成边ID
   */
  private generateEdgeId(
    fromId: string,
    toId: string,
    relationType: EvidenceChainRelationType
  ): string {
    return `${fromId}-${toId}-${relationType}`;
  }

  /**
   * 分析图结构
   */
  private analyzeGraphStructure(
    nodes: EvidenceChainNode[],
    edges: EvidenceChainEdge[]
  ): {
    coreEvidences: string[];
    isolatedEvidences: string[];
  } {
    // 初始化节点统计
    const nodeStats = new Map<
      string,
      { inDegree: number; outDegree: number }
    >();

    for (const node of nodes) {
      nodeStats.set(node.evidenceId, { inDegree: 0, outDegree: 0 });
    }

    // 计算入度和出度
    for (const edge of edges) {
      const fromStats = nodeStats.get(edge.fromEvidenceId);
      const toStats = nodeStats.get(edge.toEvidenceId);

      if (fromStats) {
        fromStats.outDegree++;
      }
      if (toStats) {
        toStats.inDegree++;
      }
    }

    // 更新节点的入度和出度
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const stats = nodeStats.get(node.evidenceId);

      if (stats) {
        nodes[i] = {
          ...node,
          incomingRelations: edges.filter(
            e => e.toEvidenceId === node.evidenceId
          ),
          outgoingRelations: edges.filter(
            e => e.fromEvidenceId === node.evidenceId
          ),
        };
      }
    }

    // 识别核心证据（入度和出度都较高的证据）
    const coreEvidences: string[] = [];
    for (const [evidenceId, stats] of nodeStats.entries()) {
      const totalConnections = stats.inDegree + stats.outDegree;
      if (totalConnections >= 3) {
        coreEvidences.push(evidenceId);
      }
    }

    // 识别孤证证据（无任何关系的证据）
    const isolatedEvidences: string[] = [];
    for (const [evidenceId, stats] of nodeStats.entries()) {
      if (stats.inDegree === 0 && stats.outDegree === 0) {
        isolatedEvidences.push(evidenceId);
      }
    }

    return { coreEvidences, isolatedEvidences };
  }

  /**
   * 计算图统计信息
   */
  private calculateStatistics(
    nodes: EvidenceChainNode[],
    edges: EvidenceChainEdge[]
  ): {
    totalEvidences: number;
    totalRelations: number;
    averageRelationStrength: number;
    chainCompleteness: number;
    relationTypeDistribution: Record<EvidenceChainRelationType, number>;
    effectivenessScore: number;
    missingEvidenceTypes: string[];
  } {
    const totalEvidences = nodes.length;
    const totalRelations = edges.length;

    // 计算平均关系强度
    let averageRelationStrength = 0;
    if (totalRelations > 0) {
      const totalStrength = edges.reduce((sum, edge) => sum + edge.strength, 0);
      averageRelationStrength =
        Math.round((totalStrength / totalRelations) * 100) / 100;
    }

    // 计算关系类型分布
    const relationTypeDistribution: Record<EvidenceChainRelationType, number> =
      {
        SUPPORTS: 0,
        REFUTES: 0,
        SUPPLEMENTS: 0,
        CONTRADICTS: 0,
        INDEPENDENT: 0,
      };

    for (const edge of edges) {
      relationTypeDistribution[edge.relationType]++;
    }

    // 计算证据链完整性（0-100）
    const chainCompleteness = this.calculateChainCompleteness(nodes, edges);

    // 计算证据效力评分（简化版）
    const effectivenessScore = this.calculateAverageEffectiveness(nodes);

    // 识别缺失的证据类型
    const missingEvidenceTypes = this.identifyMissingEvidenceTypes(nodes);

    return {
      totalEvidences,
      totalRelations,
      averageRelationStrength,
      chainCompleteness,
      relationTypeDistribution,
      effectivenessScore,
      missingEvidenceTypes,
    };
  }

  /**
   * 计算证据链完整性
   */
  private calculateChainCompleteness(
    nodes: EvidenceChainNode[],
    edges: EvidenceChainEdge[]
  ): number {
    if (nodes.length === 0) {
      return 100;
    }

    const connectedNodes = new Set<string>();

    // 使用深度优先搜索找出所有连通节点
    for (const edge of edges) {
      connectedNodes.add(edge.fromEvidenceId);
      connectedNodes.add(edge.toEvidenceId);
    }

    const connectedCount = connectedNodes.size;
    const completeness = Math.round((connectedCount / nodes.length) * 100);

    return Math.min(100, Math.max(0, completeness));
  }

  /**
   * 计算平均证据效力
   */
  private calculateAverageEffectiveness(nodes: EvidenceChainNode[]): number {
    if (nodes.length === 0) {
      return 0;
    }

    // 计算每个证据的平均关系强度
    const nodeScores = new Map<string, number>();

    for (const node of nodes) {
      const totalRelations =
        node.incomingRelations.length + node.outgoingRelations.length;

      if (totalRelations === 0) {
        nodeScores.set(node.evidenceId, 0);
        continue;
      }

      let totalStrength = 0;
      for (const edge of node.incomingRelations) {
        totalStrength += edge.strength;
      }
      for (const edge of node.outgoingRelations) {
        totalStrength += edge.strength;
      }

      const averageStrength =
        Math.round((totalStrength / totalRelations) * 100) / 100;
      nodeScores.set(node.evidenceId, averageStrength);
    }

    // 计算全局平均值
    let totalScore = 0;
    for (const score of nodeScores.values()) {
      totalScore += score;
    }

    return Math.round((totalScore / nodeScores.size) * 20); // 转换为0-100分制
  }

  /**
   * 识别缺失的证据类型
   */
  private identifyMissingEvidenceTypes(nodes: EvidenceChainNode[]): string[] {
    const existingTypes = new Set<string>();
    for (const node of nodes) {
      existingTypes.add(node.evidenceType);
    }

    const missing: string[] = [];

    // 如果只有单一证据类型，缺少多样性
    if (existingTypes.size === 1) {
      missing.push('证据多样性不足');
    }

    return missing;
  }

  /**
   * 将边添加到图
   */
  addEdge(
    graph: EvidenceChainGraph,
    edge: EvidenceChainEdge
  ): EvidenceChainGraph {
    // 验证节点存在
    const fromExists = graph.nodes.some(
      n => n.evidenceId === edge.fromEvidenceId
    );
    const toExists = graph.nodes.some(n => n.evidenceId === edge.toEvidenceId);

    if (!fromExists || !toExists) {
      return graph;
    }

    // 添加边
    const newEdges = [...graph.edges, edge];

    // 更新节点的入度和出度
    const updatedNodes = graph.nodes.map(node => {
      if (node.evidenceId === edge.fromEvidenceId) {
        return {
          ...node,
          outgoingRelations: [...node.outgoingRelations, edge],
        };
      }
      if (node.evidenceId === edge.toEvidenceId) {
        return {
          ...node,
          incomingRelations: [...node.incomingRelations, edge],
        };
      }
      return node;
    });

    // 重新计算图结构
    const { coreEvidences, isolatedEvidences } = this.analyzeGraphStructure(
      updatedNodes,
      newEdges
    );

    const statistics = this.calculateStatistics(updatedNodes, newEdges);

    return {
      ...graph,
      nodes: updatedNodes,
      edges: newEdges,
      coreEvidences,
      isolatedEvidences,
      statistics,
    };
  }

  /**
   * 从图中移除边
   */
  removeEdge(graph: EvidenceChainGraph, edgeId: string): EvidenceChainGraph {
    const edgeIndex = graph.edges.findIndex(e => e.id === edgeId);

    if (edgeIndex === -1) {
      return graph;
    }

    const removedEdge = graph.edges[edgeIndex];
    const newEdges = graph.edges.filter(e => e.id !== edgeId);

    // 更新节点的入度和出度
    const updatedNodes = graph.nodes.map(node => {
      if (node.evidenceId === removedEdge.fromEvidenceId) {
        return {
          ...node,
          outgoingRelations: node.outgoingRelations.filter(
            e => e.id !== edgeId
          ),
        };
      }
      if (node.evidenceId === removedEdge.toEvidenceId) {
        return {
          ...node,
          incomingRelations: node.incomingRelations.filter(
            e => e.id !== edgeId
          ),
        };
      }
      return node;
    });

    // 重新计算图结构
    const { coreEvidences, isolatedEvidences } = this.analyzeGraphStructure(
      updatedNodes,
      newEdges
    );

    const statistics = this.calculateStatistics(updatedNodes, newEdges);

    return {
      ...graph,
      nodes: updatedNodes,
      edges: newEdges,
      coreEvidences,
      isolatedEvidences,
      statistics,
    };
  }
}
