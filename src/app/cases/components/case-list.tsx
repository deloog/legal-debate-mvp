/**
 * 案件列表组件
 *
 * 功能：
 * 1. 展示案件列表，支持分页浏览
 * 2. 提供搜索功能（按标题/案号搜索）
 * 3. 提供筛选功能（按案件类型、状态筛选）
 * 4. 支持开始辩论（检查是否已有辩论，无则创建新辩论）
 * 5. 支持删除案件（带确认提示）
 * 6. 显示案件统计信息（总数、当前页显示范围）
 * 7. 处理加载状态、错误状态和空状态
 * 8. 使用useCallback优化子组件重渲染性能
 *
 * @component CaseList
 */

'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CaseFilters, useCases } from '@/lib/hooks/use-cases';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { CaseListItem } from './case-list-item';
import { CaseSearch } from './case-search';

/**
 * 案件列表组件
 * 功能：展示案件列表，支持分页和筛选
 */
export function CaseList() {
  const router = useRouter();
  const [filters, setFilters] = useState<CaseFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const { cases, loading, error, pagination, goToPage, refetch } = useCases(
    filters,
    searchQuery
  );

  /**
   * 处理筛选变化
   */
  const handleFilterChange = useCallback(
    (newFilters: CaseFilters) => {
      setFilters(newFilters);
      goToPage(1);
      setIsFilterOpen(false);
    },
    [goToPage]
  );

  /**
   * 重置筛选
   */
  const handleResetFilters = useCallback(() => {
    setFilters({});
    goToPage(1);
  }, [goToPage]);

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
   * 如果案件已有辩论则跳转到该辩论，否则创建新辩论
   */
  const handleStartDebate = useCallback(
    async (caseId: string) => {
      try {
        // 先获取案件详情，检查是否已有辩论
        const response = await fetch(`/api/v1/cases/${caseId}`);
        if (!response.ok) {
          throw new Error('获取案件信息失败');
        }

        const data = await response.json();
        const caseDetail = data.data;

        // 如果已有辩论，跳转到第一个辩论
        if (caseDetail.debates && caseDetail.debates.length > 0) {
          router.push(`/debates/${caseDetail.debates[0].id}`);
          return;
        }

        // 创建新辩论
        const createResponse = await fetch('/api/v1/debates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            caseId: caseId,
            title: `${caseDetail.title || '案件'}辩论`,
          }),
        });

        if (!createResponse.ok) {
          throw new Error('创建辩论失败');
        }

        const createData = await createResponse.json();
        router.push(`/debates/${createData.data.id}`);
      } catch (err) {
        console.error('开始辩论失败:', err);
        alert('操作失败，请重试');
      }
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
    const isFiltered =
      !!searchQuery ||
      (filters.types?.length ?? 0) > 0 ||
      (filters.statuses?.length ?? 0) > 0;

    return (
      <EmptyState
        icon={
          isFiltered ? (
            <svg
              className='h-8 w-8'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.5}
                d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
              />
            </svg>
          ) : (
            <svg
              className='h-8 w-8'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={1.5}
                d='M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4'
              />
            </svg>
          )
        }
        title={isFiltered ? '未找到匹配的案件' : '还没有案件'}
        description={
          isFiltered
            ? '请尝试调整搜索关键词或筛选条件'
            : '创建您的第一个案件，开始使用 AI 辩论分析'
        }
      />
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
        <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <DialogTrigger asChild>
            <Button variant='outline' className='flex items-center gap-2'>
              <Filter className='w-4 h-4' />
              <span>筛选</span>
              <span className='text-zinc-400 dark:text-zinc-500'>
                {(filters.types?.length ?? 0) +
                  (filters.statuses?.length ?? 0) >
                  0 && '（已激活）'}
              </span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>筛选案件</DialogTitle>
            </DialogHeader>
            <div className='space-y-4 py-4'>
              <div className='space-y-2'>
                <Label>案件类型</Label>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    variant={
                      filters.types?.includes('CIVIL') ? 'default' : 'outline'
                    }
                    size='sm'
                    onClick={() => {
                      const currentTypes = filters.types || [];
                      const newTypes = currentTypes.includes('CIVIL')
                        ? currentTypes.filter(t => t !== 'CIVIL')
                        : [...currentTypes, 'CIVIL'];
                      handleFilterChange({ ...filters, types: newTypes });
                    }}
                  >
                    民事
                  </Button>
                  <Button
                    variant={
                      filters.types?.includes('CRIMINAL')
                        ? 'default'
                        : 'outline'
                    }
                    size='sm'
                    onClick={() => {
                      const currentTypes = filters.types || [];
                      const newTypes = currentTypes.includes('CRIMINAL')
                        ? currentTypes.filter(t => t !== 'CRIMINAL')
                        : [...currentTypes, 'CRIMINAL'];
                      handleFilterChange({ ...filters, types: newTypes });
                    }}
                  >
                    刑事
                  </Button>
                </div>
              </div>
              <div className='space-y-2'>
                <Label>案件状态</Label>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    variant={
                      filters.statuses?.includes('ACTIVE')
                        ? 'default'
                        : 'outline'
                    }
                    size='sm'
                    onClick={() => {
                      const currentStatuses = filters.statuses || [];
                      const newStatuses = currentStatuses.includes('ACTIVE')
                        ? currentStatuses.filter(s => s !== 'ACTIVE')
                        : [...currentStatuses, 'ACTIVE'];
                      handleFilterChange({ ...filters, statuses: newStatuses });
                    }}
                  >
                    进行中
                  </Button>
                  <Button
                    variant={
                      filters.statuses?.includes('CLOSED')
                        ? 'default'
                        : 'outline'
                    }
                    size='sm'
                    onClick={() => {
                      const currentStatuses = filters.statuses || [];
                      const newStatuses = currentStatuses.includes('CLOSED')
                        ? currentStatuses.filter(s => s !== 'CLOSED')
                        : [...currentStatuses, 'CLOSED'];
                      handleFilterChange({ ...filters, statuses: newStatuses });
                    }}
                  >
                    已关闭
                  </Button>
                </div>
              </div>
              <div className='flex justify-between pt-4'>
                <Button variant='outline' onClick={handleResetFilters}>
                  重置
                </Button>
                <Button onClick={() => setIsFilterOpen(false)}>完成</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
