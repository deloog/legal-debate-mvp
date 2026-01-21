/**
 * EvidencePathFinder - 证据路径查找器
 *
 * 功能：在证据图中查找证据链路径
 */

import type {
  EvidenceChainGraph,
  EvidenceChainPath,
  EvidenceChainNode,
  EvidenceChainEdge,
} from '../../types/evidence-chain';

import { EvidenceChainRelationType } from '../../types/evidence-chain';

/**
 * 证据路径查找器类
 */
export class EvidencePathFinder {
  /**
   * 查找所有证据链路径
   */
  findAllPaths(graph: EvidenceChainGraph): EvidenceChainPath[] {
    const paths: EvidenceChainPath[] = [];

    // 从每个核心证据开始查找路径
    for (const coreId of graph.coreEvidences) {
      const node = graph.nodes.find(n => n.evidenceId === coreId);

      if (!node) continue;

      // 查找从该节点出发的所有路径
      const pathsFromNode = this.findPathsFromNode(
        node,
        graph,
        new Set<string>(),
        [coreId]
      );

      paths.push(...pathsFromNode);
    }

    // 按路径强度排序
    paths.sort((a, b) => b.totalStrength - a.totalStrength);

    return paths;
  }

  /**
   * 从节点开始查找所有路径
   */
  private findPathsFromNode(
    node: EvidenceChainNode,
    graph: EvidenceChainGraph,
    visited: Set<string>,
    path: string[]
  ): EvidenceChainPath[] {
    const paths: EvidenceChainPath[] = [];

    // 标记当前节点为已访问
    visited.add(node.evidenceId);

    // 遍历所有出边
    for (const edge of node.outgoingRelations) {
      const newPath = [...path, edge.toEvidenceId];

      // 创建路径对象
      const chainPath = this.createPathObject(newPath, edge, graph);
      paths.push(chainPath);

      // 递归查找后续节点
      const nextNode = graph.nodes.find(
        n => n.evidenceId === edge.toEvidenceId
      );

      if (nextNode && !visited.has(edge.toEvidenceId)) {
        const subPaths = this.findPathsFromNode(
          nextNode,
          graph,
          new Set(visited),
          newPath
        );
        paths.push(...subPaths);
      }
    }

    return paths;
  }

  /**
   * 创建路径对象
   */
  private createPathObject(
    evidenceIds: string[],
    lastEdge: EvidenceChainEdge,
    graph: EvidenceChainGraph
  ): EvidenceChainPath {
    let totalStrength = 0;
    let totalConfidence = 0;

    // 计算路径总强度和置信度
    for (let i = 0; i < evidenceIds.length - 1; i++) {
      const fromId = evidenceIds[i];
      const toId = evidenceIds[i + 1];

      const edge = graph.edges.find(
        e => e.fromEvidenceId === fromId && e.toEvidenceId === toId
      );

      if (edge) {
        totalStrength += edge.strength;
        totalConfidence += edge.confidence;
      }
    }

    // 添加最后一条边
    totalStrength += lastEdge.strength;
    totalConfidence += lastEdge.confidence;

    // 计算平均置信度
    const averageConfidence =
      totalConfidence > 0
        ? Math.round((totalConfidence / evidenceIds.length) * 1000) / 1000
        : 0;

    // 确定路径类型
    const pathType = this.determinePathType(graph, evidenceIds);

    return {
      evidenceIds,
      totalStrength,
      averageConfidence,
      length: evidenceIds.length,
      pathType,
    };
  }

  /**
   * 确定路径类型
   */
  private determinePathType(
    graph: EvidenceChainGraph,
    evidenceIds: string[]
  ): 'supporting' | 'refuting' | 'mixed' {
    let supportCount = 0;
    let refuteCount = 0;

    for (let i = 0; i < evidenceIds.length - 1; i++) {
      const fromId = evidenceIds[i];
      const toId = evidenceIds[i + 1];

      const edge = graph.edges.find(
        e => e.fromEvidenceId === fromId && e.toEvidenceId === toId
      );

      if (!edge) continue;

      if (
        edge.relationType === 'SUPPORTS' ||
        edge.relationType === 'SUPPLEMENTS'
      ) {
        supportCount++;
      } else if (
        edge.relationType === 'REFUTES' ||
        edge.relationType === 'CONTRADICTS'
      ) {
        refuteCount++;
      }
    }

    if (refuteCount === 0) {
      return 'supporting';
    } else if (supportCount === 0) {
      return 'refuting';
    } else {
      return 'mixed';
    }
  }

  /**
   * 查找最长证据链
   */
  findLongestChain(graph: EvidenceChainGraph): EvidenceChainPath | null {
    const paths = this.findAllPaths(graph);

    if (paths.length === 0) {
      return null;
    }

    // 返回最长路径
    return paths.reduce((longest, current) =>
      current.length > longest.length ? current : longest
    );
  }

  /**
   * 查找最强证据链
   */
  findStrongestChain(graph: EvidenceChainGraph): EvidenceChainPath | null {
    const paths = this.findAllPaths(graph);

    if (paths.length === 0) {
      return null;
    }

    // 返回最强路径
    return paths.reduce((strongest, current) =>
      current.totalStrength > strongest.totalStrength ? current : strongest
    );
  }

