/**
 * 证人列表组件
 * 显示案件证人的列表，支持筛选、排序和分页
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { WitnessForm } from './WitnessForm';
import { TestimonyViewer } from './TestimonyViewer';
import {
  WITNESS_STATUS_LABELS,
  type WitnessDetail,
  type WitnessQueryParams,
} from '@/types/witness';

/**
 * 证人列表组件属性
 */
interface WitnessListProps {
  caseId: string;
  canManage: boolean;
  currentUserId: string;
}

/**
 * 证人列表响应类型
 */
interface WitnessListResponse {
  witnesses: WitnessDetail[];
  total: number;
  caseId: string;
  page: number;
  limit: number;
  totalPages: number;
  pagination: PaginationInfo;
}

/**
 * 分页信息类型
 */
interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export function WitnessList({ caseId, canManage }: WitnessListProps) {
  const [witnesses, setWitnesses] = useState<WitnessDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWitness, setEditingWitness] = useState<WitnessDetail | null>(
    null
  );
  const [viewingTestimony, setViewingTestimony] =
    useState<WitnessDetail | null>(null);

  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  });

  const [filters, setFilters] = useState<WitnessQueryParams>({
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  // 加载证人列表
  const loadWitnesses = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      const response = await fetch(`/api/cases/${caseId}/witnesses?${params}`);

      if (!response.ok) {
        throw new Error('加载证人列表失败');
      }

      const data = (await response.json()) as { data: WitnessListResponse };
      setWitnesses(data.data.witnesses);
      setPagination(data.data.pagination || pagination);
    } catch (err) {
      const message = err instanceof Error ? err.message : '加载失败';
      setError(message);
      console.error('加载证人列表失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [caseId, filters, pagination]);

  useEffect(() => {
    void loadWitnesses();
  }, [loadWitnesses]);

  // 筛选和排序处理
  const handleFilterChange = useCallback(
    (key: keyof WitnessQueryParams, value: unknown): void => {
      setFilters(prev => ({
        ...prev,
        [key]: value,
        page: 1, // 重置页码
      }));
    },
    []
  );

  // 分页处理
  const handlePageChange = useCallback((newPage: number): void => {
    setFilters(prev => ({
      ...prev,
      page: newPage,
    }));
  }, []);

  // 创建证人处理
  const handleCreateWitness = useCallback((): void => {
    void loadWitnesses();
    setIsFormOpen(false);
  }, [loadWitnesses]);

  // 更新证人处理
  const handleUpdateWitness = useCallback((): void => {
    void loadWitnesses();
    setEditingWitness(null);
  }, [loadWitnesses]);

  // 删除证人处理
  const handleDeleteWitness = useCallback(
    async (witnessId: string): Promise<void> => {
      if (!canManage) {
        return;
      }

      try {
        const response = await fetch(`/api/witnesses/${witnessId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('删除证人失败');
        }

        void loadWitnesses();
      } catch (err) {
        const message = err instanceof Error ? err.message : '删除失败';
        console.error('删除证人失败:', err);
        alert(message);
      }
    },
    [canManage, loadWitnesses]
  );

  // 状态变更处理
  const handleStatusChange = useCallback(
    async (witnessId: string, status: string): Promise<void> => {
      if (!canManage) {
        return;
      }

      try {
        const response = await fetch(`/api/witnesses/${witnessId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error('更新状态失败');
        }

        void loadWitnesses();
      } catch (err) {
        const message = err instanceof Error ? err.message : '更新状态失败';
        console.error('更新证人状态失败:', err);
        alert(message);
      }
    },
    [canManage, loadWitnesses]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className='py-8'>
          <div className='text-center text-gray-500'>加载中...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className='py-8'>
          <div className='text-center text-red-600'>
            <p className='mb-4'>{error}</p>
            <Button onClick={() => loadWitnesses()}>重试</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 头部操作栏 */}
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <CardTitle>证人管理</CardTitle>
            {canManage && (
              <Button onClick={() => setIsFormOpen(true)}>添加证人</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* 筛选栏 */}
          <div className='flex flex-wrap gap-4 mb-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                状态筛选
              </label>
              <select
                value={filters.status || ''}
                onChange={e =>
                  handleFilterChange('status', e.target.value || undefined)
                }
                className='border border-gray-300 rounded-md px-3 py-1 text-sm'
              >
                <option value=''>全部状态</option>
                {Object.entries(WITNESS_STATUS_LABELS).map(
                  ([status, label]) => (
                    <option key={status} value={status}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                排序方式
              </label>
              <select
                value={filters.sortBy}
                onChange={e => handleFilterChange('sortBy', e.target.value)}
                className='border border-gray-300 rounded-md px-3 py-1 text-sm'
              >
                <option value='createdAt'>创建时间</option>
                <option value='updatedAt'>更新时间</option>
                <option value='name'>姓名</option>
              </select>
            </div>
          </div>

          {/* 证人列表 */}
          {witnesses.length === 0 ? (
            <div className='text-center py-8 text-gray-500'>暂无证人数据</div>
          ) : (
            <div className='space-y-4'>
              {witnesses.map(witness => (
                <Card key={witness.id} className='border-l-4 border-l-blue-500'>
                  <CardContent className='py-4'>
                    <div className='flex items-start justify-between'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-3 mb-2'>
                          <h3 className='text-lg font-medium'>
                            {witness.name}
                          </h3>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              witness.status === 'CONFIRMED'
                                ? 'bg-green-100 text-green-800'
                                : witness.status === 'DECLINED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {
                              WITNESS_STATUS_LABELS[
                                witness.status as keyof typeof WITNESS_STATUS_LABELS
                              ]
                            }
                          </span>
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600'>
                          {witness.phone && <div>📞 {witness.phone}</div>}
                          {witness.address && <div>📍 {witness.address}</div>}
                          {witness.relationship && (
                            <div>🤝 {witness.relationship}</div>
                          )}
                        </div>
                        {witness.testimony && (
                          <div className='mt-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() => setViewingTestimony(witness)}
                            >
                              查看证词 ({witness.testimony.length} 字符)
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      {canManage && (
                        <div className='flex gap-2 ml-4'>
                          <select
                            value={witness.status}
                            onChange={e =>
                              handleStatusChange(witness.id, e.target.value)
                            }
                            className='text-xs border border-gray-300 rounded px-2 py-1'
                          >
                            {Object.entries(WITNESS_STATUS_LABELS).map(
                              ([status, label]) => (
                                <option key={status} value={status}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setEditingWitness(witness)}
                          >
                            编辑
                          </Button>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => {
                              if (confirm('确定要删除这个证人吗？')) {
                                void handleDeleteWitness(witness.id);
                              }
                            }}
                            className='text-red-600 hover:text-red-700'
                          >
                            删除
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* 分页 */}
          {pagination.totalPages > 1 && (
            <div className='flex items-center justify-center gap-2 mt-6'>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={!pagination.hasPrevious}
              >
                上一页
              </Button>
              <span className='text-sm text-gray-600'>
                第 {pagination.page} 页，共 {pagination.totalPages} 页
              </span>
              <Button
                variant='outline'
                size='sm'
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={!pagination.hasNext}
              >
                下一页
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 创建/编辑表单 */}
      {(isFormOpen || editingWitness) && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto'>
            <WitnessForm
              caseId={caseId}
              witness={editingWitness}
              onSubmit={
                editingWitness ? handleUpdateWitness : handleCreateWitness
              }
              onCancel={() => {
                setIsFormOpen(false);
                setEditingWitness(null);
              }}
              canManage={canManage}
            />
          </div>
        </div>
      )}

      {/* 证词查看器 */}
      {viewingTestimony && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50'>
          <div className='bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto'>
            <TestimonyViewer
              witness={viewingTestimony}
              onClose={() => setViewingTestimony(null)}
              canEdit={canManage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
