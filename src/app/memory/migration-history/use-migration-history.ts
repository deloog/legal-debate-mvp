'use client';

import { useState, useCallback } from 'react';
import type {
  MigrationHistoryItem,
  Pagination,
} from './migration-history-list';
import type { MigrationStatsResponse as StatsResponse } from './migration-stats';

export interface UseMigrationHistoryOptions {
  initialPage?: number;
  initialLimit?: number;
  autoFetch?: boolean;
}

export interface UseMigrationHistoryReturn {
  history: {
    items: MigrationHistoryItem[];
    pagination: Pagination;
    loading: boolean;
    error: string | null;
  };
  stats: {
    data: StatsResponse | null;
    loading: boolean;
    error: string | null;
  };
  page: number;
  limit: number;
  actionType: string;
  status: string;
  fetchHistory: () => Promise<void>;
  fetchStats: () => Promise<void>;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setActionType: (type: string) => void;
  setStatus: (status: string) => void;
}

export function useMigrationHistory(
  options: UseMigrationHistoryOptions = {}
): UseMigrationHistoryReturn {
  const { initialPage = 1, initialLimit = 20, autoFetch = true } = options;

  const [historyState, setHistoryState] = useState({
    items: [] as MigrationHistoryItem[],
    pagination: {
      page: initialPage,
      limit: initialLimit,
      total: 0,
      totalPages: 0,
    } as Pagination,
    loading: false,
    error: null as string | null,
  });

  const [statsState, setStatsState] = useState({
    data: null as StatsResponse | null,
    loading: false,
    error: null as string | null,
  });

  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [actionType, setActionType] = useState('all');
  const [status, setStatus] = useState('all');

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryState(prev => ({ ...prev, loading: true, error: null }));

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (actionType && actionType !== 'all') {
        params.set('actionType', actionType);
      }

      if (status && status !== 'all') {
        params.set('status', status);
      }

      const response = await fetch(
        `/api/v1/memory/migration-history?${params}`
      );

      if (!response.ok) {
        throw new Error('获取迁移历史失败');
      }

      const result = await response.json();

      if (result.success) {
        setHistoryState({
          items: result.data.items,
          pagination: result.data.pagination,
          loading: false,
          error: null,
        });
      } else {
        throw new Error(result.error || '未知错误');
      }
    } catch (err) {
      setHistoryState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : '未知错误',
      }));
    }
  }, [page, limit, actionType, status]);

  const fetchStats = useCallback(async () => {
    try {
      setStatsState(prev => ({ ...prev, loading: true, error: null }));

      const response = await fetch('/api/v1/memory/migration-stats');

      if (!response.ok) {
        throw new Error('获取迁移统计失败');
      }

      const result = await response.json();

      if (result.success) {
        setStatsState({
          data: result,
          loading: false,
          error: null,
        });
      } else {
        throw new Error('未知错误');
      }
    } catch (err) {
      setStatsState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : '未知错误',
      }));
    }
  }, []);

  // 自动获取数据
  useState(() => {
    if (autoFetch) {
      fetchHistory();
      fetchStats();
    }
  });

  return {
    history: historyState,
    stats: statsState,
    page,
    limit,
    actionType,
    status,
    fetchHistory,
    fetchStats,
    setPage,
    setLimit,
    setActionType,
    setStatus,
  };
}
