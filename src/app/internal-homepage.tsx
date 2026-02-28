'use client';

import _React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  Scale,
  BookOpen,
  FileText,
  BarChart2,
  Network,
  FilePlus,
  Search,
  Settings,
  ChevronRight,
  Shield,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Building2,
  Briefcase,
  BadgeCheck,
  ClipboardCheck,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// 类型
// ─────────────────────────────────────────────────────────────────────────────

interface SystemOverview {
  totalLawArticles: number;
  totalRelations: number;
  relationCoverage: number;
  lastSyncTime: string;
}

interface RecentDebate {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface RecentActivity {
  recentDebates: RecentDebate[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 常量配置
// ─────────────────────────────────────────────────────────────────────────────

const NAV_MODULES = [
  {
    label: '案件管理',
    href: '/cases',
    icon: FileText,
    description: '查看和管理所有法律案件',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
  },
  {
    label: '辩论生成',
    href: '/debates',
    icon: Scale,
    description: 'AI 驱动的法律辩论分析',
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40',
  },
  {
    label: '法条检索',
    href: '/law-articles',
    icon: Search,
    description: '搜索海量法律条文数据库',
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
  },
  {
    label: '知识图谱',
    href: '/knowledge-graph',
    icon: Network,
    description: '可视化法律关系网络',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
  },
  {
    label: '合同审查',
    href: '/contracts/review',
    icon: BookOpen,
    description: '智能合同风险分析',
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
  },
  {
    label: '数据统计',
    href: '/dashboard',
    icon: BarChart2,
    description: '系统运营数据总览',
    color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40',
  },
  {
    label: '资质认证',
    href: '/qualifications',
    icon: BadgeCheck,
    description: '律师执照及资格证书管理',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40',
  },
  {
    label: '合规检查',
    href: '/compliance',
    icon: Shield,
    description: '业务合规风险评估与报告',
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40',
  },
  {
    label: '审批中心',
    href: '/approvals',
    icon: ClipboardCheck,
    description: '查看和处理待审批工作流',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40',
  },
  {
    label: '退款管理',
    href: '/refunds',
    icon: RefreshCw,
    description: '申请退款及查看退款记录',
    color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/40',
  },
  {
    label: '立案材料',
    href: '/filing-materials',
    icon: FolderOpen,
    description: '各类案件立案所需材料清单',
    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40',
  },
];

const LANDING_FEATURES = [
  {
    icon: Sparkles,
    title: 'AI 辩论生成',
    desc: '基于百万级法律条文的语料库，自动生成专业攻防论点，助力案件庭审准备。',
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-950/30',
  },
  {
    icon: Search,
    title: '法条智能检索',
    desc: '语义理解驱动的法律检索引擎，精准定位适用条文，关联司法解释一键对照。',
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
  },
  {
    icon: Shield,
    title: '合同风险分析',
    desc: '自动识别合同条款中的法律风险，生成专业审查报告，保障企业合规安全。',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
];

const LAWYER_FEATURES = [
  '案件立案与全周期管理',
  'AI 自动生成辩护论点',
  '关联法条一键检索',
  '庭审文书智能撰写',
  '开庭日程与提醒',
  '多律师团队协作',
];

const ENTERPRISE_FEATURES = [
  '合同起草与智能审查',
  '合规风险全面扫描',
  '劳动争议处理指引',
  '内部法律意见书生成',
  '监管政策变化追踪',
  '法务工作报表统计',
];

const DEBATE_STATUS_LABEL: Record<string, string> = {
  PENDING: '待开始',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  FAILED: '失败',
};

const DEBATE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  IN_PROGRESS:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  COMPLETED:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};

// ─────────────────────────────────────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days} 天前`;
  if (hours > 0) return `${hours} 小时前`;
  if (minutes > 0) return `${minutes} 分钟前`;
  return '刚刚';
}

// ─────────────────────────────────────────────────────────────────────────────
// 营销落地页（游客）
// ─────────────────────────────────────────────────────────────────────────────

function LandingPage() {
  const router = useRouter();

  return (
    <div className='min-h-screen bg-white dark:bg-zinc-950'>
      {/* 顶部导航 */}
      <header className='fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-white/80 backdrop-blur-md dark:bg-zinc-950/80'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-4'>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600'>
              <Scale className='h-4 w-4 text-white' />
            </div>
            <span className='text-base font-semibold text-zinc-900 dark:text-zinc-50'>
              法律辩论系统
            </span>
          </div>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => router.push('/login')}
              className='rounded-md px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            >
              登录
            </button>
            <button
              onClick={() => router.push('/login')}
              className='rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700'
            >
              免费使用
            </button>
          </div>
        </div>
      </header>

      {/* Hero 区块 */}
      <section className='relative flex min-h-screen items-center overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-violet-950 pt-16'>
        {/* 背景装饰 */}
        <div className='pointer-events-none absolute inset-0 overflow-hidden'>
          <div className='absolute -left-40 -top-40 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl' />
          <div className='absolute -bottom-20 right-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl' />
          <div className='absolute left-1/2 top-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl' />
        </div>

        <div className='relative mx-auto max-w-7xl px-6 py-24'>
          <div className='max-w-3xl'>
            {/* 标签 */}
            <div className='mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5'>
              <Sparkles className='h-3.5 w-3.5 text-blue-400' />
              <span className='text-xs font-medium text-blue-300'>
                AI 驱动 · 专业法律分析
              </span>
            </div>

            <h1 className='mb-6 text-5xl font-bold leading-tight tracking-tight text-white md:text-6xl'>
              让 AI 成为您的
              <br />
              <span className='bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent'>
                法律智囊团
              </span>
            </h1>

            <p className='mb-10 max-w-xl text-lg leading-relaxed text-slate-300'>
              面向律师和企业法务的智能化工作平台。AI
              辩论生成、法条精准检索、合同风险分析，一站式覆盖您的法律工作需求。
            </p>

            <div className='flex flex-wrap gap-4'>
              <button
                onClick={() => router.push('/login')}
                className='flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/25'
              >
                立即开始使用
                <ArrowRight className='h-4 w-4' />
              </button>
              <button
                onClick={() =>
                  document
                    .getElementById('features')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                className='rounded-lg border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 backdrop-blur-sm transition-colors hover:border-white/40 hover:text-white'
              >
                了解更多
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 核心功能 */}
      <section id='features' className='bg-zinc-50 py-24 dark:bg-zinc-900'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='mb-14 text-center'>
            <h2 className='mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50'>
              核心能力
            </h2>
            <p className='mx-auto max-w-xl text-base text-zinc-500 dark:text-zinc-400'>
              深度整合法律知识图谱与大语言模型，为法律专业人士提供切实可用的智能工具
            </p>
          </div>

          <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
            {LANDING_FEATURES.map(feat => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className='rounded-2xl border border-zinc-200 bg-white p-8 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950'
                >
                  <div className={`mb-5 inline-flex rounded-xl p-3 ${feat.bg}`}>
                    <Icon className={`h-6 w-6 ${feat.color}`} />
                  </div>
                  <h3 className='mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                    {feat.title}
                  </h3>
                  <p className='text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
                    {feat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 双受众区块 */}
      <section className='py-24'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='mb-14 text-center'>
            <h2 className='mb-4 text-3xl font-bold text-zinc-900 dark:text-zinc-50'>
              专为两类用户设计
            </h2>
            <p className='text-base text-zinc-500 dark:text-zinc-400'>
              无论您是执业律师，还是企业法务，都有专属的工作流程
            </p>
          </div>

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            {/* 律师 */}
            <div className='rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-8 dark:border-blue-900/40 dark:from-blue-950/30 dark:to-zinc-900'>
              <div className='mb-5 flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600'>
                  <Briefcase className='h-5 w-5 text-white' />
                </div>
                <h3 className='text-xl font-bold text-zinc-900 dark:text-zinc-50'>
                  执业律师
                </h3>
              </div>
              <p className='mb-6 text-sm text-zinc-500 dark:text-zinc-400'>
                从立案到庭审，全流程 AI 辅助，让您专注于核心法律判断
              </p>
              <ul className='space-y-2.5'>
                {LAWYER_FEATURES.map(f => (
                  <li key={f} className='flex items-center gap-2.5'>
                    <CheckCircle2 className='h-4 w-4 flex-shrink-0 text-blue-500' />
                    <span className='text-sm text-zinc-700 dark:text-zinc-300'>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 企业法务 */}
            <div className='rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-8 dark:border-emerald-900/40 dark:from-emerald-950/30 dark:to-zinc-900'>
              <div className='mb-5 flex items-center gap-3'>
                <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600'>
                  <Building2 className='h-5 w-5 text-white' />
                </div>
                <h3 className='text-xl font-bold text-zinc-900 dark:text-zinc-50'>
                  企业法务
                </h3>
              </div>
              <p className='mb-6 text-sm text-zinc-500 dark:text-zinc-400'>
                降低企业法律风险，提升合规效率，用数据支撑法务决策
              </p>
              <ul className='space-y-2.5'>
                {ENTERPRISE_FEATURES.map(f => (
                  <li key={f} className='flex items-center gap-2.5'>
                    <CheckCircle2 className='h-4 w-4 flex-shrink-0 text-emerald-500' />
                    <span className='text-sm text-zinc-700 dark:text-zinc-300'>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className='bg-gradient-to-br from-blue-600 to-violet-700 py-20'>
        <div className='mx-auto max-w-3xl px-6 text-center'>
          <h2 className='mb-4 text-3xl font-bold text-white'>
            立即体验智能法律工作台
          </h2>
          <p className='mb-8 text-base text-blue-100'>
            已有账号？直接登录即可使用全部功能
          </p>
          <button
            onClick={() => router.push('/login')}
            className='inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-50 hover:shadow-xl'
          >
            登录 / 注册
            <ArrowRight className='h-4 w-4' />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className='border-t border-zinc-200 bg-white py-8 dark:border-zinc-800 dark:bg-zinc-950'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <div className='flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-violet-600'>
                <Scale className='h-3 w-3 text-white' />
              </div>
              <span className='text-sm text-zinc-500'>法律辩论系统</span>
            </div>
            <p className='text-xs text-zinc-400'>
              © {new Date().getFullYear()} Legal Debate MVP
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 内部工作台（已登录用户）
// ─────────────────────────────────────────────────────────────────────────────

function WorkspacePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const displayName = user?.name || user?.username || user?.email || '用户';

  useEffect(() => {
    fetch('/api/v1/system/overview')
      .then(r => (r.ok ? r.json() : null))
      .then(data => data && setOverview(data))
      .catch(() => {});

    fetch('/api/v1/system/recent-activity')
      .then(r => (r.ok ? r.json() : null))
      .then(data => data && setActivity(data))
      .catch(() => {});
  }, []);

  const stats = [
    {
      label: '法条总数',
      value: overview ? overview.totalLawArticles.toLocaleString() : '—',
      color: 'text-blue-600',
    },
    {
      label: '法律关系',
      value: overview ? overview.totalRelations.toLocaleString() : '—',
      color: 'text-violet-600',
    },
    {
      label: '关系覆盖率',
      value: overview ? `${Math.round(overview.relationCoverage * 100)}%` : '—',
      color: 'text-emerald-600',
    },
    {
      label: '最后同步',
      value: overview
        ? new Date(overview.lastSyncTime).toLocaleDateString('zh-CN')
        : '—',
      color: 'text-zinc-600 dark:text-zinc-400',
    },
  ];

  const recentDebates = activity?.recentDebates ?? [];

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-zinc-950'>
      {/* 顶部导航栏 */}
      <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-4'>
          {/* Logo */}
          <div className='flex items-center gap-3'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600'>
              <Scale className='h-4 w-4 text-white' />
            </div>
            <span className='text-base font-semibold text-zinc-900 dark:text-zinc-50'>
              法律辩论系统
            </span>
          </div>

          {/* 右侧：用户信息 + 管理后台（仅管理员可见） */}
          <div className='flex items-center gap-3'>
            <span className='hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block'>
              {displayName}
            </span>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className='flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              >
                <Settings className='h-3.5 w-3.5' />
                管理后台
              </button>
            )}
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-7xl px-6 py-8'>
        {/* 欢迎语 */}
        <div className='mb-8'>
          <h1 className='text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
            你好，{displayName}
          </h1>
          <p className='mt-1 text-sm text-zinc-500 dark:text-zinc-400'>
            今天是{' '}
            {new Date().toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>

        {/* 数据统计 */}
        <div className='mb-8 grid grid-cols-2 gap-4 md:grid-cols-4'>
          {stats.map(stat => (
            <div
              key={stat.label}
              className='rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900'
            >
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
              <div className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          {/* 功能模块（占 2/3） */}
          <div className='lg:col-span-2'>
            <h2 className='mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400'>
              功能模块
            </h2>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              {NAV_MODULES.map(mod => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.href}
                    onClick={() => router.push(mod.href)}
                    className='group flex items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700'
                  >
                    <div className={`mt-0.5 rounded-lg p-2 ${mod.color}`}>
                      <Icon className='h-4 w-4' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center justify-between'>
                        <span className='text-sm font-semibold text-zinc-900 dark:text-zinc-50'>
                          {mod.label}
                        </span>
                        <ChevronRight className='h-4 w-4 flex-shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5' />
                      </div>
                      <p className='mt-0.5 text-xs text-zinc-500 dark:text-zinc-400'>
                        {mod.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右侧栏 */}
          <div className='flex flex-col gap-4'>
            {/* 快速创建 */}
            <div className='rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'>
              <h2 className='mb-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400'>
                快速创建
              </h2>
              <div className='space-y-1.5'>
                <button
                  onClick={() => router.push('/cases/create')}
                  className='flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                >
                  <div className='flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/40'>
                    <FilePlus className='h-3.5 w-3.5 text-blue-600' />
                  </div>
                  新建案件
                </button>
                <button
                  onClick={() => router.push('/cases/create')}
                  className='flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800'
                >
                  <div className='flex h-7 w-7 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/40'>
                    <Scale className='h-3.5 w-3.5 text-violet-600' />
                  </div>
                  发起辩论
                </button>
              </div>
            </div>

            {/* 最近辩论 */}
            <div className='flex-1 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900'>
              <div className='mb-3 flex items-center justify-between'>
                <h2 className='text-sm font-semibold text-zinc-500 dark:text-zinc-400'>
                  最近辩论
                </h2>
                <button
                  onClick={() => router.push('/debates')}
                  className='text-xs text-blue-600 hover:underline dark:text-blue-400'
                >
                  全部
                </button>
              </div>

              {recentDebates.length > 0 ? (
                <div className='space-y-1'>
                  {recentDebates.slice(0, 5).map(debate => (
                    <button
                      key={debate.id}
                      onClick={() => router.push(`/debates/${debate.id}`)}
                      className='flex w-full items-start justify-between gap-2 rounded-lg p-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    >
                      <div className='min-w-0'>
                        <div className='truncate text-xs font-medium text-zinc-800 dark:text-zinc-200'>
                          {debate.title}
                        </div>
                        <div className='mt-0.5 text-xs text-zinc-400'>
                          {formatRelativeTime(debate.createdAt)}
                        </div>
                      </div>
                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DEBATE_STATUS_COLOR[debate.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                      >
                        {DEBATE_STATUS_LABEL[debate.status] ?? debate.status}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className='py-6 text-center'>
                  <Scale className='mx-auto mb-2 h-8 w-8 text-zinc-200 dark:text-zinc-700' />
                  <p className='text-xs text-zinc-400 dark:text-zinc-500'>
                    暂无辩论记录
                  </p>
                  <button
                    onClick={() => router.push('/cases/create')}
                    className='mt-3 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700'
                  >
                    发起第一场辩论
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 主入口：根据登录状态切换页面
// ─────────────────────────────────────────────────────────────────────────────

export default function InternalHomepage() {
  const { user, loading } = useAuth();

  // 认证检查中：显示最小化加载，避免闪烁
  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950'>
        <div className='h-6 w-6 animate-spin rounded-full border-2 border-zinc-200 border-t-blue-600' />
      </div>
    );
  }

  // 游客：营销落地页
  if (!user) {
    return <LandingPage />;
  }

  // 已登录：内部工作台
  return <WorkspacePage />;
}
