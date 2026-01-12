'use client';

import { useState, useEffect, useCallback } from 'react';
import { CaseWithMetadata } from '@/types/case';

/**
 * 案件筛选参数接口
 */
export interface CaseFilters {
  types?: string[];
  statuses?: string[];
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

/**
 * 分页状态接口
 */
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 案件数据Hook
 * 功能：获取案件列表，支持筛选、搜索和分页
 */
export function useCases(filters: CaseFilters, searchQuery: string) {
  const [cases, setCases] = useState<CaseWithMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  /**
   * 获取案件列表
   */
  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 构建查询参数
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.pageSize.toString(),
      });

      // 添加搜索关键词
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      // 添加案件类型筛选
      if (filters.types && filters.types.length > 0) {
        params.append('types', filters.types.join(','));
      }

      // 添加案件状态筛选
      if (filters.statuses && filters.statuses.length > 0) {
        params.append('statuses', filters.statuses.join(','));
      }

      // 添加日期范围筛选
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo.toISOString());
      }

      // 调用API
      const response = await fetch(`/api/v1/cases?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setCases(data.data);
        // 安全检查pagination对象是否存在
        if (data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: data.pagination.total ?? prev.total,
            totalPages: data.pagination.totalPages ?? prev.totalPages,
          }));
        }
      } else {
        throw new Error(data.error || '获取案件列表失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('未知错误'));
      console.error('获取案件列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [filters, searchQuery, pagination.page, pagination.pageSize]);

  /**
   * 切换页码
   */
  const goToPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

  /**
   * 刷新列表
   */
  const refetch = useCallback(() => {
    fetchCases();
  }, [fetchCases]);

  /**
   * 监听筛选和搜索变化，重新获取数据
   */
  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return {
    cases,
    loading,
    error,
    pagination,
    goToPage,
    refetch,
  };
}
