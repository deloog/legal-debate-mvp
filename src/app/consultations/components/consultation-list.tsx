/**
 * 咨询列表组件
 * 功能：展示咨询列表，支持分页、筛选和搜索
 */
'use client';

import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  useConsultations,
  ConsultationFilters,
} from '@/lib/hooks/use-consultations';
import { ConsultationListItem } from './consultation-list-item';
import { ConsultationSearch } from './consultation-search';
import { FilterDrawer } from './filter-drawer';

/**
 * 咨询列表组件
 */
export function ConsultationList() {
  const router = useRouter();
  const [filters, setFilters] = useState<ConsultationFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const { consultations, loading, error, pagination, goToPage, refetch } =
    useConsultations(filters, searchQuery);

  /**
   * 处理搜索变化（使用useCallback避免子组件重渲染）
   */
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      goToPage(1);
    },
    [goToPage]
  );

  /**
   * 处理打开筛选抽屉
   */
  const handleOpenFilterDrawer = useCallback(() => {
    setIsFilterDrawerOpen(true);
  }, []);

  /**
   * 处理关闭筛选抽屉
   */
  const handleCloseFilterDrawer = useCallback(() => {
    setIsFilterDrawerOpen(false);
  }, []);

  /**
   * 处理应用筛选
   */
  const handleApplyFilters = useCallback(
    (newFilters: ConsultationFilters) => {
      setFilters(newFilters);
      goToPage(1);
    },
    [goToPage]
  );

  /**
   * 处理查看详情
   */
  const handleView = useCallback(
    (id: string) => {
      router.push(`/consultations/${id}`);
    },
    [router]
  );

  /**
   * 处理编辑
   */
  const handleEdit = useCallback(
    (id: string) => {
      router.push(`/consultations/${id}/edit`);
    },
    [router]
  );

  /**
   * 处理转化为案件
   */
  const handleConvert = useCallback(
    (id: string) => {
      if (!confirm('确定要将此咨询转化为案件吗？')) {
        return;
      }
      router.push(`/cases/create?consultationId=${id}`);
    },
    [router]
  );

  /**
   * 渲染分页按钮
   */
  const renderPagination = () => {
    const { page, totalPages } = pagination;

    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages: number[] = [];
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
        <button
          onClick={() => goToPage(page - 1)}
          disabled={page === 1}
          className='flex h-10 w-10 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
        >
          <ChevronLeft className='h-4 w-4' />
        </button>

        {getPageNumbers().map(pageNum => (
          <button
            key={pageNum}
            onClick={() => goToPage(pageNum)}
            className={`h-10 w-10 rounded-md text-sm font-medium transition-colors ${
              pageNum === page
                ? 'bg-blue-600 text-white'
                : 'border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            {pageNum}
          </button>
        ))}

        <button
          onClick={() => goToPage(page + 1)}
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
            className='h-56 animate-pulse rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950'
          />
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
  if (consultations.length === 0) {
    return (
      <div className='rounded-lg border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-950'>
        <p className='text-lg font-medium text-zinc-700 dark:text-zinc-300'>
          暂无咨询记录
        </p>
        <p className='mt-2 text-sm text-zinc-500 dark:text-zinc-400'>
          {searchQuery
            ? '没有找到匹配的咨询记录，请尝试调整搜索条件'
            : '还没有任何咨询记录'}
        </p>
      </div>
    );
  }

  /**
   * 渲染咨询列表
   */
  return (
    <div className='space-y-4'>
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex-1'>
          <ConsultationSearch
            value={searchQuery}
            onSearch={handleSearchChange}
          />
        </div>
        <button
          onClick={handleOpenFilterDrawer}
          className='flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
        >
          <Filter className='h-4 w-4' />
          <span>筛选</span>
        </button>
      </div>

      <div className='mb-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400'>
        <span>共 {pagination.total} 条咨询记录</span>
        <span>
          显示第 {(pagination.page - 1) * pagination.pageSize + 1} -{' '}
          {Math.min(pagination.page * pagination.pageSize, pagination.total)} 条
        </span>
      </div>

      <div className='space-y-4'>
        {consultations.map(consultation => (
          <ConsultationListItem
            key={consultation.id}
            consultation={consultation}
            onView={handleView}
            onEdit={handleEdit}
            onConvert={handleConvert}
          />
        ))}
      </div>

      {renderPagination()}

      {/* 筛选抽屉 */}
      <FilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={handleCloseFilterDrawer}
        onApply={handleApplyFilters}
        initialFilters={filters}
      />
    </div>
  );
}
