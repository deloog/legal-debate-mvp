'use client';

import { useState, useCallback } from 'react';
import {
  Phone,
  MessageCircle,
  Mail,
  Users,
  MoreHorizontal,
  Calendar,
  Send,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

/**
 * 跟进方式选项
 */
const FOLLOW_UP_TYPES = [
  { value: '电话', label: '电话', icon: Phone },
  { value: '微信', label: '微信', icon: MessageCircle },
  { value: '邮件', label: '邮件', icon: Mail },
  { value: '面谈', label: '面谈', icon: Users },
  { value: '其他', label: '其他', icon: MoreHorizontal },
];

/**
 * 跟进记录接口
 */
interface FollowUpRecord {
  id: string;
  consultationId: string;
  followUpTime: string;
  followUpType: string;
  content: string;
  result: string | null;
  nextFollowUp: string | null;
  createdBy: string;
  createdAt: string;
}

/**
 * 组件属性
 */
interface FollowUpFormProps {
  consultationId: string;
  onSuccess?: (followUp: FollowUpRecord) => void;
  onCancel?: () => void;
}

/**
 * 跟进记录表单组件
 */
export function FollowUpForm({
  consultationId,
  onSuccess,
  onCancel,
}: FollowUpFormProps) {
  const [followUpType, setFollowUpType] = useState<string>('电话');
  const [content, setContent] = useState('');
  const [result, setResult] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 处理提交
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      // 验证
      if (!content || content.length < 5) {
        setError('跟进内容至少需要5个字符');
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await fetch(
          `/api/consultations/${consultationId}/follow-ups`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              followUpType,
              content,
              result: result || undefined,
              nextFollowUp: nextFollowUp || undefined,
            }),
          }
        );

        const data = await response.json();

        if (data.success) {
          // 重置表单
          setContent('');
          setResult('');
          setNextFollowUp('');
          onSuccess?.(data.data);
        } else {
          setError(data.error?.message || '提交失败');
        }
      } catch {
        setError('网络错误，请重试');
      } finally {
        setIsSubmitting(false);
      }
    },
    [consultationId, followUpType, content, result, nextFollowUp, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {/* 跟进方式选择 */}
      <div>
        <Label className='mb-2 block text-sm font-medium'>跟进方式</Label>
        <div className='flex flex-wrap gap-2'>
          {FOLLOW_UP_TYPES.map(type => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                type='button'
                onClick={() => setFollowUpType(type.value)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all ${
                  followUpType === type.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                <Icon className='h-4 w-4' />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 跟进内容 */}
      <div>
        <Label htmlFor='content' className='mb-1.5 block text-sm font-medium'>
          跟进内容 <span className='text-red-500'>*</span>
        </Label>
        <textarea
          id='content'
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder='请详细描述本次跟进的内容...'
          rows={4}
          maxLength={1000}
          className='w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50'
        />
        <div className='mt-1 flex justify-between text-xs text-zinc-500'>
          <span>至少5个字符</span>
          <span>{content.length}/1000</span>
        </div>
      </div>

      {/* 跟进结果 */}
      <div>
        <Label htmlFor='result' className='mb-1.5 block text-sm font-medium'>
          跟进结果
        </Label>
        <Input
          id='result'
          value={result}
          onChange={e => setResult(e.target.value)}
          placeholder='可选：本次跟进的结果或客户反馈'
          maxLength={200}
        />
      </div>

      {/* 下次跟进日期 */}
      <div>
        <Label
          htmlFor='nextFollowUp'
          className='mb-1.5 flex items-center gap-1.5 text-sm font-medium'
        >
          <Calendar className='h-4 w-4' />
          下次跟进日期
        </Label>
        <Input
          id='nextFollowUp'
          type='datetime-local'
          value={nextFollowUp}
          onChange={e => setNextFollowUp(e.target.value)}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300'>
          {error}
        </div>
      )}

      {/* 操作按钮 */}
      <div className='flex justify-end gap-2 pt-2'>
        {onCancel && (
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={isSubmitting}
          >
            <X className='mr-1.5 h-4 w-4' />
            取消
          </Button>
        )}
        <Button type='submit' variant='primary' disabled={isSubmitting}>
          <Send className='mr-1.5 h-4 w-4' />
          {isSubmitting ? '提交中...' : '提交记录'}
        </Button>
      </div>
    </form>
  );
}

/**
 * 跟进记录列表组件
 */
interface FollowUpListProps {
  followUps: FollowUpRecord[];
}

export function FollowUpList({ followUps }: FollowUpListProps) {
  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 获取跟进方式图标
  const getTypeIcon = (type: string) => {
    const found = FOLLOW_UP_TYPES.find(t => t.value === type);
    return found ? found.icon : MoreHorizontal;
  };

  if (followUps.length === 0) {
    return (
      <div className='rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900'>
        <MessageCircle className='mx-auto h-12 w-12 text-zinc-400' />
        <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
          暂无跟进记录
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {followUps.map((followUp, index) => {
        const Icon = getTypeIcon(followUp.followUpType);
        return (
          <div
            key={followUp.id}
            className='relative border-l-2 border-zinc-200 pl-4 dark:border-zinc-700'
          >
            {/* 时间节点 */}
            <div className='absolute -left-2 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500'>
              <Icon className='h-2.5 w-2.5 text-white' />
            </div>

            {/* 内容 */}
            <div className='rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950'>
              <div className='mb-2 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <span className='rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'>
                    {followUp.followUpType}
                  </span>
                </div>
                <span className='text-xs text-zinc-500 dark:text-zinc-400'>
                  {formatDate(followUp.followUpTime)}
                </span>
              </div>

              <p className='text-sm text-zinc-700 dark:text-zinc-300'>
                {followUp.content}
              </p>

              {followUp.result && (
                <p className='mt-2 text-sm text-green-600 dark:text-green-400'>
                  结果：{followUp.result}
                </p>
              )}

              {followUp.nextFollowUp && (
                <p className='mt-2 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400'>
                  <Calendar className='h-3 w-3' />
                  下次跟进：{formatDate(followUp.nextFollowUp)}
                </p>
              )}
            </div>

            {/* 连接线 */}
            {index < followUps.length - 1 && (
              <div className='absolute -left-px top-4 h-full w-0.5 bg-zinc-200 dark:bg-zinc-700' />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 跟进记录卡片组件（包含表单和列表）
 */
interface FollowUpCardProps {
  consultationId: string;
  initialFollowUps?: FollowUpRecord[];
}

export function FollowUpCard({
  consultationId,
  initialFollowUps = [],
}: FollowUpCardProps) {
  const [followUps, setFollowUps] =
    useState<FollowUpRecord[]>(initialFollowUps);
  const [showForm, setShowForm] = useState(false);

  // 处理添加成功
  const handleSuccess = (newFollowUp: FollowUpRecord) => {
    setFollowUps(prev => [newFollowUp, ...prev]);
    setShowForm(false);
  };

  return (
    <div className='rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      {/* 头部 */}
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
          跟进记录
        </h2>
        {!showForm && (
          <Button variant='outline' size='sm' onClick={() => setShowForm(true)}>
            添加记录
          </Button>
        )}
      </div>

      {/* 表单 */}
      {showForm && (
        <div className='mb-6 rounded-lg border border-blue-200 bg-blue-50/50 p-4 dark:border-blue-800 dark:bg-blue-900/20'>
          <FollowUpForm
            consultationId={consultationId}
            onSuccess={handleSuccess}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* 列表 */}
      <FollowUpList followUps={followUps} />
    </div>
  );
}
