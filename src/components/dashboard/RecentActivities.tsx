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
  case: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950',
  client: 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-950',
  team: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950',
  schedule:
    'text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950',
  reminder: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-950',
};

/**
 * 近期活动组件
 */
export function RecentActivities({ activities }: RecentActivitiesProps) {
  return (
    <div className='rounded-lg border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950'>
      <h3 className='mb-4 text-lg font-semibold text-gray-900 dark:text-gray-50'>
        近期活动
      </h3>
      <div className='space-y-4'>
        {activities.length === 0 ? (
          <p className='py-8 text-center text-sm text-gray-500 dark:text-gray-400'>
            暂无近期活动
          </p>
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
      className={`group flex items-start gap-3 rounded-lg p-3 transition-all duration-200 hover:bg-gray-50 dark:hover:bg-zinc-900 ${activity.link ? 'cursor-pointer' : ''}`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-full p-2 ${iconColor}`}
      >
        <svg
          className='h-4 w-4'
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
      <div className='flex-1 min-w-0'>
        <p className='text-sm font-medium text-gray-900 dark:text-gray-50'>
          {activity.title}
        </p>
        <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>
          {activity.description}
        </p>
        <p className='mt-1 text-xs text-gray-500 dark:text-gray-500'>
          {activity.time}
        </p>
      </div>
    </ActivityWrapper>
  );
}
