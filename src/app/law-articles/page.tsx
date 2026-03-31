'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search,
  BookOpen,
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  FileText,
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
};

const LAW_TYPE_LABELS: Record<string, string> = {
  CONSTITUTION: '宪法',
  LAW: '法律',
  ADMINISTRATIVE_REGULATION: '行政法规',
  LOCAL_REGULATION: '地方法规',
  JUDICIAL_INTERPRETATION: '司法解释',
  DEPARTMENTAL_RULE: '部门规章',
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
  REPEALED: 'bg-red-100 text-red-500',
  EXPIRED: 'bg-orange-100 text-orange-600',
};

// ── 类型定义 ────────────────────────────────────────────────
interface LawGroup {
  lawName: string;
  category: string;
  lawType: string;
  status: string;
  articleCount: number;
  effectiveDate: string | null;
}

interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  category: string;
  lawType: string;
  status: string;
  effectiveDate: string | null;
  viewCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── 工具函数 ────────────────────────────────────────────────

/** 条文编号格式化 */
function formatArticleNumber(num: string): string {
  if (!num) return '';
  const t = num.trim();
  return /^\d+$/.test(t) ? `第${parseInt(t, 10)}条` : t;
}

/** 是否为修正案/历史版本（次要条目） */
function isSecondary(law: LawGroup): boolean {
  return (
    /修正案|修改决定|补充规定|废止决定/.test(law.lawName) ||
    // 名称以纯年份结尾，如"（1982年）"，说明是历史特定版本
    /（\d{4}年）$/.test(law.lawName) ||
    law.status === 'EXPIRED' ||
    law.status === 'REPEALED'
  );
}

/** 提取法律基础名称（去掉年份、修正案等后缀），用于分组 */
function getBaseName(name: string): string {
  return name
    .replace(/修正案（\d{4}年）$/, '')
    .replace(/修正案$/, '')
    .replace(/（\d{4}年修正文本）$/, '')
    .replace(/（\d{4}年）$/, '')
    .replace(/修改决定.*$/, '')
    .trim();
}

interface GroupedLaw {
  primary: LawGroup;
  secondaries: LawGroup[];
}

/** 将平铺的法律列表按基础名称分组 */
function groupLaws(laws: LawGroup[]): GroupedLaw[] {
  const primaryMap = new Map<string, LawGroup>();
  const secondaryMap = new Map<string, LawGroup[]>();

  // 先收集所有主体法律
  for (const law of laws) {
    if (!isSecondary(law)) {
      primaryMap.set(law.lawName, law);
    }
  }

  // 再将修正案/历史版本归入对应主体
  for (const law of laws) {
    if (!isSecondary(law)) continue;
    const base = getBaseName(law.lawName);
    // 找最匹配的主体法律
    const parentName = [...primaryMap.keys()].find(
      k => k.includes(base) || base.includes(getBaseName(k))
    );
    const key = parentName ?? `__orphan__${base}`;
    const list = secondaryMap.get(key) ?? [];
    list.push(law);
    secondaryMap.set(key, list);
  }

  const groups: GroupedLaw[] = [];

  // 已有主体的分组
  for (const [name, primary] of primaryMap) {
    groups.push({
      primary,
      secondaries: secondaryMap.get(name) ?? [],
    });
  }

  // 孤立的次要条目（找不到主体），单独成组作为主体显示
  for (const [key, secs] of secondaryMap) {
    if (key.startsWith('__orphan__')) {
      for (const s of secs) {
        groups.push({ primary: s, secondaries: [] });
      }
    }
  }

  return groups;
}

// ── 法律卡片组件 ────────────────────────────────────────────
function LawCard({
  law,
  dim,
  onClick,
}: {
  law: LawGroup;
  dim?: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-start justify-between gap-4 px-5 py-4 hover:bg-blue-50 cursor-pointer transition-colors rounded-lg ${dim ? 'opacity-60' : ''}`}
    >
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2 flex-wrap mb-1.5'>
          <span className='font-medium text-zinc-900 truncate'>
            {law.lawName}
          </span>
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          {law.category !== 'OTHER' && CATEGORY_LABELS[law.category] && (
            <span className='text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700'>
              {CATEGORY_LABELS[law.category]}
            </span>
          )}
          {law.lawType !== 'OTHER' && LAW_TYPE_LABELS[law.lawType] && (
            <span className='text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600'>
              {LAW_TYPE_LABELS[law.lawType]}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[law.status] ?? 'bg-zinc-100 text-zinc-600'}`}
          >
            {STATUS_LABELS[law.status] ?? law.status}
          </span>
          {law.effectiveDate && (
            <span className='text-xs text-zinc-400'>
              生效：{new Date(law.effectiveDate).toLocaleDateString('zh-CN')}
            </span>
          )}
        </div>
      </div>
      <div className='flex items-center gap-2 text-sm shrink-0'>
        <span className='text-zinc-400'>{law.articleCount} 条</span>
        <span className='text-blue-400'>→</span>
      </div>
    </div>
  );
}

