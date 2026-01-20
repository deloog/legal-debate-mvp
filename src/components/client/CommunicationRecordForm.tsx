import { useState } from 'react';
import { Button } from '../ui/button';
import { CommunicationType } from '../../types/client';

interface CommunicationRecordFormProps {
  clientId: string;
  onSuccess: () => void;
  onCancel: () => void;
  editingRecord?: {
    id: string;
    type: CommunicationType;
    summary: string;
    content: string | null;
    nextFollowUpDate: Date | null;
    isImportant: boolean;
  } | null;
}

export function CommunicationRecordForm({
  clientId,
  onSuccess,
  onCancel,
  editingRecord,
}: CommunicationRecordFormProps) {
  const [type, setType] = useState<CommunicationType>(
    editingRecord?.type ?? CommunicationType.PHONE
  );
  const [summary, setSummary] = useState(editingRecord?.summary ?? '');
  const [content, setContent] = useState(editingRecord?.content ?? '');
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>(
    editingRecord?.nextFollowUpDate
      ? new Date(editingRecord.nextFollowUpDate).toISOString().slice(0, 16)
      : ''
  );
  const [isImportant, setIsImportant] = useState(
    editingRecord?.isImportant ?? false
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const communicationTypes = [
    { value: CommunicationType.PHONE, label: '电话' },
    { value: CommunicationType.EMAIL, label: '邮件' },
    { value: CommunicationType.MEETING, label: '面谈' },
    { value: CommunicationType.WECHAT, label: '微信' },
    { value: CommunicationType.OTHER, label: '其他' },
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!summary.trim()) {
      newErrors.summary = '摘要不能为空';
    } else if (summary.length > 1000) {
      newErrors.summary = '摘要不能超过1000字';
    }

    if (content && content.length > 10000) {
      newErrors.content = '内容不能超过10000字';
    }

    if (nextFollowUpDate) {
      const date = new Date(nextFollowUpDate);
      if (isNaN(date.getTime())) {
        newErrors.nextFollowUpDate = '无效的日期';
      } else if (date < new Date()) {
        newErrors.nextFollowUpDate = '跟进日期不能早于当前时间';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const input = {
        clientId,
        type,
        summary: summary.trim(),
        content: content.trim() || undefined,
        nextFollowUpDate: nextFollowUpDate
          ? new Date(nextFollowUpDate)
          : undefined,
        isImportant,
      };

      if (editingRecord) {
        const response = await fetch(
          `/api/communications/${editingRecord.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );

        if (!response.ok) {
          throw new Error('更新沟通记录失败');
        }
      } else {
        const response = await fetch('/api/communications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          throw new Error('创建沟通记录失败');
        }
      }

      onSuccess();
    } catch (error) {
      console.error('提交沟通记录失败:', error);
      alert('提交失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='space-y-4'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <label className='mb-2 block text-sm font-medium text-gray-700'>
            沟通类型 *
          </label>
          <select
            value={type}
            onChange={e => setType(e.target.value as CommunicationType)}
            className='w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            {communicationTypes.map(item => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className='mb-2 block text-sm font-medium text-gray-700'>
            摘要 *
          </label>
          <input
            type='text'
            value={summary}
            onChange={e => setSummary(e.target.value)}
            placeholder='请输入沟通摘要'
            maxLength={1000}
            className='w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          {errors.summary && (
            <p className='mt-1 text-sm text-red-600'>{errors.summary}</p>
          )}
        </div>

        <div>
          <label className='mb-2 block text-sm font-medium text-gray-700'>
            详细内容
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder='请输入详细内容（可选）'
            maxLength={10000}
            rows={4}
            className='w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          {errors.content && (
            <p className='mt-1 text-sm text-red-600'>{errors.content}</p>
          )}
        </div>

        <div>
          <label className='mb-2 block text-sm font-medium text-gray-700'>
            下次跟进时间
          </label>
          <input
            type='datetime-local'
            value={nextFollowUpDate}
            onChange={e => setNextFollowUpDate(e.target.value)}
            className='w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          {errors.nextFollowUpDate && (
            <p className='mt-1 text-sm text-red-600'>
              {errors.nextFollowUpDate}
            </p>
          )}
        </div>

        <div className='flex items-center'>
          <input
            type='checkbox'
            id='isImportant'
            checked={isImportant}
            onChange={e => setIsImportant(e.target.checked)}
            className='h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
          />
          <label
            htmlFor='isImportant'
            className='ml-2 block text-sm text-gray-700'
          >
            标记为重要
          </label>
        </div>

        <div className='flex justify-end space-x-3'>
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={isSubmitting}
          >
            取消
          </Button>
          <Button type='submit' variant='primary' disabled={isSubmitting}>
            {isSubmitting ? '提交中...' : editingRecord ? '更新' : '保存'}
          </Button>
        </div>
      </form>
    </div>
  );
}
