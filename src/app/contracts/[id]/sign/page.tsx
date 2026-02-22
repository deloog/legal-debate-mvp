/**
 * 合同签署页面
 * 支持委托人和律师双方在线签署
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import SignaturePad from '@/components/contract/SignaturePad';

interface SignContractPageProps {
  params: {
    id: string;
  };
}

export default function SignContractPage({ params }: SignContractPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [contract, setContract] = useState<any>(null);
  const [signatureRole, setSignatureRole] = useState<'client' | 'lawyer'>(
    'client'
  );
  const [showSignaturePad, setShowSignaturePad] = useState(false);

  // 加载合同信息
  useEffect(() => {
    loadContract();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function loadContract() {
    try {
      const response = await fetch(`/api/contracts/${params.id}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 加载合同失败`);
      }

      const result = await response.json();

      if (result.success) {
        setContract(result.data);
      } else {
        setError('加载合同失败');
      }
    } catch (err) {
      console.error('加载合同失败:', err);
      setError('加载合同失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  // 提交签名
  async function handleSignature(signature: string) {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/contracts/${params.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: signatureRole,
          signature,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: 签名失败`);
      }

      const result = await response.json();

      if (result.success) {
        alert('签名成功！');
        setShowSignaturePad(false);
        loadContract(); // 重新加载合同信息
      } else {
        setError(result.error?.message || '签名失败');
      }
    } catch (err) {
      console.error('签名失败:', err);
      setError('签名失败，请重试');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 p-6'>
        <div className='mx-auto max-w-4xl'>
          <div className='text-center py-12'>
            <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent'></div>
            <p className='mt-4 text-gray-600'>加载中...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className='min-h-screen bg-gray-50 p-6'>
        <div className='mx-auto max-w-4xl'>
          <div className='rounded-lg bg-red-50 p-6 text-center'>
            <p className='text-red-800'>合同不存在</p>
          </div>
        </div>
      </div>
    );
  }

  const isClientSigned = !!contract.clientSignature;
  const isLawyerSigned = !!contract.lawyerSignature;
  const isFullySigned = isClientSigned && isLawyerSigned;

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-4xl'>
        {/* 页面标题 */}
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>合同签署</h1>
          <p className='mt-1 text-sm text-gray-500'>
            合同编号：{contract.contractNumber}
          </p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className='mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800'>
            {error}
          </div>
        )}

        {/* 合同信息预览 */}
        <div className='mb-6 rounded-lg bg-white p-6 shadow'>
          <h2 className='mb-4 text-lg font-semibold text-gray-900'>合同信息</h2>
          <div className='space-y-3 text-sm'>
            <div className='flex'>
              <span className='w-24 text-gray-600'>委托人：</span>
              <span className='flex-1 text-gray-900'>
                {contract.clientName}
              </span>
            </div>
            <div className='flex'>
              <span className='w-24 text-gray-600'>案件类型：</span>
              <span className='flex-1 text-gray-900'>{contract.caseType}</span>
            </div>
            <div className='flex'>
              <span className='w-24 text-gray-600'>律师费用：</span>
              <span className='flex-1 text-gray-900'>
                ¥{contract.totalFee.toFixed(2)}
              </span>
            </div>
            <div className='flex'>
              <span className='w-24 text-gray-600'>承办律师：</span>
              <span className='flex-1 text-gray-900'>
                {contract.lawyerName}
              </span>
            </div>
          </div>
        </div>

        {/* 签名状态 */}
        <div className='mb-6 rounded-lg bg-white p-6 shadow'>
          <h2 className='mb-4 text-lg font-semibold text-gray-900'>签署状态</h2>

          <div className='space-y-4'>
            {/* 委托人签名状态 */}
            <div className='flex items-center justify-between rounded-lg border border-gray-200 p-4'>
              <div className='flex items-center gap-3'>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${isClientSigned ? 'bg-green-100' : 'bg-gray-100'}`}
                >
                  {isClientSigned ? (
                    <svg
                      className='h-6 w-6 text-green-600'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  ) : (
                    <svg
                      className='h-6 w-6 text-gray-400'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 4v16m8-8H4'
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <p className='font-medium text-gray-900'>委托人签名</p>
                  {isClientSigned ? (
                    <p className='text-sm text-gray-500'>
                      已签署于{' '}
                      {new Date(contract.clientSignedAt).toLocaleString(
                        'zh-CN'
                      )}
                    </p>
                  ) : (
                    <p className='text-sm text-gray-500'>待签署</p>
                  )}
                </div>
              </div>
              {isClientSigned ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contract.clientSignature}
                  alt='委托人签名'
                  className='h-16 border border-gray-200 rounded'
                />
              ) : (
                <button
                  onClick={() => {
                    setSignatureRole('client');
                    setShowSignaturePad(true);
                  }}
                  className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
                >
                  立即签署
                </button>
              )}
            </div>

            {/* 律师签名状态 */}
            <div className='flex items-center justify-between rounded-lg border border-gray-200 p-4'>
              <div className='flex items-center gap-3'>
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${isLawyerSigned ? 'bg-green-100' : 'bg-gray-100'}`}
                >
                  {isLawyerSigned ? (
                    <svg
                      className='h-6 w-6 text-green-600'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M5 13l4 4L19 7'
                      />
                    </svg>
                  ) : (
                    <svg
                      className='h-6 w-6 text-gray-400'
                      fill='none'
                      stroke='currentColor'
                      viewBox='0 0 24 24'
                    >
                      <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M12 4v16m8-8H4'
                      />
                    </svg>
                  )}
                </div>
                <div>
                  <p className='font-medium text-gray-900'>律师签名</p>
                  {isLawyerSigned ? (
                    <p className='text-sm text-gray-500'>
                      已签署于{' '}
                      {new Date(contract.lawyerSignedAt).toLocaleString(
                        'zh-CN'
                      )}
                    </p>
                  ) : (
                    <p className='text-sm text-gray-500'>待签署</p>
                  )}
                </div>
              </div>
              {isLawyerSigned ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contract.lawyerSignature}
                  alt='律师签名'
                  className='h-16 border border-gray-200 rounded'
                />
              ) : (
                <button
                  onClick={() => {
                    setSignatureRole('lawyer');
                    setShowSignaturePad(true);
                  }}
                  className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
                >
                  立即签署
                </button>
              )}
            </div>
          </div>

          {/* 完成提示 */}
          {isFullySigned && (
            <div className='mt-4 rounded-lg bg-green-50 p-4'>
              <div className='flex items-center gap-2'>
                <svg
                  className='h-5 w-5 text-green-600'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
                  />
                </svg>
                <p className='font-medium text-green-800'>
                  合同已完成双方签署！
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className='flex justify-end gap-3'>
          <button
            onClick={() => router.push(`/contracts/${params.id}`)}
            className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            返回详情
          </button>
          {isFullySigned && (
            <button
              onClick={() =>
                window.open(`/api/contracts/${params.id}/pdf`, '_blank')
              }
              className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
            >
              下载已签署合同
            </button>
          )}
        </div>

        {/* 签名板对话框 */}
        {showSignaturePad && (
          <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4'>
            <div className='w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl'>
              <h3 className='mb-4 text-lg font-semibold text-gray-900'>
                {signatureRole === 'client' ? '委托人签名' : '律师签名'}
              </h3>

              {submitting ? (
                <div className='py-12 text-center'>
                  <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent'></div>
                  <p className='mt-4 text-gray-600'>提交中...</p>
                </div>
              ) : (
                <SignaturePad
                  onSave={handleSignature}
                  onCancel={() => setShowSignaturePad(false)}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
