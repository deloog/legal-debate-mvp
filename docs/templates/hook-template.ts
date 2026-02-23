/**
 * 自定义Hook模板
 * 位置: src/lib/hooks/useHookName.ts
 *
 * 使用说明:
 * 1. 复制此模板到目标位置
 * 2. 修改Hook名称和业务逻辑
 * 3. 使用命名导出
 */

import { useState, useCallback, useEffect } from 'react';

// ============ 类型定义 ============

interface UseHookOptions {
  /** 初始值 */
  initialValue?: string;
  /** 自动加载 */
  autoFetch?: boolean;
}

interface UseHookReturn {
  /** 当前值 */
  value: string;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 更新值 */
  setValue: (value: string) => void;
  /** 异步操作 */
  fetchValue: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

// ============ Hook实现 ============

/**
 * 功能名称Hook
 *
 * @example
 * ```tsx
 * const { value, loading, error, setValue, fetchValue } = useHookName({
 *   initialValue: 'test',
 *   autoFetch: true,
 * });
 * ```
 */
export function useHookName(options: UseHookOptions = {}): UseHookReturn {
  const { initialValue = '', autoFetch = false } = options;

  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // 异步获取数据
  const fetchValue = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // TODO: 实现异步逻辑
      // const response = await fetch('/api/data');
      // const result = await response.json();
      // setValue(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, []);

  // 自动获取
  useEffect(() => {
    if (autoFetch) {
      fetchValue();
    }
  }, [autoFetch, fetchValue]);

  // 重置状态
  const reset = useCallback(() => {
    setValue(initialValue);
    setError(null);
  }, [initialValue]);

  return {
    value,
    loading,
    error,
    setValue,
    fetchValue,
    reset,
  };
}

// ============ 辅助Hook（可选）============

/**
 * 复合Hook示例
 * 如果需要多个相关Hook，可以组合在一起
 */
export function useComplexFeature() {
  const mainHook = useHookName({ autoFetch: true });
  const secondaryHook = useHookName();

  return {
    ...mainHook,
    secondaryValue: secondaryHook.value,
  };
}
