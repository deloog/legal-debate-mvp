'use client';

import { useState, FormEvent } from 'react';
import { X, Info, AlertTriangle, XCircle } from 'lucide-react';

type RemoveReasonType = 'NOT_RELEVANT' | 'REPEALED' | 'OTHER';

interface RemoveReasonModalProps {
  isOpen: boolean;
  articleName: string;
  articleNumber: string;
  onConfirm: (reason: RemoveReasonType, detail?: string) => void;
  onCancel: () => void;
}

/**
 * 移除原因弹窗组件
 * 功能：收集律师移除法条的原因
 */
export function RemoveReasonModal({
  isOpen,
  articleName,
  articleNumber,
  onConfirm,
  onCancel,
}: RemoveReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<RemoveReasonType | null>(
    null
  );
  const [otherReason, setOtherReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedReason) {
      return;
    }

    if (selectedReason === 'OTHER' && !otherReason.trim()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onConfirm(
        selectedReason,
        selectedReason === 'OTHER' ? otherReason : undefined
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedReason(null);
    setOtherReason('');
    onCancel();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center'>
      <div className='fixed inset-0 bg-black/50' onClick={handleCancel} />

      <div className='relative mx-4 max-w-md w-full rounded-xl bg-white shadow-2xl dark:bg-zinc-900'>
        {/* 标题栏 */}
        <div className='border-b border-zinc-200 px-6 py-4 dark:border-zinc-700'>
          <div className='flex items-center justify-between'>
            <div>
              <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                确认移除法条
              </h2>
              <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
                {articleName} - {articleNumber}
              </p>
            </div>
            <button
              onClick={handleCancel}
              className='rounded p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
            >
              <X className='h-5 w-5' />
            </button>
          </div>
        </div>

        {/* 表单内容 */}
        <form onSubmit={handleSubmit} className='px-6 py-4'>
          <div className='space-y-4'>
            {/* 移除原因选择 */}
            <div>
              <label className='mb-3 block text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                请选择移除原因：
              </label>
              <div className='space-y-2'>
                {/* 选项1：不相关 */}
                <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'>
                  <input
                    type='radio'
                    name='removeReason'
                    value='NOT_RELEVANT'
                    checked={selectedReason === 'NOT_RELEVANT'}
                    onChange={e =>
                      setSelectedReason(e.target.value as RemoveReasonType)
                    }
                    className='mt-0.5 h-4 w-4'
                  />
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <AlertTriangle className='h-4 w-4 text-amber-500' />
                      <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                        不相关
                      </span>
                    </div>
                    <p className='mt-1 text-xs text-zinc-600 dark:text-zinc-400'>
                      法条与本案案情无关
                    </p>
                  </div>
                </label>

                {/* 选项2：已废止 */}
                <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'>
                  <input
                    type='radio'
                    name='removeReason'
                    value='REPEALED'
                    checked={selectedReason === 'REPEALED'}
                    onChange={e =>
                      setSelectedReason(e.target.value as RemoveReasonType)
                    }
                    className='mt-0.5 h-4 w-4'
                  />
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <Info className='h-4 w-4 text-red-500' />
                      <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                        已废止
                      </span>
                    </div>
                    <p className='mt-1 text-xs text-zinc-600 dark:text-zinc-400'>
                      法条已废止或失效
                    </p>
                  </div>
                </label>

                {/* 选项3：其他 */}
                <label className='flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'>
                  <input
                    type='radio'
                    name='removeReason'
                    value='OTHER'
                    checked={selectedReason === 'OTHER'}
                    onChange={e =>
                      setSelectedReason(e.target.value as RemoveReasonType)
                    }
                    className='mt-0.5 h-4 w-4'
                  />
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      <XCircle className='h-4 w-4 text-zinc-500' />
                      <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                        其他
                      </span>
                    </div>
                    <p className='mt-1 text-xs text-zinc-600 dark:text-zinc-400'>
                      其他原因（需说明）
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* 其他原因输入框 */}
            {selectedReason === 'OTHER' && (
              <div>
                <label
                  htmlFor='otherReason'
                  className='mb-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50'
                >
                  请说明具体原因：
                </label>
                <textarea
                  id='otherReason'
                  value={otherReason}
                  onChange={e => setOtherReason(e.target.value)}
                  placeholder='请详细说明移除该法条的原因...'
                  rows={3}
                  className='w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-blue-500 dark:focus:ring-blue-500/20'
                />
              </div>
            )}
          </div>

          {/* 操作按钮 */}
          <div className='mt-6 flex justify-end gap-3'>
            <button
              type='button'
              onClick={handleCancel}
              disabled={isSubmitting}
              className='rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            >
              取消
            </button>
            <button
              type='submit'
              disabled={!selectedReason || isSubmitting}
              className='rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600'
            >
              {isSubmitting ? '提交中...' : '确认移除'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
