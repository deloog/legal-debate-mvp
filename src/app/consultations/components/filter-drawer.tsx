/**
 * 咨询筛选抽屉组件
 * 功能：提供筛选条件，包括状态、咨询方式、日期范围等
 */
'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { ConsultationType, ConsultStatus } from '@/types/consultation';

/**
 * 筛选条件接口
 */
export interface ConsultationFilters {
  status?: ConsultStatus;
  consultType?: ConsultationType;
  caseType?: string;
  startDate?: string;
  endDate?: string;
}

export interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: ConsultationFilters) => void;
  initialFilters?: ConsultationFilters;
}

export function FilterDrawer({
  isOpen,
  onClose,
  onApply,
  initialFilters = {},
}: FilterDrawerProps) {
  const [filters, setFilters] = useState<ConsultationFilters>(initialFilters);

  const handleStatusChange = (value: string) => {
    setFilters(
      (prev): ConsultationFilters => ({
        ...prev,
        status: value ? (value as ConsultStatus) : undefined,
      })
    );
  };

  const handleConsultTypeChange = (value: string) => {
    setFilters(
      (prev): ConsultationFilters => ({
        ...prev,
        consultType: value ? (value as ConsultationType) : undefined,
      })
    );
  };

  const handleCaseTypeChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      caseType: value || undefined,
    }));
  };

  const handleStartDateChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      startDate: value || undefined,
    }));
  };

  const handleEndDateChange = (value: string) => {
    setFilters(prev => ({
      ...prev,
      endDate: value || undefined,
    }));
  };

  const handleReset = () => {
    setFilters({});
  };

  const handleApply = () => {
    // 过滤掉空值
    const activeFilters: ConsultationFilters = {};
    if (filters.status) {
      activeFilters.status = filters.status;
    }
    if (filters.consultType) {
      activeFilters.consultType = filters.consultType;
    }
    if (filters.caseType) {
      activeFilters.caseType = filters.caseType;
    }
    if (filters.startDate) {
      activeFilters.startDate = filters.startDate;
    }
    if (filters.endDate) {
      activeFilters.endDate = filters.endDate;
    }
    onApply(activeFilters);
    onClose();
  };

  const handleClose = () => {
    // 恢复初始筛选条件
    setFilters(initialFilters);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto'>
      {/* 背景遮罩 */}
      <div
        className='fixed inset-0 bg-black bg-opacity-50 transition-opacity'
        onClick={handleClose}
      />

      {/* 抽屉容器 */}
      <div className='fixed inset-y-0 right-0 w-full sm:w-96 bg-white shadow-xl overflow-y-auto'>
        <div className='flex h-full flex-col'>
          {/* 抽屉头部 */}
          <div className='flex items-center justify-between border-b border-gray-200 px-6 py-4'>
            <h2 className='text-lg font-semibold text-gray-900'>筛选条件</h2>
            <button
              onClick={handleClose}
              className='rounded-md p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <X className='h-5 w-5' />
            </button>
          </div>

          {/* 抽屉内容 */}
          <div className='flex-1 px-6 py-6 space-y-6'>
            {/* 咨询状态筛选 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                咨询状态
              </label>
              <select
                value={filters.status || ''}
                onChange={e => handleStatusChange(e.target.value)}
                className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部</option>
                <option value={ConsultStatus.PENDING}>待跟进</option>
                <option value={ConsultStatus.FOLLOWING}>跟进中</option>
                <option value={ConsultStatus.CONVERTED}>已转化</option>
                <option value={ConsultStatus.CLOSED}>已关闭</option>
                <option value={ConsultStatus.ARCHIVED}>已归档</option>
              </select>
            </div>

            {/* 咨询方式筛选 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                咨询方式
              </label>
              <select
                value={filters.consultType || ''}
                onChange={e => handleConsultTypeChange(e.target.value)}
                className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部</option>
                <option value={ConsultationType.PHONE}>电话咨询</option>
                <option value={ConsultationType.VISIT}>来访咨询</option>
                <option value={ConsultationType.ONLINE}>在线咨询</option>
                <option value={ConsultationType.REFERRAL}>转介绍</option>
              </select>
            </div>

            {/* 案件类型筛选 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                案件类型
              </label>
              <input
                type='text'
                value={filters.caseType || ''}
                onChange={e => handleCaseTypeChange(e.target.value)}
                placeholder='请输入案件类型'
                className='w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500'
              />
            </div>

            {/* 日期范围筛选 */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                咨询日期范围
              </label>
              <div className='space-y-2'>
                <div>
                  <label className='block text-xs text-gray-500 mb-1'>
                    开始日期
                  </label>
                  <input
                    type='date'
                    value={filters.startDate || ''}
                    onChange={e => handleStartDateChange(e.target.value)}
                    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <div>
                  <label className='block text-xs text-gray-500 mb-1'>
                    结束日期
                  </label>
                  <input
                    type='date'
                    value={filters.endDate || ''}
                    onChange={e => handleEndDateChange(e.target.value)}
                    className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 抽屉底部 */}
          <div className='border-t border-gray-200 px-6 py-4 space-y-3'>
            <button
              onClick={handleReset}
              className='w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              重置
            </button>
            <button
              onClick={handleApply}
              className='w-full rounded-md bg-blue-600 px-4 py-2 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              应用筛选
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