// ── 分组卡片 ────────────────────────────────────────────────
function GroupCard({
  group,
  onSelect,
}: {
  group: GroupedLaw;
  onSelect: (lawName: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { primary, secondaries } = group;

  return (
    <div className='bg-white rounded-xl border border-zinc-200 overflow-hidden hover:border-blue-200 hover:shadow-sm transition-all'>
      <LawCard law={primary} onClick={() => onSelect(primary.lawName)} />

      {secondaries.length > 0 && (
        <>
          <button
            onClick={() => setExpanded(v => !v)}
            className='w-full flex items-center gap-2 px-5 py-2 text-xs text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 border-t border-zinc-100 transition-colors'
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
            {expanded ? '收起' : `${secondaries.length} 个修正案/历史版本`}
          </button>

          {expanded && (
            <div className='border-t border-zinc-100 bg-zinc-50 divide-y divide-zinc-100'>
              {secondaries.map(s => (
                <LawCard
                  key={s.lawName}
                  law={s}
                  dim
                  onClick={() => onSelect(s.lawName)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────
export default function LawArticlesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedLaw, setSelectedLaw] = useState<string | null>(
    searchParams.get('lawName')
  );

  // ── 第一级：法律列表 ─────────────────────────────────────
  const [laws, setLaws] = useState<LawGroup[]>([]);
  const [lawsLoading, setLawsLoading] = useState(true);
  const [lawsError, setLawsError] = useState<string | null>(null);
  const [lawsPagination, setLawsPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [lawSearch, setLawSearch] = useState('');
  const [lawSearchInput, setLawSearchInput] = useState('');
  const [lawCategory, setLawCategory] = useState('');
  const [lawType, setLawType] = useState('');
  const [lawStatus, setLawStatus] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // ── 第二级：条文列表 ─────────────────────────────────────
  const [articles, setArticles] = useState<LawArticle[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(false);
  const [articlesError, setArticlesError] = useState<string | null>(null);
  const [articlesPagination, setArticlesPagination] = useState<Pagination>({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
  });
  const [hideArchived, setHideArchived] = useState(true);
  const [archivedCount, setArchivedCount] = useState(0);

  // ── 拉取法律列表 ─────────────────────────────────────────
  const fetchLaws = useCallback(async () => {
    setLawsLoading(true);
    setLawsError(null);
    try {
      const params = new URLSearchParams({
        page: String(lawsPagination.page),
        limit: '50',
      });
      if (lawSearch) params.set('search', lawSearch);
      if (lawCategory) params.set('category', lawCategory);
      if (lawType) params.set('lawType', lawType);
      if (lawStatus) params.set('status', lawStatus);

      const res = await fetch(`/api/v1/law-articles/laws?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || '获取失败');

      setLaws(data.data?.laws ?? []);
      const pg = data.meta?.pagination ?? data.pagination;
      if (pg) setLawsPagination(prev => ({ ...prev, ...pg }));
    } catch (e) {
      setLawsError(e instanceof Error ? e.message : '获取法律列表失败');
    } finally {
      setLawsLoading(false);
    }
  }, [lawsPagination.page, lawSearch, lawCategory, lawType, lawStatus]);

  useEffect(() => {
    if (!selectedLaw) fetchLaws();
  }, [selectedLaw, fetchLaws]);

  // ── 拉取条文列表 ─────────────────────────────────────────
  const fetchArticles = useCallback(
    async (lawName: string, page: number, archived: boolean) => {
      setArticlesLoading(true);
      setArticlesError(null);
      try {
        const params = new URLSearchParams({
          lawName,
          page: String(page),
          limit: '100',
          sortBy: 'articleNumber',
          sortOrder: 'asc',
          hideArchived: String(archived),
        });
        const res = await fetch(`/api/v1/law-articles?${params}`);
        const data = await res.json();
        if (!res.ok || !data.success)
          throw new Error(data.message || '获取失败');

        setArticles(data.data?.articles ?? data.data ?? []);
        const pg = data.meta?.pagination ?? data.pagination;
        if (pg) setArticlesPagination(prev => ({ ...prev, ...pg }));

        // 首次加载时同时获取废止条文数量
        if (page === 1 && archived) {
          const allParams = new URLSearchParams({
            lawName,
            page: '1',
            limit: '1',
            sortBy: 'articleNumber',
            sortOrder: 'asc',
            hideArchived: 'false',
          });
          const allRes = await fetch(`/api/v1/law-articles?${allParams}`);
          const allData = await allRes.json();
          const allPg = allData.meta?.pagination ?? allData.pagination;
          const allTotal = allPg?.total ?? 0;
          const activePg = pg;
          const activeTotal = activePg?.total ?? 0;
          setArchivedCount(Math.max(0, allTotal - activeTotal));
        }
      } catch (e) {
        setArticlesError(e instanceof Error ? e.message : '获取条文列表失败');
      } finally {
        setArticlesLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedLaw)
      fetchArticles(selectedLaw, articlesPagination.page, hideArchived);
  }, [selectedLaw, articlesPagination.page, hideArchived, fetchArticles]);

  const handleSelectLaw = (lawName: string) => {
    setSelectedLaw(lawName);
    setArticlesPagination(prev => ({ ...prev, page: 1 }));
    setArchivedCount(0);
    setHideArchived(true);
  };

  const handleBack = () => {
    setSelectedLaw(null);
    setArticles([]);
  };

  const handleLawSearch = () => {
    setLawSearch(lawSearchInput);
    setLawsPagination(prev => ({ ...prev, page: 1 }));
  };

  // ── 渲染：第二级（条文列表）────────────────────────────────
  if (selectedLaw) {
    return (
      <div className='min-h-screen bg-zinc-50'>
        <header className='border-b border-zinc-200 bg-white px-6 py-4'>
          <div className='mx-auto max-w-7xl flex items-center gap-4'>
            <button
              onClick={handleBack}
              className='flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors'
            >
              <ArrowLeft className='h-4 w-4' />
              返回法律列表
            </button>
            <div className='h-4 w-px bg-zinc-300' />
            <h1 className='text-lg font-semibold text-zinc-900 truncate'>
              {selectedLaw}
            </h1>
            {articlesPagination.total > 0 && (
              <span className='text-sm text-zinc-400'>
                共 {articlesPagination.total} 条
              </span>
            )}
          </div>
        </header>

        <main className='mx-auto max-w-7xl px-6 py-6 space-y-3'>
          {/* 已废止条文提示 */}
          {!articlesLoading && archivedCount > 0 && hideArchived && (
            <div className='bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between text-sm'>
              <span className='text-amber-700'>
                已隐藏 {archivedCount} 条已废止/失效条文
              </span>
              <button
                onClick={() => setHideArchived(false)}
                className='text-amber-600 underline hover:text-amber-800 transition-colors'
              >
                显示全部
              </button>
            </div>
          )}
          {!articlesLoading && !hideArchived && archivedCount > 0 && (
            <div className='flex justify-end'>
              <button
                onClick={() => setHideArchived(true)}
                className='text-xs text-zinc-400 hover:text-zinc-600 underline transition-colors'
              >
                隐藏已废止条文
              </button>
            </div>
          )}

          {articlesLoading ? (
            <div className='bg-white rounded-xl border border-zinc-200 p-8 space-y-5'>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className='animate-pulse'>
                  <div className='h-4 bg-zinc-200 rounded w-1/6 mb-2' />
                  <div className='h-3 bg-zinc-100 rounded w-full mb-1' />
                  <div className='h-3 bg-zinc-100 rounded w-5/6' />
                </div>
              ))}
            </div>
          ) : articlesError ? (
            <div className='bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600'>
              <p>{articlesError}</p>
              <button
                onClick={() =>
                  fetchArticles(
                    selectedLaw,
                    articlesPagination.page,
                    hideArchived
                  )
                }
                className='mt-2 text-sm underline'
              >
                重试
              </button>
            </div>
          ) : articles.length === 0 ? (
            <div className='bg-white rounded-xl border border-zinc-200 p-12 text-center'>
              <FileText className='h-10 w-10 text-zinc-300 mx-auto mb-3' />
              <p className='text-zinc-500'>暂无条文数据</p>
            </div>
          ) : (
            <div className='bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100'>
              {articles.map(article => (
                <div
                  key={article.id}
                  className='px-8 py-5 hover:bg-zinc-50 group transition-colors'
                >
                  <div className='flex items-baseline gap-3'>
                    <button
                      onClick={() => router.push(`/law-articles/${article.id}`)}
                      className='shrink-0 font-semibold text-zinc-800 group-hover:text-blue-600 transition-colors text-sm whitespace-nowrap'
                      title='查看图谱与关系'
                    >
                      {formatArticleNumber(article.articleNumber)}
                    </button>
                    {article.status !== 'VALID' && (
                      <span
                        className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full ${STATUS_COLORS[article.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                      >
                        {STATUS_LABELS[article.status] ?? article.status}
                      </span>
                    )}
                    <p className='text-zinc-700 leading-relaxed text-sm flex-1'>
                      {article.fullText}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!articlesLoading && articlesPagination.totalPages > 1 && (
            <div className='flex items-center justify-center gap-2 pt-4'>
              <button
                onClick={() =>
                  setArticlesPagination(prev => ({
                    ...prev,
                    page: prev.page - 1,
                  }))
                }
                disabled={articlesPagination.page <= 1}
                className='h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <ChevronLeft className='h-4 w-4' />
              </button>
              <span className='text-sm text-zinc-500'>
                {articlesPagination.page} / {articlesPagination.totalPages}
              </span>
              <button
                onClick={() =>
                  setArticlesPagination(prev => ({
                    ...prev,
                    page: prev.page + 1,
                  }))
                }
                disabled={
                  articlesPagination.page >= articlesPagination.totalPages
                }
                className='h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <ChevronRight className='h-4 w-4' />
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // ── 渲染：第一级（法律列表）────────────────────────────────
  const grouped = groupLaws(laws);

  return (
    <div className='min-h-screen bg-zinc-50'>
      <header className='border-b border-zinc-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-7xl flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <BookOpen className='h-6 w-6 text-blue-600' />
            <h1 className='text-xl font-semibold text-zinc-900'>法条检索</h1>
            {lawsPagination.total > 0 && (
              <span className='text-sm text-zinc-500'>
                共 {lawsPagination.total.toLocaleString()} 部法律
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
              placeholder='搜索法律名称...'
              value={lawSearchInput}
              onChange={e => setLawSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLawSearch()}
              className='w-full pl-9 pr-4 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <button
            onClick={handleLawSearch}
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
          <div className='bg-white border border-zinc-200 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4'>
            <div>
              <label className='block text-xs font-medium text-zinc-600 mb-1'>
                法律类别
              </label>
              <select
                value={lawCategory}
                onChange={e => {
                  setLawCategory(e.target.value);
                  setLawsPagination(p => ({ ...p, page: 1 }));
                }}
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
                onChange={e => {
                  setLawType(e.target.value);
                  setLawsPagination(p => ({ ...p, page: 1 }));
                }}
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
                value={lawStatus}
                onChange={e => {
                  setLawStatus(e.target.value);
                  setLawsPagination(p => ({ ...p, page: 1 }));
                }}
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
          </div>
        )}

        {/* 法律列表 */}
        {lawsLoading ? (
          <div className='space-y-3'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className='bg-white rounded-xl border border-zinc-200 p-5 animate-pulse'
              >
                <div className='h-4 bg-zinc-200 rounded w-2/3 mb-3' />
                <div className='h-3 bg-zinc-100 rounded w-1/3' />
              </div>
            ))}
          </div>
        ) : lawsError ? (
          <div className='bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-600'>
            <p className='font-medium'>{lawsError}</p>
            <button onClick={fetchLaws} className='mt-3 text-sm underline'>
              重试
            </button>
          </div>
        ) : grouped.length === 0 ? (
          <div className='bg-white rounded-xl border border-zinc-200 p-12 text-center'>
            <BookOpen className='h-12 w-12 text-zinc-300 mx-auto mb-4' />
            <p className='text-zinc-500 font-medium'>未找到相关法律</p>
            <p className='text-sm text-zinc-400 mt-1'>请调整搜索条件或筛选项</p>
          </div>
        ) : (
          <div className='space-y-2'>
            {grouped.map(group => (
              <GroupCard
                key={group.primary.lawName}
                group={group}
                onSelect={handleSelectLaw}
              />
            ))}
          </div>
        )}

        {/* 分页 */}
        {!lawsLoading && lawsPagination.totalPages > 1 && (
          <div className='flex items-center justify-center gap-2 pt-4'>
            <button
              onClick={() =>
                setLawsPagination(prev => ({ ...prev, page: prev.page - 1 }))
              }
              disabled={lawsPagination.page <= 1}
              className='h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed'
            >
              <ChevronLeft className='h-4 w-4' />
            </button>
            {Array.from(
              { length: Math.min(5, lawsPagination.totalPages) },
              (_, i) => {
                const start = Math.max(
                  1,
                  Math.min(
                    lawsPagination.page - 2,
                    lawsPagination.totalPages - 4
                  )
                );
                return start + i;
              }
            ).map(p => (
              <button
                key={p}
                onClick={() =>
                  setLawsPagination(prev => ({ ...prev, page: p }))
                }
                className={`h-9 min-w-[36px] px-3 rounded-lg text-sm border transition-colors ${p === lawsPagination.page ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50'}`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() =>
                setLawsPagination(prev => ({ ...prev, page: prev.page + 1 }))
              }
              disabled={lawsPagination.page >= lawsPagination.totalPages}
              className='h-9 w-9 flex items-center justify-center rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed'
            >
              <ChevronRight className='h-4 w-4' />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
