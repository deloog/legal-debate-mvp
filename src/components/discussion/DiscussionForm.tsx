/**
 * 讨论表单组件
 * 用于创建和编辑讨论，支持@提及功能
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Send as SendIcon,
  X as XIcon,
  AtSign as AtSignIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-react';

/**
 * 讨论数据接口
 */
interface DiscussionData {
  id: string;
  caseId: string;
  userId: string;
  content: string;
  mentions: string[];
  isPinned: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

interface DiscussionFormProps {
  caseId: string;
  editingDiscussion: DiscussionData | null;
  onCancelEdit: () => void;
  onSuccess: () => void;
}

/**
 * 讨论表单组件
 */
export function DiscussionForm({
  caseId,
  editingDiscussion,
  onCancelEdit,
  onSuccess,
}: DiscussionFormProps) {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMentionHelper, setShowMentionHelper] = useState(false);

  // 初始化表单
  useEffect(() => {
    if (editingDiscussion) {
      setContent(editingDiscussion.content);
    } else {
      setContent('');
    }
    setError(null);
  }, [editingDiscussion]);

  /**
   * 处理内容变化
   */
  const handleContentChange = (value: string) => {
    setContent(value);
    setError(null);

    // 检测@符号，显示提及提示
    if (value.includes('@') && !showMentionHelper) {
      setShowMentionHelper(true);
    } else if (!value.includes('@') && showMentionHelper) {
      setShowMentionHelper(false);
    }
  };

  /**
   * 提交表单
   */
  const handleSubmit = async () => {
    if (!content.trim()) {
      setError('讨论内容不能为空');
      return;
    }

    if (content.length > 10000) {
      setError('讨论内容不能超过10000个字符');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const url = editingDiscussion
        ? `/api/discussions/${editingDiscussion.id}`
        : `/api/cases/${caseId}/discussions`;

      const response = await fetch(url, {
        method: editingDiscussion ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: content.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '提交失败');
      }

      setContent('');
      setShowMentionHelper(false);
      onCancelEdit();
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      console.error('提交讨论时出错:', err);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * 处理取消编辑
   */
  const handleCancelEdit = () => {
    setContent('');
    setError(null);
    onCancelEdit();
  };

  /**
   * 处理@插入
   */
  const handleInsertAtSign = () => {
    const textarea = document.querySelector(
      'textarea[name="content"]'
    ) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText =
        content.substring(0, start) + '@' + content.substring(end);
      setContent(newText);
      textarea.focus();
      setShowMentionHelper(true);
    }
  };

  return (
    <div className='rounded-lg border bg-white p-4 shadow-sm'>
      <div className='mb-3 flex items-center justify-between'>
        <h3 className='text-sm font-semibold text-gray-900'>
          {editingDiscussion ? '编辑讨论' : '发表讨论'}
        </h3>
        <div className='flex items-center gap-2 text-xs text-gray-500'>
          <span>{content.length}/10000</span>
          {content.length > 10000 && <span className='text-red-500'>超限</span>}
        </div>
      </div>

      <div className='space-y-3'>
        {/* 提及提示 */}
        {showMentionHelper && (
          <div className='flex items-start gap-2 rounded-md bg-blue-50 p-3'>
            <AtSignIcon className='h-5 w-5 shrink-0 text-blue-600' />
            <div className='flex-1'>
              <p className='text-sm font-medium text-blue-900'>使用@提及</p>
              <p className='mt-1 text-xs text-blue-700'>
                输入@后输入用户名或用户ID可以提及团队成员，被提及的用户会收到通知。
              </p>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setShowMentionHelper(false)}
            >
              <XIcon className='h-4 w-4' />
            </Button>
          </div>
        )}

        {/* 表单内容 */}
        <div className='space-y-2'>
          <Label htmlFor='content'>
            讨论内容
            <span className='ml-1 text-red-500'>*</span>
          </Label>
          <Textarea
            id='content'
            name='content'
            value={content}
            onChange={e => handleContentChange(e.target.value)}
            placeholder='输入讨论内容，使用@提及团队成员...'
            rows={4}
            maxLength={10000}
            disabled={submitting}
            className='resize-none'
          />
          <div className='flex items-center justify-between'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleInsertAtSign}
              disabled={submitting}
            >
              <AtSignIcon className='mr-1 h-4 w-4' />
              插入@
            </Button>
            <span className='text-xs text-gray-500'>支持Markdown格式</span>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className='flex items-center gap-2 rounded-md bg-red-50 p-3 text-red-700'>
            <AlertCircleIcon className='h-5 w-5 shrink-0' />
            <span className='text-sm'>{error}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className='flex justify-end gap-2'>
          {editingDiscussion && (
            <Button
              variant='outline'
              onClick={handleCancelEdit}
              disabled={submitting}
            >
              取消
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting || !content.trim() || content.length > 10000}
          >
            {submitting ? '提交中...' : editingDiscussion ? '更新' : '发送'}
            {!submitting && <SendIcon className='ml-2 h-4 w-4' />}
          </Button>
        </div>
      </div>
    </div>
  );
}
