/**
 * 证词查看器组件
 * 用于查看和编辑证人证词
 */

'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  type WitnessDetail,
  type WitnessStatus,
  WITNESS_STATUS_LABELS,
} from '@/types/witness';

/**
 * 证词查看器组件属性
 */
interface TestimonyViewerProps {
  witness: WitnessDetail;
  onClose: () => void;
  canEdit: boolean;
}

/**
 * 编辑状态类型
 */
interface EditState {
  isEditing: boolean;
  testimony: string;
}

export function TestimonyViewer({
  witness,
  onClose,
  canEdit,
}: TestimonyViewerProps) {
  const [editState, setEditState] = useState<EditState>({
    isEditing: false,
    testimony: witness.testimony || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 开始编辑
  const handleStartEdit = useCallback((): void => {
    setEditState({
      isEditing: true,
      testimony: witness.testimony || '',
    });
  }, [witness.testimony]);

  // 取消编辑
  const handleCancelEdit = useCallback((): void => {
    setEditState({
      isEditing: false,
      testimony: witness.testimony || '',
    });
  }, [witness.testimony]);

  // 保存证词
  const handleSaveTestimony = useCallback(async (): Promise<void> => {
    if (!canEdit) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/witnesses/${witness.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          testimony: editState.testimony.trim() || null,
        }),
      });

      if (!response.ok) {
        throw new Error('更新证词失败');
      }

      setEditState({
        isEditing: false,
        testimony: editState.testimony.trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '更新失败';
      console.error('更新证词失败:', err);
      alert(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [witness.id, editState.testimony, canEdit]);

  // 证词变更处理
  const handleTestimonyChange = useCallback((value: string): void => {
    setEditState(prev => ({
      ...prev,
      testimony: value,
    }));
  }, []);

  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className='max-w-4xl mx-auto'>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle className='text-xl'>{witness.name} - 证词</CardTitle>
            <p className='text-sm text-gray-600 mt-1'>证人ID: {witness.id}</p>
          </div>
          <div className='flex gap-2'>
            {canEdit && editState.isEditing ? (
              <>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
                <Button
                  size='sm'
                  onClick={handleSaveTestimony}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '保存中...' : '保存'}
                </Button>
              </>
            ) : canEdit ? (
              <Button variant='outline' size='sm' onClick={handleStartEdit}>
                编辑证词
              </Button>
            ) : null}
            <Button variant='outline' size='sm' onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className='space-y-6'>
        {/* 证人基本信息 */}
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg'>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-1'>
              联系电话
            </label>
            <p className='text-sm text-gray-900'>{witness.phone || '未提供'}</p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-1'>
              联系地址
            </label>
            <p className='text-sm text-gray-900'>
              {witness.address || '未提供'}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-1'>
              与当事人关系
            </label>
            <p className='text-sm text-gray-900'>
              {witness.relationship || '未提供'}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-1'>
              证人状态
            </label>
            <span
              className={`inline-flex px-2 py-1 text-xs rounded-full ${
                witness.status === 'CONFIRMED'
                  ? 'bg-green-100 text-green-800'
                  : witness.status === 'DECLINED'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {WITNESS_STATUS_LABELS[witness.status as WitnessStatus]}
            </span>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-1'>
              创建时间
            </label>
            <p className='text-sm text-gray-900'>
              {formatDate(witness.createdAt)}
            </p>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-600 mb-1'>
              最后更新
            </label>
            <p className='text-sm text-gray-900'>
              {formatDate(witness.updatedAt)}
            </p>
          </div>
        </div>

        {/* 证词内容 */}
        <div>
          <div className='flex items-center justify-between mb-3'>
            <label className='block text-sm font-medium text-gray-700'>
              证词内容
            </label>
            {editState.testimony && (
              <span className='text-xs text-gray-500'>
                {editState.testimony.length} 字符
              </span>
            )}
          </div>

          {editState.isEditing ? (
            <div className='space-y-3'>
              <textarea
                value={editState.testimony}
                onChange={e => handleTestimonyChange(e.target.value)}
                className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm'
                placeholder='请输入证词内容...'
                rows={12}
                maxLength={10000}
              />
              <div className='text-xs text-gray-500 text-right'>
                {editState.testimony.length}/10000 字符
              </div>
            </div>
          ) : witness.testimony ? (
            <div className='border border-gray-200 rounded-md p-4 bg-white min-h-50'>
              <div className='whitespace-pre-wrap text-sm text-gray-900 leading-relaxed'>
                {witness.testimony}
              </div>
            </div>
          ) : (
            <div className='border border-gray-200 rounded-md p-8 text-center text-gray-500 bg-gray-50'>
              {canEdit ? (
                <div>
                  <p className='mb-3'>暂无证词内容</p>
                  <Button variant='outline' size='sm' onClick={handleStartEdit}>
                    添加证词
                  </Button>
                </div>
              ) : (
                '暂无证词内容'
              )}
            </div>
          )}
        </div>

        {/* 法庭日程信息 */}
        {witness.courtSchedule && (
          <div className='border-t pt-6'>
            <h3 className='text-lg font-medium mb-3'>关联法庭日程</h3>
            <div className='p-4 border border-blue-200 rounded-lg bg-blue-50'>
              <div className='flex items-center justify-between'>
                <div>
                  <h4 className='font-medium text-blue-900'>
                    {witness.courtSchedule.title}
                  </h4>
                  <p className='text-sm text-blue-700 mt-1'>
                    日程ID: {witness.courtSchedule.id}
                  </p>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  className='border-blue-300 text-blue-700 hover:bg-blue-100'
                >
                  查看详情
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
