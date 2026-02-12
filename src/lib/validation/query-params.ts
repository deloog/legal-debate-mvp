/**
 * 查询参数验证工具
 * 防止SQL注入和恶意参数
 */

/**
 * 验证排序字段白名单
 */
export function validateSortBy(
  sortBy: string | null | undefined,
  allowedFields: string[],
  defaultField: string = 'createdAt'
): string {
  if (!sortBy) return defaultField;

  // 白名单验证
  if (!allowedFields.includes(sortBy)) {
    console.warn(
      `[Security] Invalid sortBy field: ${sortBy}, using default: ${defaultField}`
    );
    return defaultField;
  }

  // 防止SQL注入：只允许字母、数字和下划线
  if (!/^[a-zA-Z0-9_]+$/.test(sortBy)) {
    console.warn(`[Security] Potentially malicious sortBy field: ${sortBy}`);
    return defaultField;
  }

  return sortBy;
}

/**
 * 验证排序方向
 */
export function validateSortOrder(
  sortOrder: string | null | undefined,
  defaultOrder: 'asc' | 'desc' = 'desc'
): 'asc' | 'desc' {
  if (!sortOrder) return defaultOrder;

  const normalized = sortOrder.toLowerCase();
  if (normalized !== 'asc' && normalized !== 'desc') {
    console.warn(`[Security] Invalid sortOrder: ${sortOrder}`);
    return defaultOrder;
  }

  return normalized as 'asc' | 'desc';
}

/**
 * 验证分页参数
 */
export function validatePagination(params: {
  page?: string | null;
  limit?: string | null;
  pageSize?: string | null;
}): {
  page: number;
  limit: number;
} {
  const { page, limit, pageSize } = params;

  // 解析page
  let parsedPage = parseInt(page || '1', 10);
  if (isNaN(parsedPage) || parsedPage < 1) {
    console.warn(`[Security] Invalid page number: ${page}`);
    parsedPage = 1;
  }
  if (parsedPage > 10000) {
    console.warn(`[Security] Page number too large: ${parsedPage}`);
    parsedPage = 10000; // 最大页数限制
  }

  // 解析limit（支持pageSize别名）
  const limitValue = limit || pageSize || '20';
  let parsedLimit = parseInt(limitValue, 10);
  if (isNaN(parsedLimit) || parsedLimit < 1) {
    console.warn(`[Security] Invalid limit: ${limitValue}`);
    parsedLimit = 20;
  }
  if (parsedLimit > 100) {
    console.warn(`[Security] Limit too large: ${parsedLimit}`);
    parsedLimit = 100; // 最大每页数量
  }

  return {
    page: parsedPage,
    limit: parsedLimit,
  };
}

/**
 * 验证枚举值
 */
export function validateEnum<T extends string>(
  value: string | null | undefined,
  allowedValues: readonly T[],
  defaultValue?: T
): T | undefined {
  if (!value) return defaultValue;

  if (!allowedValues.includes(value as T)) {
    console.warn(
      `[Security] Invalid enum value: ${value}, allowed: ${allowedValues.join(', ')}`
    );
    return defaultValue;
  }

  return value as T;
}

/**
 * 验证字符串长度
 */
export function validateStringLength(
  value: string | null | undefined,
  options: {
    minLength?: number;
    maxLength?: number;
    fieldName?: string;
  } = {}
): string | undefined {
  if (!value) return undefined;

  const { minLength = 0, maxLength = 1000, fieldName = 'field' } = options;

  if (value.length < minLength) {
    console.warn(
      `[Security] ${fieldName} too short: ${value.length} < ${minLength}`
    );
    return undefined;
  }

  if (value.length > maxLength) {
    console.warn(
      `[Security] ${fieldName} too long: ${value.length} > ${maxLength}`
    );
    return value.substring(0, maxLength); // 截断
  }

  return value;
}

/**
 * 验证日期字符串
 */
export function validateDateString(
  value: string | null | undefined,
  fieldName: string = 'date'
): Date | undefined {
  if (!value) return undefined;

  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      console.warn(`[Security] Invalid ${fieldName}: ${value}`);
      return undefined;
    }

    // 验证日期范围（1900-2100）
    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      console.warn(`[Security] ${fieldName} out of range: ${year}`);
      return undefined;
    }

    return date;
  } catch (error) {
    console.warn(`[Security] Failed to parse ${fieldName}: ${value}`);
    return undefined;
  }
}

/**
 * 验证UUID格式
 */
export function validateUUID(
  value: string | null | undefined,
  fieldName: string = 'id'
): string | undefined {
  if (!value) return undefined;

  // UUID v4格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // 或者 cuid 格式
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cuidRegex = /^c[0-9a-z]{24}$/i;

  if (!uuidRegex.test(value) && !cuidRegex.test(value)) {
    console.warn(`[Security] Invalid ${fieldName} format: ${value}`);
    return undefined;
  }

  return value;
}

/**
 * 清理搜索关键词（防止SQL注入）
 */
export function sanitizeSearchKeyword(
  keyword: string | null | undefined,
  maxLength: number = 200
): string | undefined {
  if (!keyword) return undefined;

  // 移除特殊字符，只保留字母、数字、空格、中文
  let sanitized = keyword.replace(/[^\w\s\u4e00-\u9fa5]/g, '');

  // 移除多余空格
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  // 长度限制
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  if (sanitized.length === 0) return undefined;

  return sanitized;
}

/**
 * 批量验证查询参数
 */
export interface QueryValidationResult {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
  [key: string]: unknown;
}

export function validateQueryParams(
  searchParams: URLSearchParams,
  options: {
    allowedSortFields: string[];
    defaultSortBy?: string;
    defaultSortOrder?: 'asc' | 'desc';
    maxLimit?: number;
  }
): QueryValidationResult {
  const {
    allowedSortFields,
    defaultSortBy = 'createdAt',
    defaultSortOrder = 'desc',
    maxLimit = 100,
  } = options;

  // 验证分页
  const pagination = validatePagination({
    page: searchParams.get('page'),
    limit: searchParams.get('limit') || searchParams.get('pageSize'),
  });

  // 验证排序
  const sortBy = validateSortBy(
    searchParams.get('sortBy'),
    allowedSortFields,
    defaultSortBy
  );
  const sortOrder = validateSortOrder(
    searchParams.get('sortOrder'),
    defaultSortOrder
  );

  // 验证搜索关键词
  const search = sanitizeSearchKeyword(
    searchParams.get('search') || searchParams.get('keyword')
  );

  return {
    page: pagination.page,
    limit: Math.min(pagination.limit, maxLimit),
    sortBy,
    sortOrder,
    search,
  };
}
