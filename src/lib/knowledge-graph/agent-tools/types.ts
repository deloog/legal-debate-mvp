/**
 * Knowledge Graph Agent Tools 类型定义
 *
 * 为 Manus Agent 系统提供知识图谱查询和推理能力
 */

import type { RelationType } from '@prisma/client';

// =============================================================================
// 工具基础类型
// =============================================================================

/**
 * 知识图谱 Agent 工具类型
 */
export enum KnowledgeGraphToolType {
  /** 查询法条之间的关系 */
  SEARCH_RELATIONS = 'kg_search_relations',
  /** 检测法条间的冲突关系 */
  FIND_CONFLICTS = 'kg_find_conflicts',
  /** 追踪法条效力链 */
  TRACE_VALIDITY = 'kg_trace_validity',
  /** 获取法条的N度邻居节点 */
  GET_NEIGHBORS = 'kg_get_neighbors',
  /** 查找法条间的最短路径 */
  FIND_PATHS = 'kg_find_paths',
}

/**
 * 工具执行结果
 */
export interface ToolResult<T = unknown> {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: T;
  /** 错误信息 */
  error?: string;
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 缓存命中 */
  cached?: boolean;
}

// =============================================================================
// 关系查询工具类型
// =============================================================================

/**
 * 关系查询参数
 */
export interface RelationSearchParams {
  /** 法条ID */
  articleId: string;
  /** 关系类型过滤（可选） */
  relationTypes?: RelationType[];
  /** 查询深度（1-3） */
  depth?: number;
  /** 包含方向（true: 包含入边和出边, false: 仅出边） */
  bidirectional?: boolean;
}

/**
 * 关系节点
 */
export interface RelationNode {
  /** 法条ID */
  id: string;
  /** 法条标题 */
  title: string;
  /** 法条分类 */
  category: string;
  /** 效力状态 */
  status: 'VALID' | 'OBSOLETE' | 'REPEALED' | 'IN_EFFECT';
}

/**
 * 关系边
 */
