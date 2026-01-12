/**
 * CompressionPreview - 记忆压缩预览主组件
 * 提供记忆压缩预览功能，支持输入content或memoryId进行压缩预览
 */

'use client';

import { useState } from 'react';

import { CompressionMetrics } from './compression-metrics';
import { CompressionComparison } from './compression-comparison';
import { useCompressionPreview } from './use-compression-preview';

export interface CompressionPreviewProps {
  initialContent?: string;
  initialMemoryId?: string;
}

/**
 * 记忆压缩预览组件
 */
export function CompressionPreview(props: CompressionPreviewProps) {
  const { initialContent, initialMemoryId } = props;
  const [inputMode, setInputMode] = useState<'content' | 'memoryId'>(
    initialContent ? 'content' : initialMemoryId ? 'memoryId' : 'content'
  );
  const [content, setContent] = useState(initialContent || '');
  const [memoryId, setMemoryId] = useState(initialMemoryId || '');
  const [importance, setImportance] = useState(0.8);

  const { preview, loading, error, handlePreview } = useCompressionPreview();

  /**
   * 处理预览按钮点击
   */
  const onPreview = async () => {
    if (inputMode === 'content') {
      await handlePreview({ content, importance });
    } else {
      await handlePreview({ memoryId, importance });
    }
  };

  return (
    <div className='compression-preview'>
      <div className='container mx-auto p-4 max-w-6xl'>
        <h1 className='text-3xl font-bold mb-6'>记忆压缩预览</h1>

        {/* 输入模式选择 */}
        <div className='mb-4'>
          <div className='flex gap-4'>
            <button
              type='button'
              className={`px-4 py-2 rounded ${
                inputMode === 'content'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
              onClick={() => setInputMode('content')}
            >
              输入内容
            </button>
            <button
              type='button'
              className={`px-4 py-2 rounded ${
                inputMode === 'memoryId'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200'
              }`}
              onClick={() => setInputMode('memoryId')}
            >
              使用记忆ID
            </button>
          </div>
        </div>

        {/* 输入表单 */}
        <div className='mb-4'>
          {inputMode === 'content' ? (
            <div>
              <label htmlFor='content' className='block mb-2 font-medium'>
                记忆内容
              </label>
              <textarea
                id='content'
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={10}
                className='w-full p-2 border rounded'
                placeholder='请输入要压缩预览的记忆内容'
              />
            </div>
          ) : (
            <div>
              <label htmlFor='memoryId' className='block mb-2 font-medium'>
                记忆ID
              </label>
              <input
                id='memoryId'
                type='text'
                value={memoryId}
                onChange={e => setMemoryId(e.target.value)}
                className='w-full p-2 border rounded'
                placeholder='请输入记忆ID'
              />
            </div>
          )}
        </div>

        {/* 重要性滑块 */}
        <div className='mb-4'>
          <label htmlFor='importance' className='block mb-2 font-medium'>
            重要性: {importance.toFixed(2)}
          </label>
          <input
            id='importance'
            type='range'
            min='0'
            max='1'
            step='0.1'
            value={importance}
            onChange={e => setImportance(parseFloat(e.target.value))}
            className='w-full'
          />
        </div>

        {/* 预览按钮 */}
        <button
          type='button'
          onClick={onPreview}
          disabled={loading}
          className='w-full bg-blue-500 text-white py-2 rounded hover:bg-blue-600 disabled:bg-gray-400'
        >
          {loading ? '压缩中...' : '预览压缩效果'}
        </button>

        {/* 错误提示 */}
        {error && (
          <div className='mt-4 p-4 bg-red-100 text-red-700 rounded'>
            {error}
          </div>
        )}

        {/* 预览结果 */}
        {preview && (
          <div className='mt-6'>
            <CompressionMetrics metrics={preview.metrics} />
            <CompressionComparison
              original={preview.original}
              compressed={preview.compressed}
            />
          </div>
        )}
      </div>
    </div>
  );
}
