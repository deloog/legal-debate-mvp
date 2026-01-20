'use client';

import { FollowUpTask, FollowUpTaskStatus } from '@/types/client';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import {
  getStatusName,
  getStatusColor,
  getPriorityName,
  getPriorityColor,
  getDueDateText,
  getDueDateColor,
} from './FollowUpTaskUtils';

export interface FollowUpTaskCardProps {
  task: FollowUpTask;
  onComplete: (id: string, notes?: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
  isCompleting: boolean;
  isCanceling: boolean;
  isCompletingWithNotes: boolean;
  onOpenNotesDialog: () => void;
  onCloseNotesDialog: () => void;
  onUpdateNotesDialog: (value: { taskId: string; notes: string }) => void;
  notesDialog: { taskId: string; notes: string } | null;
}

export function FollowUpTaskCard({
  task,
  onComplete,
  onCancel,
  isCompleting,
  isCanceling,
  isCompletingWithNotes,
  onOpenNotesDialog,
  onCloseNotesDialog,
  onUpdateNotesDialog,
  notesDialog,
}: FollowUpTaskCardProps) {
  const isPending = task.status === FollowUpTaskStatus.PENDING;

  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardContent className='p-6'>
        {/* 头部信息 */}
        <div className='mb-4 flex items-start justify-between'>
          <div className='flex-1'>
            <div className='mb-2 flex items-center space-x-2'>
              <h3 className='text-lg font-semibold text-gray-900'>
                {task.clientName}
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                  task.status
                )}`}
              >
                {getStatusName(task.status)}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getPriorityColor(
                  task.priority
                )}`}
              >
                {getPriorityName(task.priority)}
              </span>
            </div>
            <p className='text-sm text-gray-600'>{task.summary}</p>
          </div>
        </div>

        {/* 联系信息 */}
        {isPending && (
          <div className='mb-4 space-y-1 text-sm text-gray-600'>
            {task.clientPhone && (
              <div className='flex items-center'>
                <span className='mr-2 font-medium'>电话:</span>
                <span>{task.clientPhone}</span>
              </div>
            )}
            {task.clientEmail && (
              <div className='flex items-center'>
                <span className='mr-2 font-medium'>邮箱:</span>
                <span className='truncate'>{task.clientEmail}</span>
              </div>
            )}
          </div>
        )}

        {/* 完成记录 */}
        {task.completedAt && task.notes && (
          <div className='mb-4 rounded-md bg-gray-50 p-3'>
            <p className='mb-1 text-sm font-medium text-gray-700'>完成记录</p>
            <p className='text-sm text-gray-600'>{task.notes}</p>
          </div>
        )}

        {/* 底部信息 */}
        <div className='flex items-center justify-between border-t pt-4'>
          <div className='text-sm'>
            <span className='mr-4 text-gray-500'>
              截止日期:{' '}
              <span className={getDueDateColor(task.dueDate)}>
                {getDueDateText(task.dueDate)}
              </span>
            </span>
            <span className='text-gray-400'>
              {new Date(task.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>

        {/* 操作按钮 */}
        {isPending && (
          <div className='mt-4 flex justify-end space-x-2'>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onOpenNotesDialog()}
              disabled={isCompleting || isCanceling}
            >
              {isCompletingWithNotes ? '添加备注...' : '完成并备注'}
            </Button>
            <Button
              variant='primary'
              size='sm'
              onClick={() => onComplete(task.id)}
              disabled={isCompleting || isCanceling}
            >
              {isCompleting ? '完成中...' : '完成'}
            </Button>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => onCancel(task.id)}
              disabled={isCanceling || isCompleting}
              className='text-red-600 hover:bg-red-50'
            >
              {isCanceling ? '取消中...' : '取消'}
            </Button>
          </div>
        )}

        {/* 备注对话框 */}
        {isCompletingWithNotes && notesDialog && (
          <div className='mt-4 rounded-md border p-4'>
            <textarea
              className='mb-3 w-full rounded-md border border-gray-300 p-2'
              rows={3}
              placeholder='请输入完成备注（可选）'
              value={notesDialog.notes}
              onChange={e =>
                onUpdateNotesDialog({
                  taskId: notesDialog.taskId,
                  notes: e.target.value,
                })
              }
            />
            <div className='flex justify-end space-x-2'>
              <Button variant='ghost' size='sm' onClick={onCloseNotesDialog}>
                取消
              </Button>
              <Button
                variant='primary'
                size='sm'
                onClick={() => onComplete(task.id, notesDialog.notes)}
                disabled={isCompleting}
              >
                {isCompleting ? '完成中...' : '确定'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
