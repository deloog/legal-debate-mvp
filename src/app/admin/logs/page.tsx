/**
 * 系统日志查看页面（管理员专用）
 *
 * - 操作日志：来自 /api/v1/audit-logs，展示用户操作记录
 * - 错误日志：系统尚未集成独立错误日志后端，显示说明
 *
 * @page /admin/logs
 * @access Admin only
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ActionLogViewer } from '@/components/admin/ActionLogViewer';
import type { ActionLogItem } from '@/types/log';

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<'error' | 'action'>('action');
  const [actionLogs, setActionLogs] = useState<ActionLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchActionLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/v1/audit-logs?page=${pageNum}&limit=20`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 获取操作日志失败`);
      }
      const result = await response.json();
      if (result.data) {
        setActionLogs(result.data.logs ?? []);
        const pagination = result.meta?.pagination ?? result.data.pagination;
        setTotal(pagination?.total ?? 0);
        setTotalPages(pagination?.totalPages ?? 1);
      }
    } catch (_error) {
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = () => {
    if (activeTab === 'action') fetchActionLogs(page);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (activeTab === 'action') fetchActionLogs(newPage);
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
    if (activeTab === 'action') {
      fetchActionLogs(page);
    }
  }, [activeTab, fetchActionLogs, page]);

  return (
    <div className='container mx-auto px-4 py-8'>
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>系统日志</h1>
        <p className='text-gray-600'>查看系统错误日志和用户操作日志</p>
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

      {/* 日志内容 */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
        {activeTab === 'error' ? (
          // 错误日志系统尚未集成独立后端，避免用错误类型渲染 ActionLogItem 数据
          <div className='flex flex-col items-center justify-center py-16 text-center'>
            <div className='text-4xl mb-4'>🗂️</div>
            <h3 className='text-lg font-medium text-gray-900 mb-2'>
              错误日志系统暂未集成
            </h3>
            <p className='text-sm text-gray-500 max-w-md'>
              应用程序运行时错误记录于服务器日志文件（如 pm2 / systemd
              journal）中，尚未集成到管理后台。
              如需排查错误，请直接查阅服务器日志。
            </p>
          </div>
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
