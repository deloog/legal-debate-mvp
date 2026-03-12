/**
 * 图算法库
 *
 * 功能：
 * 1. 最短路径算法（BFS）
 * 2. 中心性分析（度中心性、PageRank）
 * 3. 连通分量分析（DFS）
 */

import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import { logger } from '@/lib/logger';

/**
 * 最短路径结果
 */
export interface ShortestPathResult {
  path: string[]; // 节点ID数组
  pathLength: number; // 路径长度（边数）
  relationTypes: string[]; // 途经关系类型
  exists: boolean; // 是否存在路径
}

/**
 * 中心性分析结果
 */
export interface CentralityResult {
  nodeId: string;
  lawName: string;
  articleNumber: string;
  category: string;
  score: number; // 中心性分数
  rank: number; // 排名
}

/**
 * 连通分量结果
 */
export interface ConnectedComponent {
  id: number; // 分量ID
  nodes: GraphNode[]; // 包含的节点
  nodeCount: number; // 节点数量
  edgeCount: number; // 边数量
}

/**
 * 邻接表
 */
type AdjacencyList = Map<
  string,
  Array<{ target: string; relationType: string }>
>;

/**
 * 构建邻接表
 */
function buildAdjacencyList(links: GraphLink[]): AdjacencyList {
  const adjList: AdjacencyList = new Map();

  for (const link of links) {
    const sourceId = link.source;
    const targetId = link.target;

    if (!adjList.has(sourceId)) {
      adjList.set(sourceId, []);
    }

    adjList
      .get(sourceId)
      ?.push({ target: targetId, relationType: link.relationType });
  }

  return adjList;
}

/**
 * 构建无向邻接表（用于连通分量分析）
 */
function buildUndirectedAdjacencyList(links: GraphLink[]): AdjacencyList {
  const adjList: AdjacencyList = new Map();

  for (const link of links) {
    const sourceId = link.source;
    const targetId = link.target;

    // 添加 source -> target
    if (!adjList.has(sourceId)) {
      adjList.set(sourceId, []);
    }
    adjList
      .get(sourceId)
      ?.push({ target: targetId, relationType: link.relationType });

    // 添加 target -> source（无向图）
    if (!adjList.has(targetId)) {
      adjList.set(targetId, []);
    }
    adjList
      .get(targetId)
      ?.push({ target: sourceId, relationType: link.relationType });
  }

  return adjList;
}

/**
 * 图算法类
 */
