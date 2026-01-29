/**
 * 合同详情页面
 */
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ContractStatus, ContractPaymentStatus } from '@/types/contract';

interface ContractDetail {
  id: string;
  contractNumber: string;
  clientType: string;
  clientName: string;
  clientIdNumber: string | null;
  clientAddress: string | null;
  clientContact: string | null;
  lawFirmName: string;
  lawyerName: string;
  caseType: string;
  caseSummary: string;
  scope: string;
  feeType: string;
  totalFee: number;
  paidAmount: number;
  status: ContractStatus;
  signedAt: Date | null;
  specialTerms: string | null;
  createdAt: Date;
  payments: Array<{
    id: string;
    paymentNumber: string;
    amount: number;
    paymentType: string;
    paymentMethod: string | null;
    status: ContractPaymentStatus;
    paidAt: Date | null;
    note: string | null;
  }>;
}

const statusLabels: Record<ContractStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待签署',
  SIGNED: '已签署',
  EXECUTING: '履行中',
  COMPLETED: '已完成',
  TERMINATED: '已终止',
};

const statusColors: Record<ContractStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  SIGNED: 'bg-blue-100 text-blue-800',
  EXECUTING: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-purple-100 text-purple-800',
  TERMINATED: 'bg-red-100 text-red-800',
};

