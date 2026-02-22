/**
 * 编辑合同页面
 */
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FeeType } from '@/types/contract';

interface EditContractPageProps {
  params: {
    id: string;
  };
}

export default function EditContractPage({ params }: EditContractPageProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 表单数据
  const [formData, setFormData] = useState({
    // 委托方信息
    clientType: 'INDIVIDUAL',
    clientName: '',
    clientIdNumber: '',
    clientAddress: '',
    clientContact: '',

    // 受托方信息
    lawFirmName: '律伴律师事务所',
    lawyerName: '',
    lawyerId: 'default-lawyer-id',

    // 委托事项
    caseType: '',
    caseSummary: '',
    scope: '',

    // 收费信息
    feeType: FeeType.FIXED,
    totalFee: 0,
    specialTerms: '',

    // 付款计划
    payments: [{ paymentType: '首付款', amount: 0 }],
  });

  // 加载现有合同数据
  useEffect(() => {
    async function loadContract() {
      try {
        const response = await fetch(`/api/contracts/${params.id}`);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: 加载合同数据失败`);
        }

        const result = await response.json();

        if (result.success) {
          const contract = result.data;
          setFormData({
            clientType: contract.clientType || 'INDIVIDUAL',
            clientName: contract.clientName || '',
            clientIdNumber: contract.clientIdNumber || '',
            clientAddress: contract.clientAddress || '',
            clientContact: contract.clientContact || '',
            lawFirmName: contract.lawFirmName || '律伴律师事务所',
            lawyerName: contract.lawyerName || '',
            lawyerId: contract.lawyerId || 'default-lawyer-id',
            caseType: contract.caseType || '',
            caseSummary: contract.caseSummary || '',
            scope: contract.scope || '',
            feeType: contract.feeType || FeeType.FIXED,
            totalFee: parseFloat(contract.totalFee) || 0,
            specialTerms: contract.specialTerms || '',
            payments:
              contract.payments?.length > 0
                ? contract.payments.map((p: { paymentType?: string; amount?: number }) => ({
                    paymentType: p.paymentType || '',
                    amount: parseFloat(p.amount) || 0,
                  }))
                : [{ paymentType: '首付款', amount: 0 }],
          });
        } else {
          setError('加载合同数据失败');
        }
      } catch (err) {
        console.error('加载合同数据失败:', err);
        setError('加载合同数据失败，请重试');
      } finally {
        setLoadingData(false);
      }
    }

    loadContract();
  }, [params.id]);

  function handleChange(field: string, value: unknown) {
    setFormData(prev => ({ ...prev, [field]: value }));
  }

  function addPayment() {
    setFormData(prev => ({
      ...prev,
      payments: [...prev.payments, { paymentType: '中期款', amount: 0 }],
    }));
  }

  function removePayment(index: number) {
    setFormData(prev => ({
      ...prev,
      payments: prev.payments.filter((_, i) => i !== index),
    }));
  }

  function updatePayment(index: number, field: string, value: unknown) {
    setFormData(prev => ({
      ...prev,
      payments: prev.payments.map((p, i) =>
        i === index ? { ...p, [field]: value } : p
      ),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/contracts/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/contracts/${params.id}`);
      } else {
        setError(result.error?.message || '更新合同失败');
      }
    } catch (err) {
      console.error('更新合同失败:', err);
      setError('更新合同失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
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

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-4xl'>
        {/* 页面标题 */}
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>编辑合同</h1>
          <p className='mt-1 text-sm text-gray-500'>修改委托合同信息</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className='mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800'>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className='space-y-6'>
          {/* 委托方信息 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900'>
              委托方信息
            </h2>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  委托人类型 <span className='text-red-500'>*</span>
                </label>
                <div className='flex gap-4'>
                  <label className='flex items-center'>
                    <input
                      type='radio'
                      value='INDIVIDUAL'
                      checked={formData.clientType === 'INDIVIDUAL'}
                      onChange={e => handleChange('clientType', e.target.value)}
                      className='mr-2'
                    />
                    个人
                  </label>
                  <label className='flex items-center'>
                    <input
                      type='radio'
                      value='ENTERPRISE'
                      checked={formData.clientType === 'ENTERPRISE'}
                      onChange={e => handleChange('clientType', e.target.value)}
                      className='mr-2'
                    />
                    企业
                  </label>
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  {formData.clientType === 'INDIVIDUAL' ? '姓名' : '企业名称'}{' '}
                  <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.clientName}
                  onChange={e => handleChange('clientName', e.target.value)}
                  required
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  {formData.clientType === 'INDIVIDUAL'
                    ? '身份证号'
                    : '统一社会信用代码'}
                </label>
                <input
                  type='text'
                  value={formData.clientIdNumber}
                  onChange={e => handleChange('clientIdNumber', e.target.value)}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  联系方式
                </label>
                <input
                  type='text'
                  value={formData.clientContact}
                  onChange={e => handleChange('clientContact', e.target.value)}
                  placeholder='电话/邮箱'
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  地址
                </label>
                <input
                  type='text'
                  value={formData.clientAddress}
                  onChange={e => handleChange('clientAddress', e.target.value)}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>

          {/* 受托方信息 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900'>
              受托方信息
            </h2>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  律所名称 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.lawFirmName}
                  onChange={e => handleChange('lawFirmName', e.target.value)}
                  required
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  承办律师 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.lawyerName}
                  onChange={e => handleChange('lawyerName', e.target.value)}
                  required
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>

          {/* 委托事项 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900'>
              委托事项
            </h2>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  案件类型 <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.caseType}
                  onChange={e => handleChange('caseType', e.target.value)}
                  required
                  placeholder='如：劳动争议、合同纠纷等'
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  案情简述 <span className='text-red-500'>*</span>
                </label>
                <textarea
                  value={formData.caseSummary}
                  onChange={e => handleChange('caseSummary', e.target.value)}
                  required
                  rows={4}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  委托范围 <span className='text-red-500'>*</span>
                </label>
                <textarea
                  value={formData.scope}
                  onChange={e => handleChange('scope', e.target.value)}
                  required
                  rows={3}
                  placeholder='如：代理一审、代理二审、代理执行等'
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>

          {/* 收费约定 */}
          <div className='rounded-lg bg-white p-6 shadow'>
            <h2 className='mb-4 text-lg font-semibold text-gray-900'>
              收费约定
            </h2>
            <div className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  收费方式 <span className='text-red-500'>*</span>
                </label>
                <select
                  value={formData.feeType}
                  onChange={e => handleChange('feeType', e.target.value)}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                >
                  <option value={FeeType.FIXED}>固定收费</option>
                  <option value={FeeType.RISK}>风险代理</option>
                  <option value={FeeType.HOURLY}>计时收费</option>
                  <option value={FeeType.MIXED}>混合收费</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  律师费总额（元） <span className='text-red-500'>*</span>
                </label>
                <input
                  type='number'
                  value={formData.totalFee}
                  onChange={e =>
                    handleChange('totalFee', parseFloat(e.target.value) || 0)
                  }
                  required
                  min='0'
                  step='0.01'
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              {/* 付款计划 */}
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <label className='block text-sm font-medium text-gray-700'>
                    付款计划
                  </label>
                  <button
                    type='button'
                    onClick={addPayment}
                    className='text-sm text-blue-600 hover:text-blue-700'
                  >
                    + 添加付款期
                  </button>
                </div>
                <div className='space-y-2'>
                  {formData.payments.map((payment, index) => (
                    <div key={index} className='flex gap-2'>
                      <input
                        type='text'
                        value={payment.paymentType}
                        onChange={e =>
                          updatePayment(index, 'paymentType', e.target.value)
                        }
                        placeholder='付款类型'
                        className='flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                      />
                      <input
                        type='number'
                        value={payment.amount}
                        onChange={e =>
                          updatePayment(
                            index,
                            'amount',
                            parseFloat(e.target.value) || 0
                          )
                        }
                        placeholder='金额'
                        min='0'
                        step='0.01'
                        className='w-32 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                      />
                      {formData.payments.length > 1 && (
                        <button
                          type='button'
                          onClick={() => removePayment(index)}
                          className='text-red-600 hover:text-red-700'
                        >
                          删除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  特别约定
                </label>
                <textarea
                  value={formData.specialTerms}
                  onChange={e => handleChange('specialTerms', e.target.value)}
                  rows={3}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className='flex justify-end gap-4'>
            <button
              type='button'
              onClick={() => router.back()}
              className='rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
            >
              取消
            </button>
            <button
              type='submit'
              disabled={loading}
              className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50'
            >
              {loading ? '保存中...' : '保存修改'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
