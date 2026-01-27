'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { EnterpriseStatus } from '@/types/enterprise';
import { EnterpriseReviewAction } from '@/types/enterprise';

interface EnterpriseDetail {
  id: string;
  userId: string;
  enterpriseName: string;
  creditCode: string;
  legalPerson: string;
  industryType: string;
  businessLicense: string | null;
  status: EnterpriseStatus;
  submittedAt: Date;
  reviewedAt: Date | null;
  reviewerId: string | null;
  reviewNotes: string | null;
  expiresAt: Date | null;
  verificationData: unknown | null;
  metadata: unknown | null;
  user: {
    id: string;
    email: string;
    username: string | null;
    name: string | null;
    phone: string | null;
  };
  reviews: Array<{
    id: string;
    reviewerId: string;
    reviewerName: string | null;
    reviewAction: string;
    reviewNotes: string | null;
    createdAt: Date;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待审核',
  UNDER_REVIEW: '审核中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  EXPIRED: '已过期',
  SUSPENDED: '已暂停',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-600',
  UNDER_REVIEW: 'text-blue-600',
  APPROVED: 'text-green-600',
  REJECTED: 'text-red-600',
  EXPIRED: 'text-gray-600',
  SUSPENDED: 'text-orange-600',
};

function EnterpriseDetailPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams();
  const enterpriseId = params.id as string;

  const [data, setData] = useState<EnterpriseDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reviewAction, setReviewAction] =
    useState<EnterpriseReviewAction | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');

  const loadEnterpriseDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/enterprise/${enterpriseId}`);
      if (!response.ok) {
        throw new Error('获取企业认证详情失败');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [enterpriseId]);

  useEffect(() => {
    loadEnterpriseDetail();
  }, [loadEnterpriseDetail]);

  const handleReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!reviewAction) {
      setError('请选择审核操作');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/admin/enterprise/${enterpriseId}/review`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            reviewAction,
            reviewNotes,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '审核失败');
      }

      setSuccess('审核完成');
      setReviewAction(null);
      setReviewNotes('');
      setTimeout(() => {
        loadEnterpriseDetail();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核失败');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-gray-600'>加载中...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className='flex items-center justify-center h-64'>
        <div className='text-red-600'>{error}</div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <h1 className='text-2xl font-bold text-gray-900'>企业认证详情</h1>
        <button
          onClick={() => router.back()}
          className='px-4 py-2 text-blue-600 hover:text-blue-900'
        >
          返回列表
        </button>
      </div>

      {error && (
        <div className='bg-red-50 border border-red-200 rounded-lg p-4'>
          <p className='text-red-600'>{error}</p>
        </div>
      )}

      {success && (
        <div className='bg-green-50 border border-green-200 rounded-lg p-4'>
          <p className='text-green-600'>{success}</p>
        </div>
      )}

      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>基本信息</h2>
          <div className='space-y-4'>
            <div>
              <label className='block text-sm font-medium text-gray-500'>
                企业名称
              </label>
              <p className='mt-1 text-sm text-gray-900'>
                {data.enterpriseName}
              </p>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-500'>
                统一社会信用代码
              </label>
              <p className='mt-1 text-sm text-gray-900'>{data.creditCode}</p>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-500'>
                法定代表人
              </label>
              <p className='mt-1 text-sm text-gray-900'>{data.legalPerson}</p>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-500'>
                行业类型
              </label>
              <p className='mt-1 text-sm text-gray-900'>{data.industryType}</p>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-500'>
                认证状态
              </label>
              <p className='mt-1'>
                <span
                  className={`font-medium ${STATUS_COLORS[data.status] || ''}`}
                >
                  {STATUS_LABELS[data.status] || data.status}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className='space-y-6'>
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-lg font-semibold text-gray-900 mb-4'>
              申请时间
            </h2>
            <div className='space-y-2'>
              <div>
                <label className='block text-sm font-medium text-gray-500'>
                  申请日期
                </label>
                <p className='mt-1 text-sm text-gray-900'>
                  {formatDate(data.submittedAt)}
                </p>
              </div>
              {data.reviewedAt && (
                <div>
                  <label className='block text-sm font-medium text-gray-500'>
                    审核日期
                  </label>
                  <p className='mt-1 text-sm text-gray-900'>
                    {formatDate(data.reviewedAt)}
                  </p>
                </div>
              )}
              {data.expiresAt && (
                <div>
                  <label className='block text-sm font-medium text-gray-500'>
                    到期日期
                  </label>
                  <p className='mt-1 text-sm text-gray-900'>
                    {formatDate(data.expiresAt)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {(data.status === EnterpriseStatus.PENDING ||
            data.status === EnterpriseStatus.UNDER_REVIEW) && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-lg font-semibold text-gray-900 mb-4'>
                审核操作
              </h2>
              <form onSubmit={handleReview} className='space-y-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    审核决定
                  </label>
                  <select
                    value={reviewAction || ''}
                    onChange={e =>
                      setReviewAction(e.target.value as EnterpriseReviewAction)
                    }
                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>请选择</option>
                    <option value={EnterpriseReviewAction.APPROVE}>通过</option>
                    <option value={EnterpriseReviewAction.REJECT}>拒绝</option>
                  </select>
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    审核备注
                  </label>
                  <textarea
                    rows={3}
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder='请输入审核备注（选填）'
                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <button
                  type='submit'
                  disabled={submitting}
                  className='w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {submitting ? '审核中...' : '提交审核'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      <div className='bg-white rounded-lg shadow p-6'>
        <h2 className='text-lg font-semibold text-gray-900 mb-4'>用户信息</h2>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-500'>
              邮箱
            </label>
            <p className='mt-1 text-sm text-gray-900'>{data.user.email}</p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-500'>
              用户名
            </label>
            <p className='mt-1 text-sm text-gray-900'>
              {data.user.username || '-'}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-500'>
              姓名
            </label>
            <p className='mt-1 text-sm text-gray-900'>
              {data.user.name || '-'}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-500'>
              电话
            </label>
            <p className='mt-1 text-sm text-gray-900'>
              {data.user.phone || '-'}
            </p>
          </div>
        </div>
      </div>

      {data.businessLicense && (
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>营业执照</h2>
          <Image
            src={data.businessLicense}
            alt='营业执照'
            width={0}
            height={0}
            sizes='100vw'
            className='max-w-full h-auto border border-gray-200 rounded-lg'
          />
        </div>
      )}

      {data.reviews.length > 0 && (
        <div className='bg-white rounded-lg shadow p-6'>
          <h2 className='text-lg font-semibold text-gray-900 mb-4'>审核历史</h2>
          <div className='space-y-4'>
            {data.reviews.map(review => (
              <div
                key={review.id}
                className='border border-gray-200 rounded-lg p-4'
              >
                <div className='flex items-center justify-between mb-2'>
                  <div>
                    <p className='text-sm font-medium text-gray-900'>
                      {review.reviewerName || '未知审核人'}
                    </p>
                    <p className='text-xs text-gray-500'>
                      {formatDate(review.createdAt)}
                    </p>
                  </div>
                  <span className='text-sm font-medium text-gray-600'>
                    {review.reviewAction === 'APPROVE' ? '通过' : '拒绝'}
                  </span>
                </div>
                {review.reviewNotes && (
                  <div className='mt-2 pt-2 border-t border-gray-100'>
                    <p className='text-sm text-gray-700'>
                      {review.reviewNotes}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EnterpriseDetailPage;
