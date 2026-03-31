'use client';

import { MemoryType } from '@prisma/client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Trash2, Filter } from 'lucide-react';

interface MemoryFilterProps {
  selectedType: MemoryType | 'ALL';
  onTypeChange: (type: MemoryType | 'ALL') => void;
  keyword: string;
  onKeywordChange: (keyword: string) => void;
  showExpired: boolean;
  onShowExpiredChange: (show: boolean) => void;
  onSearch: () => void;
  onCleanup: () => void;
  loading?: boolean;
}

const typeOptions: {
  value: MemoryType | 'ALL';
  label: string;
  color: string;
}[] = [
  { value: 'ALL', label: '全部', color: 'bg-gray-500' },
  { value: MemoryType.WORKING, label: 'Working', color: 'bg-blue-500' },
  { value: MemoryType.HOT, label: 'Hot', color: 'bg-orange-500' },
  { value: MemoryType.COLD, label: 'Cold', color: 'bg-purple-500' },
];

export function MemoryFilter({
  selectedType,
  onTypeChange,
  keyword,
  onKeywordChange,
  showExpired,
  onShowExpiredChange,
  onSearch,
  onCleanup,
  loading,
}: MemoryFilterProps) {
  return (
    <div className='space-y-4 rounded-lg border bg-card p-4'>
      {/* 类型筛选 */}
      <div className='flex flex-wrap items-center gap-2'>
        <Filter className='h-4 w-4 text-muted-foreground' />
        <span className='text-sm font-medium'>记忆类型:</span>
        {typeOptions.map(option => (
          <Button
            key={option.value}
            variant={selectedType === option.value ? 'default' : 'outline'}
            size='sm'
            className={`h-7 px-3 text-xs ${
              selectedType === option.value ? option.color : ''
            }`}
            onClick={() => onTypeChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* 搜索和筛选 */}
      <div className='flex flex-wrap items-center gap-4'>
        <div className='flex items-center gap-2 flex-1 min-w-[200px]'>
          <Search className='h-4 w-4 text-muted-foreground' />
          <Input
            placeholder='搜索记忆 key...'
            value={keyword}
            onChange={e => onKeywordChange(e.target.value)}
            className='flex-1'
            onKeyDown={e => e.key === 'Enter' && onSearch()}
          />
        </div>

        <div className='flex items-center gap-2'>
          <label className='flex items-center gap-2 text-sm cursor-pointer'>
            <input
              type='checkbox'
              checked={showExpired}
              onChange={e => onShowExpiredChange(e.target.checked)}
              className='rounded border-gray-300'
            />
            只显示已过期
          </label>
        </div>

        <div className='flex items-center gap-2'>
          <Button onClick={onSearch} disabled={loading} size='sm'>
            <Search className='h-4 w-4 mr-1' />
            搜索
          </Button>
          <Button
            onClick={onCleanup}
            disabled={loading}
            variant='destructive'
            size='sm'
          >
            <Trash2 className='h-4 w-4 mr-1' />
            清理过期
          </Button>
        </div>
      </div>
    </div>
  );
}