export class GraphAlgorithms {
  /**
   * 查找最短路径（BFS算法）
   *
   * @param nodes 图节点
   * @param links 图边
   * @param sourceId 起始节点ID
   * @param targetId 目标节点ID
   * @returns 最短路径结果
   */
  static shortestPath(
    nodes: GraphNode[],
    links: GraphLink[],
    sourceId: string,
    targetId: string
  ): ShortestPathResult {
    // 参数验证
    if (!sourceId || !targetId) {
      logger.warn('shortestPath: 缺少必需参数', { sourceId, targetId });
      return { path: [], pathLength: 0, relationTypes: [], exists: false };
    }

    if (sourceId === targetId) {
      return {
        path: [sourceId],
        pathLength: 0,
        relationTypes: [],
        exists: true,
      };
    }

    const adjList = buildAdjacencyList(links);
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // 如果节点不存在，返回无路径
    if (!nodeMap.has(sourceId) || !nodeMap.has(targetId)) {
      return { path: [], pathLength: 0, relationTypes: [], exists: false };
    }

    // BFS
    const queue: Array<{
      nodeId: string;
      path: string[];
      relationTypes: string[];
    }> = [{ nodeId: sourceId, path: [sourceId], relationTypes: [] }];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      const { nodeId, path, relationTypes } = current;

      if (nodeId === targetId) {
        return {
          path,
          pathLength: path.length - 1,
          relationTypes,
          exists: true,
        };
      }

      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.target)) {
          visited.add(neighbor.target);
          queue.push({
            nodeId: neighbor.target,
            path: [...path, neighbor.target],
            relationTypes: [...relationTypes, neighbor.relationType],
          });
        }
      }
    }

    return { path: [], pathLength: 0, relationTypes: [], exists: false };
  }

  /**
   * 计算度中心性
   *
   * @param nodes 图节点
   * @param links 图边
   * @returns 中心性结果（按分数降序排列）
   */
  static degreeCentrality(
    nodes: GraphNode[],
    links: GraphLink[]
  ): CentralityResult[] {
    const adjList = buildAdjacencyList(links);

    const results: CentralityResult[] = [];

    for (const node of nodes) {
      const degree = (adjList.get(node.id) || []).length;
      results.push({
        nodeId: node.id,
        lawName: node.lawName,
        articleNumber: node.articleNumber,
        category: node.category,
        score: degree,
        rank: 0,
      });
    }

    // 按分数降序排列
    results.sort((a, b) => b.score - a.score);

    // 添加排名
    results.forEach((r, index) => {
      r.rank = index + 1;
    });

    return results;
  }

  /**
   * 计算PageRank中心性
   *
   * @param nodes 图节点
   * @param links 图边
   * @param iterations 迭代次数（默认20）
   * @param dampingFactor 阻尼因子（默认0.85）
   * @returns 中心性结果（按分数降序排列）
   */
  static pageRank(
    nodes: GraphNode[],
    links: GraphLink[],
    iterations: number = 20,
    dampingFactor: number = 0.85
  ): CentralityResult[] {
    const adjList = buildAdjacencyList(links);

    // 初始化PageRank分数
    const pageRanks = new Map<string, number>();
    const initialRank = 1 / nodes.length;
    for (const node of nodes) {
      pageRanks.set(node.id, initialRank);
    }

    // 计算每个节点的出度
    const outDegrees = new Map<string, number>();
    for (const node of nodes) {
      outDegrees.set(node.id, (adjList.get(node.id) || []).length);
    }

    // 迭代计算PageRank
    for (let i = 0; i < iterations; i++) {
      const newPageRanks = new Map<string, number>();

      for (const node of nodes) {
        let sum = 0;

        // 查找所有指向当前节点的边
        for (const [sourceId, neighbors] of Array.from(adjList.entries())) {
          for (const neighbor of neighbors) {
            if (neighbor.target === node.id) {
              const outDegree = outDegrees.get(sourceId) || 1;
              const pageRank = pageRanks.get(sourceId) || initialRank;
              sum += pageRank / outDegree;
            }
          }
        }

        const newRank =
          (1 - dampingFactor) / nodes.length + dampingFactor * sum;
        newPageRanks.set(node.id, newRank);
      }

      pageRanks.clear();
      newPageRanks.forEach((value, key) => pageRanks.set(key, value));
    }

    // 构建结果
    const results: CentralityResult[] = [];
    for (const node of nodes) {
      results.push({
        nodeId: node.id,
        lawName: node.lawName,
        articleNumber: node.articleNumber,
        category: node.category,
        score: pageRanks.get(node.id) || 0,
        rank: 0,
      });
    }

    // 按分数降序排列
    results.sort((a, b) => b.score - a.score);

    // 添加排名
    results.forEach((r, index) => {
      r.rank = index + 1;
    });

    return results;
  }

  /**
   * 查找连通分量（DFS算法）
   *
   * @param nodes 图节点
   * @param links 图边
   * @returns 连通分量列表（按节点数量降序排列）
   */
  static connectedComponents(
    nodes: GraphNode[],
    links: GraphLink[]
  ): ConnectedComponent[] {
    const adjList = buildUndirectedAdjacencyList(links);
    const visited = new Set<string>();
    const components: ConnectedComponent[] = [];
    let componentId = 0;

    for (const node of nodes) {
      if (visited.has(node.id)) {
        continue;
      }

      // DFS遍历查找连通分量
      const stack: string[] = [node.id];
      const componentNodes: GraphNode[] = [];
      const componentNodeIds = new Set<string>();

      while (stack.length > 0) {
        const currentId = stack.pop();
        if (!currentId || visited.has(currentId)) {
          continue;
        }

        visited.add(currentId);
        componentNodeIds.add(currentId);

        const currentNode = nodes.find(n => n.id === currentId);
        if (currentNode) {
          componentNodes.push(currentNode);
        }

        const neighbors = adjList.get(currentId) || [];
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor.target)) {
            stack.push(neighbor.target);
          }
        }
      }

      // 计算边数量
      let edgeCount = 0;
      const nodeIds = Array.from(componentNodeIds);
      for (let i = 0; i < nodeIds.length; i++) {
        for (let j = i + 1; j < nodeIds.length; j++) {
          const id1 = nodeIds[i];
          const id2 = nodeIds[j];

          const neighbors = adjList.get(id1) || [];
          if (neighbors.some(n => n.target === id2)) {
            edgeCount++;
          }
        }
      }

      components.push({
        id: componentId++,
        nodes: componentNodes,
        nodeCount: componentNodes.length,
        edgeCount,
      });
    }

    // 按节点数量降序排列
    components.sort((a, b) => b.nodeCount - a.nodeCount);

    return components;
  }

  /**
   * 标签传播算法（Label Propagation）— 社区检测
   *
   * 每个节点初始标签为自身ID，迭代时将标签更新为邻居中出现最多的标签。
   * 收敛后，同一标签的节点属于同一社区。
   *
   * @param nodes 图节点
   * @param links 图边
   * @param maxIterations 最大迭代次数（默认20）
   * @returns 节点ID -> 社区ID 的映射
   */
  static labelPropagation(
    nodes: GraphNode[],
    links: GraphLink[],
    maxIterations: number = 20
  ): Map<string, number> {
    if (nodes.length === 0) {
      return new Map();
    }

    // 限制最大迭代次数防止无限循环
    const MAX_ITERATIONS = Math.min(maxIterations, 100);

    const adjList = buildUndirectedAdjacencyList(links);

    // 初始化：每个节点标签 = 节点在数组中的索引
    const labels = new Map<string, number>();
    nodes.forEach((n, i) => labels.set(n.id, i));

    // 节点ID列表（使用确定性顺序而非随机）
    const nodeIds = nodes.map(n => n.id).sort();

    for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
      let changed = false;

      // 使用确定性顺序（按节点ID排序）而非随机，确保结果可重现
      for (const nodeId of nodeIds) {
        const neighbors = adjList.get(nodeId);
        if (!neighbors || neighbors.length === 0) continue;

        // 统计邻居标签频次
        const labelCount = new Map<number, number>();
        for (const neighbor of neighbors) {
          const lbl = labels.get(neighbor.target);
          if (lbl !== undefined) {
            labelCount.set(lbl, (labelCount.get(lbl) ?? 0) + 1);
          }
        }

        if (labelCount.size === 0) continue;

        // 找出最高频次的标签（如有并列取最小值确保确定性）
        let maxCount = -1;
        let bestLabel = labels.get(nodeId) ?? 0;

        // 按标签值排序遍历，确保确定性
        const sortedLabels = Array.from(labelCount.entries()).sort(
          (a, b) => a[0] - b[0]
        );

        for (const [lbl, count] of sortedLabels) {
          if (count > maxCount) {
            maxCount = count;
            bestLabel = lbl;
          }
        }

        if (bestLabel !== labels.get(nodeId)) {
          labels.set(nodeId, bestLabel);
          changed = true;
        }
      }

      // 如果本轮没有标签变化，算法收敛，提前退出
      if (!changed) {
        logger.debug(
          `Label propagation converged after ${iter + 1} iterations`
        );
        break;
      }
    }

    // 将标签重新编号为连续整数（0, 1, 2, ...）
    const uniqueLabels = Array.from(new Set(labels.values())).sort(
      (a, b) => a - b
    );
    const labelRemap = new Map<number, number>(
      uniqueLabels.map((lbl, i) => [lbl, i])
    );

    const communityMap = new Map<string, number>();
    for (const [nodeId, lbl] of Array.from(labels.entries())) {
      communityMap.set(nodeId, labelRemap.get(lbl) ?? 0);
    }

    return communityMap;
  }
}
