/**
 * 导出按钮组件
 * 提供统一的数据导出功能
 */

'use client';

import { Download, FileSpreadsheet } from 'lucide-react';
import { useState } from 'react';
import { ExportFormat, TimeRange } from '@/types/stats';

// =============================================================================
// 类型定义
// =============================================================================

interface ExportButtonProps {
  /** 导出类型 */
  exportType: 'cases' | string;
  /** 导出格式 */
  format?: ExportFormat;
  /** 时间范围 */
  timeRange?: TimeRange;
  /** 按钮文字 */
  label?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 额外的查询参数 */
  queryParams?: Record<string, string>;
  /** 导出开始回调 */
  onExportStart?: () => void;
  /** 导出完成回调 */
  onExportComplete?: (success: boolean) => void;
}

// =============================================================================
// 组件
// =============================================================================

/**
 * 导出按钮组件
 */
export function ExportButton({
  exportType,
  format = ExportFormat.EXCEL,
  timeRange = TimeRange.LAST_30_DAYS,
  label,
  disabled = false,
  className = '',
  queryParams = {},
  onExportStart,
  onExportComplete,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 处理导出操作
   */
  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    setError(null);
    onExportStart?.();

    try {
      const baseUrl = `/api/admin/export/${exportType}`;
      const searchParams = new URLSearchParams({
        format,
        timeRange,
        ...queryParams,
      });

      const url = `${baseUrl}?${searchParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '导出失败');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${exportType}_${new Date().toISOString()}.csv`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match?.[1]) {
          filename = match[1];
        }
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      onExportComplete?.(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '导出失败，请重试';
      setError(errorMessage);
      onExportComplete?.(false);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleExport}
        disabled={disabled || isExporting}
        className='inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors'
      >
        {isExporting ? (
          <>
            <FileSpreadsheet className='w-4 h-4 animate-pulse' />
            <span>导出中...</span>
          </>
        ) : (
          <>
            <Download className='w-4 h-4' />
            <span>{label || '导出'}</span>
          </>
        )}
      </button>
      {error && <p className='mt-2 text-sm text-red-600'>{error}</p>}
    </div>
  );
}

// =============================================================================
// 默认导出
// =============================================================================

export default ExportButton;
