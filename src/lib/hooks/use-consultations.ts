/**
 * useConsultations Hook
 * 获取咨询列表，支持筛选、搜索和分页
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConsultationType, ConsultStatus } from '@/types/consultation';

/**
 * 咨询筛选参数接口
 */
export interface ConsultationFilters {
  status?: ConsultStatus;
  consultType?: ConsultationType;
  dateFrom?: Date | null;
  dateTo?: Date | null;
}

/**
 * 咨询数据接口
 */
export interface ConsultationData {
  id: string;
  consultNumber: string;
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  consultType: ConsultationType;
  consultTime: string;
  caseType: string | null;
  status: ConsultStatus;
  followUpDate: string | null;
  winRate: number | null;
  difficulty: string | null;
  riskLevel: string | null;
  suggestedFee: number | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
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
 * useConsultations Hook返回值
 */
interface UseConsultationsReturn {
  consultations: ConsultationData[];
  loading: boolean;
  error: Error | null;
  pagination: PaginationState;
  goToPage: (page: number) => void;
  refetch: () => void;
}

/**
 * 咨询数据Hook
 * 功能：获取咨询列表，支持筛选、搜索和分页
 */
export function useConsultations(
  filters: ConsultationFilters,
  searchQuery: string
): UseConsultationsReturn {
  const [consultations, setConsultations] = useState<ConsultationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  /**
   * 获取咨询列表
   */
  const fetchConsultations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 构建查询参数
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
      });

      // 添加搜索关键词
      if (searchQuery) {
        params.append('keyword', searchQuery);
      }

      // 添加咨询状态筛选
      if (filters.status) {
        params.append('status', filters.status);
      }

      // 添加咨询类型筛选
      if (filters.consultType) {
        params.append('consultType', filters.consultType);
      }

      // 添加日期范围筛选
      if (filters.dateFrom) {
        params.append('startDate', filters.dateFrom.toISOString());
      }
      if (filters.dateTo) {
        params.append('endDate', filters.dateTo.toISOString());
      }

      // 调用API
      const response = await fetch(`/api/consultations?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setConsultations(data.data);
        // 安全检查pagination对象是否存在
        if (data.pagination) {
          setPagination(prev => ({
            ...prev,
            total: data.pagination.total ?? prev.total,
            totalPages: data.pagination.totalPages ?? prev.totalPages,
          }));
        }
      } else {
        throw new Error(data.error?.message || '获取咨询列表失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('未知错误'));
      console.error('获取咨询列表失败:', err);
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
    fetchConsultations();
  }, [fetchConsultations]);

  /**
   * 监听筛选和搜索变化，重新获取数据
   */
  useEffect(() => {
    fetchConsultations();
  }, [fetchConsultations]);

  return {
    consultations,
    loading,
    error,
    pagination,
    goToPage,
    refetch,
  };
}
