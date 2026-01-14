'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ErrorLogViewer } from '@/components/admin/ErrorLogViewer';
import { ActionLogViewer } from '@/components/admin/ActionLogViewer';
import type { ErrorLogItem, ActionLogItem } from '@/types/log';

/**
 * 日志查看页面
 */
export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<'error' | 'action'>('error');
  const [errorLogs, setErrorLogs] = useState<ErrorLogItem[]>([]);
  const [actionLogs, setActionLogs] = useState<ActionLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = useCallback(
    async (pageNum: number) => {
      setLoading(true);
      try {
        const apiPath =
          activeTab === 'error'
            ? '/api/admin/error-logs'
            : '/api/admin/action-logs';
        const response = await fetch(`${apiPath}?page=${pageNum}&limit=20`);
        const result = await response.json();
        if (result.data) {
          if (activeTab === 'error') {
            setErrorLogs(result.data.logs);
          } else {
            setActionLogs(result.data.logs);
          }
          setTotal(result.data.pagination.total);
          setTotalPages(result.data.pagination.totalPages);
        }
      } catch (error) {
        console.error('获取日志失败:', error);
      } finally {
        setLoading(false);
      }
    },
    [activeTab]
  );

  const handleRefresh = () => {
    fetchLogs(page);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(newPage);
  };

  const handleTabChange = (tab: 'error' | 'action') => {
    if (tab !== activeTab) {
      setActiveTab(tab);
      setPage(1);
      setTotal(0);
      setTotalPages(1);
    }
  };

  useEffect(() => {
    fetchLogs(page);
  }, [fetchLogs, page]);

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>系统日志</h1>
        <p className='text-gray-600'>查看和管理系统错误日志和用户操作日志</p>
      </div>

      {/* 标签页切换 */}
      <div className='mb-6'>
        <div className='border-b border-gray-200'>
          <nav className='flex space-x-8'>
            <button
              onClick={() => handleTabChange('error')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'error'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              错误日志
            </button>
            <button
              onClick={() => handleTabChange('action')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'action'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              操作日志
            </button>
          </nav>
        </div>
      </div>

      {/* 日志查看器 */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
        {activeTab === 'error' ? (
          <ErrorLogViewer
            logs={errorLogs}
            loading={loading}
            total={total}
            page={page}
            totalPages={totalPages}
            onRefresh={handleRefresh}
            onPageChange={handlePageChange}
          />
        ) : (
          <ActionLogViewer
            logs={actionLogs}
            loading={loading}
            total={total}
            page={page}
            totalPages={totalPages}
            onRefresh={handleRefresh}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    </div>
  );
}
