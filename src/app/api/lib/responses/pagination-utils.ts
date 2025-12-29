/**
 * 创建分页游标
 */
export function createCursor<T>(
  items: T[],
  key: keyof T,
  limit: number,
): {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
} {
  if (!items || items.length === 0) {
    return {
      data: [],
      hasMore: false,
    };
  }

  if (limit <= 0) {
    return {
      data: [],
      hasMore: true,
      nextCursor: undefined,
    };
  }

  if (items.length <= limit) {
    return {
      data: items,
      hasMore: false,
    };
  }

  const nextItem = items[limit];
  if (!nextItem || nextItem[key] === undefined || nextItem[key] === null) {
    return {
      data: items.slice(0, limit),
      hasMore: true,
    };
  }

  const nextCursor = Buffer.from(
    JSON.stringify({ [key]: nextItem[key] }),
  ).toString("base64");

  return {
    data: items.slice(0, limit),
    nextCursor,
    hasMore: true,
  };
}

/**
 * 解析分页游标
 */
export function parseCursor(cursor?: string): Record<string, unknown> | null {
  if (!cursor) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(cursor, "base64").toString());
  } catch {
    return null;
  }
}

/**
 * 构建游标查询选项
 */
export function buildCursorOptions<T>(
  cursor?: string,
  limit: number = 20,
): {
  cursor?: Record<string, unknown>;
  take: number;
} {
  const parsedCursor = parseCursor(cursor);

  return {
    cursor: parsedCursor,
    take: limit + 1, // 多取一个来判断是否还有更多数据
  };
}

/**
 * 估算查询总数（用于大数据集性能优化）
 */
export async function estimateTotalCount<T>(
  countFunction: () => Promise<number>,
  totalCount?: number,
): Promise<number> {
  if (totalCount !== undefined) {
    return totalCount;
  }

  return countFunction();
}

/**
 * 创建分页链接
 */
export function createPaginationLinks(
  baseUrl: string,
  pagination: {
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  },
  queryParams: Record<string, string> = {},
): {
  first: string;
  prev: string | null;
  next: string | null;
  last: string;
} {
  const searchParams = new URLSearchParams();

  // 按照字母顺序添加查询参数以确保一致性
  const sortedKeys = Object.keys(queryParams).sort();
  for (const key of sortedKeys) {
    if (key !== "page") {
      // 排除page参数，我们会单独设置
      searchParams.set(key, queryParams[key]);
    }
  }

  const buildUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());

    // 按照固定顺序构建查询字符串：page, sort, filter, others
    const orderedParams: string[] = [];

    // 首先添加page参数
    orderedParams.push(`page=${page.toString()}`);

    // 然后按照特定顺序添加其他参数
    const paramOrder = ["sort", "filter"];
    for (const param of paramOrder) {
      if (queryParams[param]) {
        orderedParams.push(
          `${param}=${encodeURIComponent(queryParams[param])}`,
        );
      }
    }

    // 最后添加其他参数
    for (const [key, value] of params.entries()) {
      if (key !== "page" && !paramOrder.includes(key)) {
        orderedParams.push(`${key}=${encodeURIComponent(value)}`);
      }
    }

    return `${baseUrl}?${orderedParams.join("&")}`;
  };

  return {
    first: buildUrl(1),
    prev: pagination.hasPrev ? buildUrl(pagination.page - 1) : null,
    next: pagination.hasNext ? buildUrl(pagination.page + 1) : null,
    last: buildUrl(pagination.totalPages),
  };
}

/**
 * 计算分页统计信息
 */
export function calculatePaginationStats(
  currentPage: number,
  pageSize: number,
  totalItems: number,
): {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  itemsFrom: number;
  itemsTo: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
} {
  const totalPages = Math.ceil(totalItems / pageSize);
  const itemsFrom = (currentPage - 1) * pageSize + 1;
  const itemsTo = Math.min(currentPage * pageSize, totalItems);

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    itemsFrom,
    itemsTo,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}
