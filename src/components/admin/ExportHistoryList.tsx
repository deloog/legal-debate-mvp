'use client';

import { Clock, Download, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

// =============================================================================
// 类型定义
// =============================================================================

interface ExportHistoryItem {
  id: string;
  fileName: string;
  format: string;
  recordCount: number;
  filters: {
    tier?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  };
  exportedAt: Date;
  fileUrl?: string;
}

interface ExportHistoryListProps {
  history: ExportHistoryItem[];
  loading?: boolean;
}

// =============================================================================
// 辅助函数
// =============================================================================

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getFilterSummary(filters: ExportHistoryItem['filters']): string {
  const parts: string[] = [];
  if (filters.tier) {
    parts.push(`等级:${filters.tier}`);
  }
  if (filters.status) {
    parts.push(`状态:${filters.status}`);
  }
  if (filters.startDate || filters.endDate) {
    const dateRange =
      filters.startDate && filters.endDate
        ? `${filters.startDate} ~ ${filters.endDate}`
        : filters.startDate || filters.endDate;
    parts.push(`时间:${dateRange}`);
  }
  return parts.length > 0 ? parts.join('，') : '全部数据';
}

// =============================================================================
// 主组件
// =============================================================================

export function ExportHistoryList({
  history,
  loading = false,
}: ExportHistoryListProps): React.ReactElement {
  if (loading) {
    return (
      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-xl font-semibold text-gray-900 mb-6'>导出历史</h2>
        <div className='flex items-center justify-center h-40'>
          <div className='text-gray-600'>加载中...</div>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-xl font-semibold text-gray-900 mb-6'>导出历史</h2>
        <div className='flex items-center justify-center h-40'>
          <div className='text-gray-600'>暂无导出历史</div>
        </div>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-lg shadow p-6'>
      <h2 className='text-xl font-semibold text-gray-900 mb-6'>导出历史</h2>

      <div className='space-y-4'>
        {history.map(item => (
          <div
            key={item.id}
            className='flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors'
          >
            <div className='flex items-start gap-4 flex-1'>
              {/* 文件图标 */}
              <div className='flex-shrink-0'>
                <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100'>
                  <FileText className='h-5 w-5 text-blue-600' />
                </div>
              </div>

              {/* 文件信息 */}
              <div className='flex-1 min-w-0'>
                <h3 className='text-sm font-medium text-gray-900 truncate'>
                  {item.fileName}
                </h3>
                <div className='mt-1 flex items-center gap-3 text-xs text-gray-500'>
                  <span className='flex items-center gap-1'>
                    <Clock className='h-3 w-3' />
                    {formatDate(item.exportedAt)}
                  </span>
                  <span>•</span>
                  <span>{item.recordCount} 条记录</span>
                  <span>•</span>
                  <span>{item.format.toUpperCase()}</span>
                </div>
                <p className='mt-1 text-xs text-gray-500'>
                  筛选: {getFilterSummary(item.filters)}
                </p>
              </div>
            </div>

            {/* 下载按钮 */}
            {item.fileUrl && (
              <Button
                variant='outline'
                size='sm'
                onClick={() => window.open(item.fileUrl, '_blank')}
              >
                <Download className='h-4 w-4 mr-2' />
                下载
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
