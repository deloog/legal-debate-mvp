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
  /**
   * 案件ID
   */
  caseId: string;

  /**
   * 初始证据列表数据
   */
  initialData?: EvidenceListResponse;

  /**
   * 是否显示选择框
   */
  showSelection?: boolean;

  /**
   * 选择证据回调
   */
  onSelectEvidence?: (evidenceId: string) => void;

  /**
   * 编辑证据回调
   */
  onEditEvidence?: (evidenceId: string) => void;
}

/**
 * 证据筛选参数
 */
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

/**
 * 批量操作类型
 */
type BulkAction = 'updateStatus' | 'delete';

/**
 * 批量操作参数
 */
interface BulkActionParams {
  action: BulkAction;
  status?: EvidenceStatus;
  evidenceIds: string[];
  reason?: string;
}

/**
 * 证据列表组件
 */
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

  /**
   * 加载证据列表
   */
  const fetchEvidenceList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('caseId', caseId);

      if (filters.type) {
        params.append('type', filters.type);
      }
      if (filters.status) {
        params.append('status', filters.status);
      }
      if (filters.submitter) {
        params.append('submitter', filters.submitter);
      }
      if (filters.source) {
        params.append('source', filters.source);
      }
      if (filters.minRelevanceScore !== undefined) {
        params.append(
          'minRelevanceScore',
          filters.minRelevanceScore.toString()
        );
      }
      if (filters.maxRelevanceScore !== undefined) {
        params.append(
          'maxRelevanceScore',
          filters.maxRelevanceScore.toString()
        );
      }
      params.append('sortBy', filters.sortBy || 'createdAt');
      params.append('sortOrder', filters.sortOrder || 'desc');
      params.append('page', (filters.page || 1).toString());
      params.append('limit', (filters.limit || 20).toString());

      const response = await fetch(
        buildUrl(EVIDENCE_API.LIST, Object.fromEntries(params.entries())),
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || '加载证据列表失败');
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

  /**
   * 当filters变化时重新加载数据
   */
  useEffect(() => {
    if (!initialData) {
      fetchEvidenceList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  /**
   * 切换页面
   */
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    setFilters(prev => ({ ...prev, page: newPage }));
    setSelectedIds(new Set());
  }, []);

  /**
   * 应用筛选
   */
  const handleFilterChange = useCallback(
    (newFilters: Partial<EvidenceFilters>) => {
      setPage(1);
      setFilters(prev => ({ ...prev, ...newFilters }));
      setSelectedIds(new Set());
    },
    []
  );

  /**
   * 选择/取消选择证据
   */
  const toggleSelect = useCallback((evidenceId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(evidenceId)) {
        newSet.delete(evidenceId);
      } else {
        newSet.add(evidenceId);
      }
      return newSet;
    });
  }, []);

  /**
   * 选择所有证据
   */
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(evidenceList.map(e => e.id)));
  }, [evidenceList]);

  /**
   * 取消所有选择
   */
  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /**
   * 执行批量操作
   */
  const handleBulkAction = useCallback(
    async (params: BulkActionParams) => {
      try {
        const response = await fetch(EVIDENCE_API.BULK, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.message || '批量操作失败');
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

  /**
   * 批量更新状态
   */
  const handleBulkUpdateStatus = useCallback(
    (status: EvidenceStatus) => {
      handleBulkAction({
        action: 'updateStatus',
        status,
        evidenceIds: Array.from(selectedIds),
      });
    },
    [selectedIds, handleBulkAction]
  );

  /**
   * 批量删除
   */
  const handleBulkDelete = useCallback(() => {
    const confirmed = confirm(
      `确定要删除选中的 ${selectedIds.size} 条证据吗？`
    );
    if (!confirmed) {
      return;
    }

    handleBulkAction({
      action: 'delete',
      evidenceIds: Array.from(selectedIds),
    });
  }, [selectedIds, handleBulkAction]);

  /**
   * 删除单个证据
   */
  const handleDelete = useCallback(
    async (evidenceId: string) => {
      const confirmed = confirm('确定要删除这条证据吗？');
      if (!confirmed) {
        return;
      }

      try {
        const response = await fetch(EVIDENCE_API.delete(evidenceId), {
          method: 'DELETE',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          setError(errorData.message || '删除证据失败');
          return;
        }

        await fetchEvidenceList();
      } catch (err) {
        setError(err instanceof Error ? err.message : '删除证据失败');
      }
    },
    [fetchEvidenceList]
  );

  /**
   * 组件挂载时加载数据
   */
  useEffect(() => {
    if (initialData) {
      setEvidenceList(initialData.evidence);
      setTotal(initialData.total);
      setPage(initialData.page);
      setTotalPages(initialData.totalPages);
    } else {
      fetchEvidenceList();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在挂载时执行一次

  return (
    <div className='evidence-list'>
      <div className='list-header'>
        <h2>证据列表</h2>
        <div className='header-actions'>
          {showSelection && selectedIds.size > 0 && (
            <div className='bulk-actions'>
              <span className='selected-count'>
                已选择 {selectedIds.size} 条证据
              </span>
              <Button
                size='sm'
                variant='outline'
                onClick={() => handleBulkUpdateStatus(EvidenceStatus.ACCEPTED)}
              >
                标记为已采纳
              </Button>
              <Button
                size='sm'
                variant='outline'
                onClick={() => handleBulkUpdateStatus(EvidenceStatus.REJECTED)}
              >
                标记为已拒绝
              </Button>
              <Button size='sm' variant='outline' onClick={handleBulkDelete}>
                删除
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className='filters'>
        <select
          value={filters.type || ''}
          onChange={e =>
            handleFilterChange({
              type: e.target.value as EvidenceType | undefined,
            })
          }
          className='filter-select'
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
              status: e.target.value as EvidenceStatus | undefined,
            })
          }
          className='filter-select'
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
          className='filter-select'
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
          className='filter-select'
        >
          <option value='desc'>降序</option>
          <option value='asc'>升序</option>
        </select>
      </div>

      {error && <div className='error-message'>{error}</div>}

      {loading ? (
        <div className='loading'>加载中...</div>
      ) : evidenceList.length === 0 ? (
        <div className='empty-state'>暂无证据</div>
      ) : (
        <>
          <div className='list-header-row'>
            {showSelection && (
              <div className='header-cell checkbox-cell'>
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
              </div>
            )}
            <div className='header-cell'>名称</div>
            <div className='header-cell'>类型</div>
            <div className='header-cell'>状态</div>
            <div className='header-cell'>提交人</div>
            <div className='header-cell'>来源</div>
            <div className='header-cell'>相关性</div>
            <div className='header-cell'>创建时间</div>
            <div className='header-cell'>操作</div>
          </div>

          <div className='list-body'>
            {evidenceList.map(evidence => (
              <div key={evidence.id} className='list-row'>
                {showSelection && (
                  <div className='cell checkbox-cell'>
                    <input
                      type='checkbox'
                      checked={selectedIds.has(evidence.id)}
                      onChange={() => toggleSelect(evidence.id)}
                    />
                  </div>
                )}
                <div
                  className='cell'
                  onClick={() => onSelectEvidence?.(evidence.id)}
                >
                  {evidence.name}
                </div>
                <div className='cell'>
                  {getEvidenceTypeLabel(evidence.type as EvidenceType)}
                </div>
                <div className='cell'>
                  <span
                    className={`status-badge status-${evidence.status?.toLowerCase()}`}
                  >
                    {getEvidenceStatusLabel(evidence.status as EvidenceStatus)}
                  </span>
                </div>
                <div className='cell'>{evidence.submitter || '-'}</div>
                <div className='cell'>{evidence.source || '-'}</div>
                <div className='cell'>
                  {evidence.relevanceScore !== null
                    ? `${(evidence.relevanceScore * 100).toFixed(1)}%`
                    : '-'}
                </div>
                <div className='cell'>
                  {new Date(evidence.createdAt).toLocaleDateString('zh-CN')}
                </div>
                <div className='cell actions-cell'>
                  {onEditEvidence && (
                    <button
                      className='action-button'
                      onClick={e => {
                        e.stopPropagation();
                        onEditEvidence(evidence.id);
                      }}
                    >
                      编辑
                    </button>
                  )}
                  <button
                    className='action-button delete-button'
                    onClick={e => {
                      e.stopPropagation();
                      handleDelete(evidence.id);
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className='pagination'>
            <Button
              size='sm'
              variant='outline'
              disabled={page === 1}
              onClick={() => handlePageChange(page - 1)}
            >
              上一页
            </Button>
            <span className='page-info'>
              第 {page} / {totalPages} 页
            </span>
            <Button
              size='sm'
              variant='outline'
              disabled={page === totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              下一页
            </Button>
          </div>

          <div className='list-footer'>
            <div className='total-count'>共 {total} 条证据</div>
          </div>
        </>
      )}
    </div>
  );
}
