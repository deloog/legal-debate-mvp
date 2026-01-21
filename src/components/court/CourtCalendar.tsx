'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { CourtScheduleDetail } from '../../types/court-schedule';

/**
 * 日历视图组件
 * 功能：展示月/周/日视图的法庭日程
 */

interface CourtCalendarProps {
  viewMode: 'month' | 'week' | 'day';
  selectedDate: Date;
  onViewModeChange: (mode: 'month' | 'week' | 'day') => void;
  onDateChange: (date: Date) => void;
}

export function CourtCalendar(props: CourtCalendarProps) {
  const { viewMode, selectedDate, onViewModeChange, onDateChange } = props;
  const [schedules, setSchedules] = useState<CourtScheduleDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] =
    useState<CourtScheduleDetail | null>(null);

  const loadSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      const startDate = new Date(selectedDate);
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(selectedDate);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate.setDate(0);
      endDate.setHours(23, 59, 59, 999);

      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const response = await fetch(`/api/court-schedules?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = (await response.json()) as {
          schedules: CourtScheduleDetail[];
        };
        setSchedules(data.schedules || []);
      }
    } catch (error) {
      console.error('Failed to load schedules:', error);
      setSchedules([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  const handlePreviousMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  const handleScheduleClick = (schedule: CourtScheduleDetail) => {
    setSelectedSchedule(schedule);
  };

  const handleScheduleClose = () => {
    setSelectedSchedule(null);
  };

  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const monthName = new Date(year, month).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
  });

  return (
    <div className='space-y-4'>
      {/* 工具栏 */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-4'>
          <h2 className='text-xl font-semibold text-zinc-900 dark:text-zinc-50'>
            {monthName}
          </h2>
          <div className='flex items-center gap-2'>
            <Button variant='outline' size='sm' onClick={handlePreviousMonth}>
              <ChevronLeft className='h-4 w-4' />
            </Button>
            <Button variant='outline' size='sm' onClick={handleToday}>
              今天
            </Button>
            <Button variant='outline' size='sm' onClick={handleNextMonth}>
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        </div>

        <div className='flex items-center gap-2'>
          {(['month', 'week', 'day'] as const).map(mode => (
            <Button
              key={mode}
              variant={viewMode === mode ? 'default' : 'outline'}
              size='sm'
              onClick={() => onViewModeChange(mode)}
            >
              {mode === 'month' && '月'}
              {mode === 'week' && '周'}
              {mode === 'day' && '日'}
            </Button>
          ))}
        </div>
      </div>

      {/* 日历内容 */}
      {isLoading ? (
        <div className='h-96 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800' />
      ) : (
        <MonthView
          year={year}
          month={month}
          schedules={schedules}
          onScheduleClick={handleScheduleClick}
        />
      )}

      {/* 日程详情对话框 */}
      {selectedSchedule && (
        <ScheduleDetailDialog
          schedule={selectedSchedule}
          onClose={handleScheduleClose}
        />
      )}
    </div>
  );
}

/**
 * 月视图组件
 */
interface MonthViewProps {
  year: number;
  month: number;
  schedules: CourtScheduleDetail[];
  onScheduleClick: (schedule: CourtScheduleDetail) => void;
}

function MonthView(props: MonthViewProps) {
  const { year, month, schedules, onScheduleClick } = props;

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  // 填充月初空白
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(new Date(0, 0, 0)); // 占位符
  }

  // 填充日期
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    currentWeek.push(date);

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // 填充月末空白
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(new Date(0, 0, 0)); // 占位符
    }
    weeks.push(currentWeek);
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className='rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950'>
      {/* 星期表头 */}
      <div className='grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900'>
        {weekDays.map(day => (
          <div
            key={day}
            className='px-4 py-2 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300'
          >
            {day}
          </div>
        ))}
      </div>

      {/* 日期网格 */}
      <div className='grid grid-cols-7'>
        {weeks.map((week, weekIndex) =>
          week.map((date, dayIndex) => {
            if (date.getTime() === 0) {
              return (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className='min-h-24 border-b border-r border-zinc-100 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-900/50'
                />
              );
            }

            const daySchedules = schedules.filter(schedule => {
              const scheduleDate = new Date(schedule.startTime);
              return (
                scheduleDate.getDate() === date.getDate() &&
                scheduleDate.getMonth() === month &&
                scheduleDate.getFullYear() === year
              );
            });

            const isToday = new Date().toDateString() === date.toDateString();

            return (
              <div
                key={`${weekIndex}-${dayIndex}`}
                className={`min-h-24 border-b border-r border-zinc-100 p-1 dark:border-zinc-800 ${
                  isToday ? 'bg-blue-50/30 dark:bg-blue-950/30' : ''
                }`}
              >
                <div
                  className={`mb-1 text-center text-sm ${
                    isToday
                      ? 'rounded-full bg-blue-600 px-2 py-1 text-white'
                      : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {date.getDate()}
                </div>
                <div className='space-y-1'>
                  {daySchedules.slice(0, 3).map(schedule => (
                    <ScheduleItem
                      key={schedule.id}
                      schedule={schedule}
                      onClick={() => onScheduleClick(schedule)}
                    />
                  ))}
                  {daySchedules.length > 3 && (
                    <div className='px-2 text-xs text-zinc-500 dark:text-zinc-400'>
                      +{daySchedules.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * 日程项组件
 */
interface ScheduleItemProps {
  schedule: CourtScheduleDetail;
  onClick: () => void;
}

function ScheduleItem(props: ScheduleItemProps) {
  const { schedule, onClick } = props;

  const getTypeColor = (type: string): string => {
    switch (type) {
      case 'TRIAL':
        return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
      case 'MEDIATION':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
      case 'ARBITRATION':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
      case 'MEETING':
        return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'TRIAL':
        return '开庭';
      case 'MEDIATION':
        return '调解';
      case 'ARBITRATION':
        return '仲裁';
      case 'MEETING':
        return '会谈';
      default:
        return '其他';
    }
  };

  const startTime = new Date(schedule.startTime);
  const endTime = new Date(schedule.endTime);
  const timeRange = `${startTime.getHours()}:${startTime
    .getMinutes()
    .toString()
    .padStart(2, '0')}-${endTime.getHours()}:${endTime
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  return (
    <button
      type='button'
      onClick={onClick}
      className={`w-full truncate rounded px-2 py-1 text-left text-xs ${getTypeColor(schedule.type)}`}
    >
      <div className='truncate font-medium'>{schedule.title}</div>
      <div className='truncate text-xs opacity-80'>
        {timeRange} {getTypeLabel(schedule.type)}
      </div>
    </button>
  );
}

/**
 * 日程详情对话框
 */
interface ScheduleDetailDialogProps {
  schedule: CourtScheduleDetail;
  onClose: () => void;
}

function ScheduleDetailDialog(props: ScheduleDetailDialogProps) {
  const { schedule, onClose } = props;

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
      case 'CONFIRMED':
        return 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300';
      case 'COMPLETED':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';
      case 'RESCHEDULED':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300';
      default:
        return 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'SCHEDULED':
        return '已安排';
      case 'CONFIRMED':
        return '已确认';
      case 'COMPLETED':
        return '已完成';
      case 'CANCELLED':
        return '已取消';
      case 'RESCHEDULED':
        return '已改期';
      default:
        return status;
    }
  };

  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'TRIAL':
        return '开庭';
      case 'MEDIATION':
        return '调解';
      case 'ARBITRATION':
        return '仲裁';
      case 'MEETING':
        return '会谈';
      default:
        return '其他';
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='w-full max-w-lg rounded-lg bg-white p-6 shadow-lg dark:bg-zinc-950'>
        <div className='mb-4 flex items-start justify-between'>
          <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
            {schedule.title}
          </h3>
          <button
            type='button'
            onClick={onClose}
            className='text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300'
          >
            ✕
          </button>
        </div>

        <div className='space-y-3'>
          <div className='flex items-center justify-between'>
            <span className='text-sm text-zinc-600 dark:text-zinc-400'>
              类型
            </span>
            <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
              {getTypeLabel(schedule.type)}
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-sm text-zinc-600 dark:text-zinc-400'>
              状态
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(schedule.status)}`}
            >
              {getStatusLabel(schedule.status)}
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-sm text-zinc-600 dark:text-zinc-400'>
              开始时间
            </span>
            <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
              {new Date(schedule.startTime).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          <div className='flex items-center justify-between'>
            <span className='text-sm text-zinc-600 dark:text-zinc-400'>
              结束时间
            </span>
            <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
              {new Date(schedule.endTime).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>

          {schedule.location && (
            <div className='flex items-center justify-between'>
              <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                地点
              </span>
              <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                {schedule.location}
              </span>
            </div>
          )}

          {schedule.judge && (
            <div className='flex items-center justify-between'>
              <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                法官
              </span>
              <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                {schedule.judge}
              </span>
            </div>
          )}

          {schedule.caseTitle && (
            <div className='flex items-center justify-between'>
              <span className='text-sm text-zinc-600 dark:text-zinc-400'>
                关联案件
              </span>
              <span className='text-sm font-medium text-zinc-900 dark:text-zinc-50'>
                {schedule.caseTitle}
              </span>
            </div>
          )}

          {schedule.notes && (
            <div>
              <span className='mb-1 block text-sm text-zinc-600 dark:text-zinc-400'>
                备注
              </span>
              <p className='text-sm text-zinc-900 dark:text-zinc-50'>
                {schedule.notes}
              </p>
            </div>
          )}
        </div>

        <div className='mt-6 flex justify-end gap-2'>
          <Button variant='outline' onClick={onClose}>
            关闭
          </Button>
        </div>
      </div>
    </div>
  );
}
