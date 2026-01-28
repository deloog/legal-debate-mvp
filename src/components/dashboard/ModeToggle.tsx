'use client';

/**
 * 模式切换组件
 *
 * 允许用户在律师模式和企业法务模式之间切换
 */

import { useUserMode, type UserMode } from '@/contexts/UserModeContext';

interface ModeOption {
  value: UserMode;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
}

const modeOptions: ModeOption[] = [
  {
    value: 'lawyer',
    label: '律师模式',
    shortLabel: '律师',
    description: '执业律师工作场景',
    icon: (
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
          d='M3 6l3 1m0 0l-3 1m0-1l18 5M6 8l0 13M6 8l18 5m-18 5l6-2m6 0l6 2M6 13l6 3m6-3l6 3'
        />
      </svg>
    ),
  },
  {
    value: 'enterprise',
    label: '企业法务模式',
    shortLabel: '法务',
    description: '企业法务部门场景',
    icon: (
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
          d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
        />
      </svg>
    ),
  },
];

export function ModeToggle() {
  const { mode, setMode } = useUserMode();

  return (
    <div className='flex items-center gap-1 rounded-lg bg-slate-100 p-1'>
      {modeOptions.map(option => (
        <button
          key={option.value}
          onClick={() => setMode(option.value)}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-all ${
            mode === option.value
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
          title={option.description}
        >
          {option.icon}
          <span className='hidden sm:inline'>{option.label}</span>
          <span className='sm:hidden'>{option.shortLabel}</span>
        </button>
      ))}
    </div>
  );
}

/**
 * 紧凑版模式切换
 */
export function ModeToggleCompact() {
  const { mode, setMode, isLawyerMode } = useUserMode();

  const handleToggle = () => {
    setMode(isLawyerMode ? 'enterprise' : 'lawyer');
  };

  return (
    <button
      onClick={handleToggle}
      className='group flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-200'
      title={`当前：${isLawyerMode ? '律师模式' : '企业法务模式'}，点击切换`}
    >
      <div className='relative h-5 w-5'>
        <div
          className={`absolute inset-0 transition-opacity ${isLawyerMode ? 'opacity-100' : 'opacity-0'}`}
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
              d='M3 6l3 1m0 0l-3 1m0-1l18 5M6 8l0 13M6 8l18 5m-18 5l6-2m6 0l6 2M6 13l6 3m6-3l6 3'
            />
          </svg>
        </div>
        <div
          className={`absolute inset-0 transition-opacity ${isLawyerMode ? 'opacity-0' : 'opacity-100'}`}
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
              d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
            />
          </svg>
        </div>
      </div>
      <span>{isLawyerMode ? '律师' : '法务'}</span>
      <svg
        className='h-4 w-4 text-slate-400 transition-transform group-hover:rotate-180'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M8 9l4-4 4 4m0 6l-4 4-4-4'
        />
      </svg>
    </button>
  );
}

export default ModeToggle;
