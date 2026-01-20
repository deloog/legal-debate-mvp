'use client';

import {
  FollowUpTask,
  FollowUpTaskQueryParams,
  FollowUpTaskStatus,
  FollowUpTaskPriority,
} from '@/types/client';
import { FollowUpTasks } from './FollowUpTasks';

export interface FollowUpTaskListProps {
  tasks: FollowUpTask[];
  loading?: boolean;
  onCompleteTask: (id: string, notes?: string) => Promise<void>;
  onCancelTask: (id: string) => Promise<void>;
  onRefresh?: () => void;
  pendingCount?: number;
  filter?: Partial<FollowUpTaskQueryParams>;
  onFilterChange?: (filter: Partial<FollowUpTaskQueryParams>) => void;
}

export function FollowUpTaskList({
  tasks,
  loading = false,
  onCompleteTask,
  onCancelTask,
  onRefresh,
  pendingCount = 0,
  filter,
  onFilterChange,
}: FollowUpTaskListProps) {
  return (
    <div className='container mx-auto px-4 py-6'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold'>跟进任务管理</h1>
        <p className='text-gray-600 mt-1'>管理客户跟进任务，按时完成重要跟进</p>
      </div>

      {/* 筛选栏 */}
      {onFilterChange && filter && (
        <div className='mb-6 flex flex-wrap items-center gap-4'>
          <div className='flex items-center space-x-2'>
            <label className='text-sm font-medium text-gray-700'>状态:</label>
            <select
              className='rounded-md border border-gray-300 px-3 py-2 text-sm'
              value={filter.status || ''}
              onChange={e =>
                onFilterChange({
                  ...filter,
                  status: (e.target.value as FollowUpTaskStatus) || undefined,
                })
              }
            >
              <option value=''>全部</option>
              <option value={FollowUpTaskStatus.PENDING}>待处理</option>
              <option value={FollowUpTaskStatus.COMPLETED}>已完成</option>
              <option value={FollowUpTaskStatus.CANCELLED}>已取消</option>
            </select>
          </div>
          <div className='flex items-center space-x-2'>
            <label className='text-sm font-medium text-gray-700'>优先级:</label>
            <select
              className='rounded-md border border-gray-300 px-3 py-2 text-sm'
              value={filter.priority || ''}
              onChange={e =>
                onFilterChange({
                  ...filter,
                  priority:
                    (e.target.value as FollowUpTaskPriority) || undefined,
                })
              }
            >
              <option value=''>全部</option>
              <option value={FollowUpTaskPriority.HIGH}>高优先级</option>
              <option value={FollowUpTaskPriority.MEDIUM}>中优先级</option>
              <option value={FollowUpTaskPriority.LOW}>低优先级</option>
            </select>
          </div>
          <div className='flex items-center space-x-2'>
            <label className='text-sm font-medium text-gray-700'>排序:</label>
            <select
              className='rounded-md border border-gray-300 px-3 py-2 text-sm'
              value={`${filter.sortBy}-${filter.sortOrder}`}
              onChange={e => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                onFilterChange({
                  ...filter,
                  sortBy: sortBy as 'dueDate' | 'createdAt' | undefined,
                  sortOrder: sortOrder as 'asc' | 'desc' | undefined,
                });
              }}
            >
              <option value='dueDate-asc'>截止日期（近到远）</option>
              <option value='dueDate-desc'>截止日期（远到近）</option>
              <option value='createdAt-desc'>创建时间（新到旧）</option>
              <option value='createdAt-asc'>创建时间（旧到新）</option>
            </select>
          </div>
        </div>
      )}

      {/* 任务列表 */}
      <FollowUpTasks
        tasks={tasks}
        loading={loading}
        onCompleteTask={onCompleteTask}
        onCancelTask={onCancelTask}
        onRefresh={onRefresh}
        pendingCount={pendingCount}
      />
    </div>
  );
}
