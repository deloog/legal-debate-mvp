'use client';

import { useState, useEffect, useCallback } from 'react';
import { LawArticleImportDialog } from './LawArticleImportDialog';

interface LawGroup {
  lawName: string;
  lawType: string;
  category: string;
  status: string;
  count: number;
}

interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  lawType: string;
  category: string;
  status: string;
  effectiveDate: string;
}

const LAW_TYPE_LABELS: Record<string, string> = {
  LAW: '法律',
  ADMINISTRATIVE_REGULATION: '行政法规',
  LOCAL_REGULATION: '地方法规',
  JUDICIAL_INTERPRETATION: '司法解释',
  DEPARTMENTAL_RULE: '部门规章',
  CONSTITUTION: '宪法',
  OTHER: '其他',
};

const CATEGORY_LABELS: Record<string, string> = {
  CIVIL: '民法',
  CRIMINAL: '刑法',
  ADMINISTRATIVE: '行政法',
  COMMERCIAL: '商法',
  ECONOMIC: '经济法',
  LABOR: '劳动法',
  INTELLECTUAL_PROPERTY: '知识产权',
  PROCEDURE: '诉讼法',
  OTHER: '其他',
};

const STATUS_BADGE: Record<string, string> = {
  VALID: 'bg-green-100 text-green-800',
  DRAFT: 'bg-yellow-100 text-yellow-800',
  AMENDED: 'bg-blue-100 text-blue-800',
  REPEALED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
};

const STATUS_LABELS: Record<string, string> = {
  VALID: '有效',
  DRAFT: '草稿',
  AMENDED: '已修订',
  REPEALED: '已废止',
  EXPIRED: '已过期',
};

