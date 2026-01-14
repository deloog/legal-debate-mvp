'use client';

import { useState } from 'react';

interface LawArticleImportDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * 法条导入对话框组件
 */
export function LawArticleImportDialog({
  open,
  onClose,
  onSuccess,
}: LawArticleImportDialogProps): React.ReactElement {
  const [jsonText, setJsonText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSuccess(false);

    try {
      const parsedJson = JSON.parse(jsonText);

      const response = await fetch('/api/admin/law-articles/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsedJson),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '导入法条失败');
      }

      const result = await response.json();
      setSuccess(true);

      if (result.data.failed > 0) {
        alert(
          `导入完成：成功 ${result.data.success} 条，失败 ${result.data.failed} 条`
        );
      } else {
        alert(`成功导入 ${result.data.success} 条法条`);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return <></>;
  }

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-4'>
          <h2 className='text-xl font-bold'>导入法条</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600'
            disabled={loading}
          >
            <svg
              className='h-6 w-6'
              fill='none'
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth='2'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path d='M6 18L18 6M6 6l12 12'></path>
            </svg>
          </button>
        </div>

        {error && (
          <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4'>
            {error}
          </div>
        )}

        {success && (
          <div className='bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4'>
            导入成功
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className='mb-4'>
            <label
              htmlFor='jsonInput'
              className='block text-sm font-medium text-gray-700 mb-2'
            >
              JSON数据
            </label>
            <textarea
              id='jsonInput'
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              className='w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm'
              placeholder='请输入JSON格式的法条数据...'
              required
            />
            <p className='text-xs text-gray-500 mt-1'>
              JSON格式示例：
              {`{"articles": [{"lawName":"中华人民共和国民法典","articleNumber":"第一条","fullText":"...","lawType":"CIVIL","category":"CIVIL_GENERAL","effectiveDate":"2021-01-01"}]}`}
            </p>
          </div>

          <div className='flex justify-end space-x-3'>
            <button
              type='button'
              onClick={onClose}
              disabled={loading}
              className='px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              取消
            </button>
            <button
              type='submit'
              disabled={loading || !jsonText.trim()}
              className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              {loading ? '导入中...' : '导入'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
