'use client';

import _React, { useState } from 'react';
import type { ActionLogItem } from '@/types/log';

/**
 * 操作日志查看器属性
 */
interface ActionLogViewerProps {
  logs: ActionLogItem[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  onRefresh: () => void;
  onPageChange: (page: number) => void;
}

/**
 * 操作日志查看器组件
 */
export function ActionLogViewer({
  logs,
  loading,
  total,
  page,
  totalPages,
  onRefresh,
  onPageChange,
}: ActionLogViewerProps) {
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const getActionTypeText = (actionType: string): string => {
    switch (actionType) {
      case 'LOGIN':
        return '登录';
      case 'LOGOUT':
        return '退出登录';
      case 'REGISTER':
        return '注册';
      case 'UPDATE_PROFILE':
        return '更新资料';
      case 'CHANGE_PASSWORD':
        return '修改密码';
      case 'CREATE_CASE':
        return '创建案件';
      case 'UPDATE_CASE':
        return '更新案件';
      case 'DELETE_CASE':
        return '删除案件';
      case 'VIEW_CASE':
        return '查看案件';
      case 'UPLOAD_DOCUMENT':
        return '上传文档';
      case 'DELETE_DOCUMENT':
        return '删除文档';
      case 'ANALYZE_DOCUMENT':
        return '分析文档';
      case 'CREATE_DEBATE':
        return '创建辩论';
      case 'UPDATE_DEBATE':
        return '更新辩论';
      case 'DELETE_DEBATE':
        return '删除辩论';
      case 'GENERATE_ARGUMENT':
        return '生成论点';
      case 'APPROVE_QUALIFICATION':
        return '审核通过';
      case 'REJECT_QUALIFICATION':
        return '审核拒绝';
      case 'UPDATE_USER_ROLE':
        return '更新用户角色';
      case 'BAN_USER':
        return '封禁用户';
      case 'UNBAN_USER':
        return '解封用户';
      case 'EXPORT_DATA':
        return '导出数据';
      case 'IMPORT_DATA':
        return '导入数据';
      case 'SYSTEM_CONFIG_UPDATE':
        return '更新系统配置';
      default:
        return actionType;
    }
  };

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'AUTH':
        return 'bg-blue-100 text-blue-700';
      case 'USER':
        return 'bg-green-100 text-green-700';
      case 'CASE':
        return 'bg-purple-100 text-purple-700';
      case 'DOCUMENT':
        return 'bg-orange-100 text-orange-700';
      case 'DEBATE':
        return 'bg-pink-100 text-pink-700';
      case 'ADMIN':
        return 'bg-red-100 text-red-700';
      case 'SYSTEM':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
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
        <div className='text-gray-500 text-lg mb-4'>暂无操作日志</div>
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
        <div className='text-sm text-gray-600'>共 {total} 条操作日志</div>
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
                        className={`px-2 py-0.5 text-xs font-medium rounded ${getCategoryColor(
                          log.actionCategory
                        )}`}
                      >
                        {log.actionCategory}
                      </span>
                      <span className='text-sm text-gray-500'>
                        {getActionTypeText(log.actionType)}
                      </span>
                      <span className='text-xs text-gray-400'>
                        用户: {log.userId.slice(0, 8)}
                      </span>
                    </div>
                    <div className='text-sm text-gray-900 font-medium truncate'>
                      {log.description}
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
                    <div className='grid grid-cols-2 gap-4 text-sm'>
                      <div>
                        <span className='text-gray-500'>请求方法：</span>
                        <span className='text-gray-900 ml-1'>
                          {log.requestMethod || '-'}
                        </span>
                      </div>
                      <div>
                        <span className='text-gray-500'>响应状态：</span>
                        <span
                          className={`ml-1 ${
                            log.responseStatus &&
                            log.responseStatus >= 200 &&
                            log.responseStatus < 300
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {log.responseStatus || '-'}
                        </span>
                      </div>
                      <div>
                        <span className='text-gray-500'>资源类型：</span>
                        <span className='text-gray-900 ml-1'>
                          {log.resourceType || '-'}
                        </span>
                      </div>
                      <div>
                        <span className='text-gray-500'>资源ID：</span>
                        <span className='text-gray-900 ml-1'>
                          {log.resourceId || '-'}
                        </span>
                      </div>
                    </div>
                    {log.requestPath && (
                      <div>
                        <div className='text-xs font-medium text-gray-700 mb-1'>
                          请求路径：
                        </div>
                        <code className='text-xs text-gray-600 bg-white p-2 rounded border border-gray-200 block'>
                          {log.requestPath}
                        </code>
                      </div>
                    )}
                    {!!log.requestParams &&
                      Object.keys(log.requestParams as Record<string, unknown>)
                        .length > 0 && (
                        <div>
                          <div className='text-xs font-medium text-gray-700 mb-1'>
                            请求参数：
                          </div>
                          <pre className='text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto bg-white p-2 rounded border border-gray-200'>
                            {JSON.stringify(log.requestParams, null, 2)}
                          </pre>
                        </div>
                      )}
                    {log.ipAddress && (
                      <div>
                        <span className='text-xs text-gray-500'>IP地址：</span>
                        <span className='text-xs text-gray-900 ml-1'>
                          {log.ipAddress}
                        </span>
                      </div>
                    )}
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
