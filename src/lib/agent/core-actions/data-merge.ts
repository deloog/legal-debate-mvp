/**
 * 数据合并模块（Data Merge）
 * 包含：merge_results
 */

import type { MergeResultsResult } from "./types";

/**
 * 13. merge_results - 结果合并
 * 合并多个结果集，支持去重
 */
export async function merge_results<T>(
  params:
    | T[][]
    | {
        results: T[][];
        deduplicate?: boolean;
        keySelector?: (item: T) => string;
      },
  deduplicate = false,
  keySelector?: (item: T) => string,
): Promise<MergeResultsResult<T>> {
  let resultsArr: T[][];
  let dedup = deduplicate;
  let keySel = keySelector;

  if (Array.isArray(params)) {
    resultsArr = params;
  } else {
    resultsArr = params.results;
    dedup = params.deduplicate !== undefined ? params.deduplicate : deduplicate;
    keySel = params.keySelector;
  }

  const flattened = resultsArr.flat();
  let merged = flattened;

  if (dedup && keySel) {
    const seen = new Set<string>();
    merged = merged.filter((item) => {
      const key = keySel!(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  return {
    merged,
    totalItems: flattened.length,
    duplicatesRemoved: flattened.length - merged.length,
  };
}
