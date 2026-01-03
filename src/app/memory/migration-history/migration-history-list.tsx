"use client";

import { useEffect, useState, useCallback } from "react";

export interface MigrationHistoryItem {
  id: string;
  actionType: string;
  actionName: string;
  status: string;
  executionTime: number;
  createdAt: string;
  memoryId: string;
  memoryKey: string;
  originalType: string;
  targetType: string;
  importance: number;
  accessCount: number;
  compressionRatio?: number;
  error?: string;
  memoryType: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MigrationHistoryResponse {
  success: boolean;
  data: {
    items: MigrationHistoryItem[];
    pagination: Pagination;
  };
  error?: string;
}

export interface MigrationHistoryListProps {
  page?: number;
  limit?: number;
  actionType?: string;
  status?: string;
  onPageChange?: (page: number) => void;
}

export function MigrationHistoryList({
  page = 1,
  limit = 20,
  actionType = "all",
  status = "all",
  onPageChange,
}: MigrationHistoryListProps) {
  const [items, setItems] = useState<MigrationHistoryItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (actionType && actionType !== "all") {
        params.set("actionType", actionType);
      }

      if (status && status !== "all") {
        params.set("status", status);
      }

      const response = await fetch(
        `/api/v1/memory/migration-history?${params}`,
      );

      if (!response.ok) {
        throw new Error("获取迁移历史失败");
      }

      const data: MigrationHistoryResponse = await response.json();

      if (data.success) {
        setItems(data.data.items);
        setPagination(data.data.pagination);
      } else {
        throw new Error(data.error || "未知错误");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, [page, limit, actionType, status]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("zh-CN");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "FAILED":
        return "bg-red-100 text-red-800";
      case "RUNNING":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getActionTypeBadge = (actionType: string) => {
    if (actionType === "MIGRATE_WORKING_TO_HOT") {
      return (
        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
          Working→Hot
        </span>
      );
    }
    if (actionType === "MIGRATE_HOT_TO_COLD") {
      return (
        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
          Hot→Cold
        </span>
      );
    }
    return <span className="text-xs">{actionType}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">暂无迁移历史记录</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                迁移类型
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                状态
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                记忆ID
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                重要性
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                访问次数
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                执行时间(ms)
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                时间
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">
                  {getActionTypeBadge(item.actionType)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 rounded text-xs ${getStatusColor(item.status)}`}
                  >
                    {item.status === "COMPLETED" ? "成功" : "失败"}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {item.memoryKey}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {(item.importance * 100).toFixed(0)}%
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {item.accessCount}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {item.executionTime}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(item.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-700">
            共 {pagination.total} 条记录，第 {pagination.page} /{" "}
            {pagination.totalPages} 页
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => onPageChange?.(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              上一页
            </button>
            <button
              onClick={() => onPageChange?.(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
