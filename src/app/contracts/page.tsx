/**
 * 合同管理页面 — 我的合同 + 合同模板库
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ContractStatus } from '@/types/contract';

// ─── 我的合同 ────────────────────────────────────────────────────────────────

interface Contract {
  id: string;
  contractNumber: string;
  clientName: string;
  clientType: string;
  caseType: string;
  totalFee: number;
  paidAmount: number;
  status: ContractStatus;
  signedAt: Date | null;
  createdAt: Date;
  case: { id: string; title: string; caseNumber: string | null } | null;
  paymentCount: number;
  paidPaymentCount: number;
}

const STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: '草稿',
  PENDING: '待签署',
  SIGNED: '已签署',
  EXECUTING: '履行中',
  COMPLETED: '已完成',
  TERMINATED: '已终止',
};
const STATUS_COLOR: Record<ContractStatus, string> = {
  DRAFT: 'bg-zinc-100 text-zinc-700',
  PENDING: 'bg-amber-100 text-amber-700',
  SIGNED: 'bg-blue-100 text-blue-700',
  EXECUTING: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-violet-100 text-violet-700',
  TERMINATED: 'bg-red-100 text-red-700',
};

function MyContractsTab() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ContractStatus | ''>('');
  const [keyword, setKeyword] = useState('');

  const load = useCallback(
    async (p = page, s = status, kw = keyword) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: p.toString(),
          pageSize: PAGE_SIZE.toString(),
        });
        if (s) params.append('status', s);
        if (kw) params.append('keyword', kw);
        const res = await fetch(`/api/contracts?${params}`);
        const data = await res.json();
        if (data.success && data.data?.items) {
          setContracts(data.data.items);
          setTotal(data.data.total || 0);
        } else {
          setError('加载失败，请刷新重试');
        }
      } catch {
        setError('加载失败，请刷新重试');
      } finally {
        setLoading(false);
      }
    },
    [page, status, keyword]
  );

  useEffect(() => {
    load();
  }, [page, status]); // eslint-disable-line react-hooks/exhaustive-deps

  function search() {
    setPage(1);
    load(1, status, keyword);
  }

  function payLabel(c: Contract) {
    if (c.paidAmount === 0) return { text: '未付', cls: 'text-red-600' };
    if (c.paidAmount >= c.totalFee)
      return { text: '全额', cls: 'text-green-600' };
    return { text: '部分', cls: 'text-amber-600' };
  }

  return (
    <div>
      {/* 筛选栏 */}
      <div className='mb-5 flex flex-wrap gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm'>
        <select
          value={status}
          onChange={e => {
            setStatus(e.target.value as ContractStatus | '');
            setPage(1);
          }}
          className='rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>全部状态</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className='flex flex-1 gap-2'>
          <input
            type='text'
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder='搜索客户名称或合同编号'
            className='min-w-[220px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            onClick={search}
            className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
          >
            搜索
          </button>
        </div>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      <div className='overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm'>
        {loading ? (
          <div className='py-16 text-center text-zinc-400'>
            <div className='mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600' />
            加载中…
          </div>
        ) : contracts.length === 0 ? (
          <div className='py-16 text-center'>
            <div className='mx-auto mb-3 text-4xl'>📄</div>
            <p className='text-sm text-zinc-500'>暂无合同记录</p>
            <Link
              href='/contracts/new'
              className='mt-3 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700'
            >
              创建第一份合同
            </Link>
          </div>
        ) : (
          <>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500'>
                  <tr>
                    {[
                      '合同编号',
                      '客户',
                      '案件类型',
                      '总费用',
                      '已付',
                      '状态',
                      '签署日期',
                      '操作',
                    ].map(h => (
                      <th
                        key={h}
                        className='px-5 py-3 text-left whitespace-nowrap'
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className='divide-y divide-zinc-100'>
                  {contracts.map(c => {
                    const pay = payLabel(c);
                    return (
                      <tr
                        key={c.id}
                        className='hover:bg-zinc-50 transition-colors'
                      >
                        <td className='px-5 py-3.5 font-medium text-zinc-900 whitespace-nowrap'>
                          {c.contractNumber}
                        </td>
                        <td className='px-5 py-3.5'>
                          <div className='font-medium text-zinc-900'>
                            {c.clientName}
                          </div>
                          <div className='text-xs text-zinc-400'>
                            {c.clientType === 'INDIVIDUAL' ? '个人' : '企业'}
                          </div>
                        </td>
                        <td className='px-5 py-3.5 text-zinc-600 whitespace-nowrap'>
                          {c.caseType}
                        </td>
                        <td className='px-5 py-3.5 font-medium text-zinc-900 whitespace-nowrap'>
                          ¥{c.totalFee.toLocaleString()}
                        </td>
                        <td className='px-5 py-3.5 whitespace-nowrap'>
                          <div className='text-zinc-900'>
                            ¥{c.paidAmount.toLocaleString()}
                          </div>
                          <div className={`text-xs ${pay.cls}`}>{pay.text}</div>
                        </td>
                        <td className='px-5 py-3.5 whitespace-nowrap'>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_COLOR[c.status]}`}
                          >
                            {STATUS_LABEL[c.status]}
                          </span>
                        </td>
                        <td className='px-5 py-3.5 text-zinc-400 whitespace-nowrap'>
                          {c.signedAt
                            ? new Date(c.signedAt).toLocaleDateString('zh-CN')
                            : '—'}
                        </td>
                        <td className='px-5 py-3.5 whitespace-nowrap'>
                          <div className='flex gap-3'>
                            <Link
                              href={`/contracts/${c.id}`}
                              className='text-blue-600 hover:underline'
                            >
                              查看
                            </Link>
                            <Link
                              href={`/contracts/${c.id}/edit`}
                              className='text-zinc-500 hover:text-zinc-800'
                            >
                              编辑
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className='flex items-center justify-between border-t border-zinc-100 px-5 py-3'>
              <span className='text-xs text-zinc-400'>
                共 {total} 条，第 {page} 页
              </span>
              <div className='flex gap-2'>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className='rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40'
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * PAGE_SIZE >= total}
                  className='rounded-lg border border-zinc-200 px-3 py-1.5 text-xs disabled:opacity-40'
                >
                  下一页
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── 合同模板库 ───────────────────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  category: string;
  subCategory: string | null;
  description: string | null;
  source: string | null;
  version: string;
  viewCount: number;
  tags: string[];
  keywords: string[];
}

const CATEGORY_LABEL: Record<string, string> = {
  EMPLOYMENT: '劳动用工',
  REAL_ESTATE: '房产物业',
  SERVICE: '服务协议',
  SALES: '买卖合同',
  LOAN: '借贷融资',
  LEASE: '租赁合同',
  CONSTRUCTION: '建设工程',
  TRANSPORTATION: '运输物流',
  TECHNOLOGY: '技术合作',
  INTELLECTUAL_PROPERTY: '知识产权',
  INVESTMENT: '投资合作',
  OTHER: '其他',
};
const CATEGORY_COLOR: Record<string, string> = {
  EMPLOYMENT: 'bg-blue-50 text-blue-700 border-blue-200',
  REAL_ESTATE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SERVICE: 'bg-violet-50 text-violet-700 border-violet-200',
  SALES: 'bg-amber-50 text-amber-700 border-amber-200',
  LOAN: 'bg-rose-50 text-rose-700 border-rose-200',
  LEASE: 'bg-teal-50 text-teal-700 border-teal-200',
  CONSTRUCTION: 'bg-orange-50 text-orange-700 border-orange-200',
  TRANSPORTATION: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  TECHNOLOGY: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  INTELLECTUAL_PROPERTY: 'bg-pink-50 text-pink-700 border-pink-200',
  INVESTMENT: 'bg-lime-50 text-lime-700 border-lime-200',
  OTHER: 'bg-zinc-100 text-zinc-600 border-zinc-200',
};

function TemplateLibraryTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [keyword, setKeyword] = useState('');

  const load = useCallback(
    async (p = 1, cat = category, kw = keyword) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: p.toString(),
          pageSize: PAGE_SIZE.toString(),
        });
        if (cat) params.append('category', cat);
        if (kw) params.append('keyword', kw);
        const res = await fetch(`/api/contract-templates?${params}`);
        const data = await res.json();
        if (data.success) {
          setTemplates(data.data?.items ?? data.data ?? []);
          setTotal(data.data?.total ?? data.data?.length ?? 0);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [category, keyword]
  );

  useEffect(() => {
    load(page, category);
  }, [page, category]); // eslint-disable-line react-hooks/exhaustive-deps

  function search() {
    setPage(1);
    load(1, category, keyword);
  }

  return (
    <div>
      {/* 筛选 */}
      <div className='mb-5 flex flex-wrap gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm'>
        <select
          value={category}
          onChange={e => {
            setCategory(e.target.value);
            setPage(1);
          }}
          className='rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <option value=''>全部分类</option>
          {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className='flex flex-1 gap-2'>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder='搜索模板名称或关键词…'
            className='min-w-[220px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          />
          <button
            onClick={search}
            className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700'
          >
            搜索
          </button>
        </div>
        <span className='self-center text-xs text-zinc-400'>
          共 {total} 份模板
        </span>
      </div>

      {loading ? (
        <div className='py-16 text-center text-zinc-400'>
          <div className='mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600' />
          加载中…
        </div>
      ) : templates.length === 0 ? (
        <div className='py-16 text-center text-zinc-400'>暂无匹配模板</div>
      ) : (
        <>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {templates.map(t => {
              const catLabel = CATEGORY_LABEL[t.category] ?? t.category;
              const catColor =
                CATEGORY_COLOR[t.category] ?? CATEGORY_COLOR.OTHER;
              return (
                <div
                  key={t.id}
                  className='group flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-zinc-300 hover:shadow-md'
                >
                  {/* 头部 */}
                  <div className='mb-3 flex items-start justify-between gap-2'>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${catColor}`}
                    >
                      {catLabel}
                    </span>
                    {t.viewCount > 0 && (
                      <span className='text-xs text-zinc-400'>
                        {t.viewCount} 次使用
                      </span>
                    )}
                  </div>

                  {/* 名称 */}
                  <h3 className='mb-2 line-clamp-2 text-sm font-semibold leading-snug text-zinc-900 group-hover:text-blue-600'>
                    {t.name}
                  </h3>

                  {/* 描述 */}
                  {t.description && (
                    <p className='mb-3 line-clamp-2 text-xs leading-relaxed text-zinc-500'>
                      {t.description}
                    </p>
                  )}

                  {/* 来源 & 版本 */}
                  <div className='mt-auto flex items-center justify-between border-t border-zinc-100 pt-3'>
                    <span className='text-xs text-zinc-400'>
                      {t.source ?? '标准模板'} · v{t.version}
                    </span>
                    <Link
                      href={`/contract-templates/${t.id}`}
                      className='rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700'
                    >
                      查看 →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 分页 */}
          <div className='mt-6 flex items-center justify-between'>
            <span className='text-xs text-zinc-400'>
              第 {page} 页，共 {Math.ceil(total / PAGE_SIZE)} 页
            </span>
            <div className='flex gap-2'>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className='rounded-lg border border-zinc-200 px-4 py-2 text-sm disabled:opacity-40 hover:bg-zinc-50'
              >
                上一页
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * PAGE_SIZE >= total}
                className='rounded-lg border border-zinc-200 px-4 py-2 text-sm disabled:opacity-40 hover:bg-zinc-50'
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── 主页面 ───────────────────────────────────────────────────────────────────

type Tab = 'my' | 'templates';

export default function ContractsPage() {
  const [tab, setTab] = useState<Tab>('my');

  return (
    <div className='min-h-screen bg-zinc-50 p-6'>
      <div className='mx-auto max-w-7xl'>
        {/* 页头 */}
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-zinc-900'>合同管理</h1>
            <p className='mt-1 text-sm text-zinc-500'>
              管理委托合同及使用标准合同模板库
            </p>
          </div>
          <Link
            href='/contracts/new'
            className='rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700'
          >
            + 创建合同
          </Link>
        </div>

        {/* 标签页 */}
        <div className='mb-6 flex gap-1 rounded-xl border border-zinc-200 bg-white p-1 shadow-sm w-fit'>
          <button
            onClick={() => setTab('my')}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition-all ${tab === 'my' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            我的合同
          </button>
          <button
            onClick={() => setTab('templates')}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition-all ${tab === 'templates' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-600 hover:text-zinc-900'}`}
          >
            合同模板库
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${tab === 'templates' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}
            >
              460
            </span>
          </button>
        </div>

        {tab === 'my' ? <MyContractsTab /> : <TemplateLibraryTab />}
      </div>
    </div>
  );
}