/** 展开一部法律时加载其条文列表 */
function LawArticlesDetail({
  lawName,
  onDelete,
}: {
  lawName: string;
  onDelete: () => void;
}) {
  const [articles, setArticles] = useState<LawArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 30;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search: lawName,
        page: page.toString(),
        limit: LIMIT.toString(),
      });
      const res = await fetch(`/api/admin/law-articles?${params}`);
      if (!res.ok) throw new Error('加载失败');
      const json = (await res.json()) as {
        data: {
          articles: LawArticle[];
          pagination: { totalPages: number; total: number };
        };
      };
      setArticles(json.data.articles);
      setTotalPages(json.data.pagination.totalPages);
      setTotal(json.data.pagination.total);
    } finally {
      setLoading(false);
    }
  }, [lawName, page]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该条文？')) return;
    const res = await fetch(`/api/admin/law-articles/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      load();
      onDelete();
    } else {
      alert('删除失败');
    }
  };

  if (loading) {
    return (
      <div className='p-4 text-center text-sm text-gray-500'>
        <div className='inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2' />
        加载中...
      </div>
    );
  }

  return (
    <div className='border-t border-gray-100'>
      <div className='overflow-x-auto'>
        <table className='min-w-full text-sm'>
          <thead className='bg-gray-50'>
            <tr>
              <th className='px-4 py-2 text-left text-xs text-gray-500 font-medium w-24'>
                条号
              </th>
              <th className='px-4 py-2 text-left text-xs text-gray-500 font-medium'>
                条文内容（摘要）
              </th>
              <th className='px-4 py-2 text-left text-xs text-gray-500 font-medium w-20'>
                状态
              </th>
              <th className='px-4 py-2 text-left text-xs text-gray-500 font-medium w-24'>
                生效日期
              </th>
              <th className='px-4 py-2 text-right text-xs text-gray-500 font-medium w-16'>
                操作
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-100'>
            {articles.map(a => (
              <tr key={a.id} className='hover:bg-gray-50'>
                <td className='px-4 py-2 text-gray-900 font-medium whitespace-nowrap'>
                  {a.articleNumber}
                </td>
                <td className='px-4 py-2 text-gray-600 max-w-md'>
                  <span className='line-clamp-2 text-xs'>
                    {a.fullText?.slice(0, 120)}
                    {(a.fullText?.length ?? 0) > 120 ? '…' : ''}
                  </span>
                </td>
                <td className='px-4 py-2 whitespace-nowrap'>
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs ${STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </td>
                <td className='px-4 py-2 text-gray-500 whitespace-nowrap text-xs'>
                  {new Date(a.effectiveDate).toLocaleDateString('zh-CN')}
                </td>
                <td className='px-4 py-2 text-right'>
                  <button
                    onClick={() => handleDelete(a.id)}
                    className='text-red-500 hover:text-red-700 text-xs'
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className='flex items-center justify-between px-4 py-2 bg-gray-50 text-xs text-gray-600'>
          <span>
            共 {total} 条，第 {page}/{totalPages} 页
          </span>
          <div className='flex gap-2'>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className='px-2 py-1 border rounded disabled:opacity-40'
            >
              上一页
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className='px-2 py-1 border rounded disabled:opacity-40'
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 主组件 */
export function LawArticleList(): React.ReactElement {
  const [laws, setLaws] = useState<LawGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    lawType: '',
    status: '',
    search: '',
  });
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        ...(filters.lawType && { lawType: filters.lawType }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search }),
      });
      const res = await fetch(`/api/admin/law-articles/grouped?${params}`);
      if (!res.ok) throw new Error('加载法律列表失败');
      const json = (await res.json()) as {
        data: { laws: LawGroup[]; total: number };
      };
      setLaws(json.data.laws);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [filters, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const toggle = (lawName: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(lawName)) next.delete(lawName);
      else next.add(lawName);
      return next;
    });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setExpanded(new Set());
    loadGroups();
  };

  return (
    <div className='space-y-4'>
      {/* 操作栏 */}
      <form
        onSubmit={handleSearch}
        className='flex flex-wrap gap-3 items-center'
      >
        <input
          type='text'
          placeholder='搜索法律名称...'
          value={filters.search}
          onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          className='flex-1 min-w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <select
          value={filters.lawType}
          onChange={e => setFilters(f => ({ ...f, lawType: e.target.value }))}
          className='px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>全部类型</option>
          <option value='LAW'>法律</option>
          <option value='ADMINISTRATIVE_REGULATION'>行政法规</option>
          <option value='JUDICIAL_INTERPRETATION'>司法解释</option>
          <option value='LOCAL_REGULATION'>地方法规</option>
          <option value='DEPARTMENTAL_RULE'>部门规章</option>
        </select>
        <select
          value={filters.status}
          onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          className='px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>全部状态</option>
          <option value='VALID'>有效</option>
          <option value='AMENDED'>已修订</option>
          <option value='REPEALED'>已废止</option>
        </select>
        <button
          type='submit'
          className='px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700'
        >
          搜索
        </button>
        <button
          type='button'
          onClick={() => setShowImportDialog(true)}
          className='px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 ml-auto'
        >
          导入法条
        </button>
      </form>

      {/* 错误 */}
      {error && (
        <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm'>
          {error}
        </div>
      )}

      {/* 加载 */}
      {loading && (
        <div className='text-center py-12'>
          <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent' />
          <p className='mt-2 text-sm text-gray-500'>加载中...</p>
        </div>
      )}

      {/* 汇总 */}
      {!loading && laws.length > 0 && (
        <div className='text-sm text-gray-500'>
          共 <span className='font-semibold text-gray-900'>{laws.length}</span>{' '}
          部法律， 合计{' '}
          <span className='font-semibold text-gray-900'>
            {laws.reduce((s, l) => s + l.count, 0).toLocaleString()}
          </span>{' '}
          条条文
        </div>
      )}

      {/* 分组列表 */}
      {!loading && laws.length === 0 && !error && (
        <div className='text-center py-12 text-gray-500'>暂无数据</div>
      )}

      {!loading && laws.length > 0 && (
        <div className='divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm'>
          {laws.map(law => (
            <div key={law.lawName}>
              {/* 法律标题行 */}
              <button
                onClick={() => toggle(law.lawName)}
                className='w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left'
              >
                {/* 展开/折叠图标 */}
                <span
                  className={`flex-shrink-0 h-4 w-4 text-gray-400 transition-transform ${expanded.has(law.lawName) ? 'rotate-90' : ''}`}
                >
                  ▶
                </span>

                {/* 法律名称 */}
                <span className='flex-1 text-sm font-medium text-gray-900 truncate'>
                  {law.lawName}
                </span>

                {/* 标签区 */}
                <div className='flex items-center gap-2 flex-shrink-0'>
                  <span className='text-xs text-gray-500 hidden sm:block'>
                    {LAW_TYPE_LABELS[law.lawType] ?? law.lawType}
                  </span>
                  <span className='text-xs text-gray-400 hidden md:block'>
                    {CATEGORY_LABELS[law.category] ?? law.category}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs ${STATUS_BADGE[law.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {STATUS_LABELS[law.status] ?? law.status}
                  </span>
                  <span className='bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium'>
                    {law.count.toLocaleString()} 条
                  </span>
                </div>
              </button>

              {/* 展开内容 */}
              {expanded.has(law.lawName) && (
                <LawArticlesDetail
                  lawName={law.lawName}
                  onDelete={() => setReloadKey(k => k + 1)}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* 导入对话框 */}
      {showImportDialog && (
        <LawArticleImportDialog
          open={showImportDialog}
          onClose={() => setShowImportDialog(false)}
          onSuccess={() => {
            setShowImportDialog(false);
            setReloadKey(k => k + 1);
          }}
        />
      )}
    </div>
  );
}
