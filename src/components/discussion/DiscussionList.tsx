/**
 * 讨论列表组件
 * 显示案件的所有讨论，支持分页、筛选、排序
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  MessageCircle as MessageIcon,
  Filter as FilterIcon,
  ArrowUpDown as SortIcon,
  RefreshCw as RefreshIcon,
  AlertCircle as AlertCircleIcon,
} from 'lucide-react';
import { DiscussionItem } from './DiscussionItem';
import { DiscussionForm } from './DiscussionForm';

/**
 * 讨论数据接口
 */
interface DiscussionData {
  id: string;
  caseId: string;
  userId: string;
  content: string;
  mentions: string[];
  isPinned: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  author: {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
  };
}

/**
 * 讨论列表响应接口
 */
interface DiscussionsResponse {
  success: boolean;
  data: {
    discussions: DiscussionData[];
    total: number;
    caseId: string;
    page: number;
    limit: number;
  };
  meta?: {
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  };
}

export interface DiscussionListProps {
  caseId: string;
  currentUserId: string;
  canViewDiscussions: boolean;
  canCreateDiscussions: boolean;
  canEditDiscussions: boolean;
  canPinDiscussions: boolean;
  canDeleteDiscussions: boolean;
}

/**
 * 讨论列表组件
 */
export function DiscussionList({
  caseId,
  currentUserId,
  canViewDiscussions,
  canCreateDiscussions,
  canEditDiscussions,
  canPinDiscussions,
  canDeleteDiscussions,
}: DiscussionListProps) {
  const [discussions, setDiscussions] = useState<DiscussionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [editingDiscussion, setEditingDiscussion] =
    useState<DiscussionData | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filterPinned, setFilterPinned] = useState(false);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'isPinned'>(
    'createdAt'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  /**
   * 获取讨论列表
   */
  const fetchDiscussions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        sortBy,
        sortOrder,
        ...(filterPinned && { isPinned: 'true' }),
      });

      const response = await fetch(
        `/api/cases/${caseId}/discussions?${params}`
      );

      if (!response.ok) {
        throw new Error('获取讨论列表失败');
      }

      const data: DiscussionsResponse = await response.json();
      if (data.success && data.data) {
        setDiscussions(data.data.discussions);
        setTotal(data.data.total);
        setTotalPages(
          data.meta?.pagination?.totalPages || Math.ceil(data.data.total / 20)
        );
        setHasNext(data.meta?.pagination?.hasNext || false);
        setHasPrevious(data.meta?.pagination?.hasPrevious || false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      console.error('获取讨论列表时出错:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId, page, sortBy, sortOrder, filterPinned]);

  /**
   * 刷新列表
   */
  const handleRefresh = () => {
    fetchDiscussions();
  };

  /**
   * 处理编辑讨论
   */
  const handleEditDiscussion = (discussion: DiscussionData) => {
    setEditingDiscussion(discussion);
    setShowForm(true);
  };

  /**
   * 处理删除讨论
   */
  const handleDeleteDiscussion = async (discussionId: string) => {
    try {
      const response = await fetch(`/api/discussions/${discussionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('删除讨论失败');
      }

      await fetchDiscussions();
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      console.error('删除讨论时出错:', err);
    }
  };

  /**
   * 处理置顶/取消置顶
   */
  const handleTogglePin = async (discussionId: string, isPinned: boolean) => {
    try {
      const response = await fetch(`/api/discussions/${discussionId}/pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPinned }),
      });

      if (!response.ok) {
        throw new Error('置顶操作失败');
      }

      await fetchDiscussions();
    } catch (err) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
      console.error('置顶操作时出错:', err);
    }
  };

  /**
   * 处理表单提交成功
   */
  const handleFormSuccess = () => {
    setEditingDiscussion(null);
    setShowForm(false);
    fetchDiscussions();
  };

  /**
   * 切换筛选
   */
  const toggleFilter = () => {
    setFilterPinned(!filterPinned);
    setPage(1);
  };

  /**
   * 切换排序
   */
  const toggleSort = () => {
    if (sortBy === 'createdAt') {
      setSortBy('updatedAt');
    } else if (sortBy === 'updatedAt') {
      setSortBy('isPinned');
    } else {
      setSortBy('createdAt');
    }
    setPage(1);
  };

  /**
   * 切换排序顺序
   */
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    setPage(1);
  };

  useEffect(() => {
    if (canViewDiscussions) {
      void fetchDiscussions();
    }
  }, [
    caseId,
    page,
    filterPinned,
    sortBy,
    sortOrder,
    canViewDiscussions,
    fetchDiscussions,
  ]);

  // 无权限时显示提示
  if (!canViewDiscussions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <MessageIcon className='h-5 w-5' />
            案件讨论
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center gap-2 text-muted-foreground'>
            <AlertCircleIcon className='h-5 w-5' />
            <span>您无权查看此案件的讨论</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      {/* 头部：标题和操作 */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle className='flex items-center gap-2'>
              <MessageIcon className='h-5 w-5' />
              案件讨论
              <span className='text-sm font-normal text-muted-foreground'>
                ({total}条讨论)
              </span>
            </CardTitle>
            <div className='flex items-center gap-2'>
              {/* 筛选按钮 */}
              <Button
                variant='outline'
                size='sm'
                onClick={toggleFilter}
                title={filterPinned ? '显示全部' : '只显示置顶'}
              >
                <FilterIcon className='mr-1 h-4 w-4' />
                {filterPinned ? '全部' : '置顶'}
              </Button>

              {/* 排序按钮 */}
              <Button
                variant='outline'
                size='sm'
                onClick={toggleSort}
                title={`按${sortBy === 'createdAt' ? '创建时间' : sortBy === 'updatedAt' ? '更新时间' : '置顶状态'}排序`}
              >
                <SortIcon className='mr-1 h-4 w-4' />
                {sortBy === 'createdAt'
                  ? '创建'
                  : sortBy === 'updatedAt'
                    ? '更新'
                    : '置顶'}
              </Button>

              {/* 排序顺序按钮 */}
              <Button
                variant='outline'
                size='sm'
                onClick={toggleSortOrder}
                title={sortOrder === 'asc' ? '升序' : '降序'}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>

              {/* 刷新按钮 */}
              <Button
                variant='outline'
                size='sm'
                onClick={handleRefresh}
                disabled={loading}
                title='刷新'
              >
                <RefreshIcon
                  className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
                />
              </Button>

              {/* 创建按钮 */}
              {canCreateDiscussions && !showForm && !editingDiscussion && (
                <Button size='sm' onClick={() => setShowForm(true)}>
                  <MessageIcon className='mr-1 h-4 w-4' />
                  发表讨论
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 错误提示 */}
      {error && (
        <div className='flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700'>
          <AlertCircleIcon className='h-5 w-5 shrink-0' />
          <div className='flex-1'>
            <p className='font-medium'>加载失败</p>
            <p className='text-sm'>{error}</p>
          </div>
          <Button variant='outline' size='sm' onClick={handleRefresh}>
            重试
          </Button>
        </div>
      )}

      {/* 创建/编辑表单 */}
      {(showForm || editingDiscussion) && canCreateDiscussions && (
        <DiscussionForm
          caseId={caseId}
          editingDiscussion={editingDiscussion}
          onCancelEdit={() => {
            setEditingDiscussion(null);
            setShowForm(false);
          }}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* 讨论列表 */}
      {loading && discussions.length === 0 ? (
        <Card>
          <CardContent className='p-8'>
            <div className='flex items-center justify-center'>
              <div className='text-muted-foreground'>加载中...</div>
            </div>
          </CardContent>
        </Card>
      ) : discussions.length === 0 ? (
        <Card>
          <CardContent className='p-8'>
            <div className='flex flex-col items-center gap-3 text-center text-muted-foreground'>
              <MessageIcon className='h-12 w-12' />
              <p>{filterPinned ? '没有置顶的讨论' : '暂无讨论'}</p>
              {canCreateDiscussions && (
                <Button size='sm' onClick={() => setShowForm(true)}>
                  发表第一条讨论
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className='space-y-3'>
          {discussions.map(discussion => (
            <DiscussionItem
              key={discussion.id}
              discussion={discussion}
              currentUserId={currentUserId}
              canEdit={canEditDiscussions}
              canPin={canPinDiscussions}
              canDelete={canDeleteDiscussions}
              onEdit={handleEditDiscussion}
              onDelete={handleDeleteDiscussion}
              onTogglePin={handleTogglePin}
            />
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center justify-between'>
              <div className='text-sm text-muted-foreground'>
                第{page}页 / 共{totalPages}页
              </div>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage(page - 1)}
                  disabled={!hasPrevious || loading}
                >
                  <ChevronLeftIcon className='h-4 w-4' />
                  上一页
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => setPage(page + 1)}
                  disabled={!hasNext || loading}
                >
                  下一页
                  <ChevronRightIcon className='h-4 w-4' />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
