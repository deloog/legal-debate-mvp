'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Scale,
} from 'lucide-react';

// ── 枚举映射 ────────────────────────────────────────────────
const CATEGORY_LABELS: Record<string, string> = {
  CIVIL: '民法',
  CRIMINAL: '刑法',
  ADMINISTRATIVE: '行政法',
  COMMERCIAL: '商法',
  ECONOMIC: '经济法',
  LABOR: '劳动法',
  INTELLECTUAL_PROPERTY: '知识产权',
  PROCEDURE: '程序法',
  OTHER: '其他',
};

const LAW_TYPE_LABELS: Record<string, string> = {
  CONSTITUTION: '宪法',
  LAW: '法律',
  ADMINISTRATIVE_REGULATION: '行政法规',
  LOCAL_REGULATION: '地方法规',
  JUDICIAL_INTERPRETATION: '司法解释',
  DEPARTMENTAL_RULE: '部门规章',
  OTHER: '其他',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: '草稿',
  VALID: '有效',
  AMENDED: '已修订',
  REPEALED: '已废止',
  EXPIRED: '已失效',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-600',
  VALID: 'bg-green-100 text-green-700',
  AMENDED: 'bg-blue-100 text-blue-700',
  REPEALED: 'bg-red-100 text-red-600',
  EXPIRED: 'bg-orange-100 text-orange-600',
};

// ── 类型定义 ────────────────────────────────────────────────
interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  category: string;
  lawType: string;
  status: string;
  effectiveDate: string | null;
  viewCount: number;
  referenceCount: number;
  dataSource: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── 主组件 ────────────────────────────────────────────────
