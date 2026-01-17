'use client';

import { useState, useEffect, useCallback } from 'react';
import { AdminMembershipDetail } from './AdminMembershipDetail';
import { AdminMembershipEditModal } from './AdminMembershipEditModal';

// =============================================================================
// 类型定义
// =============================================================================

interface Membership {
  id: string;
  userId: string;
  userEmail: string;
  userName: string | null;
  tierName: string;
  tierDisplayName: string;
  status: string;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  pausedAt: Date | null;
  pausedReason: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface MembershipListData {
  memberships: Membership[];
  pagination: Pagination;
}

interface FilterParams {
  tier: string;
  status: string;
  search: string;
}

// =============================================================================
// 辅助常量
// =============================================================================

const TIER_OPTIONS = [
  { value: '', label: '全部等级' },
  { value: 'FREE', label: '免费版' },
  { value: 'BASIC', label: '基础版' },
  { value: 'PROFESSIONAL', label: '专业版' },
  { value: 'ENTERPRISE', label: '企业版' },
];

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'ACTIVE', label: '生效中' },
  { value: 'EXPIRED', label: '已过期' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'SUSPENDED', label: '已暂停' },
  { value: 'PENDING', label: '待生效' },
];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-green-600',
  EXPIRED: 'text-red-600',
  CANCELLED: 'text-gray-600',
  SUSPENDED: 'text-yellow-600',
  PENDING: 'text-blue-600',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: '生效中',
  EXPIRED: '已过期',
  CANCELLED: '已取消',
  SUSPENDED: '已暂停',
  PENDING: '待生效',
};

// =============================================================================
// 组件
// =============================================================================

export function AdminMembershipList(): React.ReactElement {
  const [data, setData] = useState<MembershipListData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterParams>({
    tier: '',
    status: '',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedMembershipId, setSelectedMembershipId] = useState<
    string | null
  >(null);
  const [editingMembership, setEditingMembership] = useState<{
    id: string;
    detail: Membership;
  } | null>(null);
  const [exporting, setExporting] = useState<boolean>(false);

  const loadMemberships = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(filters.tier && { tier: filters.tier }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/memberships?${params}`);
      if (!response.ok) {
        throw new Error('获取会员列表失败');
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
    loadMemberships();
  }, [loadMemberships]);

  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    loadMemberships();
  };

  const handleViewDetail = (membershipId: string) => {
    setSelectedMembershipId(membershipId);
  };

  const handleCloseDetail = () => {
    setSelectedMembershipId(null);
  };

  // 处理编辑会员
  const handleEditMembership = (membership: Membership) => {
    setEditingMembership({
      id: membership.id,
      detail: membership,
    });
  };

  // 处理编辑完成
  const handleEditComplete = () => {
    setEditingMembership(null);
    loadMemberships();
  };

  // 关闭编辑模态框
  const handleCloseEdit = () => {
    setEditingMembership(null);
  };

  // 处理导出会员
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams({
        ...(filters.tier && { tier: filters.tier }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/memberships/export?${params}`);
      if (!response.ok) {
        throw new Error('导出失败');
      }

      // 获取文件名
      const contentDisposition = response.headers.get('content-disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'memberships.csv';

      // 下载文件
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('导出失败:', err);
      alert('导出失败，请重试');
    } finally {
      setExporting(false);
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

  if (!data || data.memberships.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>暂无会员数据</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 筛选栏 */}
      <div className='bg-white rounded-lg shadow p-6'>
        <form onSubmit={handleSearch} className='flex flex-wrap gap-4'>
          <input
            type='text'
            placeholder='搜索邮箱、用户名或姓名'
            value={filters.search}
            onChange={e => handleFilterChange('search', e.target.value)}
            className='flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <select
            value={filters.tier}
            onChange={e => handleFilterChange('tier', e.target.value)}
            className='px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            {TIER_OPTIONS.map(opt => (
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
          <button
            type='submit'
            className='px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            搜索
          </button>
        </form>
      </div>

      {/* 操作栏 */}
      <div className='flex justify-between items-center mb-4'>
        <div className='text-sm text-gray-700'>
          共找到 {data.pagination.total} 条会员记录
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className='px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
        >
          {exporting ? '导出中...' : '导出CSV'}
          <svg
            className='h-4 w-4'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
            />
          </svg>
        </button>
      </div>

      {/* 会员列表表格 */}
      <div className='bg-white rounded-lg shadow overflow-hidden'>
        <table className='min-w-full divide-y divide-gray-200'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                用户邮箱
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                用户名
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                会员等级
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                状态
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                开始日期
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                结束日期
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                自动续费
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {data.memberships.map(membership => (
              <tr key={membership.id} className='hover:bg-gray-50'>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                  {membership.userEmail}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {membership.userName || '-'}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                  {membership.tierDisplayName}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                  <span className={STATUS_COLORS[membership.status] || ''}>
                    {STATUS_LABELS[membership.status] || membership.status}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {new Date(membership.startDate).toLocaleDateString('zh-CN')}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {new Date(membership.endDate).toLocaleDateString('zh-CN')}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {membership.autoRenew ? '是' : '否'}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2'>
                  <button
                    onClick={() => handleViewDetail(membership.id)}
                    className='text-blue-600 hover:text-blue-900'
                  >
                    查看详情
                  </button>
                  <button
                    onClick={() => handleEditMembership(membership)}
                    className='text-indigo-600 hover:text-indigo-900'
                  >
                    编辑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 分页 */}
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

      {/* 会员详情模态框 */}
      {selectedMembershipId && (
        <AdminMembershipDetail
          membershipId={selectedMembershipId}
          onClose={handleCloseDetail}
        />
      )}

      {/* 会员编辑模态框 */}
      {editingMembership && (
        <AdminMembershipEditModal
          membershipId={editingMembership.id}
          detail={editingMembership.detail}
          onClose={handleCloseEdit}
          onUpdate={handleEditComplete}
        />
      )}
    </div>
  );
}
