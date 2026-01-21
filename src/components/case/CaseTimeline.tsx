'use client';

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Clock, Edit, Trash2, Plus } from 'lucide-react';
import { TimelineEvent } from '@/types/case';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimelineEventForm } from './TimelineEventForm';

/**
 * 时间线事件类型颜色映射
 */
const EVENT_TYPE_COLORS: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  FILING: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  PRETRIAL: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  TRIAL: {
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    text: 'text-orange-700 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800',
  },
  JUDGMENT: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    text: 'text-green-700 dark:text-green-300',
    border: 'border-green-200 dark:border-green-800',
  },
  APPEAL: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    text: 'text-yellow-700 dark:text-yellow-300',
    border: 'border-yellow-200 dark:border-yellow-800',
  },
  EXECUTION: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
  CLOSED: {
    bg: 'bg-zinc-50 dark:bg-zinc-900/20',
    text: 'text-zinc-700 dark:text-zinc-300',
    border: 'border-zinc-200 dark:border-zinc-800',
  },
  CUSTOM: {
    bg: 'bg-cyan-50 dark:bg-cyan-900/20',
    text: 'text-cyan-700 dark:text-cyan-300',
    border: 'border-cyan-200 dark:border-cyan-800',
  },
};

/**
 * 时间线事件类型标签映射
 */
const EVENT_TYPE_LABELS: Record<string, string> = {
  FILING: '立案',
  PRETRIAL: '审前准备',
  TRIAL: '开庭审理',
  JUDGMENT: '判决',
  APPEAL: '上诉',
  EXECUTION: '执行',
  CLOSED: '结案',
  CUSTOM: '自定义',
};

/**
 * 案件时间线组件
 */
interface CaseTimelineProps {
  caseId: string;
  readonly?: boolean;
}

export function CaseTimeline({ caseId, readonly = false }: CaseTimelineProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterEventType, setFilterEventType] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);

  /**
   * 加载时间线事件
   */
  const loadEvents = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const url = new URL(
        `/api/v1/cases/${caseId}/timeline`,
        window.location.origin
      );
      if (filterEventType !== 'all') {
        url.searchParams.set('eventType', filterEventType);
      }

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('加载时间线失败');
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [caseId, filterEventType]);

  /**
   * 删除时间线事件
   */
  const handleDelete = async (eventId: string) => {
    if (!confirm('确定要删除这个时间线事件吗？')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/v1/timeline-events/${eventId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('删除失败');
      }

      await loadEvents();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateString: Date | string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  /**
   * 格式化日期时间
   */
  const formatDateTime = (dateString: Date | string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-zinc-500'>加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-red-500'>{error}</div>
      </div>
    );
  }

  const filteredEvents =
    filterEventType === 'all'
      ? events
      : events.filter(event => event.eventType === filterEventType);

  return (
    <div className='space-y-6'>
      {/* 头部 */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <Clock className='h-6 w-6 text-zinc-600 dark:text-zinc-400' />
          <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
            案件时间线
          </h2>
          <Badge variant='secondary'>{events.length} 个事件</Badge>
        </div>

        {!readonly && (
          <div className='flex items-center gap-2'>
            {/* 筛选按钮 */}
            <select
              value={filterEventType}
              onChange={e => setFilterEventType(e.target.value)}
              className='rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
            >
              <option value='all'>全部</option>
              {Object.entries(EVENT_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>

            {/* 添加按钮 */}
            <Button
              onClick={() => setShowForm(true)}
              size='sm'
              variant='outline'
            >
              <Plus className='mr-1 h-4 w-4' />
              添加事件
            </Button>
          </div>
        )}
      </div>

      {/* 时间线列表 */}
      <div className='relative space-y-4 before:absolute before:left-4.75 before:top-2 before:h-[calc(100%-8px)] before:w-0.5 before:bg-zinc-200 dark:before:bg-zinc-800'>
        {filteredEvents.length === 0 ? (
          <div className='py-12 text-center text-zinc-500 dark:text-zinc-400'>
            暂无时间线事件
          </div>
        ) : (
          filteredEvents.map(event => {
            const colors =
              EVENT_TYPE_COLORS[event.eventType] || EVENT_TYPE_COLORS.CUSTOM;
            const eventLabel =
              EVENT_TYPE_LABELS[event.eventType] || event.eventType;

            return (
              <div
                key={event.id}
                className={`relative flex gap-4 rounded-lg border ${colors.border} ${colors.bg} p-4 transition-colors hover:shadow-md`}
              >
                {/* 时间线点 */}
                <div
                  className={`absolute left-2.75 top-6 h-4 w-4 rounded-full border-2 ${colors.bg} ${colors.text} bg-white dark:border-zinc-900`}
                />

                {/* 内容 */}
                <div className='ml-8 flex-1'>
                  {/* 标题和类型 */}
                  <div className='mb-2 flex items-start justify-between'>
                    <div className='flex items-center gap-2'>
                      <h3 className='font-semibold text-zinc-900 dark:text-zinc-50'>
                        {event.title}
                      </h3>
                      <Badge
                        variant='outline'
                        className={`${colors.text} ${colors.border}`}
                      >
                        {eventLabel}
                      </Badge>
                    </div>

                    {!readonly && (
                      <div className='flex items-center gap-1'>
                        <button
                          onClick={() => setEditingEvent(event)}
                          className='rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200'
                        >
                          <Edit className='h-4 w-4' />
                        </button>
                        <button
                          onClick={() => handleDelete(event.id)}
                          className='rounded p-1 text-red-500 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                        >
                          <Trash2 className='h-4 w-4' />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 描述 */}
                  {event.description && (
                    <p className='mb-2 text-sm text-zinc-600 dark:text-zinc-400'>
                      {event.description}
                    </p>
                  )}

                  {/* 日期 */}
                  <div className='flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400'>
                    <div className='flex items-center gap-1'>
                      <Calendar className='h-3 w-3' />
                      <span>{formatDate(event.eventDate)}</span>
                    </div>
                    <div className='text-zinc-400'>•</div>
                    <div>创建于 {formatDateTime(event.createdAt)}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 添加/编辑表单 */}
      {showForm && (
        <TimelineEventForm
          caseId={caseId}
          onClose={() => {
            setShowForm(false);
            loadEvents();
          }}
        />
      )}

      {editingEvent && (
        <TimelineEventForm
          caseId={caseId}
          event={editingEvent}
          onClose={() => {
            setEditingEvent(null);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}

export default CaseTimeline;
