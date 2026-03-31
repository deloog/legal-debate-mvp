/**
 * EvidenceList - 证据列表组件
 *
 * 功能：展示证据列表，支持筛选、分页、批量操作
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import type { EvidenceDetail, EvidenceListResponse } from '@/types/evidence';
import {
  getEvidenceTypeLabel,
  getEvidenceStatusLabel,
  EvidenceType,
  EvidenceStatus,
} from '@/types/evidence';
import { Button } from '@/components/ui/button';
import { EVIDENCE_API, buildUrl } from '@/lib/constants/api-paths';

interface EvidenceListProps {
  caseId: string;
  initialData?: EvidenceListResponse;
  showSelection?: boolean;
  onSelectEvidence?: (evidenceId: string) => void;
  onEditEvidence?: (evidenceId: string) => void;
}

interface EvidenceFilters {
  caseId: string;
  type?: EvidenceType;
  status?: EvidenceStatus;
  submitter?: string;
  source?: string;
  minRelevanceScore?: number;
  maxRelevanceScore?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'relevanceScore' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

type BulkAction = 'updateStatus' | 'delete';

interface BulkActionParams {
  action: BulkAction;
  status?: EvidenceStatus;
  evidenceIds: string[];
  reason?: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  ACCEPTED:
    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  QUESTIONED:
    'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
};

export function EvidenceList({
  caseId,
  initialData,
  showSelection = false,
  onSelectEvidence,
  onEditEvidence,
}: EvidenceListProps) {
  const [evidenceList, setEvidenceList] = useState<EvidenceDetail[]>(
    initialData?.evidence || []
  );
  const [total, setTotal] = useState<number>(initialData?.total || 0);
  const [page, setPage] = useState<number>(initialData?.page || 1);
  const [totalPages, setTotalPages] = useState<number>(
    initialData?.totalPages || 0
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<EvidenceFilters>(() => ({
    caseId,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 20,
  }));

  const fetchEvidenceList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('caseId', caseId);
      if (filters.type) params.append('type', filters.type);
      if (filters.status) params.append('status', filters.status);
      if (filters.submitter) params.append('submitter', filters.submitter);
      if (filters.source) params.append('source', filters.source);
      if (filters.minRelevanceScore !== undefined)
        params.append(
          'minRelevanceScore',
          filters.minRelevanceScore.toString()
        );
      if (filters.maxRelevanceScore !== undefined)
        params.append(
          'maxRelevanceScore',
          filters.maxRelevanceScore.toString()
        );
      params.append('sortBy', filters.sortBy || 'createdAt');
      params.append('sortOrder', filters.sortOrder || 'desc');
      params.append('page', (filters.page || 1).toString());
      params.append('limit', (filters.limit || 20).toString());

      const response = await fetch(
        buildUrl(EVIDENCE_API.LIST, Object.fromEntries(params.entries())),
        { credentials: 'include' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        setError(
          (errorData as { message?: string }).message || '加载证据列表失败'
        );
        return;
      }

      const data = (await response.json()) as { data: EvidenceListResponse };
      setEvidenceList(data.data.evidence);
      setTotal(data.data.total);
      setPage(data.data.page);
      setTotalPages(data.data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载证据列表失败');
    } finally {
      setLoading(false);
    }
  }, [caseId, filters]);

  useEffect(() => {
    if (!initialData) {
      void fetchEvidenceList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (initialData) {
      setEvidenceList(initialData.evidence);
      setTotal(initialData.total);
      setPage(initialData.page);
      setTotalPages(initialData.totalPages);
    } else {
      void fetchEvidenceList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    setFilters(prev => ({ ...prev, page: newPage }));
    setSelectedIds(new Set());
  }, []);

  const handleFilterChange = useCallback(
    (newFilters: Partial<EvidenceFilters>) => {
      setPage(1);
      setFilters(prev => ({ ...prev, ...newFilters }));
      setSelectedIds(new Set());
    },
    []
  );

  const toggleSelect = useCallback((evidenceId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(evidenceId)) next.delete(evidenceId);
      else next.add(evidenceId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(evidenceList.map(e => e.id)));
  }, [evidenceList]);

  const deselectAll = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkAction = useCallback(
    async (params: BulkActionParams) => {
      try {
        const response = await fetch(EVIDENCE_API.BULK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(params),
        });
        if (!response.ok) {
          const errorData = await response.json();
          setError(
            (errorData as { message?: string }).message || '批量操作失败'
          );
          return;
        }
        await fetchEvidenceList();
        setSelectedIds(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : '批量操作失败');
      }
    },
    [fetchEvidenceList]
  );

  const handleBulkUpdateStatus = useCallback(
    (status: EvidenceStatus) => {
      void handleBulkAction({
        action: 'updateStatus',
        status,
        evidenceIds: Array.from(selectedIds),
      });
    },
    [selectedIds, handleBulkAction]
  );

  const handleUpdateStatus = useCallback(
    async (evidenceId: string, status: EvidenceStatus) => {
      try {
        const response = await fetch(EVIDENCE_API.update(evidenceId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ status }),
        });
        if (!response.ok) {
          const errorData = await response.json();
          setError((errorData as { message?: string }).message || '操作失败');
          return;
        }
        await fetchEvidenceList();
      } catch (err) {
        setError(err instanceof Error ? err.message : '操作失败');
      }
    },
    [fetchEvidenceList]
  );

  const handleBulkDelete = useCallback(() => {
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 条证据吗？`)) return;
    void handleBulkAction({
      action: 'delete',
      evidenceIds: Array.from(selectedIds),
    });
  }, [selectedIds, handleBulkAction]);

  const handleDelete = useCallback(
    async (evidenceId: string) => {
      if (!confirm('确定要删除这条证据吗？')) return;
      try {
        const response = await fetch(EVIDENCE_API.delete(evidenceId), {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!response.ok) {
          const errorData = await response.json();
          setError(
            (errorData as { message?: string }).message || '删除证据失败'
          );
          return;
        }
        await fetchEvidenceList();
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除证据失败');
      }
    },
    [fetchEvidenceList]
  );

  const selectStyle =
    'rounded border border-gray-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100';

  return (
    <div className='space-y-3'>
      {/* 筛选栏 */}
      <div className='flex flex-wrap items-center gap-2'>
        <select
          value={filters.type || ''}
          onChange={e =>
            handleFilterChange({
              type: (e.target.value as EvidenceType) || undefined,
            })
          }
          className={selectStyle}
        >
          <option value=''>全部类型</option>
          <option value='DOCUMENT'>书证</option>
          <option value='PHYSICAL'>物证</option>
          <option value='WITNESS'>证人证言</option>
          <option value='EXPERT_OPINION'>鉴定意见</option>
          <option value='AUDIO_VIDEO'>音视频</option>
          <option value='OTHER'>其他</option>
        </select>

        <select
          value={filters.status || ''}
          onChange={e =>
            handleFilterChange({
              status: (e.target.value as EvidenceStatus) || undefined,
            })
          }
          className={selectStyle}
        >
          <option value=''>全部状态</option>
          <option value='PENDING'>待审核</option>
          <option value='ACCEPTED'>已采纳</option>
          <option value='REJECTED'>已拒绝</option>
          <option value='QUESTIONED'>存疑</option>
        </select>

        <select
          value={filters.sortBy || 'createdAt'}
          onChange={e =>
            handleFilterChange({
              sortBy: e.target.value as EvidenceFilters['sortBy'],
            })
          }
          className={selectStyle}
        >
          <option value='createdAt'>创建时间</option>
          <option value='updatedAt'>更新时间</option>
          <option value='relevanceScore'>相关性评分</option>
          <option value='name'>名称</option>
        </select>

        <select
          value={filters.sortOrder || 'desc'}
          onChange={e =>
            handleFilterChange({ sortOrder: e.target.value as 'asc' | 'desc' })
          }
          className={selectStyle}
        >
          <option value='desc'>降序</option>
          <option value='asc'>升序</option>
        </select>

        {showSelection && selectedIds.size > 0 && (
          <div className='ml-auto flex items-center gap-2'>
            <span className='text-sm text-gray-600 dark:text-zinc-400'>
              已选 {selectedIds.size} 条
            </span>
            <Button
              size='sm'
              variant='outline'
              onClick={() => handleBulkUpdateStatus(EvidenceStatus.ACCEPTED)}
            >
              标记已采纳
            </Button>
            <Button
              size='sm'
              variant='outline'
              onClick={() => handleBulkUpdateStatus(EvidenceStatus.REJECTED)}
            >
              标记已拒绝
            </Button>
            <Button size='sm' variant='outline' onClick={handleBulkDelete}>
              删除
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className='rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
          {error}
          <button className='ml-2 underline' onClick={() => setError(null)}>
            关闭
          </button>
        </div>
      )}

      {loading ? (
        <div className='py-10 text-center text-sm text-gray-500 dark:text-zinc-400'>
          加载中...
        </div>
      ) : evidenceList.length === 0 ? (
        <div className='py-10 text-center text-sm text-gray-500 dark:text-zinc-400'>
          暂无证据
        </div>
      ) : (
        <>
          {/* 表格 */}
          <div className='overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-700'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 dark:bg-zinc-800'>
                <tr>
                  {showSelection && (
                    <th className='w-8 px-3 py-2 text-left'>
                      <input
                        type='checkbox'
                        checked={
                          selectedIds.size === evidenceList.length &&
                          evidenceList.length > 0
                        }
                        onChange={e =>
                          e.target.checked ? selectAll() : deselectAll()
                        }
                      />
                    </th>
                  )}
                  <th className='px-3 py-2 text-left font-medium text-gray-600 dark:text-zinc-300'>
                    名称
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-600 dark:text-zinc-300'>
                    类型
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-600 dark:text-zinc-300'>
                    状态
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-600 dark:text-zinc-300'>
                    提交人
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-600 dark:text-zinc-300'>
                    来源
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-600 dark:text-zinc-300'>
                    相关性
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-600 dark:text-zinc-300'>
                    创建时间
                  </th>
                  <th className='px-3 py-2 text-left font-medium text-gray-600 dark:text-zinc-300'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-zinc-700'>
                {evidenceList.map(evidence => (
                  <tr
                    key={evidence.id}
                    className='hover:bg-gray-50 dark:hover:bg-zinc-800/50'
                  >
                    {showSelection && (
                      <td className='px-3 py-2'>
                        <input
                          type='checkbox'
                          checked={selectedIds.has(evidence.id)}
                          onChange={() => toggleSelect(evidence.id)}
                        />
                      </td>
                    )}
                    <td
                      className='max-w-[180px] truncate px-3 py-2 font-medium text-gray-900 dark:text-zinc-100 cursor-pointer hover:text-blue-600'
                      onClick={() => onSelectEvidence?.(evidence.id)}
                      title={evidence.name}
                    >
                      {evidence.name}
                    </td>
                    <td className='px-3 py-2 text-gray-600 dark:text-zinc-400'>
                      {getEvidenceTypeLabel(evidence.type as EvidenceType)}
                    </td>
                    <td className='px-3 py-2'>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[evidence.status ?? ''] ?? 'bg-gray-100 text-gray-700'}`}
                      >
                        {getEvidenceStatusLabel(
                          evidence.status as EvidenceStatus
                        )}
                      </span>
                    </td>
                    <td className='px-3 py-2 text-gray-600 dark:text-zinc-400'>
                      {evidence.submitter || '-'}
                    </td>
                    <td
                      className='max-w-[120px] truncate px-3 py-2 text-gray-600 dark:text-zinc-400'
                      title={evidence.source ?? ''}
                    >
                      {evidence.source || '-'}
                    </td>
                    <td className='px-3 py-2 text-gray-600 dark:text-zinc-400'>
                      {evidence.relevanceScore !== null
                        ? `${(evidence.relevanceScore * 100).toFixed(1)}%`
                        : '-'}
                    </td>
                    <td className='whitespace-nowrap px-3 py-2 text-gray-600 dark:text-zinc-400'>
                      {new Date(evidence.createdAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className='px-3 py-2'>
                      <div className='flex items-center gap-1'>
                        {evidence.status === 'PENDING' && (
                          <>
                            <button
                              className='rounded px-2 py-0.5 text-xs text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20'
                              onClick={e => {
                                e.stopPropagation();
                                void handleUpdateStatus(
                                  evidence.id,
                                  EvidenceStatus.ACCEPTED
                                );
                              }}
                            >
                              采纳
                            </button>
                            <button
                              className='rounded px-2 py-0.5 text-xs text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20'
                              onClick={e => {
                                e.stopPropagation();
                                void handleUpdateStatus(
                                  evidence.id,
                                  EvidenceStatus.REJECTED
                                );
                              }}
                            >
                              拒绝
                            </button>
                          </>
                        )}
                        {onEditEvidence && (
                          <button
                            className='rounded px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
                            onClick={e => {
                              e.stopPropagation();
                              onEditEvidence(evidence.id);
                            }}
                          >
                            编辑
                          </button>
                        )}
                        <button
                          className='rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20'
                          onClick={e => {
                            e.stopPropagation();
                            void handleDelete(evidence.id);
                          }}
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className='flex items-center justify-between text-sm'>
            <span className='text-gray-500 dark:text-zinc-400'>
              共 {total} 条证据
            </span>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                disabled={page === 1}
                onClick={() => handlePageChange(page - 1)}
              >
                上一页
              </Button>
              <span className='text-gray-600 dark:text-zinc-400'>
                第 {page} / {totalPages} 页
              </span>
              <Button
                size='sm'
                variant='outline'
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                下一页
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
