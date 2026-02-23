/**
 * 数据库查询优化工具函数
 * 提供常用的查询优化模式
 */

import type { Prisma } from '@prisma/client';

/**
 * 分页查询选项
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * 构建分页查询选项
 */
export function buildPaginationOptions(options: PaginationOptions): {
  skip: number;
  take: number;
} {
  const { page, limit } = options;
  const maxLimit = 100; // 最大限制100条记录
  const normalizedLimit = Math.min(limit, maxLimit);
  const skip = (page - 1) * normalizedLimit;

  return { skip, take: normalizedLimit };
}

/**
 * 构建排序选项
 */
export function buildOrderBy<T extends Record<string, 'asc' | 'desc'>>(
  sortBy: string,
  sortOrder: 'asc' | 'desc',
  validFields: string[]
): T {
  const orderBy: Record<string, 'asc' | 'desc'> = {};

  if (validFields.includes(sortBy)) {
    orderBy[sortBy] = sortOrder;
  } else {
    orderBy.createdAt = 'desc'; // 默认按创建时间降序
  }

  return orderBy as T;
}

/**
 * 构建模糊搜索条件
 */
export function buildSearchCondition(
  fields: string[],
  searchTerm: string
): Prisma.StringFilter | Prisma.StringFilter[] {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return {};
  }

  const conditions = fields.map(
    field =>
      ({
        [field]: { contains: searchTerm, mode: 'insensitive' as const },
      }) as Prisma.StringFilter
  );

  return { OR: conditions } as Prisma.StringFilter;
}

/**
 * 构建时间范围过滤条件
 */
export function buildDateRangeFilter(
  _fieldName: string,
  startDate?: string | Date,
  endDate?: string | Date
): Prisma.DateTimeFilter {
  const filter: Prisma.DateTimeFilter = {};

  if (startDate) {
    filter.gte = new Date(startDate);
  }

  if (endDate) {
    filter.lte = new Date(endDate);
  }

  return filter;
}

/**
 * 构建软删除过滤条件
 */
export function buildSoftDeleteFilter(
  fieldName = 'deletedAt'
): Record<string, null> {
  return { [fieldName]: null };
}

/**
 * 批量查询优化器
 * 将单个查询拆分为批量查询，减少数据库往返
 */
export class BatchQueryOptimizer<K> {
  private batchSize: number;
  private queries: Array<() => Promise<K>> = [];
  private results: K[] = [];

  constructor(batchSize = 10) {
    this.batchSize = batchSize;
  }

  /**
   * 添加查询到批处理队列
   */
  addQuery(query: () => Promise<K>): void {
    this.queries.push(query);
  }

  /**
   * 执行所有查询
   */
  async executeAll(): Promise<K[]> {
    const batches: Array<() => Promise<K>>[] = [];

    // 将查询分组为批次
    for (let i = 0; i < this.queries.length; i += this.batchSize) {
      batches.push(this.queries.slice(i, i + this.batchSize));
    }

    // 逐批执行
    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(q => q()));
      this.results.push(...batchResults);
    }

    return this.results;
  }

  /**
   * 清空批处理队列
   */
  clear(): void {
    this.queries = [];
    this.results = [];
  }
}

/**
 * 查询计数器
 * 用于统计查询次数，帮助识别N+1查询问题
 */
export class QueryCounter {
  private counts = new Map<string, number>();

  /**
   * 增加查询计数
   */
  increment(queryType: string): void {
    const current = this.counts.get(queryType) || 0;
    this.counts.set(queryType, current + 1);
  }

  /**
   * 获取查询计数
   */
  getCount(queryType: string): number {
    return this.counts.get(queryType) || 0;
  }

  /**
   * 获取所有查询计数
   */
  getAllCounts(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  /**
   * 重置计数
   */
  reset(): void {
    this.counts.clear();
  }

  /**
   * 打印查询统计
   */
  logStats(): void {
    const stats = this.getAllCounts();
    console.log('查询统计:', JSON.stringify(stats, null, 2));
  }
}

/**
 * 查询优化建议
 * 基于查询模式提供优化建议
 */
export interface QueryOptimizationSuggestion {
  type:
    | 'missing-index'
    | 'n-plus-one'
    | 'large-result-set'
    | 'inefficient-join';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  suggestion: string;
}

/**
 * 分析查询并提供建议
 */
export function analyzeQueryOptimization(
  _queryType: string,
  queryStats: {
    executionTime: number;
    resultCount: number;
    hasIncludes: boolean;
    hasJoins: boolean;
  }
): QueryOptimizationSuggestion[] {
  const suggestions: QueryOptimizationSuggestion[] = [];

  // 检查执行时间
  if (queryStats.executionTime > 1000) {
    suggestions.push({
      type: 'inefficient-join',
      severity: 'high',
      message: `查询执行时间过长: ${queryStats.executionTime}ms`,
      suggestion: '考虑添加索引或优化查询条件',
    });
  }

  // 检查结果集大小
  if (queryStats.resultCount > 100) {
    suggestions.push({
      type: 'large-result-set',
      severity: 'medium',
      message: `返回结果集过大: ${queryStats.resultCount}条`,
      suggestion: '考虑使用分页或限制返回字段',
    });
  }

  // 检查关联查询
  if (queryStats.hasIncludes && queryStats.executionTime > 500) {
    suggestions.push({
      type: 'inefficient-join',
      severity: 'medium',
      message: '关联查询可能存在性能问题',
      suggestion: '考虑使用select替代include，只获取必要字段',
    });
  }

  return suggestions;
}
