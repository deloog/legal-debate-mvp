/**
 * 版本对比模块（Version Compare）
 * 包含：compare_versions
 */

import type { CompareVersionsResult } from './types';

/**
 * 17. compare_versions - 版本对比
 * 对比两个版本的差异
 */
export async function compare_versions<
  T extends Record<string, unknown>,
>(params: {
  versionA: T;
  versionB: T;
  compareFields?: (keyof T)[];
}): Promise<CompareVersionsResult<T>> {
  const { versionA, versionB, compareFields } = params;

  // 合并两个版本的所有字段
  const allFields = new Set([
    ...Object.keys(versionA),
    ...Object.keys(versionB),
  ]) as Set<keyof T>;
  const finalFields = compareFields || Array.from(allFields);
  const differences: Array<{
    field: keyof T;
    valueA: unknown;
    valueB: unknown;
    changeType: 'added' | 'removed' | 'modified';
  }> = [];

  for (const field of finalFields) {
    const valA = versionA[field];
    const valB = versionB[field];

    if (valA === undefined && valB !== undefined) {
      differences.push({
        field,
        valueA: valA,
        valueB: valB,
        changeType: 'added',
      });
    } else if (valA !== undefined && valB === undefined) {
      differences.push({
        field,
        valueA: valA,
        valueB: valB,
        changeType: 'removed',
      });
    } else if (valA !== valB) {
      differences.push({
        field,
        valueA: valA,
        valueB: valB,
        changeType: 'modified',
      });
    }
  }

  return {
    hasDifferences: differences.length > 0,
    differences,
    versionA,
    versionB,
  };
}