  /**
   * 查找证据之间的最短路径
   */
  findShortestPath(
    graph: EvidenceChainGraph,
    fromId: string,
    toId: string
  ): EvidenceChainPath | null {
    // 使用BFS算法查找最短路径
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: fromId, path: [fromId] },
    ];

    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) break;

      const { nodeId, path } = current;

      // 找到目标节点
      if (nodeId === toId) {
        const lastEdge = graph.edges.find(
          e =>
            e.fromEvidenceId === path[path.length - 2] &&
            e.toEvidenceId === toId
        );
        if (!lastEdge) {
          return null;
        }
        return this.createPathObject(path, lastEdge, graph);
      }

      // 遍历相邻节点
      const node = graph.nodes.find(n => n.evidenceId === nodeId);
      if (!node) continue;

      for (const edge of node.outgoingRelations) {
        if (visited.has(edge.toEvidenceId)) {
          continue;
        }

        visited.add(edge.toEvidenceId);
        queue.push({
          nodeId: edge.toEvidenceId,
          path: [...path, edge.toEvidenceId],
        });
      }
    }

    return null;
  }

  /**
   * 查找证据之间的所有路径
   */
  findAllPathsBetween(
    graph: EvidenceChainGraph,
    fromId: string,
    toId: string
  ): EvidenceChainPath[] {
    const paths: EvidenceChainPath[] = [];
    const visited = new Set<string>();

    const findPathsRecursive = (
      currentId: string,
      currentPath: string[]
    ): void => {
      if (currentId === toId) {
        const lastEdge = graph.edges.find(
          e =>
            e.fromEvidenceId === currentPath[currentPath.length - 1] &&
            e.toEvidenceId === toId
        );
        if (!lastEdge) {
          return;
        }
        const path = this.createPathObject(
          [...currentPath, toId],
          lastEdge,
          graph
        );
        paths.push(path);
        return;
      }

      if (visited.has(currentId)) {
        return;
      }

      visited.add(currentId);

      const node = graph.nodes.find(n => n.evidenceId === currentId);
      if (!node) return;

      for (const edge of node.outgoingRelations) {
        findPathsRecursive(edge.toEvidenceId, [...currentPath, currentId]);
      }

      visited.delete(currentId);
    };

    findPathsRecursive(fromId, []);

    return paths;
  }

  /**
   * 查找证据的支撑证据
   */
  findSupportingEvidences(
    graph: EvidenceChainGraph,
    evidenceId: string
  ): string[] {
    const supporting: string[] = [];

    const node = graph.nodes.find(n => n.evidenceId === evidenceId);
    if (!node) return supporting;

    // 查找所有入边中类型为SUPPORTS或SUPPLEMENTS的
    for (const edge of node.incomingRelations) {
      if (
        edge.relationType === EvidenceChainRelationType.SUPPORTS ||
        edge.relationType === EvidenceChainRelationType.SUPPLEMENTS
      ) {
        supporting.push(edge.fromEvidenceId);
      }
    }

    return supporting;
  }

  /**
   * 查找证据的反驳证据
   */
  findRefutingEvidences(
    graph: EvidenceChainGraph,
    evidenceId: string
  ): string[] {
    const refuting: string[] = [];

    const node = graph.nodes.find(n => n.evidenceId === evidenceId);
    if (!node) return refuting;

    // 查找所有入边中类型为REFUTES或CONTRADICTS的
    for (const edge of node.incomingRelations) {
      if (
        edge.relationType === EvidenceChainRelationType.REFUTES ||
        edge.relationType === EvidenceChainRelationType.CONTRADICTS
      ) {
        refuting.push(edge.fromEvidenceId);
      }
    }

    return refuting;
  }

  /**
   * 分析证据链的连通性
   */
  analyzeConnectivity(graph: EvidenceChainGraph): {
    isConnected: boolean;
    connectedComponents: number;
    maxComponentSize: number;
  } {
    const visited = new Set<string>();
    let connectedComponents = 0;
    let maxComponentSize = 0;

    for (const node of graph.nodes) {
      if (visited.has(node.evidenceId)) {
        continue;
      }

      // 使用DFS遍历连通分量
      const componentSize = this.dfsCount(node.evidenceId, graph, visited);

      connectedComponents++;
      maxComponentSize = Math.max(maxComponentSize, componentSize);
    }

    const isConnected = connectedComponents === 1;

    return {
      isConnected,
      connectedComponents,
      maxComponentSize,
    };
  }

  /**
   * DFS计数节点数量
   */
  private dfsCount(
    nodeId: string,
    graph: EvidenceChainGraph,
    visited: Set<string>
  ): number {
    visited.add(nodeId);
    let count = 1;

    const node = graph.nodes.find(n => n.evidenceId === nodeId);
    if (!node) return count;

    for (const edge of node.outgoingRelations) {
      if (!visited.has(edge.toEvidenceId)) {
        count += this.dfsCount(edge.toEvidenceId, graph, visited);
      }
    }

    return count;
  }
}
