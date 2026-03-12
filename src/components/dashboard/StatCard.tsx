/**
 * Dashboard统计卡片组件
 */

'use client';

import React from 'react';
import Link from 'next/link';
import type { StatCard as StatCardType } from '@/types/dashboard';

interface StatCardProps {
  card: StatCardType;
}

const colorClasses: Record<
  StatCardType['color'],
  {
    gradient: string;
    text: string;
    iconBg: string;
    iconText: string;
  }
> = {
  blue: {
    gradient: 'from-blue-500/10 to-cyan-500/10',
    text: 'text-blue-600',
    iconBg: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    iconText: 'text-white',
  },
  green: {
    gradient: 'from-green-500/10 to-emerald-500/10',
    text: 'text-green-600',
    iconBg: 'bg-gradient-to-br from-green-500 to-emerald-500',
    iconText: 'text-white',
  },
  yellow: {
    gradient: 'from-yellow-500/10 to-orange-500/10',
    text: 'text-yellow-600',
    iconBg: 'bg-gradient-to-br from-yellow-500 to-orange-500',
    iconText: 'text-white',
  },
  purple: {
    gradient: 'from-purple-500/10 to-violet-500/10',
    text: 'text-purple-600',
    iconBg: 'bg-gradient-to-br from-purple-500 to-violet-500',
    iconText: 'text-white',
  },
  red: {
    gradient: 'from-red-500/10 to-rose-500/10',
    text: 'text-red-600',
    iconBg: 'bg-gradient-to-br from-red-500 to-rose-500',
    iconText: 'text-white',
  },
};

const icons: Record<string, string> = {
  case: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
  client:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  task: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  schedule:
    'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};

/**
 * 统计卡片组件
 */
export function StatCard({ card }: StatCardProps) {
  const colors = colorClasses[card.color];
  const iconPath = icons[card.icon] || icons.case;
  const CardWrapper = (card.link ? Link : 'div') as React.ElementType;

  return (
    <CardWrapper
      {...(card.link && { href: card.link })}
      className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br ${colors.gradient} bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-xl ${card.link ? 'cursor-pointer hover:scale-[1.02] hover:border-violet-300' : ''}`}
    >
      <div className='flex items-start justify-between'>
        <div className='flex-1'>
          <p className='text-sm font-semibold uppercase tracking-wider text-slate-600'>
            {card.title}
          </p>
          <p className='mt-3 text-4xl font-bold text-slate-900'>{card.value}</p>
          {card.change !== undefined && (
            <p
              className={`mt-3 flex items-center gap-1 text-sm font-medium ${
                card.changeType === 'increase'
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {card.changeType === 'increase' ? (
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2.5}
                    d='M5 10l7-7m0 0l7 7m-7-7v18'
                  />
                </svg>
              ) : (
                <svg
                  className='h-4 w-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2.5}
                    d='M19 14l-7 7m0 0l-7-7m7 7V3'
                  />
                </svg>
              )}
              <span>{Math.abs(card.change)}% 较上月</span>
            </p>
          )}
        </div>
        <div
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${colors.iconBg} shadow-lg`}
        >
          <svg
            className={`h-7 w-7 ${colors.iconText}`}
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
      </div>
    </CardWrapper>
  );
}
