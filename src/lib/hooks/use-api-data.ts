/**
 * 通用 API 数据处理 Hook
 *
 * 提供统一的 API 调用逻辑，自动处理：
 * - 响应状态检查
 * - 数据格式验证
 * - 错误处理
 * - 加载状态
 *
 * 使用方式：
 * const { data, loading, error, execute } = useApiData<MyType>('/api/items');
 * await execute();
 */

import { useState, useCallback } from 'react';

export interface ApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export interface UseApiOptions {
  /** 初始数据 */
  initialData?: unknown;
  /** 是否立即执行 */
  immediate?: boolean;
  /** 成功回调 */
  onSuccess?: (data: unknown) => void;
  /** 失败回调 */
  onError?: (error: Error) => void;
}

export interface UseApiReturn<T> {
  /** 数据 */
  data: T | null;
  /** 加载状态 */
  loading: boolean;
  /** 错误信息 */
  error: Error | null;
  /** 执行 API 调用 */
  execute: (options?: FetchOptions) => Promise<T | null>;
  /** 重置状态 */
  reset: () => void;
  /** 设置数据 */
  setData: (data: T | null) => void;
}

interface FetchOptions {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * 安全获取嵌套属性
 */
function getNestedValue(obj: unknown, path: string): unknown {
  return path.split('.').reduce((current: unknown, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * 创建通用的 API 数据处理 Hook
 */
export function createUseApiData<T = unknown>(
  defaultUrl: string = '',
  options: UseApiOptions = {}
): () => UseApiReturn<T> {
  return function useApiData(): UseApiReturn<T> {
    const [data, setData] = useState<T | null>(options.initialData as T | null);
    const [loading, setLoading] = useState(options.immediate ?? false);
    const [error, setError] = useState<Error | null>(null);

    const execute = useCallback(
      async (fetchOptions: FetchOptions = {}): Promise<T | null> => {
        const url = fetchOptions.url || defaultUrl;
        if (!url) {
          const err = new Error('URL is required');
          setError(err);
          options.onError?.(err);
          return null;
        }

        setLoading(true);
        setError(null);

        try {
          const response = await fetch(url, {
            method: fetchOptions.method || 'GET',
            headers: {
              'Content-Type': 'application/json',
              ...fetchOptions.headers,
            },
            body: fetchOptions.body
              ? JSON.stringify(fetchOptions.body)
              : undefined,
          });

          // 检查响应状态
          if (!response.ok) {
            let errorMessage = `请求失败: ${response.status}`;
            try {
              const errorData = await response.json();
              errorMessage =
                errorData.error?.message ||
                errorData.message ||
                errorData.error ||
                errorMessage;
            } catch {
              // 忽略 JSON 解析错误
            }
            const err = new Error(errorMessage);
            setError(err);
            options.onError?.(err);
            return null;
          }

          const responseData = await response.json();

          // 检查业务成功状态
          if (responseData.success === false) {
            const err = new Error(
              responseData.error?.message || '业务处理失败'
            );
            setError(err);
            options.onError?.(err);
            return null;
          }

          // 根据 responseData 结构获取数据
          let result: T;
          if (responseData.data !== undefined) {
            result = responseData.data as T;
          } else if (Array.isArray(responseData)) {
            result = responseData as T;
          } else {
            result = responseData as T;
          }

          // 验证数组类型
          if (typeof result === 'object' && result !== null) {
            const resultObj = result as Record<string, unknown>;
            // 检查常见的数组字段
            for (const key of ['items', 'list', 'results', 'data']) {
              if (Array.isArray(resultObj[key])) {
                resultObj[key] = resultObj[key] as unknown[];
              }
            }
          }

          setData(result);
          options.onSuccess?.(result);
          return result;
        } catch (err) {
          const error = err instanceof Error ? err : new Error('未知错误');
          setError(error);
          options.onError?.(error);
          return null;
        } finally {
          setLoading(false);
        }
      },
      []
    );

    const reset = useCallback(() => {
      setData(options.initialData as T | null);
      setError(null);
      setLoading(false);
    }, []);

    const handleSetData = useCallback((newData: T | null) => {
      setData(newData);
    }, []);

    return {
      data,
      loading,
      error,
      execute,
      reset,
      setData: handleSetData,
    };
  };
}

/**
 * 预定义的常用 Hook
 */

// 获取列表数据
export const useListData = createUseApiData<{
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
}>();

// 获取单个详情
export const useDetailData = createUseApiData<unknown>();

// 获取简单数据
export const useSimpleData = createUseApiData<unknown>();

/**
 * 便捷函数：快速创建数据 Hook
 */
export function createListHook<T>(url: string) {
  return createUseApiData<T>(url);
}

/**
 * 安全提取 API 响应数据
 *
 * @param response API 响应对象
 * @param dataPath 数据路径，如 'data.items' 或 'data'
 * @param fallback 降级值
 */
export function safeExtractData<T>(
  response: unknown,
  dataPath: string = 'data',
  fallback: T
): T {
  if (!response || typeof response !== 'object') {
    return fallback;
  }

  const value = getNestedValue(response, dataPath);

  if (value === undefined || value === null) {
    return fallback;
  }

  // 如果期望是数组但不是数组
  if (Array.isArray(fallback) && !Array.isArray(value)) {
    return fallback;
  }

  return value as T;
}