export default function ContractDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContract();
  }, [params.id]);

  async function loadContract() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/contracts/${params.id}`);
      const result = await response.json();

      if (result.success) {
        setContract(result.data);
      } else {
        setError(result.error?.message || '加载合同详情失败');
      }
    } catch (err) {
      console.error('加载合同详情失败:', err);
      setError('加载合同详情失败，请刷新页面重试');
    } finally {
      setLoading(false);
    }
  }

  function getPaymentProgress() {
    if (!contract) return { rate: 0, status: 'UNPAID' };

    const rate =
      contract.totalFee > 0
        ? (contract.paidAmount / contract.totalFee) * 100
        : 0;

    let status: 'UNPAID' | 'PARTIAL' | 'FULL' = 'UNPAID';
    if (contract.paidAmount === 0) {
      status = 'UNPAID';
    } else if (contract.paidAmount >= contract.totalFee) {
      status = 'FULL';
    } else {
      status = 'PARTIAL';
    }

    return { rate, status };
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 p-6'>
        <div className='mx-auto max-w-5xl'>
          <div className='text-center text-gray-500'>加载中...</div>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className='min-h-screen bg-gray-50 p-6'>
        <div className='mx-auto max-w-5xl'>
          <div className='rounded-lg bg-red-50 p-4 text-sm text-red-800'>
            {error || '合同不存在'}
          </div>
        </div>
      </div>
    );
  }

  const paymentProgress = getPaymentProgress();

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-5xl'>
        {/* 页面标题 */}
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold text-gray-900'>
                {contract.contractNumber}
              </h1>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusColors[contract.status]}`}
              >
                {statusLabels[contract.status]}
              </span>
            </div>
            <p className='mt-1 text-sm text-gray-500'>
              创建于 {new Date(contract.createdAt).toLocaleString()}
            </p>
          </div>
          <div className='flex gap-2'>
            <Link
              href={`/contracts/${contract.id}/edit`}
              className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
            >
              编辑
            </Link>
            <button
              onClick={() => router.push('/contracts')}
              className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
            >
              返回列表
            </button>
          </div>
        </div>

        <div className='grid gap-6 lg:grid-cols-3'>
          {/* 左侧主要内容 */}
          <div className='space-y-6 lg:col-span-2'>
            {/* 委托方信息 */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='mb-4 text-lg font-semibold text-gray-900'>
                委托方信息
              </h2>
              <dl className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>类型</dt>
                  <dd className='mt-1 text-sm text-gray-900'>
                    {contract.clientType === 'INDIVIDUAL' ? '个人' : '企业'}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    {contract.clientType === 'INDIVIDUAL' ? '姓名' : '企业名称'}
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900'>
                    {contract.clientName}
                  </dd>
                </div>
                {contract.clientIdNumber && (
                  <div>
                    <dt className='text-sm font-medium text-gray-500'>
                      {contract.clientType === 'INDIVIDUAL'
                        ? '身份证号'
                        : '统一社会信用代码'}
                    </dt>
                    <dd className='mt-1 text-sm text-gray-900'>
                      {contract.clientIdNumber}
                    </dd>
                  </div>
                )}
                {contract.clientContact && (
                  <div>
                    <dt className='text-sm font-medium text-gray-500'>
                      联系方式
                    </dt>
                    <dd className='mt-1 text-sm text-gray-900'>
                      {contract.clientContact}
                    </dd>
                  </div>
                )}
                {contract.clientAddress && (
                  <div className='sm:col-span-2'>
                    <dt className='text-sm font-medium text-gray-500'>地址</dt>
                    <dd className='mt-1 text-sm text-gray-900'>
                      {contract.clientAddress}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* 受托方信息 */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='mb-4 text-lg font-semibold text-gray-900'>
                受托方信息
              </h2>
              <dl className='grid gap-4 sm:grid-cols-2'>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    律所名称
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900'>
                    {contract.lawFirmName}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    承办律师
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900'>
                    {contract.lawyerName}
                  </dd>
                </div>
              </dl>
            </div>

            {/* 委托事项 */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='mb-4 text-lg font-semibold text-gray-900'>
                委托事项
              </h2>
              <dl className='space-y-4'>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    案件类型
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900'>
                    {contract.caseType}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    案情简述
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900 whitespace-pre-wrap'>
                    {contract.caseSummary}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    委托范围
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900 whitespace-pre-wrap'>
                    {contract.scope}
                  </dd>
                </div>
                {contract.specialTerms && (
                  <div>
                    <dt className='text-sm font-medium text-gray-500'>
                      特别约定
                    </dt>
                    <dd className='mt-1 text-sm text-gray-900 whitespace-pre-wrap'>
                      {contract.specialTerms}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* 付款记录 */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <div className='mb-4 flex items-center justify-between'>
                <h2 className='text-lg font-semibold text-gray-900'>
                  付款记录
                </h2>
                <button className='text-sm text-blue-600 hover:text-blue-700'>
                  + 添加付款记录
                </button>
              </div>
              {contract.payments.length === 0 ? (
                <p className='text-sm text-gray-500'>暂无付款记录</p>
              ) : (
                <div className='space-y-3'>
                  {contract.payments.map(payment => (
                    <div
                      key={payment.id}
                      className='flex items-center justify-between rounded-lg border border-gray-200 p-4'
                    >
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium text-gray-900'>
                            {payment.paymentType}
                          </span>
                          <span
                            className={`text-xs ${
                              payment.status === 'PAID'
                                ? 'text-green-600'
                                : payment.status === 'OVERDUE'
                                  ? 'text-red-600'
                                  : 'text-yellow-600'
                            }`}
                          >
                            {payment.status === 'PAID'
                              ? '已付款'
                              : payment.status === 'OVERDUE'
                                ? '已逾期'
                                : '待付款'}
                          </span>
                        </div>
                        <div className='mt-1 text-sm text-gray-500'>
                          {payment.paymentNumber}
                          {payment.paidAt &&
                            ` · ${new Date(payment.paidAt).toLocaleDateString()}`}
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='font-semibold text-gray-900'>
                          ¥{payment.amount.toLocaleString()}
                        </div>
                        {payment.paymentMethod && (
                          <div className='text-xs text-gray-500'>
                            {payment.paymentMethod}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 右侧边栏 */}
          <div className='space-y-6'>
            {/* 收费信息 */}
            <div className='rounded-lg bg-white p-6 shadow'>
              <h2 className='mb-4 text-lg font-semibold text-gray-900'>
                收费信息
              </h2>
              <dl className='space-y-3'>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    收费方式
                  </dt>
                  <dd className='mt-1 text-sm text-gray-900'>
                    {contract.feeType === 'FIXED'
                      ? '固定收费'
                      : contract.feeType === 'RISK'
                        ? '风险代理'
                        : contract.feeType === 'HOURLY'
                          ? '计时收费'
                          : '混合收费'}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    律师费总额
                  </dt>
                  <dd className='mt-1 text-lg font-semibold text-gray-900'>
                    ¥{contract.totalFee.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    已付金额
                  </dt>
                  <dd className='mt-1 text-lg font-semibold text-green-600'>
                    ¥{contract.paidAmount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className='text-sm font-medium text-gray-500'>
                    未付金额
                  </dt>
                  <dd className='mt-1 text-lg font-semibold text-red-600'>
                    ¥
                    {(contract.totalFee - contract.paidAmount).toLocaleString()}
                  </dd>
                </div>
              </dl>

              {/* 付款进度条 */}
              <div className='mt-4'>
                <div className='mb-1 flex items-center justify-between text-sm'>
                  <span className='text-gray-500'>付款进度</span>
                  <span className='font-medium text-gray-900'>
                    {paymentProgress.rate.toFixed(1)}%
                  </span>
                </div>
                <div className='h-2 w-full overflow-hidden rounded-full bg-gray-200'>
                  <div
                    className={`h-full transition-all ${
                      paymentProgress.status === 'FULL'
                        ? 'bg-green-500'
                        : paymentProgress.status === 'PARTIAL'
                          ? 'bg-yellow-500'
                          : 'bg-gray-300'
                    }`}
                    style={{ width: `${Math.min(paymentProgress.rate, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* 签署信息 */}
            {contract.signedAt && (
              <div className='rounded-lg bg-white p-6 shadow'>
                <h2 className='mb-4 text-lg font-semibold text-gray-900'>
                  签署信息
                </h2>
                <dl className='space-y-3'>
                  <div>
                    <dt className='text-sm font-medium text-gray-500'>
                      签署日期
                    </dt>
                    <dd className='mt-1 text-sm text-gray-900'>
                      {new Date(contract.signedAt).toLocaleString()}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
