'use client';

import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  username: string | null;
  name: string | null;
}

interface Qualification {
  id: string;
  userId: string;
  licenseNumber: string;
  fullName: string;
  lawFirm: string;
  status: string;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  user: User;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface QualificationListData {
  qualifications: Qualification[];
  pagination: Pagination;
}

interface FilterParams {
  status: string;
  search: string;
}

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '待审核' },
  { value: 'UNDER_REVIEW', label: '审核中' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已拒绝' },
  { value: 'EXPIRED', label: '已过期' },
];

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600',
  UNDER_REVIEW: 'text-blue-600',
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
  EXPIRED: 'text-gray-600',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待审核',
  UNDER_REVIEW: '审核中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  EXPIRED: '已过期',
};

interface ReviewModalProps {
  qualification: Qualification | null;
  onClose: () => void;
  onSuccess: () => void;
}

function ReviewModal({
  qualification,
  onClose,
  onSuccess,
}: ReviewModalProps): React.ReactElement | null {
  const [approved, setApproved] = useState<boolean>(true);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qualification) return;

    if (!reviewNotes.trim()) {
      setError('请输入审核备注');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/qualifications/${qualification.id}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            approved,
            reviewNotes: reviewNotes.trim(),
          }),
        }
      );

      if (!response.ok) {
        throw new Error('审核失败');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核失败');
    } finally {
      setLoading(false);
    }
  };

  if (!qualification) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl max-w-md w-full mx-4'>
        <div className='p-6 border-b border-gray-200'>
          <h2 className='text-xl font-bold text-gray-900'>审核律师资格</h2>
        </div>
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              执业证号
            </label>
            <p className='text-gray-900 font-medium'>
              {qualification.licenseNumber}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              律师姓名
            </label>
            <p className='text-gray-900 font-medium'>
              {qualification.fullName}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              执业律所
            </label>
            <p className='text-gray-900 font-medium'>{qualification.lawFirm}</p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              用户邮箱
            </label>
            <p className='text-gray-900 font-medium'>
              {qualification.user.email}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              审核决定
            </label>
            <div className='flex gap-4'>
              <label className='flex items-center'>
                <input
                  type='radio'
                  checked={approved}
                  onChange={() => {
                    setApproved(true);
                  }}
                  className='mr-2'
                />
                <span className='text-gray-700'>通过</span>
              </label>
              <label className='flex items-center'>
                <input
                  type='radio'
                  checked={!approved}
                  onChange={() => {
                    setApproved(false);
                  }}
                  className='mr-2'
                />
                <span className='text-gray-700'>拒绝</span>
              </label>
            </div>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-2'>
              审核备注
            </label>
            <textarea
              value={reviewNotes}
              onChange={e => setReviewNotes(e.target.value)}
              placeholder='请输入审核意见'
              rows={3}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          {error && <div className='text-red-600 text-sm'>{error}</div>}
          <div className='flex gap-3 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500'
            >
              取消
            </button>
            <button
              type='submit'
              disabled={loading}
              className='flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? '提交中...' : '提交'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function QualificationReview(): React.ReactElement {
  const [data, setData] = useState<QualificationListData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterParams>({
    status: '',
    search: '',
  });
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedQualification, setSelectedQualification] =
    useState<Qualification | null>(null);

  const loadQualifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });

      const response = await fetch(`/api/admin/qualifications?${params}`);
      if (!response.ok) {
        throw new Error('获取资格列表失败');
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
    loadQualifications();
  }, [loadQualifications]);

  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCurrentPage(1);
    loadQualifications();
  };

  const handleReview = (qualification: Qualification) => {
    setSelectedQualification(qualification);
  };

  const handleReviewSuccess = () => {
    loadQualifications();
    setSelectedQualification(null);
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

  if (!data || data.qualifications.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>暂无资格审核数据</div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {selectedQualification && (
        <ReviewModal
          qualification={selectedQualification}
          onClose={() => {
            setSelectedQualification(null);
          }}
          onSuccess={handleReviewSuccess}
        />
      )}
      <div className='bg-white rounded-lg shadow p-6'>
        <form onSubmit={handleSearch} className='flex flex-wrap gap-4'>
          <input
            type='text'
            placeholder='搜索执业证号、律师姓名或律所'
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
                执业证号
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                律师姓名
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                执业律所
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                用户邮箱
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                状态
              </th>
              <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>
                提交时间
              </th>
              <th className='px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='bg-white divide-y divide-gray-200'>
            {data.qualifications.map(qualification => (
              <tr key={qualification.id} className='hover:bg-gray-50'>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-900'>
                  {qualification.licenseNumber}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {qualification.fullName}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {qualification.lawFirm}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {qualification.user.email}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm'>
                  <span className={STATUS_COLORS[qualification.status] || ''}>
                    {STATUS_LABELS[qualification.status] ||
                      qualification.status}
                  </span>
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-500'>
                  {new Date(qualification.submittedAt).toLocaleDateString(
                    'zh-CN'
                  )}
                </td>
                <td className='px-6 py-4 whitespace-nowrap text-right text-sm font-medium'>
                  <button
                    onClick={() => {
                      handleReview(qualification);
                    }}
                    className='text-blue-600 hover:text-blue-900'
                  >
                    审核
                  </button>
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
