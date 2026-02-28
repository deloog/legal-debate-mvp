/**
 * 知识图谱缓存类型定义
 *
 * 功能：
 * 1. 缓存类型定义
 * 2. 缓存配置接口
 * 3. 缓存数据结构
 */

import { GraphNode, GraphLink } from '@/lib/law-article/graph-builder';
import { ShortestPathResult } from '@/lib/knowledge-graph/graph-algorithms';

/**
 * 缓存类型
 */
export enum CacheType {
  /** 节点的N度邻居数据 */
  NODE_NEIGHBORS = 'node_neighbors',
  /** 两节点间的最短路径 */
  SHORTEST_PATH = 'shortest_path',
  /** 子图数据（多节点） */
  SUBGRAPH = 'subgraph',
}

/**
 * 邻居查询参数
 */
export interface NeighborsQueryParams {
  /** 节点ID */
  nodeId: string;
  /** 查询深度 */
  depth: number;
  /** 关系类型筛选（可选） */
  relationTypes?: string[];
}

/**
 * 最短路径查询参数
 */
export interface ShortestPathQueryParams {
  /** 源节点ID */
  sourceId: string;
  /** 目标节点ID */
  targetId: string;
  /** 最大深度（可选） */
  maxDepth?: number;
}

/**
 * 子图查询参数
 */
export interface SubgraphQueryParams {
  /** 节点ID集合 */
  nodeIds: string[];
  /** 查询深度 */
  depth: number;
  /** 关系类型筛选（可选） */
  relationTypes?: string[];
}

/**
 * 缓存数据接口
 */
export interface CacheData {
  /** 节点数据（NODE_NEIGHBORS, SUBGRAPH） */
  nodes?: GraphNode[];
  /** 关系数据（NODE_NEIGHBORS, SUBGRAPH） */
  links?: GraphLink[];
  /** 最短路径结果（SHORTEST_PATH） */
  shortestPath?: ShortestPathResult;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 缓存条目
 */
export interface CacheEntry {
  id: string;
  cacheType: CacheType;
  cacheKey: string;
  cacheData: CacheData;
  hitCount: number;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt?: Date;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /** 默认过期时间（秒） */
  defaultTTL: number;
  /** 最大缓存条目数 */
  maxEntries?: number;
  /** 是否启用缓存 */
  enabled: boolean;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 总缓存条目数 */
  totalEntries: number;
  /** 按类型分组的统计 */
  byType: Record<CacheType, number>;
  /** 平均命中率 */
  hitRate: number;
  /** 总命中次数 */
  totalHits: number;
  /** 总请求次数 */
  totalRequests: number;
  /** 即将过期的条目数（1小时内） */
  expiringSoon: number;
  /** 已过期的条目数 */
  expired: number;
}

/**
 * 缓存预热选项
 */
export interface WarmUpOptions {
  /** 预热的缓存类型 */
  cacheTypes?: CacheType[];
  /** 最大预热数量 */
  maxEntries?: number;
  /** 是否跳过已存在的缓存 */
  skipExisting?: boolean;
}

/**
 * 缓存清理选项
 */
export interface ClearCacheOptions {
  /** 清理的缓存类型（不指定则清理所有） */
  cacheTypes?: CacheType[];
  /** 是否只清理过期缓存 */
  expiredOnly?: boolean;
}
