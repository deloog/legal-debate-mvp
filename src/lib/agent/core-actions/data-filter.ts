/**
 * 数据过滤模块（Data Filter）
 * 包含：filter_data
 */

import type { FilterDataResult } from './types';

/**
 * 14. filter_data - 数据过滤
 * 根据条件过滤数据，支持分页
 */
export async function filter_data<T>(
  data: T[],
  filterFn: (item: T) => boolean,
  options?: { maxResults?: number; offset?: number }
): Promise<FilterDataResult<T>> {
  const filtered = data.filter(filterFn);
  const { maxResults, offset = 0 } = options || {};

  const startIndex = Math.min(offset, filtered.length);
  const endIndex = maxResults ? startIndex + maxResults : filtered.length;
  const returned = filtered.slice(startIndex, endIndex);

  return {
    filtered: returned,
    totalMatched: filtered.length,
    returnedCount: returned.length,
  };
}
