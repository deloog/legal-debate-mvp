/**
 * 创建合同页面
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FeeType } from '@/types/contract';

const CASE_TYPE_OPTIONS = [
  '劳动争议',
  '合同纠纷',
  '婚姻家庭',
  '交通事故',
  '房产纠纷',
  '知识产权',
  '刑事辩护',
  '行政诉讼',
  '公司法务',
  '其他',
];

export default function NewContractPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    clientType: 'INDIVIDUAL',
    clientName: '',
    clientPhone: '',
    clientIdNumber: '',
    clientAddress: '',
    lawFirmName: '律伴律师事务所',
    lawyerName: '',
    caseType: '',
    caseSummary: '',
    scope: '代理一审诉讼',
    feeType: FeeType.FIXED,
    totalFee: 0,
    specialTerms: '',
    payments: [{ paymentType: '首付款', amount: 0 }],
  });

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
      const payload = {
        clientType:
          formData.clientType === '个人'
            ? 'INDIVIDUAL'
            : formData.clientType === '企业'
              ? 'ENTERPRISE'
              : formData.clientType,
        clientName: formData.clientName,
        clientIdNumber: formData.clientIdNumber || undefined,
        clientAddress: formData.clientAddress || undefined,
        clientContact: formData.clientPhone || undefined,
        lawFirmName: formData.lawFirmName || '律伴律师事务所',
        lawyerName: formData.lawyerName || '承办律师',
        caseType: formData.caseType || '其他',
        caseSummary: formData.caseSummary || '待补充',
        scope: formData.scope || '代理一审诉讼',
        feeType: formData.feeType,
        totalFee: formData.totalFee,
        specialTerms: formData.specialTerms || undefined,
        payments: formData.payments,
      };

      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        router.push(`/contracts/${result.data.id}`);
      } else {
        setError(result.error?.message || '创建合同失败');
      }
    } catch (_err) {
      setError('创建合同失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='mx-auto max-w-4xl'>
        <div className='mb-6'>
          <h1 className='text-2xl font-bold text-gray-900'>新建合同</h1>
          <p className='mt-1 text-sm text-gray-500'>填写委托合同信息</p>
        </div>

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
                <select
                  name='clientType'
                  value={
                    formData.clientType === 'INDIVIDUAL'
                      ? '个人'
                      : formData.clientType === 'ENTERPRISE'
                        ? '企业'
                        : formData.clientType
                  }
                  onChange={e => {
                    const val =
                      e.target.value === '个人'
                        ? 'INDIVIDUAL'
                        : e.target.value === '企业'
                          ? 'ENTERPRISE'
                          : e.target.value;
                    handleChange('clientType', val);
                  }}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                >
                  <option value='个人'>个人</option>
                  <option value='企业'>企业</option>
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  {formData.clientType === 'INDIVIDUAL' ? '姓名' : '企业名称'}{' '}
                  <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  name='clientName'
                  value={formData.clientName}
                  onChange={e => handleChange('clientName', e.target.value)}
                  required
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  手机号码
                </label>
                <input
                  type='text'
                  name='clientPhone'
                  value={formData.clientPhone}
                  onChange={e => handleChange('clientPhone', e.target.value)}
                  placeholder='请输入手机号码'
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
                  律所名称
                </label>
                <input
                  type='text'
                  value={formData.lawFirmName}
                  onChange={e => handleChange('lawFirmName', e.target.value)}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  承办律师
                </label>
                <input
                  type='text'
                  value={formData.lawyerName}
                  onChange={e => handleChange('lawyerName', e.target.value)}
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
                <select
                  name='caseType'
                  value={formData.caseType}
                  onChange={e => handleChange('caseType', e.target.value)}
                  required
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                >
                  <option value=''>请选择案件类型</option>
                  {CASE_TYPE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  案情简述
                </label>
                <textarea
                  name='caseSummary'
                  value={formData.caseSummary}
                  onChange={e => handleChange('caseSummary', e.target.value)}
                  rows={4}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'
                />
              </div>

              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  委托范围
                </label>
                <textarea
                  value={formData.scope}
                  onChange={e => handleChange('scope', e.target.value)}
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
                  收费方式
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
                  律师费总额（元）
                </label>
                <input
                  type='number'
                  name='totalFee'
                  value={formData.totalFee}
                  onChange={e =>
                    handleChange('totalFee', parseFloat(e.target.value) || 0)
                  }
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
              {loading ? '创建中...' : '创建合同'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
