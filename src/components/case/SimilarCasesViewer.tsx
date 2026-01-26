'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import type {
  SimilaritySearchResult,
  PrismaCaseExample,
} from '@/types/case-example';
import { getCaseResultLabel } from '@/types/case-example';

export interface SimilarCasesViewerProps {
  searchResult: SimilaritySearchResult | null;
  loading?: boolean;
  error?: string | null;
}

export function SimilarCasesViewer({
  searchResult,
  loading = false,
  error = null,
}: SimilarCasesViewerProps) {
  const [sortBy, setSortBy] = useState<'similarity' | 'date'>('similarity');

  if (loading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} />;
  }

  if (!searchResult || searchResult.matches.length === 0) {
    return <EmptyState />;
  }

  // 根据选择的排序方式排序
  const sortedMatches = [...searchResult.matches].sort((a, b) => {
    if (sortBy === 'similarity') {
      return b.similarity - a.similarity;
    }
    return (
      new Date(b.caseExample.judgmentDate).getTime() -
      new Date(a.caseExample.judgmentDate).getTime()
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>相似案例（{searchResult.matches.length}）</CardTitle>
          <SortButtons sortBy={sortBy} onSortByChange={setSortBy} />
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          {sortedMatches.map(match => (
            <SimilarCaseCard key={match.caseExample.id} match={match} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SortButtons({
  sortBy,
  onSortByChange,
}: {
  sortBy: 'similarity' | 'date';
  onSortByChange: (sortBy: 'similarity' | 'date') => void;
}) {
  return (
    <div className='flex gap-2'>
      <Button
        variant={sortBy === 'similarity' ? 'primary' : 'outline'}
        size='sm'
        onClick={() => onSortByChange('similarity')}
      >
        按相似度排序
      </Button>
      <Button
        variant={sortBy === 'date' ? 'primary' : 'outline'}
        size='sm'
        onClick={() => onSortByChange('date')}
      >
        按日期排序
      </Button>
    </div>
  );
}

function SimilarCaseCard({
  match,
}: {
  match: { similarity: number; caseExample: PrismaCaseExample };
}) {
  const { caseExample } = match;
  const similarityPercentage = Math.round(match.similarity * 100);

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

  const getSimilarityColor = (similarity: number): string => {
    if (similarity >= 0.8) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (similarity >= 0.6) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className='rounded-lg border-2 border-gray-200 p-4 hover:shadow-md transition-shadow'>
      <div className='mb-3 flex items-start justify-between'>
        <div className='flex-1'>
          <div className='flex items-center gap-2 flex-wrap mb-2'>
            <h4 className='font-semibold text-gray-900'>{caseExample.title}</h4>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${getTypeColor(
                caseExample.type
              )}`}
            >
              {getTypeName(caseExample.type)}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${getResultColor(
                caseExample.result
              )}`}
            >
              {getCaseResultLabel(caseExample.result)}
            </span>
          </div>
          <p className='text-sm text-gray-500'>{caseExample.caseNumber}</p>
        </div>
        <div
          className={`rounded-lg border-2 px-3 py-1 ${getSimilarityColor(
            match.similarity
          )}`}
        >
          <div className='text-center'>
            <div className='text-lg font-bold'>{similarityPercentage}%</div>
            <div className='text-xs'>相似度</div>
          </div>
        </div>
      </div>

      <div className='mb-3 space-y-1 text-sm text-gray-600'>
        <div className='flex items-center'>
          <span className='mr-2 font-medium w-16 shrink-0'>法院:</span>
          <span className='truncate'>{caseExample.court}</span>
        </div>
        {caseExample.cause && (
          <div className='flex items-center'>
            <span className='mr-2 font-medium w-16 shrink-0'>案由:</span>
            <span className='truncate'>{caseExample.cause}</span>
          </div>
        )}
        <div className='flex items-center'>
          <span className='mr-2 font-medium w-16 shrink-0'>判决日:</span>
          <span>
            {new Date(caseExample.judgmentDate).toLocaleDateString('zh-CN')}
          </span>
        </div>
      </div>

      {caseExample.facts && (
        <div>
          <div className='mb-1 text-sm text-gray-600'>
            <span className='font-medium'>事实摘要:</span>
          </div>
          <p className='text-sm text-gray-700 line-clamp-2'>
            {caseExample.facts}
          </p>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <Card>
      <CardContent className='p-8 text-center'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center'>
          <div className='h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600' />
        </div>
        <p className='text-gray-600'>加载中...</p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ error }: { error: string }) {
  return (
    <Card>
      <CardContent className='p-8 text-center'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100'>
          <span className='text-4xl'>❌</span>
        </div>
        <p className='text-red-600'>{error}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className='py-16 text-center'>
        <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100'>
          <span className='text-4xl'>🔍</span>
        </div>
        <h3 className='mb-2 text-lg font-semibold text-gray-900'>
          暂无相似案例
        </h3>
        <p className='text-gray-500'>请先执行相似案例检索</p>
      </CardContent>
    </Card>
  );
}
