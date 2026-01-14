/**
 * 导出控制面板组件
 * 提供导出参数配置和操作界面
 */

'use client';

import { Calendar, FileText, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { ExportButton } from './export-button';
import { ExportFormat, TimeRange } from '@/types/stats';

// =============================================================================
// 类型定义
// =============================================================================

interface ExportPanelProps {
  /** 导出类型 */
  exportType: 'cases' | string;
  /** 是否显示时间范围选择 */
  showTimeRange?: boolean;
  /** 是否显示格式选择 */
  showFormat?: boolean;
  /** 额外的查询参数 */
  queryParams?: Record<string, string>;
  /** 面板标题 */
  title?: string;
  /** 面板描述 */
  description?: string;
}

// =============================================================================
// 常量定义
// =============================================================================

const TIME_RANGE_OPTIONS = [
  { value: TimeRange.TODAY, label: '今天' },
  { value: TimeRange.YESTERDAY, label: '昨天' },
  { value: TimeRange.LAST_7_DAYS, label: '最近7天' },
  { value: TimeRange.LAST_30_DAYS, label: '最近30天' },
  { value: TimeRange.LAST_90_DAYS, label: '最近90天' },
  { value: TimeRange.THIS_WEEK, label: '本周' },
  { value: TimeRange.LAST_WEEK, label: '上周' },
  { value: TimeRange.THIS_MONTH, label: '本月' },
  { value: TimeRange.LAST_MONTH, label: '上月' },
  { value: TimeRange.THIS_YEAR, label: '今年' },
];

const FORMAT_OPTIONS = [
  { value: ExportFormat.EXCEL, label: 'Excel (CSV)' },
  { value: ExportFormat.CSV, label: 'CSV' },
  { value: ExportFormat.JSON, label: 'JSON' },
  { value: ExportFormat.PDF, label: 'PDF' },
];

// =============================================================================
// 组件
// =============================================================================

/**
 * 导出控制面板组件
 */
export function ExportPanel({
  exportType,
  showTimeRange = true,
  showFormat = true,
  queryParams = {},
  title,
  description,
}: ExportPanelProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.LAST_30_DAYS);
  const [format, setFormat] = useState<ExportFormat>(ExportFormat.EXCEL);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportStart = (): void => {
    setIsExporting(true);
  };

  const handleExportComplete = (success: boolean): void => {
    setIsExporting(false);
    if (!success) {
      console.error('导出失败');
    }
  };

  return (
    <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
      {(title || description) && (
        <div className='mb-6'>
          <div className='flex items-center gap-2 mb-2'>
            {exportType === 'cases' && (
              <FileText className='w-5 h-5 text-blue-600' />
            )}
            {exportType.startsWith('DEBATE') && (
              <TrendingUp className='w-5 h-5 text-blue-600' />
            )}
            {exportType.startsWith('CASE') && (
              <FileText className='w-5 h-5 text-blue-600' />
            )}
            {exportType.startsWith('PERFORMANCE') && (
              <TrendingUp className='w-5 h-5 text-blue-600' />
            )}
            <h3 className='text-lg font-semibold text-gray-900'>
              {title || '数据导出'}
            </h3>
          </div>
          {description && (
            <p className='text-sm text-gray-600'>{description}</p>
          )}
        </div>
      )}

      {showTimeRange && (
        <div className='mb-6'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            <Calendar className='inline w-4 h-4 mr-1' />
            时间范围
          </label>
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value as TimeRange)}
            disabled={isExporting}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed'
          >
            {TIME_RANGE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {showFormat && (
        <div className='mb-6'>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            文件格式
          </label>
          <select
            value={format}
            onChange={e => setFormat(e.target.value as ExportFormat)}
            disabled={isExporting}
            className='w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed'
          >
            {FORMAT_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <ExportButton
        exportType={exportType}
        format={format}
        timeRange={timeRange}
        queryParams={queryParams}
        onExportStart={handleExportStart}
        onExportComplete={handleExportComplete}
      />

      <div className='mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md'>
        <p className='text-xs text-blue-700'>
          提示：导出功能需要管理员权限。导出的数据将包含选定时间范围内的所有记录。
          如果数据量较大，导出可能需要一些时间。
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// 默认导出
// =============================================================================

export default ExportPanel;
