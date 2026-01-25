/**
 * 讨论项组件
 * 显示单个讨论的内容、作者信息和操作按钮
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Pin as PinIcon,
  PinOff as PinOffIcon,
  Edit as EditIcon,
  Trash2 as TrashIcon,
  User as UserIcon,
  Clock as ClockIcon,
  CheckCircle as CheckCircleIcon,
} from 'lucide-react';

/**
 * 讨论作者信息接口
 */
interface Author {
  id: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

/**
 * 讨论项数据接口
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
  author: Author;
}

interface DiscussionItemProps {
  discussion: DiscussionData;
  currentUserId: string;
  canEdit: boolean;
  canPin: boolean;
  canDelete: boolean;
  onEdit: (discussion: DiscussionData) => void;
  onDelete: (discussionId: string) => void;
  onTogglePin: (discussionId: string, isPinned: boolean) => void;
}

/**
 * 讨论项组件
 */
export function DiscussionItem({
  discussion,
  currentUserId,
  canEdit,
  canPin,
  canDelete,
  onEdit,
  onDelete,
  onTogglePin,
}: DiscussionItemProps) {
  const [deleting, setDeleting] = useState(false);
  const [togglingPin, setTogglingPin] = useState(false);

  const isOwner = discussion.userId === currentUserId;

  /**
   * 处理删除讨论
   */
  const handleDelete = () => {
    if (confirm('确定要删除这条讨论吗？')) {
      setDeleting(true);
      onDelete(discussion.id);
    }
  };

  /**
   * 处理置顶/取消置顶
   */
  const handleTogglePin = () => {
    setTogglingPin(true);
    onTogglePin(discussion.id, !discussion.isPinned);
  };

  /**
   * 渲染提及的用户
   */
  const renderMentions = () => {
    if (!discussion.mentions || discussion.mentions.length === 0) {
      return null;
    }

    return (
      <div className='mt-2 flex flex-wrap gap-1'>
        {discussion.mentions.map((mention, index) => (
          <span
            key={index}
            className='inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700'
          >
            <UserIcon className='h-3 w-3' />
            {mention}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className='relative rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md'>
      {/* 置顶标记 */}
      {discussion.isPinned && (
        <div className='absolute -top-1 -right-1'>
          <span className='flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700'>
            <PinIcon className='h-3 w-3' />
            置顶
          </span>
        </div>
      )}

      {/* 头部：作者和时间 */}
      <div className='mb-3 flex items-start justify-between'>
        <div className='flex items-center gap-3'>
          {/* 头像 */}
          {discussion.author.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={discussion.author.avatar}
              alt={discussion.author.name || discussion.author.email}
              className='h-10 w-10 rounded-full object-cover'
            />
          ) : (
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-gray-100'>
              <UserIcon className='h-5 w-5 text-gray-500' />
            </div>
          )}

          {/* 作者信息 */}
          <div>
            <div className='flex items-center gap-2'>
              <span className='font-medium text-gray-900'>
                {discussion.author.name || discussion.author.email}
              </span>
              {isOwner && (
                <span className='inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-600'>
                  <CheckCircleIcon className='h-3 w-3' />
                  创建者
                </span>
              )}
            </div>
            <div className='flex items-center gap-1 text-xs text-gray-500'>
              <ClockIcon className='h-3 w-3' />
              <span>
                {new Date(discussion.createdAt).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {discussion.updatedAt !== discussion.createdAt && (
                <span className='text-gray-400'>· 已编辑</span>
              )}
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className='flex items-center gap-1'>
          {canPin && (
            <Button
              variant='ghost'
              size='sm'
              onClick={handleTogglePin}
              disabled={togglingPin}
              title={discussion.isPinned ? '取消置顶' : '置顶'}
            >
              {discussion.isPinned ? (
                <PinOffIcon className='h-4 w-4' />
              ) : (
                <PinIcon className='h-4 w-4' />
              )}
            </Button>
          )}
          {canEdit && (
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onEdit(discussion)}
              title='编辑'
            >
              <EditIcon className='h-4 w-4' />
            </Button>
          )}
          {canDelete && (
            <Button
              variant='ghost'
              size='sm'
              onClick={handleDelete}
              disabled={deleting}
              title='删除'
            >
              <TrashIcon className='h-4 w-4 text-red-500' />
            </Button>
          )}
        </div>
      </div>

      {/* 讨论内容 */}
      <div className='mb-2 whitespace-pre-wrap wrap-break-word text-sm text-gray-700'>
        {discussion.content}
      </div>

      {/* 提及用户 */}
      {renderMentions()}

      {/* Metadata（可选显示） */}
      {discussion.metadata && Object.keys(discussion.metadata).length > 0 && (
        <div className='mt-3 flex flex-wrap gap-2'>
          {Object.entries(discussion.metadata).map(([key, value]) => (
            <span
              key={key}
              className='inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600'
            >
              <span className='font-medium'>{key}:</span>
              <span>{String(value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
