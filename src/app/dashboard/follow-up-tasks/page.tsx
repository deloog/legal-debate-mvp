/**
 * 跟进任务管理页面
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FollowUpTask,
  FollowUpTaskQueryParams,
  FollowUpTaskStatus,
} from '@/types/client';
import { FollowUpTaskList } from '@/components/client/FollowUpTaskList';

export default function FollowUpTasksPage() {
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Partial<FollowUpTaskQueryParams>>({
    status: FollowUpTaskStatus.PENDING,
    page: 1,
    limit: 20,
    sortBy: 'dueDate',
    sortOrder: 'asc',
  });
  const [pendingCount, setPendingCount] = useState(0);

  // 加载任务列表
  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status) params.append('status', filter.status);
      if (filter.priority) params.append('priority', filter.priority);
      if (filter.page) params.append('page', String(filter.page));
      if (filter.limit) params.append('limit', String(filter.limit));
      if (filter.sortBy) params.append('sortBy', filter.sortBy);
      if (filter.sortOrder) params.append('sortOrder', filter.sortOrder);

      const response = await fetch(`/api/follow-up-tasks?${params.toString()}`);
      if (!response.ok) {
        throw new Error('加载失败');
      }
      const data = await response.json();
      setTasks(data.tasks || []);

      // 加载待处理任务数量
      const pendingResponse = await fetch('/api/follow-up-tasks/pending-count');
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        setPendingCount(pendingData.count || 0);
      }
    } catch (error) {
      console.error('加载任务失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // 完成任务
  const handleCompleteTask = async (id: string, notes?: string) => {
    try {
      const response = await fetch(`/api/follow-up-tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        throw new Error('操作失败');
      }

      await loadTasks();
    } catch (error) {
      console.error('完成任务失败:', error);
      alert('完成任务失败，请重试');
    }
  };

  // 取消任务
  const handleCancelTask = async (id: string) => {
    try {
      const response = await fetch(`/api/follow-up-tasks/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('操作失败');
      }

      await loadTasks();
    } catch (error) {
      console.error('取消任务失败:', error);
      alert('取消任务失败，请重试');
    }
  };

  // 初始加载
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  return (
    <FollowUpTaskList
      tasks={tasks}
      loading={loading}
      onCompleteTask={handleCompleteTask}
      onCancelTask={handleCancelTask}
      onRefresh={loadTasks}
      pendingCount={pendingCount}
      filter={filter}
      onFilterChange={setFilter}
    />
  );
}