export default function LawArticlesPage() {
  const router = useRouter();

  const [articles, setArticles] = useState<LawArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  // 筛选条件
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [category, setCategory] = useState('');
  const [lawType, setLawType] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [showFilters, setShowFilters] = useState(false);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
        sortBy,
        sortOrder: 'desc',
      });
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      if (lawType) params.set('lawType', lawType);
      if (status) params.set('status', status);

      const res = await fetch(`/api/v1/law-articles?${params}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.message || '获取失败');
      }

      setArticles(data.data?.articles ?? data.data ?? []);
      if (data.pagination) {
        setPagination(prev => ({ ...prev, ...data.pagination }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取法条列表失败');
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    pagination.limit,
    search,
    category,
    lawType,
    status,
    sortBy,
  ]);

  useEffect(() => {
    fetchArticles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, search, category, lawType, status, sortBy]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (key: string, value: string) => {
    if (key === 'category') setCategory(value);
    if (key === 'lawType') setLawType(value);
    if (key === 'status') setStatus(value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  // ── 渲染 ────────────────────────────────────────────────
  return (
    <div className='min-h-screen bg-zinc-50'>
      {/* 页头 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-7xl flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Scale className='h-6 w-6 text-blue-600' />
            <h1 className='text-xl font-semibold text-zinc-900'>法条检索</h1>
            {pagination.total > 0 && (
              <span className='text-sm text-zinc-500'>
                共 {pagination.total} 条
              </span>
            )}
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-6 py-6 space-y-4'>
        {/* 搜索栏 */}
        <div className='flex gap-2'>
          <div className='relative flex-1'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400' />
            <input
              type='text'
              placeholder='搜索法律名称、条文编号...'
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              className='w-full pl-9 pr-4 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <button
            onClick={handleSearch}
            className='px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700'
          >
            搜索
          </button>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-1 px-4 py-2 border rounded-lg text-sm transition-colors ${showFilters ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'}`}
          >
            <Filter className='h-4 w-4' />
            筛选
          </button>
        </div>

        {/* 筛选面板 */}
        {showFilters && (
          <div className='bg-white border border-zinc-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4'>
            <div>
              <label className='block text-xs font-medium text-zinc-600 mb-1'>
                法律类别
              </label>
              <select
                value={category}
                onChange={e => handleFilterChange('category', e.target.value)}
                className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部类别</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='block text-xs font-medium text-zinc-600 mb-1'>
                法律类型
              </label>
              <select
                value={lawType}
                onChange={e => handleFilterChange('lawType', e.target.value)}
                className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部类型</option>
                {Object.entries(LAW_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='block text-xs font-medium text-zinc-600 mb-1'>
                状态
              </label>
              <select
                value={status}
                onChange={e => handleFilterChange('status', e.target.value)}
                className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value=''>全部状态</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className='block text-xs font-medium text-zinc-600 mb-1'>
                排序
              </label>
              <select
                value={sortBy}
                onChange={e => {
                  setSortBy(e.target.value);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
                className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='createdAt'>最新收录</option>
                <option value='viewCount'>浏览最多</option>
                <option value='referenceCount'>引用最多</option>
                <option value='effectiveDate'>生效日期</option>
                <option value='lawName'>名称排序</option>
              </select>
            </div>
          </div>
        )}

        {/* 内容区 */}
        {loading ? (
          <div className='space-y-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className='bg-white rounded-xl border border-zinc-200 p-5 animate-pulse'
              >
                <div className='h-4 bg-zinc-200 rounded w-2/3 mb-3' />
                <div className='h-3 bg-zinc-100 rounded w-1/3' />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className='bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600'>
            <p className='font-medium'>{error}</p>
            <button onClick={fetchArticles} className='mt-3 text-sm underline'>
              重试
            </button>
          </div>
        ) : articles.length === 0 ? (
          <div className='bg-white rounded-xl border border-zinc-200 p-12 text-center'>
            <BookOpen className='h-12 w-12 text-zinc-300 mx-auto mb-4' />
            <p className='text-zinc-500 font-medium'>未找到相关法条</p>
            <p className='text-sm text-zinc-400 mt-1'>请调整搜索条件或筛选项</p>
          </div>
        ) : (
          <div className='space-y-2'>
            {articles.map(article => (
              <div
                key={article.id}
                onClick={() => router.push(`/law-articles/${article.id}`)}
                className='bg-white rounded-xl border border-zinc-200 p-5 hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all'
              >
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 flex-wrap mb-1'>
                      <h3 className='font-medium text-zinc-900 truncate'>
                        {article.lawName}
                      </h3>
                      {article.articleNumber && (
                        <span className='text-xs text-zinc-500 shrink-0'>
                          第 {article.articleNumber} 条
                        </span>
                      )}
                    </div>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span className='text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700'>
                        {CATEGORY_LABELS[article.category] ?? article.category}
                      </span>
                      <span className='text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600'>
                        {LAW_TYPE_LABELS[article.lawType] ?? article.lawType}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[article.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                      >
                        {STATUS_LABELS[article.status] ?? article.status}
                      </span>
                      {article.effectiveDate && (
                        <span className='text-xs text-zinc-400'>
                          生效：
                          {new Date(article.effectiveDate).toLocaleDateString(
                            'zh-CN'
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className='flex items-center gap-3 text-xs text-zinc-400 shrink-0'>
                    <span className='flex items-center gap-1'>
                      <Eye className='h-3 w-3' /> {article.viewCount}
                    </span>
                    <span className='text-blue-400'>→</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 分页 */}
        {!loading && pagination.totalPages > 1 && (
          <div className='flex items-center justify-center gap-2 pt-4'>
            <button
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className='flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>
            {Array.from(
              { length: Math.min(5, pagination.totalPages) },
              (_, i) => {
                const start = Math.max(
                  1,
                  Math.min(pagination.page - 2, pagination.totalPages - 4)
                );
                return start + i;
              }
            ).map(p => (
              <button
                key={p}
                onClick={() => goToPage(p)}
                className={`h-9 min-w-[36px] px-3 rounded-lg text-sm border transition-colors ${p === pagination.page ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'}`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className='flex items-center justify-center h-9 w-9 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
