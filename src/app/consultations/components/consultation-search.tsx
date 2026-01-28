/**
 * 咨询搜索组件
 * 功能：提供关键词搜索输入框
 */
'use client';

import { Search } from 'lucide-react';

interface ConsultationSearchProps {
  value: string;
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function ConsultationSearch({
  value,
  onSearch,
  placeholder = '搜索客户姓名或电话...',
}: ConsultationSearchProps) {
  return (
    <div className='relative'>
      <div className='pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3'>
        <Search className='h-4 w-4 text-zinc-400' />
      </div>
      <input
        type='text'
        value={value}
        onChange={e => onSearch(e.target.value)}
        placeholder={placeholder}
        className='w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20'
      />
    </div>
  );
}