export interface RelationEdge {
  /** 关系ID */
  id: string;
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 关系类型 */
  relationType: RelationType;
  /** 关系强度（0-1） */
  strength: number;
  /** 验证状态 */
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

/**
 * 关系查询结果
 */
export interface RelationSearchResult {
  /** 中心法条 */
  centerNode: RelationNode;
  /** 关联法条列表 */
  nodes: RelationNode[];
  /** 关系列表 */
  edges: RelationEdge[];
  /** 统计信息 */
  stats: {
    /** 总节点数 */
    totalNodes: number;
    /** 总边数 */
    totalEdges: number;
    /** 按类型统计 */
    byRelationType: Record<RelationType, number>;
  };
}

// =============================================================================
// 冲突检测工具类型
// =============================================================================

/**
 * 冲突检测参数
 */
export interface ConflictFinderParams {
  /** 法条ID列表 */
  articleIds: string[];
  /** 检测深度 */
  maxDepth?: number;
  /** 包含间接冲突 */
  includeIndirect?: boolean;
}

/**
 * 冲突信息
 */
export interface ConflictInfo {
  /** 源法条ID */
  articleId: string;
  /** 源法条标题 */
  articleTitle: string;
  /** 冲突的法条列表 */
  conflictsWith: Array<{
    /** 法条ID */
    articleId: string;
    /** 法条标题 */
    articleTitle: string;
    /** 关系类型 */
    relationType: RelationType;
    /** 冲突原因 */
    reason: string;
    /** 冲突强度 */
    strength: number;
  }>;
}

/**
 * 冲突检测结果
 */
export interface ConflictFinderResult {
  /** 检测到的冲突列表 */
  conflicts: ConflictInfo[];
  /** 统计信息 */
  stats: {
    /** 检测的法条数 */
    totalArticles: number;
    /** 发现的冲突数 */
    totalConflicts: number;
    /** 直接冲突数 */
    directConflicts: number;
    /** 间接冲突数 */
    indirectConflicts: number;
  };
}

// =============================================================================
// 效力链追踪工具类型
// =============================================================================

/**
 * 效力链追踪参数
 */
export interface ValidityTracerParams {
  /** 法条ID */
  articleId: string;
  /** 最大追踪深度 */
  maxDepth?: number;
  /** 包含替代关系 */
  includeReplacements?: boolean;
  /** 包含引用关系 */
  includeCitations?: boolean;
}

/**
 * 效力链节点
 */
export interface ValidityChainNode {
  /** 法条ID */
  articleId: string;
  /** 法条标题 */
  title: string;
  /** 当前状态 */
  status: 'VALID' | 'OBSOLETE' | 'REPEALED' | 'IN_EFFECT';
  /** 生效日期 */
  effectiveDate: Date | null;
  /** 替代信息 */
  replacedBy?: {
    /** 替代的法条ID */
    articleId: string;
    /** 替代日期 */
    replacedAt: Date;
  };
}

/**
 * 效力链追踪结果
 */
export interface ValidityTracerResult {
  /** 起始法条ID */
  articleId: string;
  /** 效力链 */
  chain: ValidityChainNode[];
  /** 链的当前状态 */
  currentStatus: 'VALID' | 'OBSOLETE' | 'REPEALED' | 'IN_EFFECT';
  /** 有效法条（链的末端） */
  validArticle?: ValidityChainNode;
  /** 统计信息 */
  stats: {
    /** 链的长度 */
    chainLength: number;
    /** 替代次数 */
    replacementCount: number;
  };
}

// =============================================================================
// 邻居查询工具类型
// =============================================================================

/**
 * 邻居查询参数
 */
export interface NeighborFinderParams {
  /** 节点ID */
  nodeId: string;
  /** 查询深度 */
  depth: number;
  /** 关系类型过滤（可选） */
  relationTypes?: RelationType[];
  /** 最大返回节点数 */
  maxNodes?: number;
}

/**
 * 邻居查询结果
 */
export interface NeighborFinderResult {
  /** 中心节点 */
  centerNode: RelationNode;
  /** 各层级的邻居 */
  layers: Array<{
    /** 层级（从1开始） */
    level: number;
    /** 该层的节点 */
    nodes: RelationNode[];
    /** 该层级的边 */
    edges: RelationEdge[];
  }>;
  /** 所有邻居节点（扁平化） */
  allNeighbors: RelationNode[];
  /** 统计信息 */
  stats: {
    /** 总邻居数 */
    totalNeighbors: number;
    /** 各层级统计 */
    byLevel: Record<number, number>;
  };
}

// =============================================================================
// 路径查找工具类型
// =============================================================================

/**
 * 路径查找参数
 */
export interface PathFinderParams {
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 查找最短路径 */
  findShortest?: boolean;
  /** 查找最强路径 */
  findStrongest?: boolean;
  /** 最大跳数限制 */
  maxHops?: number;
  /** 关系类型过滤（可选） */
  relationTypes?: RelationType[];
}

/**
 * 路径节点详情
 */
export interface PathNodeDetail {
  /** 法条ID */
  articleId: string;
  /** 法条标题 */
  title: string;
  /** 法条分类 */
  category: string;
  /** 关系类型（最后一个节点无此字段） */
  relationType?: RelationType;
  /** 关系强度（最后一个节点无此字段） */
  strength?: number;
}

/**
 * 路径
 */
export interface Path {
  /** 路径节点ID序列 */
  path: string[];
  /** 路径长度（边数） */
  pathLength: number;
  /** 跳数 */
  hops: number;
  /** 路径强度（平均） */
  strength: number;
  /** 是否存在路径 */
  exists: boolean;
  /** 路径节点详情 */
  nodeDetails?: PathNodeDetail[];
}

/**
 * 路径查找结果
 */
export interface PathFinderResult {
  /** 源法条ID */
  sourceId: string;
  /** 目标法条ID */
  targetId: string;
  /** 源法条标题 */
  sourceTitle: string;
  /** 目标法条标题 */
  targetTitle: string;
  /** 最短路径 */
  shortestPath?: Path;
  /** 最强路径（平均强度最高） */
  strongestPath?: Path;
  /** 统计信息 */
  stats: {
    /** 图中节点总数 */
    graphSize: number;
    /** 是否找到路径 */
    foundPath: boolean;
  };
}

// =============================================================================
// 工具配置
// =============================================================================

/**
 * 工具配置
 */
export interface ToolConfig {
  /** 是否启用缓存 */
  enableCache: boolean;
  /** 缓存TTL（毫秒） */
  cacheTTL: number;
  /** 最大返回结果数 */
  maxResults: number;
  /** 超时时间（毫秒） */
  timeout: number;
}

/**
 * 默认工具配置
 */
export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  enableCache: true,
  cacheTTL: 300000, // 5分钟
  maxResults: 1000,
  timeout: 10000, // 10秒
};
