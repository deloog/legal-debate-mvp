/**
 * 系统配置管理页面
 *
 * 功能：
 * 1. 查看和管理系统全局配置项（AI服务、存储、安全等）
 * 2. 支持创建、更新、删除配置项
 * 3. 实时显示操作结果通知（成功/失败）
 * 4. 分页展示配置列表
 * 5. 支持刷新和翻页操作
 *
 * 页面组件使用 SystemConfigViewer 子组件进行配置展示和操作
 *
 * @page /admin/configs
 */

'use client';

import React, { useState, useCallback } from 'react';
import { SystemConfigViewer } from '@/components/admin/SystemConfigViewer';
import { SystemConfig } from '@prisma/client';
import { CreateConfigRequest, UpdateConfigRequest } from '@/types/config';

/**
 * 系统配置管理页面
 */
export default function ConfigsPage() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  /**
   * 获取配置列表
   */
  const fetchConfigs = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/admin/configs?page=${pageNum}&limit=20`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 获取配置列表失败`);
      }
      const result = await response.json();
      if (result.data) {
        setConfigs(result.data.configs);
        setTotal(result.data.pagination.total);
        setTotalPages(result.data.pagination.totalPages);
      } else {
        showNotification('error', result.message || '获取配置列表失败');
      }
    } catch (error) {
      console.error('获取配置列表失败:', error);
      showNotification('error', '获取配置列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 创建配置
   */
  const handleCreate = async (data: CreateConfigRequest) => {
    try {
      const response = await fetch('/api/admin/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 创建配置失败`);
      }
      const result = await response.json();
      if (response.ok) {
        showNotification('success', '配置创建成功');
        await fetchConfigs(page);
      } else {
        showNotification('error', result.message || '创建配置失败');
      }
    } catch (error) {
      console.error('创建配置失败:', error);
      showNotification('error', '创建配置失败');
    }
  };

  /**
   * 更新配置
   */
  const handleUpdate = async (key: string, data: UpdateConfigRequest) => {
    try {
      const response = await fetch(`/api/admin/configs/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 更新配置失败`);
      }
      const result = await response.json();
      if (response.ok) {
        showNotification('success', '配置更新成功');
        await fetchConfigs(page);
      } else {
        showNotification('error', result.message || '更新配置失败');
      }
    } catch (error) {
      console.error('更新配置失败:', error);
      showNotification('error', '更新配置失败');
    }
  };

  /**
   * 删除配置
   */
  const handleDelete = async (key: string) => {
    try {
      const response = await fetch(`/api/admin/configs/${key}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 删除配置失败`);
      }
      const result = await response.json();
      if (response.ok) {
        showNotification('success', '配置删除成功');
        await fetchConfigs(page);
      } else {
        showNotification('error', result.message || '删除配置失败');
      }
    } catch (error) {
      console.error('删除配置失败:', error);
      showNotification('error', '删除配置失败');
    }
  };

  /**
   * 显示通知
   */
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  /**
   * 初始化时获取配置列表
   */
  React.useEffect(() => {
    fetchConfigs(page);
  }, [fetchConfigs, page]);

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* 页面标题 */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold text-gray-900 mb-2'>系统配置管理</h1>
        <p className='text-gray-600'>
          管理系统全局配置，包括AI服务、存储、安全等功能参数
        </p>
      </div>

      {/* 通知提示 */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            notification.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className='flex items-center'>
            <span className='font-medium'>{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className='ml-auto text-gray-500 hover:text-gray-700'
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* 配置查看器 */}
      <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-6'>
        <SystemConfigViewer
          configs={configs}
          loading={loading}
          total={total}
          page={page}
          totalPages={totalPages}
          onRefresh={() => fetchConfigs(page)}
          onPageChange={p => {
            setPage(p);
            fetchConfigs(p);
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
