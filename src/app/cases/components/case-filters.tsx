'use client';

import { Filter, X } from 'lucide-react';
import { CaseFilters as CaseFiltersType } from '@/lib/hooks/use-cases';

/**
 * 案件类型选项
 */
const CASE_TYPES = [
  { value: 'CIVIL', label: '民事' },
  { value: 'CRIMINAL', label: '刑事' },
  { value: 'ADMINISTRATIVE', label: '行政' },
  { value: 'COMMERCIAL', label: '商事' },
  { value: 'LABOR', label: '劳动' },
  { value: 'INTELLECTUAL_PROPERTY', label: '知识产权' },
] as const;

/**
 * 案件状态选项
 */
const CASE_STATUSES = [
  { value: 'ACTIVE', label: '进行中' },
  { value: 'PENDING', label: '待处理' },
  { value: 'CLOSED', label: '已结案' },
  { value: 'ARCHIVED', label: '已归档' },
] as const;

/**
 * 案件筛选器组件
 * 功能：按类型、状态、日期范围筛选案件
 */
interface CaseFiltersProps {
  filters: CaseFiltersType;
  onFiltersChange: (filters: CaseFiltersType) => void;
}

export function CaseFilters({ filters, onFiltersChange }: CaseFiltersProps) {
  /**
   * 切换案件类型
   */
  const toggleType = (type: string) => {
    const currentTypes = filters.types || [];
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter(t => t !== type)
      : [...currentTypes, type];
    onFiltersChange({ ...filters, types: newTypes });
  };

  /**
   * 切换案件状态
   */
  const toggleStatus = (status: string) => {
    const currentStatuses = filters.statuses || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter(s => s !== status)
      : [...currentStatuses, status];
    onFiltersChange({ ...filters, statuses: newStatuses });
  };

  /**
   * 更新日期范围
   */
  const updateDateRange = (
    field: 'dateFrom' | 'dateTo',
    value: Date | null
  ) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  /**
   * 清空所有筛选
   */
  const clearFilters = () => {
    onFiltersChange({
      types: [],
      statuses: [],
      dateFrom: null,
      dateTo: null,
    });
  };

  /**
   * 检查是否有激活的筛选
   */
  const hasActiveFilters =
    (filters.types && filters.types.length > 0) ||
    (filters.statuses && filters.statuses.length > 0) ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'>
      {/* 筛选器标题 */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Filter className='h-4 w-4 text-zinc-600 dark:text-zinc-400' />
          <h2 className='text-sm font-semibold text-zinc-900 dark:text-zinc-50'>
            筛选条件
          </h2>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className='flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
          >
            <X className='h-3 w-3' />
            清空
          </button>
        )}
      </div>

      {/* 案件类型 */}
      <div className='mt-4'>
        <h3 className='mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400'>
          案件类型
        </h3>
        <div className='space-y-1'>
          {CASE_TYPES.map(type => (
            <label
              key={type.value}
              className='flex cursor-pointer items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50'
            >
              <input
                type='checkbox'
                checked={filters.types?.includes(type.value) || false}
                onChange={() => toggleType(type.value)}
                className='h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900'
              />
              {type.label}
            </label>
          ))}
        </div>
      </div>

      {/* 案件状态 */}
      <div className='mt-4'>
        <h3 className='mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400'>
          案件状态
        </h3>
        <div className='space-y-1'>
          {CASE_STATUSES.map(status => (
            <label
              key={status.value}
              className='flex cursor-pointer items-center gap-2 text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50'
            >
              <input
                type='checkbox'
                checked={filters.statuses?.includes(status.value) || false}
                onChange={() => toggleStatus(status.value)}
                className='h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900'
              />
              {status.label}
            </label>
          ))}
        </div>
      </div>

      {/* 日期范围 */}
      <div className='mt-4'>
        <h3 className='mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400'>
          日期范围
        </h3>
        <div className='space-y-2'>
          <div>
            <label className='mb-1 block text-xs text-zinc-600 dark:text-zinc-400'>
              开始日期
            </label>
            <input
              type='date'
              value={filters.dateFrom?.toISOString().split('T')[0] || ''}
              onChange={e =>
                updateDateRange(
                  'dateFrom',
                  e.target.value ? new Date(e.target.value) : null
                )
              }
              className='w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50'
            />
          </div>
          <div>
            <label className='mb-1 block text-xs text-zinc-600 dark:text-zinc-400'>
              结束日期
            </label>
            <input
              type='date'
              value={filters.dateTo?.toISOString().split('T')[0] || ''}
              onChange={e =>
                updateDateRange(
                  'dateTo',
                  e.target.value ? new Date(e.target.value) : null
                )
              }
              className='w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50'
            />
          </div>
        </div>
      </div>
    </div>
  );
}
