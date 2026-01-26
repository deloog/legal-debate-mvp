'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { getCaseResultLabel, type CaseExample } from '@/types/case-example';

export interface CaseExampleListProps {
  examples: CaseExample[];
  loading?: boolean;
  total: number;
  page: number;
  totalPages: number;
  onViewDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onCreate?: () => void;
  onPageChange: (page: number) => void;
}

export function CaseExampleList({
  examples,
  loading = false,
  total,
  page,
  totalPages,
  onViewDetail,
  onEdit,
  onDelete,
  onCreate,
  onPageChange,
}: CaseExampleListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除此案例吗？此操作不可恢复。')) {
      setDeleteId(id);
      try {
        await onDelete(id);
      } finally {
        setDeleteId(null);
      }
    }
  };

  const getTypeName = (type: string): string => {
    const names: Record<string, string> = {
      CIVIL: '民事',
      CRIMINAL: '刑事',
      ADMINISTRATIVE: '行政',
      COMMERCIAL: '商事',
      LABOR: '劳动',
      INTELLECTUAL: '知识产权',
      OTHER: '其他',
    };
    return names[type] || type;
  };

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      CIVIL: 'bg-blue-100 text-blue-800',
      CRIMINAL: 'bg-red-100 text-red-800',
      ADMINISTRATIVE: 'bg-yellow-100 text-yellow-800',
      COMMERCIAL: 'bg-purple-100 text-purple-800',
      LABOR: 'bg-green-100 text-green-800',
      INTELLECTUAL: 'bg-indigo-100 text-indigo-800',
      OTHER: 'bg-gray-100 text-gray-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getResultColor = (result: string): string => {
    const colors: Record<string, string> = {
      WIN: 'bg-green-100 text-green-800',
      LOSE: 'bg-red-100 text-red-800',
      PARTIAL: 'bg-yellow-100 text-yellow-800',
      WITHDRAW: 'bg-gray-100 text-gray-800',
    };
    return colors[result] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (examples.length === 0) {
    return <EmptyState onCreate={onCreate} />;
  }

  return (
    <div className='space-y-4'>
      <div className='flex justify-between items-center'>
        <div className='text-sm text-gray-600'>
          共 {total} 条记录，当前第 {page} 页
        </div>
        <div className='flex space-x-2'>
          {onCreate && (
            <Button variant='primary' onClick={onCreate}>
              添加案例
            </Button>
          )}
        </div>
      </div>

      <div className='space-y-4'>
        {examples.map(example => (
          <CaseExampleCard
            key={example.id}
            example={example}
            onViewDetail={onViewDetail}
            onEdit={onEdit}
            onDelete={handleDelete}
            isDeleting={deleteId === example.id}
            getTypeName={getTypeName}
            getTypeColor={getTypeColor}
            getResultColor={getResultColor}
          />
        ))}
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}

interface CaseExampleCardProps {
  example: CaseExample;
  onViewDetail: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
  getTypeName: (type: string) => string;
  getTypeColor: (type: string) => string;
  getResultColor: (result: string) => string;
}

function CaseExampleCard({
  example,
  onViewDetail,
  onEdit,
  onDelete,
  isDeleting,
  getTypeName,
  getTypeColor,
  getResultColor,
}: CaseExampleCardProps) {
  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardContent className='p-6'>
        <div className='mb-4 flex items-start justify-between'>
          <div className='flex-1'>
            <div className='flex items-center gap-2 flex-wrap'>
              <h3 className='text-lg font-semibold text-gray-900'>
                {example.title}
              </h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getTypeColor(
                  example.type
                )}`}
              >
                {getTypeName(example.type)}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${getResultColor(
                  example.result
                )}`}
              >
                {getCaseResultLabel(example.result)}
              </span>
            </div>
            <p className='mt-2 text-sm text-gray-500'>{example.caseNumber}</p>
          </div>
        </div>

        <div className='mb-4 space-y-2 text-sm text-gray-600'>
          <div className='flex items-center'>
            <span className='mr-2 font-medium w-16'>法院:</span>
            <span>{example.court}</span>
          </div>
          {example.cause && (
            <div className='flex items-center'>
              <span className='mr-2 font-medium w-16'>案由:</span>
              <span>{example.cause}</span>
            </div>
          )}
          <div className='flex items-center'>
            <span className='mr-2 font-medium w-16'>判决日:</span>
            <span>
              {new Date(example.judgmentDate).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>

        <div className='mb-4'>
          <div className='text-sm text-gray-600 mb-1'>
            <span className='font-medium'>事实摘要:</span>
          </div>
          <p className='text-sm text-gray-700 line-clamp-2'>{example.facts}</p>
        </div>

        <div className='flex justify-between border-t pt-4 text-xs text-gray-500'>
          <div>
            <span className='mr-3'>
              创建于 {new Date(example.createdAt).toLocaleDateString('zh-CN')}
            </span>
            <span>
              更新于 {new Date(example.updatedAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        </div>

        <div className='mt-4 flex justify-end space-x-2'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onViewDetail(example.id)}
          >
            查看
          </Button>
          <Button variant='ghost' size='sm' onClick={() => onEdit(example.id)}>
            编辑
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={() => onDelete(example.id)}
            disabled={isDeleting}
            className='text-red-600 hover:bg-red-50'
          >
            {isDeleting ? '删除中...' : '删除'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisiblePages = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className='flex items-center justify-center space-x-2'>
      <Button
        variant='outline'
        size='sm'
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
      >
        上一页
      </Button>
      {pages.map(page => (
        <Button
          key={page}
          variant={page === currentPage ? 'primary' : 'outline'}
          size='sm'
          onClick={() => onPageChange(page)}
        >
          {page}
        </Button>
      ))}
      <Button
        variant='outline'
        size='sm'
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
      >
        下一页
      </Button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className='space-y-4'>
      {[...Array(3)].map((_, index) => (
        <Card key={index}>
          <CardContent className='p-6'>
            <div className='mb-4 flex items-start justify-between'>
              <div className='flex-1 space-y-2'>
                <div className='h-6 w-2/3 animate-pulse rounded bg-gray-200' />
                <div className='h-4 w-1/2 animate-pulse rounded bg-gray-200' />
              </div>
              <div className='flex gap-2'>
                <div className='h-6 w-16 animate-pulse rounded-full bg-gray-200' />
                <div className='h-6 w-16 animate-pulse rounded-full bg-gray-200' />
              </div>
            </div>
            <div className='mb-4 space-y-2'>
              <div className='h-4 w-1/4 animate-pulse rounded bg-gray-200' />
              <div className='h-4 w-3/4 animate-pulse rounded bg-gray-200' />
            </div>
            <div className='mb-4'>
              <div className='h-4 w-1/4 animate-pulse rounded bg-gray-200 mb-2' />
              <div className='h-4 w-full animate-pulse rounded bg-gray-200' />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <Card>
      <CardContent className='py-16 text-center'>
        <div className='mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100'>
          <svg
            className='h-12 w-12 text-gray-400'
            fill='none'
            viewBox='0 0 24 24'
            stroke='currentColor'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
            />
          </svg>
        </div>
        <h3 className='mb-2 text-lg font-semibold text-gray-900'>暂无案例</h3>
        <p className='mb-6 text-gray-500'>开始添加您的第一个案例</p>
        {onCreate && (
          <Button variant='primary' onClick={onCreate}>
            添加案例
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
