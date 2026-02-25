/**
 * Knowledge Graph Agent Tools
 *
 * 为 Manus Agent 系统提供知识图谱查询和推理能力
 */

// 工具类
export { RelationSearchTool } from './relation-search-tool';
export { ConflictFinderTool } from './conflict-finder-tool';
export { ValidityTracerTool } from './validity-tracer-tool';
export { NeighborFinderTool } from './neighbor-finder-tool';
export { PathFinderTool } from './path-finder-tool';

// 适配器和服务
export type { AgentTool } from './adapter';
export {
  ToolRegistry,
  KnowledgeGraphAgentService,
  knowledgeGraphAgentService,
  toolRegistry,
} from './adapter';

// 类型定义
import type {
  RelationSearchParams,
  RelationSearchResult,
  RelationNode,
  RelationEdge,
  ConflictFinderParams,
  ConflictFinderResult,
  ConflictInfo,
  ValidityTracerParams,
  ValidityTracerResult,
  ValidityChainNode,
  NeighborFinderParams,
  NeighborFinderResult,
  PathFinderParams,
  PathFinderResult,
  Path,
  PathNodeDetail,
  ToolResult,
  ToolConfig,
  KnowledgeGraphToolType,
} from './types';

export type { RelationSearchParams };
export type { RelationSearchResult };
export type { RelationNode };
export type { RelationEdge };
export type { ConflictFinderParams };
export type { ConflictFinderResult };
export type { ConflictInfo };
export type { ValidityTracerParams };
export type { ValidityTracerResult };
export type { ValidityChainNode };
export type { NeighborFinderParams };
export type { NeighborFinderResult };
export type { PathFinderParams };
export type { PathFinderResult };
export type { Path };
export type { PathNodeDetail };
export type { ToolResult };
export type { ToolConfig };
export { KnowledgeGraphToolType } from './types';
export { DEFAULT_TOOL_CONFIG } from './types';
