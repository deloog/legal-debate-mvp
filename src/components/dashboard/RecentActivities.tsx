/**
 * 近期活动组件
 */

'use client';

import Link from 'next/link';
import type { RecentActivity as RecentActivityType } from '@/types/dashboard';

interface RecentActivitiesProps {
  activities: RecentActivityType[];
}

const typeIcons: Record<RecentActivityType['type'], string> = {
  case: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  client:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  team: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  schedule:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  reminder:
    'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
};

const typeColors: Record<RecentActivityType['type'], string> = {
  case: 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white',
  client: 'bg-gradient-to-br from-green-500 to-emerald-500 text-white',
  team: 'bg-gradient-to-br from-purple-500 to-violet-500 text-white',
  schedule: 'bg-gradient-to-br from-yellow-500 to-orange-500 text-white',
  reminder: 'bg-gradient-to-br from-red-500 to-rose-500 text-white',
};

/**
 * 近期活动组件
 */
export function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <div className='rounded-2xl border border-slate-200 bg-white p-6 shadow-sm'>
      <h3 className='mb-6 text-lg font-semibold text-slate-900'>近期活动</h3>
      <div className='space-y-3'>
        {activities.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-12'>
            <div className='mb-4 rounded-full bg-slate-100 p-4'>
              <svg
                className='h-8 w-8 text-slate-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
                />
              </svg>
            </div>
            <p className='text-sm text-slate-500'>暂无近期活动</p>
          </div>
        ) : (
          activities.map(activity => (
            <ActivityItem key={activity.id} activity={activity} />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * 活动项组件
 */
function ActivityItem({ activity }: { activity: RecentActivityType }) {
  const iconPath = typeIcons[activity.type];
  const iconColor = typeColors[activity.type];
  const ActivityWrapper = activity.link ? Link : 'div';

  return (
    <ActivityWrapper
      {...(activity.link && { href: activity.link })}
      className={`group flex items-start gap-4 rounded-xl border border-slate-100 bg-slate-50 p-4 transition-all duration-200 hover:border-violet-200 hover:bg-violet-50/50 hover:shadow-md ${activity.link ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-md ${iconColor}`}
      >
        <svg
          className='h-5 w-5'
          fill='none'
          stroke='currentColor'
          viewBox='0 0 24 24'
        >
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d={iconPath}
          />
        </svg>
      </div>
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold text-slate-900'>{activity.title}</p>
        <p className='mt-1 text-sm text-slate-600'>{activity.description}</p>
        <p className='mt-2 text-xs font-medium text-slate-500'>
          {activity.time}
        </p>
      </div>
    </ActivityWrapper>
  );
}
