'use client';

import { useCallback, useState } from 'react';

interface DebateCreateFormProps {
  caseId: string;
  caseTitle: string;
  onSuccess?: (debateId: string) => void;
  onError?: (error: string) => void;
}

interface DebateConfig {
  maxRounds: number;
  debateMode: 'standard' | 'fast' | 'detailed';
  aiProvider: 'zhipu' | 'deepseek';
  enableReview: boolean;
}

export function DebateCreateForm({
  caseId,
  caseTitle,
  onSuccess,
  onError,
}: DebateCreateFormProps) {
  const [title, setTitle] = useState('');
  const [config, setConfig] = useState<DebateConfig>({
    maxRounds: 3,
    debateMode: 'standard',
    aiProvider: 'deepseek',
    enableReview: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = '请输入辩论标题';
    } else if (title.length < 5) {
      newErrors.title = '标题至少5个字符';
    } else if (title.length > 100) {
      newErrors.title = '标题最多100个字符';
    }

    if (config.maxRounds < 1 || config.maxRounds > 10) {
      newErrors.maxRounds = '轮次数量必须在1-10之间';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, config]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      setIsLoading(true);
      setErrors({});

      try {
        const response = await fetch('/api/v1/debates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            caseId,
            title: title.trim(),
            config: {
              maxRounds: config.maxRounds,
              debateMode: config.debateMode,
              aiProvider: config.aiProvider,
              enableReview: config.enableReview,
            },
            status: 'DRAFT',
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || '创建辩论失败');
        }

        setTitle('');
        onSuccess?.(data.id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '创建辩论失败';
        setErrors({ submit: errorMessage });
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [caseId, title, config, validateForm, onSuccess, onError]
  );

  return (
    <div className='bg-white rounded-lg shadow-md p-6'>
      <h2 className='text-xl font-semibold mb-4'>创建辩论</h2>
      <p className='text-gray-600 mb-4'>
        案件: <span className='font-medium'>{caseTitle}</span>
      </p>

      <form onSubmit={handleSubmit} className='space-y-4'>
        {/* 辩论标题 */}
        <div>
          <label
            htmlFor='title'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            辩论标题 *
          </label>
          <input
            type='text'
            id='title'
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder='输入辩论标题'
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.title ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={isLoading}
          />
          {errors.title && (
            <p className='text-red-500 text-sm mt-1'>{errors.title}</p>
          )}
        </div>

        {/* 轮次数量 */}
        <div>
          <label
            htmlFor='maxRounds'
            className='block text-sm font-medium text-gray-700 mb-1'
          >
            辩论轮次
          </label>
          <select
            id='maxRounds'
            value={config.maxRounds}
            onChange={e =>
              setConfig(prev => ({
                ...prev,
                maxRounds: parseInt(e.target.value, 10),
              }))
            }
            className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
            disabled={isLoading}
          >
            <option value={1}>1轮</option>
            <option value={2}>2轮</option>
            <option value={3}>3轮</option>
            <option value={4}>4轮</option>
            <option value={5}>5轮</option>
          </select>
          {errors.maxRounds && (
            <p className='text-red-500 text-sm mt-1'>{errors.maxRounds}</p>
          )}
        </div>

        {/* 辩论模式 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            辩论模式
          </label>
          <div className='grid grid-cols-3 gap-3'>
            <label
              className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                config.debateMode === 'standard'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type='radio'
                name='debateMode'
                value='standard'
                checked={config.debateMode === 'standard'}
                onChange={() =>
                  setConfig(prev => ({ ...prev, debateMode: 'standard' }))
                }
                className='sr-only'
                disabled={isLoading}
              />
              <span className='font-medium'>标准模式</span>
            </label>
            <label
              className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                config.debateMode === 'fast'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type='radio'
                name='debateMode'
                value='fast'
                checked={config.debateMode === 'fast'}
                onChange={() =>
                  setConfig(prev => ({ ...prev, debateMode: 'fast' }))
                }
                className='sr-only'
                disabled={isLoading}
              />
              <span className='font-medium'>快速模式</span>
            </label>
            <label
              className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                config.debateMode === 'detailed'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type='radio'
                name='debateMode'
                value='detailed'
                checked={config.debateMode === 'detailed'}
                onChange={() =>
                  setConfig(prev => ({ ...prev, debateMode: 'detailed' }))
                }
                className='sr-only'
                disabled={isLoading}
              />
              <span className='font-medium'>详细模式</span>
            </label>
          </div>
          <p className='text-gray-500 text-sm mt-1'>
            {config.debateMode === 'standard' && '标准辩论模式，平衡深度和速度'}
            {config.debateMode === 'fast' && '快速辩论模式，减少轮次和时间'}
            {config.debateMode === 'detailed' &&
              '详细辩论模式，更多轮次和深入分析'}
          </p>
        </div>

        {/* AI提供商 */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>
            AI服务提供商
          </label>
          <div className='grid grid-cols-2 gap-3'>
            <label
              className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                config.aiProvider === 'deepseek'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type='radio'
                name='aiProvider'
                value='deepseek'
                checked={config.aiProvider === 'deepseek'}
                onChange={() =>
                  setConfig(prev => ({ ...prev, aiProvider: 'deepseek' }))
                }
                className='sr-only'
                disabled={isLoading}
              />
              <span className='font-medium'>DeepSeek</span>
            </label>
            <label
              className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                config.aiProvider === 'zhipu'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type='radio'
                name='aiProvider'
                value='zhipu'
                checked={config.aiProvider === 'zhipu'}
                onChange={() =>
                  setConfig(prev => ({ ...prev, aiProvider: 'zhipu' }))
                }
                className='sr-only'
                disabled={isLoading}
              />
              <span className='font-medium'>智谱AI</span>
            </label>
          </div>
        </div>

        {/* AI审查开关 */}
        <div className='flex items-center justify-between p-3 border border-gray-200 rounded-lg'>
          <div>
            <h4 className='font-medium text-gray-700'>AI审查</h4>
            <p className='text-sm text-gray-500'>对生成的论点进行质量审查</p>
          </div>
          <label className='relative inline-flex items-center cursor-pointer'>
            <input
              type='checkbox'
              checked={config.enableReview}
              onChange={e =>
                setConfig(prev => ({
                  ...prev,
                  enableReview: e.target.checked,
                }))
              }
              className='sr-only peer'
              disabled={isLoading}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>

        {/* 提交错误 */}
        {errors.submit && (
          <div className='p-3 bg-red-50 border border-red-200 rounded-lg'>
            <p className='text-red-600 text-sm'>{errors.submit}</p>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          type='submit'
          disabled={isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
            isLoading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isLoading ? (
            <span className='flex items-center justify-center gap-2'>
              <svg
                className='animate-spin h-5 w-5'
                fill='none'
                viewBox='0 0 24 24'
              >
                <circle
                  className='opacity-25'
                  cx='12'
                  cy='12'
                  r='10'
                  stroke='currentColor'
                  strokeWidth='4'
                />
                <path
                  className='opacity-75'
                  fill='currentColor'
                  d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                />
              </svg>
              创建中...
            </span>
          ) : (
            '创建辩论'
          )}
        </button>
      </form>
    </div>
  );
}
