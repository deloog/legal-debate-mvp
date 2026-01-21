'use client';

import { Suspense, useState } from 'react';
import { CourtCalendar } from '../../components/court/CourtCalendar';
import { CourtScheduleForm } from '../../components/court/CourtScheduleForm';
import { Button } from '../../components/ui/button';
import { Plus } from 'lucide-react';

/**
 * 法庭日历管理页面主入口
 * 功能：展示法庭日程日历、创建和编辑日程
 */
export default function CourtSchedulePage() {
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const handleCreateSchedule = () => {
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleViewModeChange = (mode: 'month' | 'week' | 'day') => {
    setViewMode(mode);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black'>
      {/* 页面头部 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto flex max-w-7xl items-center justify-between'>
          <div>
            <h1 className='text-2xl font-semibold text-zinc-900 dark:text-zinc-50'>
              法庭日历
            </h1>
            <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400'>
              管理您的法庭开庭日程
            </p>
          </div>
          <Button onClick={handleCreateSchedule}>
            <Plus className='mr-2 h-4 w-4' />
            创建日程
          </Button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className='mx-auto max-w-7xl px-6 py-6'>
        <Suspense fallback={<LoadingSkeleton />}>
          <CourtCalendar
            viewMode={viewMode}
            selectedDate={selectedDate}
            onViewModeChange={handleViewModeChange}
            onDateChange={handleDateChange}
          />
        </Suspense>
      </main>

      {/* 日程表单对话框 */}
      {showForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
          <div className='w-full max-w-2xl rounded-lg bg-white p-6 dark:bg-zinc-950'>
            <CourtScheduleForm onClose={handleFormClose} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 加载骨架屏
 */
function LoadingSkeleton() {
  return (
    <div className='space-y-4'>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className='h-48 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'
        >
          <div className='mb-4 flex items-center gap-4'>
            <div className='h-4 w-1/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='h-6 w-20 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800' />
          </div>
          <div className='space-y-2'>
            <div className='h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
            <div className='h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800' />
          </div>
        </div>
      ))}
    </div>
  );
}
