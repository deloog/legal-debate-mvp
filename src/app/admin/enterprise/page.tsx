'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { EnterpriseStatus } from '@/types/enterprise';

interface EnterpriseListItem {
  id: string;
  userId: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  status: EnterpriseStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  expiresAt: Date | null;
  user: {
    email: string;
    username: string | null;
    name: string | null;
  };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface EnterpriseListData {
  enterprises: EnterpriseListItem[];
  pagination: Pagination;
}

interface FilterParams {
  status: string;
  search: string;
  startDate: string;
  endDate: string;
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: EnterpriseStatus.PENDING, label: '待审核' },
  { value: EnterpriseStatus.UNDER_REVIEW, label: '审核中' },
  { value: EnterpriseStatus.APPROVED, label: '已通过' },
  { value: EnterpriseStatus.REJECTED, label: '已拒绝' },
  { value: EnterpriseStatus.EXPIRED, label: '已过期' },
  { value: EnterpriseStatus.SUSPENDED, label: '已暂停' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600',
  UNDER_REVIEW: 'text-blue-600',
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
  EXPIRED: 'text-gray-600',
  SUSPENDED: 'text-orange-600',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待审核',
  UNDER_REVIEW: '审核中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  EXPIRED: '已过期',
  SUSPENDED: '已暂停',
};

export function EnterpriseListPage(): React.ReactElement {
  const [data, setData] = useState<EnterpriseListData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterParams>({
    status: '',
    search: '',
    startDate: '',
    endDate: '',
  });
  const [currentPage, setCurrentPage] = useState<number>(1);

  const loadEnterprises = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/admin/enterprise?${params}`);
      if (!response.ok) {
        throw new Error('获取企业认证列表失败');
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
    loadEnterprises();
  }, [loadEnterprises]);

  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    loadEnterprises();
  };

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('zh-CN');
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

  if (!data || data.enterprises.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>暂无企业认证数据</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='bg-white rounded-lg shadow p-6'>
        <form onSubmit={handleSearch} className='flex flex-wrap gap-4'>
          <input
            type='text'
            placeholder='搜索企业名称、信用代码或法人'
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className='flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
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
            type='date'
            value={filters.startDate}
            onChange={e => handleFilterChange('startDate', e.target.value)}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <input
            type='date'
            value={filters.endDate}
            onChange={e => handleFilterChange('endDate', e.target.value)}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
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
                企业名称
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                统一社会信用代码
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                法人
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                行业
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                状态
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                申请时间
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                到期时间
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {data.enterprises.map(enterprise => (
              <tr key={enterprise.id} className='hover:bg-gray-50'>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                  {enterprise.enterpriseName}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {enterprise.creditCode}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {enterprise.legalPerson}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {enterprise.industryType}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                  <span className={STATUS_COLORS[enterprise.status] || ''}>
                    {STATUS_LABELS[enterprise.status] || enterprise.status}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {formatDate(enterprise.submittedAt)}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {formatDate(enterprise.expiresAt)}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                  <div className='flex justify-end gap-2'>
                    <Link
                      href={`/admin/enterprise/${enterprise.id}`}
                      className='text-blue-600 hover:text-blue-900'
                    >
                      查看
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className='bg-gray-50 px-6 py-4 flex items-center justify-between'>
          <div className='text-sm text-gray-700'>
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
