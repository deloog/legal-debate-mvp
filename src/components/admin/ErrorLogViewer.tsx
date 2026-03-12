'use client';

import _React, { useState } from 'react';
import type { ErrorLogItem } from '@/types/log';

/**
 * 错误日志查看器属性
 */
interface ErrorLogViewerProps {
  logs: ErrorLogItem[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
}

/**
 * 错误日志查看器组件
 */
export function ErrorLogViewer({
  logs,
  loading,
  total,
  page,
  totalPages,
  onRefresh,
  onPageChange,
}: ErrorLogViewerProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'LOW':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'MEDIUM':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'HIGH':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityText = (severity: string): string => {
    switch (severity) {
      case 'LOW':
        return '低';
      case 'MEDIUM':
        return '中';
      case 'HIGH':
        return '高';
      case 'CRITICAL':
        return '严重';
      default:
        return severity;
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-gray-500'>加载中...</div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className='flex flex-col items-center justify-center py-12'>
        <div className='text-gray-500 text-lg mb-4'>暂无错误日志</div>
        <button
          onClick={onRefresh}
          className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'
        >
          刷新
        </button>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <div className='text-sm text-gray-600'>共 {total} 条错误日志</div>
        <button
          onClick={onRefresh}
          className='px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded'
        >
          刷新
        </button>
      </div>

      <div className='space-y-3'>
        {logs.map(log => {
          return (
            <div
              key={log.id}
              className='border border-gray-200 rounded-lg overflow-hidden'
            >
              <div
                className='p-4 cursor-pointer hover:bg-gray-50 transition-colors'
                onClick={() => toggleExpand(log.id)}
              >
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-2'>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded border ${getSeverityColor(
                          log.severity
                        )}`}
                      >
                        {getSeverityText(log.severity)}
                      </span>
                      <span className='text-sm text-gray-500'>
                        {log.errorType}
                      </span>
                      {log.userId && (
                        <span className='text-xs text-gray-400'>
                          用户: {log.userId.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className='text-sm text-gray-900 font-medium truncate'>
                      {log.errorCode}: {log.errorMessage}
                    </div>
                    <div className='text-xs text-gray-500 mt-1'>
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                  <div className='text-gray-400'>
                    {expandedLogId === log.id ? '▲' : '▼'}
                  </div>
                </div>
              </div>

              {expandedLogId === log.id && (
                <div className='px-4 pb-4 border-t border-gray-100 bg-gray-50'>
                  <div className='space-y-3 pt-3'>
                    {log.stackTrace && (
                      <div>
                        <div className='text-xs font-medium text-gray-700 mb-1'>
                          堆栈跟踪：
                        </div>
                        <pre className='text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto bg-white p-2 rounded border border-gray-200'>
                          {log.stackTrace}
                        </pre>
                      </div>
                    )}
                    {!!log.context && Object.keys(log.context as Record<string, unknown>).length > 0 && (
                      <div>
                        <div className='text-xs font-medium text-gray-700 mb-1'>
                          上下文信息：
                        </div>
                        <pre className='text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto bg-white p-2 rounded border border-gray-200'>
                          {JSON.stringify(log.context, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className='grid grid-cols-2 gap-2 text-xs'>
                      <div>
                        <span className='text-gray-500'>恢复尝试：</span>
                        <span className='text-gray-900 ml-1'>
                          {log.recoveryAttempts}
                        </span>
                      </div>
                      <div>
                        <span className='text-gray-500'>已恢复：</span>
                        <span
                          className={`ml-1 ${
                            log.recovered ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {log.recovered ? '是' : '否'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className='flex items-center justify-center gap-2 pt-4'>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className='px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            上一页
          </button>
          <span className='text-sm text-gray-600'>
            第 {page} / {totalPages} 页
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className='px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
