'use client';

import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCases, CaseFilters } from '@/lib/hooks/use-cases';
import { CaseListItem } from './case-list-item';
import { CaseSearch } from './case-search';

/**
 * 案件列表组件
 * 功能：展示案件列表，支持分页
 */
export function CaseList() {
  const router = useRouter();
  const [filters] = useState<CaseFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const { cases, loading, error, pagination, goToPage, refetch } = useCases(
    filters,
    searchQuery
  );

  /**
   * 处理搜索变化（使用useCallback避免子组件重渲染）
   */
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      // 搜索变化时重置到第一页
      goToPage(1);
    },
    [goToPage]
  );

  /**
   * 处理页面变化（使用useCallback避免子组件重渲染）
   */
  const handlePageChange = useCallback(
    (newPage: number) => {
      goToPage(newPage);
    },
    [goToPage]
  );

  /**
   * 开始辩论（使用useCallback避免子组件重渲染）
   */
  const handleStartDebate = useCallback(
    (caseId: string) => {
      // 跳转到辩论创建页面，并携带案件ID
      router.push(`/debates/create?caseId=${caseId}`);
    },
    [router]
  );

  /**
   * 删除案件（使用useCallback避免子组件重渲染）
   */
  const handleDeleteCase = useCallback(
    async (caseId: string) => {
      if (!confirm('确定要删除这个案件吗？此操作不可撤销。')) {
        return;
      }

      try {
        const response = await fetch(`/api/v1/cases/${caseId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          // 刷新列表
          refetch();
        } else {
          const data = await response.json();
          alert(data.error || '删除失败');
        }
      } catch (error) {
        console.error('删除案件失败:', error);
        alert('删除失败，请重试');
      }
    },
    [refetch]
  );

  /**
   * 渲染分页按钮
   */
  const renderPagination = () => {
    const { page, totalPages } = pagination;

    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages = [];
      const maxVisible = 5;
      const startPage = Math.max(1, page - Math.floor(maxVisible / 2));
      const endPage = Math.min(totalPages, startPage + maxVisible - 1);

      const finalStart =
        endPage - startPage < maxVisible
          ? Math.max(1, endPage - maxVisible + 1)
          : startPage;

      for (let i = finalStart; i <= endPage; i++) {
        pages.push(i);
      }

      return pages;
    };

    return (
      <div className='mt-6 flex items-center justify-center gap-2'>
        {/* 上一页 */}
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
          className='flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
        >
          <ChevronLeft className='h-4 w-4' />
        </button>

        {/* 页码 */}
        {getPageNumbers().map(pageNum => (
          <button
            key={pageNum}
            onClick={() => handlePageChange(pageNum)}
            className={`h-10 w-10 rounded-md text-sm font-medium transition-colors ${
              pageNum === page
                ? 'bg-blue-600 text-white'
                : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {pageNum}
          </button>
        ))}

        {/* 下一页 */}
        <button
          onClick={() => handlePageChange(page + 1)}
          disabled={page === totalPages}
          className='flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
        >
          <ChevronRight className='h-4 w-4' />
        </button>
      </div>
    );
  };

  /**
   * 渲染加载状态
   */
  if (loading) {
    return (
      <div className='space-y-4'>
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className='h-40 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'
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

  /**
   * 渲染错误状态
   */
  if (error) {
    return (
      <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20'>
        <p className='text-lg font-medium text-red-800 dark:text-red-200'>
          加载失败
        </p>
        <p className='mt-2 text-sm text-red-600 dark:text-red-300'>
          {error.message}
        </p>
        <button
          onClick={refetch}
          className='mt-4 rounded-md bg-red-100 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200 dark:hover:bg-red-900/50'
        >
          重试
        </button>
      </div>
    );
  }

  /**
   * 渲染空状态
   */
  if (cases.length === 0) {
    return (
      <div className='rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-950'>
        <p className='text-lg font-medium text-zinc-700 dark:text-zinc-300'>
          暂无案件
        </p>
        <p className='mt-2 text-sm text-zinc-500 dark:text-zinc-400'>
          {searchQuery ||
          (filters.types?.length ?? 0) > 0 ||
          (filters.statuses?.length ?? 0) > 0
            ? '没有找到匹配的案件，请尝试调整搜索或筛选条件'
            : '点击右上角创建新案件开始使用'}
        </p>
      </div>
    );
  }

  /**
   * 渲染案件列表
   */
  return (
    <div className='space-y-4'>
      {/* 顶部工具栏：搜索和筛选 */}
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex-1'>
          <CaseSearch value={searchQuery} onSearch={handleSearchChange} />
        </div>
        <button
          onClick={() => {
            // TODO: 显示筛选抽屉
            console.log('显示筛选');
          }}
          className='flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
        >
          <span>筛选</span>
          <span className='text-zinc-400 dark:text-zinc-500'>
            {(filters.types?.length ?? 0) + (filters.statuses?.length ?? 0) >
              0 && '（已激活）'}
          </span>
        </button>
      </div>

      {/* 案件统计 */}
      <div className='mb-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400'>
        <span>共 {pagination.total} 个案件</span>
        <span>
          显示第 {(pagination.page - 1) * pagination.pageSize + 1} -{' '}
          {Math.min(pagination.page * pagination.pageSize, pagination.total)} 个
        </span>
      </div>

      {/* 案件列表 */}
      <div className='space-y-4'>
        {cases.map(caseItem => (
          <CaseListItem
            key={caseItem.id}
            case={caseItem}
            onStartDebate={handleStartDebate}
            onDelete={handleDeleteCase}
          />
        ))}
      </div>

      {/* 分页 */}
      {renderPagination()}
    </div>
  );
}
