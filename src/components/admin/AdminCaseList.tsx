'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Case {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  amount: string | null;
  caseNumber: string | null;
  cause: string | null;
  court: string | null;
  plaintiffName: string | null;
  defendantName: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
  };
  documentsCount: number;
  debatesCount: number;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CaseListData {
  cases: Case[];
  pagination: Pagination;
}

interface FilterParams {
  type: string;
  status: string;
  userId: string;
  search: string;
}

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: 'CIVIL', label: '民事' },
  { value: 'CRIMINAL', label: '刑事' },
  { value: 'ADMINISTRATIVE', label: '行政' },
  { value: 'COMMERCIAL', label: '商事' },
  { value: 'LABOR', label: '劳动' },
  { value: 'INTELLECTUAL', label: '知识产权' },
  { value: 'OTHER', label: '其他' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'ACTIVE', label: '进行中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'ARCHIVED', label: '已归档' },
];

const TYPE_LABELS: Record<string, string> = {
  CIVIL: '民事',
  CRIMINAL: '刑事',
  ADMINISTRATIVE: '行政',
  COMMERCIAL: '商事',
  LABOR: '劳动',
  INTELLECTUAL: '知识产权',
  OTHER: '其他',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  ARCHIVED: 'bg-yellow-100 text-yellow-800',
};

export function AdminCaseList(): React.ReactElement {
  const [data, setData] = useState<CaseListData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterParams>({
    type: '',
    status: '',
    userId: '',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(filters.type && { type: filters.type }),
        ...(filters.status && { status: filters.status }),
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/cases?${params}`);
      if (!response.ok) {
        throw new Error('获取案件列表失败');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filters]);

  useEffect(() => {
    loadCases();
  }, [loadCases]);

  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    loadCases();
  };

  const handleDelete = async (caseId: string, caseTitle: string) => {
    if (!window.confirm(`确定要删除案件"${caseTitle}"吗？此操作不可恢复。`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/cases/${caseId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      await loadCases();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-red-600'>{error}</div>
      </div>
    );
  }

  if (!data || data.cases.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>暂无案件数据</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <form onSubmit={handleSearch} className='flex flex-wrap gap-4'>
          <input
            type='text'
            placeholder='搜索标题、案号、案由或当事人'
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className='flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <select
            value={filters.type}
            onChange={e => handleFilterChange('type', e.target.value)}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={e => handleFilterChange('status', e.target.value)}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type='text'
            placeholder='用户ID'
            value={filters.userId}
            onChange={e => handleFilterChange('userId', e.target.value)}
            className='w-40 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            type='submit'
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            搜索
          </button>
        </form>
      </div>

      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                标题
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                类型
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                状态
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                用户
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                文档数
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                辩论数
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                创建时间
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {data.cases.map(caseItem => (
              <tr key={caseItem.id} className='hover:bg-gray-50'>
                <td className='px-6 py-4'>
                  <div className='text-sm font-medium text-gray-900'>
                    {caseItem.title}
                  </div>
                  {caseItem.caseNumber && (
                    <div className='text-sm text-gray-500'>
                      {caseItem.caseNumber}
                    </div>
                  )}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {TYPE_LABELS[caseItem.type] || caseItem.type}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[caseItem.status] || ''}`}
                  >
                    {caseItem.status}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  <div>{caseItem.user.name || caseItem.user.username}</div>
                  <div className='text-xs text-gray-400'>
                    {caseItem.user.email}
                  </div>
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {caseItem.documentsCount}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {caseItem.debatesCount}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {new Date(caseItem.createdAt).toLocaleDateString('zh-CN')}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                  <div className='flex justify-end gap-2'>
                    <Link
                      href={`/cases/${caseItem.id}`}
                      className='text-blue-600 hover:text-blue-900'
                    >
                      查看
                    </Link>
                    <button
                      onClick={() => {
                        handleDelete(caseItem.id, caseItem.title);
                      }}
                      className='text-red-600 hover:text-red-900'
                    >
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className='bg-gray-50 px-6 py-4 flex items-center justify-between'>
          <div className='text-sm text-gray-700'>
            {' '}
            共 {data.pagination.total} 条记录，第 {currentPage} /{' '}
            {data.pagination.totalPages} 页
          </div>
          <div className='flex gap-2'>
            <button
              onClick={() => {
                setCurrentPage(p => Math.max(1, p - 1));
              }}
              disabled={currentPage === 1}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              上一页
            </button>
            <button
              onClick={() => {
                setCurrentPage(p =>
                  Math.min(data.pagination.totalPages, p + 1)
                );
              }}
              disabled={currentPage === data.pagination.totalPages}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
