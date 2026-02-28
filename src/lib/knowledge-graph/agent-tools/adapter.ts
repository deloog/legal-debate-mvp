/**
 * Knowledge Graph Agent Tools 适配器
 *
 * 将知识图谱工具适配到 Manus Agent 系统
 */

import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { RelationSearchTool } from './relation-search-tool';
import { ConflictFinderTool } from './conflict-finder-tool';
import { ValidityTracerTool } from './validity-tracer-tool';
import { NeighborFinderTool } from './neighbor-finder-tool';
import { PathFinderTool } from './path-finder-tool';
import type {
  RelationSearchParams,
  RelationSearchResult,
  ConflictFinderParams,
  ConflictFinderResult,
  ValidityTracerParams,
  ValidityTracerResult,
  NeighborFinderParams,
  NeighborFinderResult,
  PathFinderParams,
  PathFinderResult,
  ToolResult,
} from './types';

/**
 * Agent 工具定义
 */
export interface AgentTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 执行方法 */
  execute: (params: unknown) => Promise<ToolResult>;
}

/**
 * 工具注册表
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, AgentTool> = new Map();

  private constructor() {
    this.registerDefaultTools();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * 注册默认工具
   */
  private registerDefaultTools(): void {
    const relationSearchTool = new RelationSearchTool(prisma);
    const conflictFinderTool = new ConflictFinderTool(prisma);
    const validityTracerTool = new ValidityTracerTool(prisma);
    const neighborFinderTool = new NeighborFinderTool(prisma);
    const pathFinderTool = new PathFinderTool(prisma);

    this.registerTool({
      name: 'kg_search_relations',
      description: '查询法条之间的关系网络，包括引用、冲突、补全、替代等关系',
      execute: async (params: unknown) => {
        return relationSearchTool.execute(params as RelationSearchParams);
      },
    });

    this.registerTool({
      name: 'kg_find_conflicts',
      description: '检测法条间的冲突关系，包括直接冲突和间接冲突',
      execute: async (params: unknown) => {
        return conflictFinderTool.execute(params as ConflictFinderParams);
      },
    });

    this.registerTool({
      name: 'kg_trace_validity',
      description: '追踪法条的效力链，查找替代法条和效力状态',
      execute: async (params: unknown) => {
        return validityTracerTool.execute(params as ValidityTracerParams);
      },
    });

    this.registerTool({
      name: 'kg_get_neighbors',
      description: '获取法条的N度邻居节点，支持分层查询',
      execute: async (params: unknown) => {
        return neighborFinderTool.execute(params as NeighborFinderParams);
      },
    });

    this.registerTool({
      name: 'kg_find_path',
      description: '查找法条之间的路径，支持最短路径和最强路径',
      execute: async (params: unknown) => {
        return pathFinderTool.execute(params as PathFinderParams);
      },
    });
  }

  /**
   * 注册工具
   */
  registerTool(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
    logger.info('Knowledge Graph Tool 注册成功', { name: tool.name });
  }

  /**
   * 获取工具
   */
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 获取所有工具
   */
  getAllTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * 执行工具
   */
  async executeTool(name: string, params: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        error: `工具不存在: ${name}`,
        executionTime: 0,
      };
    }

    try {
      return await tool.execute(params);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Knowledge Graph Tool 执行失败', {
        name,
        error: errorMessage,
      });
      return {
        success: false,
        error: errorMessage,
        executionTime: 0,
      };
    }
  }

  /**
   * 获取工具列表（用于Agent描述）
   */
  getToolDescriptions(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}

/**
 * Knowledge Graph Agent 服务
 *
 * 为 Manus Agent 系统提供知识图谱查询能力
 */
export class KnowledgeGraphAgentService {
  private static instance: KnowledgeGraphAgentService;
  private readonly toolRegistry: ToolRegistry;

  private constructor() {
    this.toolRegistry = ToolRegistry.getInstance();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): KnowledgeGraphAgentService {
    if (!KnowledgeGraphAgentService.instance) {
      KnowledgeGraphAgentService.instance = new KnowledgeGraphAgentService();
    }
    return KnowledgeGraphAgentService.instance;
  }

  /**
   * 获取所有可用工具
   */
  getAvailableTools(): AgentTool[] {
    return this.toolRegistry.getAllTools();
  }

  /**
   * 获取工具描述
   */
  getToolDescriptions(): Array<{ name: string; description: string }> {
    return this.toolRegistry.getToolDescriptions();
  }

  /**
   * 执行工具
   */
  async executeTool(toolName: string, params: unknown): Promise<ToolResult> {
    return this.toolRegistry.executeTool(toolName, params);
  }

  /**
   * 查询法条关系
   */
  async searchRelations(
    params: RelationSearchParams
  ): Promise<ToolResult<RelationSearchResult>> {
    const toolName = 'kg_search_relations';
    const result = await this.executeTool(toolName, params);
    return result as ToolResult<RelationSearchResult>;
  }

  /**
   * 检测冲突
   */
  async findConflicts(
    params: ConflictFinderParams
  ): Promise<ToolResult<ConflictFinderResult>> {
    const toolName = 'kg_find_conflicts';
    const result = await this.executeTool(toolName, params);
    return result as ToolResult<ConflictFinderResult>;
  }

  /**
   * 追踪效力链
   */
  async traceValidity(
    params: ValidityTracerParams
  ): Promise<ToolResult<ValidityTracerResult>> {
    const toolName = 'kg_trace_validity';
    const result = await this.executeTool(toolName, params);
    return result as ToolResult<ValidityTracerResult>;
  }

  /**
   * 获取邻居
   */
  async getNeighbors(
    params: NeighborFinderParams
  ): Promise<ToolResult<NeighborFinderResult>> {
    const toolName = 'kg_get_neighbors';
    const result = await this.executeTool(toolName, params);
    return result as ToolResult<NeighborFinderResult>;
  }

  /**
   * 查找路径
   */
  async findPath(
    params: PathFinderParams
  ): Promise<ToolResult<PathFinderResult>> {
    const toolName = 'kg_find_paths';
    const result = await this.executeTool(toolName, params);
    return result as ToolResult<PathFinderResult>;
  }

  /**
   * 批量执行工具
   */
  async executeBatch(
    operations: Array<{
      toolName: string;
      params: unknown;
    }>
  ): Promise<Array<ToolResult>> {
    const results = await Promise.all(
      operations.map(({ toolName, params }) =>
        this.executeTool(toolName, params)
      )
    );
    return results;
  }
}

/**
 * 导出默认实例
 */
export const knowledgeGraphAgentService =
  KnowledgeGraphAgentService.getInstance();

/**
 * 导出工具注册表实例
 */
export const toolRegistry = ToolRegistry.getInstance();
