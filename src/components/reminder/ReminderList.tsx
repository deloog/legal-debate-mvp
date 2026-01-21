'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Reminder,
  ReminderType,
  ReminderStatus,
  NotificationChannel,
} from '@/types/notification';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ReminderListProps {
  userId: string;
}

export function ReminderList({ userId }: ReminderListProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });

  const [filters, setFilters] = useState({
    type: '' as ReminderType | '',
    status: '' as ReminderStatus | '',
    startTime: '' as string,
    endTime: '' as string,
  });

  const fetchReminders = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());

      if (filters.type) {
        params.append('type', filters.type);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.startTime) {
        params.append('startTime', filters.startTime);
      }
      if (filters.endTime) {
        params.append('endTime', filters.endTime);
      }

      const response = await fetch(`/api/reminders?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || '获取提醒列表失败');
      }

      setReminders(result.data.reminders);
      setPagination(result.data.pagination);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '获取提醒列表失败';
      setError(errorMessage);
      console.error('获取提醒列表失败:', err);
    } finally {
      setLoading(false);
    }
  }, [
    filters.type,
    filters.status,
    filters.startTime,
    filters.endTime,
    pagination.page,
    pagination.limit,
  ]);

  useEffect(() => {
    fetchReminders();
  }, [userId, fetchReminders]);

  const handleMarkAsRead = async (reminderId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/reminders/${reminderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'READ' }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchReminders();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : '标记为已读失败';
      setError(errorMessage);
      console.error('标记为已读失败:', err);
    }
  };

  const handleDismiss = async (reminderId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/reminders/${reminderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'DISMISSED' }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchReminders();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '忽略提醒失败';
      setError(errorMessage);
      console.error('忽略提醒失败:', err);
    }
  };

  const handleDelete = async (reminderId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/reminders/${reminderId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      await fetchReminders();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除提醒失败';
      setError(errorMessage);
      console.error('删除提醒失败:', err);
    }
  };

  const formatReminderTime = (date: Date): string => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}天后`;
    }
    if (hours > 0) {
      return `${hours}小时后`;
    }
    return '即将到达';
  };

  const getReminderTypeLabel = (type: ReminderType): string => {
    const typeLabels: Record<ReminderType, string> = {
      COURT_SCHEDULE: '法庭日程',
      DEADLINE: '截止日期',
      FOLLOW_UP: '跟进提醒',
      CUSTOM: '自定义提醒',
    };
    return typeLabels[type] || type;
  };

  const getReminderStatusLabel = (status: ReminderStatus): string => {
    const statusLabels: Record<ReminderStatus, string> = {
      PENDING: '待发送',
      SENT: '已发送',
      READ: '已读',
      DISMISSED: '已忽略',
    };
    return statusLabels[status] || status;
  };

  const getStatusColor = (status: ReminderStatus): string => {
    const statusColors: Record<ReminderStatus, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      SENT: 'bg-blue-100 text-blue-800',
      READ: 'bg-green-100 text-green-800',
      DISMISSED: 'bg-gray-100 text-gray-800',
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type: ReminderType): string => {
    const typeColors: Record<ReminderType, string> = {
      COURT_SCHEDULE: 'bg-red-100 text-red-800',
      DEADLINE: 'bg-orange-100 text-orange-800',
      FOLLOW_UP: 'bg-purple-100 text-purple-800',
      CUSTOM: 'bg-gray-100 text-gray-800',
    };
    return typeColors[type] || 'bg-gray-100 text-gray-800';
  };

  const handlePageChange = (newPage: number): void => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleFilterChange = (field: string, value: string): void => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  return (
    <div className='space-y-4'>
      <Card>
        <CardHeader>
          <CardTitle>筛选提醒</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                类型
              </label>
              <select
                value={filters.type}
                onChange={e => handleFilterChange('type', e.target.value)}
                className='w-full border rounded-md px-3 py-2 text-sm'
              >
                <option value=''>全部</option>
                <option value='COURT_SCHEDULE'>法庭日程</option>
                <option value='DEADLINE'>截止日期</option>
                <option value='FOLLOW_UP'>跟进提醒</option>
                <option value='CUSTOM'>自定义提醒</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                状态
              </label>
              <select
                value={filters.status}
                onChange={e => handleFilterChange('status', e.target.value)}
                className='w-full border rounded-md px-3 py-2 text-sm'
              >
                <option value=''>全部</option>
                <option value='PENDING'>待发送</option>
                <option value='SENT'>已发送</option>
                <option value='READ'>已读</option>
                <option value='DISMISSED'>已忽略</option>
              </select>
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                开始时间
              </label>
              <input
                type='date'
                value={filters.startTime}
                onChange={e => handleFilterChange('startTime', e.target.value)}
                className='w-full border rounded-md px-3 py-2 text-sm'
              />
            </div>

            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                结束时间
              </label>
              <input
                type='date'
                value={filters.endTime}
                onChange={e => handleFilterChange('endTime', e.target.value)}
                className='w-full border rounded-md px-3 py-2 text-sm'
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md'>
          {error}
        </div>
      )}

      {loading ? (
        <div className='text-center py-8'>
          <div className='text-gray-500'>加载中...</div>
        </div>
      ) : reminders.length === 0 ? (
        <Card>
          <CardContent className='text-center py-8'>
            <div className='text-gray-500'>暂无提醒</div>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {reminders.map(reminder => (
            <Card key={reminder.id}>
              <CardContent className='py-4'>
                <div className='flex items-start justify-between'>
                  <div className='flex-1'>
                    <div className='flex items-center space-x-2 mb-2'>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(
                          reminder.type
                        )}`}
                      >
                        {getReminderTypeLabel(reminder.type)}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                          reminder.status
                        )}`}
                      >
                        {getReminderStatusLabel(reminder.status)}
                      </span>
                      <span className='text-sm text-gray-500'>
                        {formatReminderTime(new Date(reminder.reminderTime))}
                      </span>
                    </div>

                    <h4 className='text-lg font-semibold mb-1'>
                      {reminder.title}
                    </h4>

                    {reminder.message && (
                      <p className='text-gray-600 text-sm mb-2'>
                        {reminder.message}
                      </p>
                    )}

                    <div className='text-sm text-gray-500'>
                      <div className='flex items-center space-x-4'>
                        <span>
                          提醒时间:{' '}
                          {new Date(reminder.reminderTime).toLocaleString(
                            'zh-CN'
                          )}
                        </span>
                        {reminder.channels.length > 0 && (
                          <span>
                            通知渠道:{' '}
                            {reminder.channels
                              .map(channel => {
                                const channelLabels: Record<
                                  NotificationChannel,
                                  string
                                > = {
                                  IN_APP: '站内',
                                  EMAIL: '邮件',
                                  SMS: '短信',
                                };
                                return channelLabels[channel];
                              })
                              .join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='flex flex-col space-y-2 ml-4'>
                    {reminder.status === ReminderStatus.PENDING && (
                      <Button
                        size='sm'
                        onClick={() => handleMarkAsRead(reminder.id)}
                      >
                        标记已读
                      </Button>
                    )}
                    {reminder.status === ReminderStatus.PENDING && (
                      <Button
                        size='sm'
                        variant='outline'
                        onClick={() => handleDismiss(reminder.id)}
                      >
                        忽略
                      </Button>
                    )}
                    <Button
                      size='sm'
                      variant='ghost'
                      onClick={() => handleDelete(reminder.id)}
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <Card>
          <CardContent className='py-4'>
            <div className='flex items-center justify-between'>
              <div className='text-sm text-gray-600'>
                第 {pagination.page} 页，共 {pagination.totalPages} 页，共{' '}
                {pagination.total} 条
              </div>
              <div className='flex space-x-2'>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!pagination.hasPrevious}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  上一页
                </Button>
                <Button
                  size='sm'
                  variant='outline'
                  disabled={!pagination.hasNext}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
