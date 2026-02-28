/**
 * 查询语言类型定义
 *
 * 功能：定义图谱查询语言的输入/输出类型
 */

import { z } from 'zod';

/**
 * 查询方向枚举
 */
export type GraphQueryDirection = 'in' | 'out' | 'both';

/**
 * 关系过滤条件
 */
export interface GraphQueryFilter {
  /** 关系类型过滤 */
  relationType?: string;
  /** 最小关系强度 (0-1) */
  minStrength?: number;
  /** 验证状态过滤 */
  verificationStatus?: string;
  /** 发现方法过滤 */
  discoveryMethod?: string;
}

/**
 * 聚合函数类型
 */
export type GraphQueryAggregate = 'count' | 'sum' | 'avg' | 'max' | 'min';

/**
 * 图查询输入
 */
export interface GraphQueryInput {
  /** 起始节点ID（必需） */
  startNode: string;
  /** 查询方向：in（入）、out（出）、both（双向） */
  direction?: GraphQueryDirection;
  /** 查询深度 */
  depth?: number;
  /** 过滤条件 */
  filter?: GraphQueryFilter;
  /** 聚合函数 */
  aggregate?: GraphQueryAggregate;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 限制返回结果数量 */
  limit?: number;
  /** 分页偏移量 */
  offset?: number;
}

/**
 * 图节点
 */
export interface GraphQueryNode {
  /** 节点ID */
  id: string;
  /** 法条名称 */
  lawName: string;
  /** 法条编号 */
  articleNumber: string;
  /** 分类 */
  category?: string;
  /** 节点类型 */
  nodeType: 'lawArticle';
}

/**
 * 图边（关系）
 */
export interface GraphQueryLink {
  /** 边ID */
  id: string;
  /** 源节点ID */
  source: string;
  /** 目标节点ID */
  target: string;
  /** 关系类型 */
  relationType: string;
  /** 关系强度 */
  strength?: number;
}

/**
 * 图查询结果
 */
export interface GraphQueryResult {
  /** 节点列表 */
  nodes: GraphQueryNode[];
  /** 边列表 */
  links: GraphQueryLink[];
  /** 聚合结果（如果指定了aggregate） */
  aggregate?: {
    /** 聚合类型 */
    type: GraphQueryAggregate;
    /** 聚合值 */
    value: number;
    /** 聚合字段 */
    field?: string;
  };
  /** 查询统计 */
  stats?: {
    /** 耗时（毫秒） */
    queryTime: number;
    /** 节点数量 */
    nodeCount: number;
    /** 边数量 */
    linkCount: number;
  };
}

/**
 * 查询错误
 */
export interface GraphQueryError {
  /** 错误代码 */
  code: string;
  /** 错误消息 */
  message: string;
  /** 错误详情 */
  details?: Record<string, unknown>;
}

// Zod 验证模式

/**
 * GraphQueryDirection 验证模式
 */
const GraphQueryDirectionSchema = z.enum(['in', 'out', 'both']);

/**
 * GraphQueryFilter 验证模式
 */
const GraphQueryFilterSchema = z.object({
  relationType: z.string().optional(),
  minStrength: z.number().min(0).max(1).optional(),
  verificationStatus: z.string().optional(),
  discoveryMethod: z.string().optional(),
});

/**
 * GraphQueryAggregate 验证模式
 */
const GraphQueryAggregateSchema = z.enum(['count', 'sum', 'avg', 'max', 'min']);

/**
 * GraphQueryInput 验证模式
 */
export const GraphQueryInputSchema = z.object({
  startNode: z.string().min(1, 'startNode 不能为空'),
  direction: GraphQueryDirectionSchema.optional().default('both'),
  depth: z.number().int().min(1).max(10).optional().default(1),
  filter: GraphQueryFilterSchema.optional(),
  aggregate: GraphQueryAggregateSchema.optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  limit: z.number().int().min(1).max(100).optional().default(50),
  offset: z.number().int().min(0).optional().default(0),
});

/**
 * 验证查询输入是否有效
 */
export function isValidQueryInput(input: unknown): input is GraphQueryInput {
  const result = GraphQueryInputSchema.safeParse(input);
  return result.success;
}

/**
 * 验证查询输入并返回错误列表
 */
export function validateQueryInput(input: unknown): string[] {
  const result = GraphQueryInputSchema.safeParse(input);

  if (result.success) {
    return [];
  }

  return result.error.issues.map(issue => {
    const path = issue.path.join('.');
    return `${path ? `${path}: ` : ''}${issue.message}`;
  });
}

/**
 * 解析查询输入，设置默认值
 */
export function parseQueryInput(
  input: GraphQueryInput
): Required<GraphQueryInput> {
  const parsed = GraphQueryInputSchema.parse(input);

  return {
    startNode: parsed.startNode,
    direction: parsed.direction ?? 'both',
    depth: parsed.depth ?? 1,
    filter: parsed.filter,
    aggregate: parsed.aggregate,
    sortBy: parsed.sortBy ?? 'strength',
    sortOrder: parsed.sortOrder ?? 'desc',
    limit: parsed.limit ?? 50,
    offset: parsed.offset ?? 0,
  };
}

/**
 * 创建错误响应
 */
export function createQueryError(
  code: string,
  message: string,
  details?: Record<string, unknown>
): GraphQueryError {
  return {
    code,
    message,
    details,
  };
}

/**
 * 验证关系强度
 */
export function isValidStrength(value: unknown): boolean {
  if (typeof value !== 'number') {
    return false;
  }
  return value >= 0 && value <= 1;
}

/**
 * 验证深度范围
 */
export function isValidDepth(value: unknown): boolean {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return false;
  }
  return value >= 1 && value <= 10;
}

/**
 * 验证方向参数
 */
export function isValidDirection(value: unknown): value is GraphQueryDirection {
  return value === 'in' || value === 'out' || value === 'both';
}
