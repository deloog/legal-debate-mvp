/**
 * 分页元数据接口
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * 分页查询参数接口
 */
export interface PaginationQuery {
  page: number;
  limit: number;
  sort?: string;
  order: 'asc' | 'desc';
}

/**
 * 分页结果接口
 */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * 构建分页查询选项
 */
export function buildPaginationOptions(query: PaginationQuery) {
  const { page, limit, sort, order } = query;
  const skip = (page - 1) * limit;

  return {
    skip,
    take: limit,
    orderBy: sort ? { [sort]: order } : { createdAt: 'desc' as const },
  };
}

/**
 * 构建搜索查询选项
 */
export function buildSearchOptions(query: PaginationQuery & { search?: string }) {
  const { page, limit, sort, order, search } = query;
  const skip = (page - 1) * limit;

  const where = search ? {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ],
  } : {};

  return {
    where,
    skip,
    take: limit,
    orderBy: sort ? { [sort]: order } : { createdAt: 'desc' as const },
  };
}

/**
 * 计算分页偏移量
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * 验证分页参数
 */
export function validatePaginationParams(params: {
  page?: unknown;
  limit?: unknown;
  sort?: unknown;
  order?: unknown;
}): PaginationQuery {
  // 处理page参数
  let page = 1;
  if (params.page !== undefined && params.page !== null && params.page !== '') {
    const parsedPage = Number(params.page);
    if (!isNaN(parsedPage)) {
      page = Math.floor(parsedPage); // 确保是整数
    }
  }

  // 处理limit参数
  let limit = 20;
  if (params.limit !== undefined && params.limit !== null && params.limit !== '') {
    const parsedLimit = Number(params.limit);
    if (!isNaN(parsedLimit)) {
      limit = Math.floor(parsedLimit); // 确保是整数
    }
  }
  
  // 处理布尔值转换
  if (typeof params.limit === 'boolean') {
    limit = params.limit ? 1 : 20;
  }

  // 验证边界条件
  if (page < 1) {
    throw new Error('Page must be greater than 0');
  }

  if (limit < 1 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  // 验证order参数
  let order: 'asc' | 'desc' = 'desc';
  if (params.order && typeof params.order === 'string') {
    const normalizedOrder = params.order.toLowerCase();
    if (normalizedOrder === 'asc' || normalizedOrder === 'desc') {
      order = normalizedOrder;
    }
  }

  return {
    page,
    limit,
    sort: typeof params.sort === 'string' ? params.sort : undefined,
    order,
  };
}
