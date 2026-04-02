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
  ScrollText,
  Zap,
  TrendingUp,
  Clock,
  AlertTriangle,
  PieChart,
  ListTodo,
  Users,
  CalendarDays,
  ShoppingCart,
  Upload,
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

interface RecentCase {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

interface RecentActivity {
  recentDebates: RecentDebate[];
  recentCases?: RecentCase[];
}

interface UserStats {
  totalCases: number;
  pendingTasks: number;
  todaySchedules: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 常量配置
// ─────────────────────────────────────────────────────────────────────────────

type UserRole = 'USER' | 'LAWYER' | 'ENTERPRISE' | 'ADMIN' | 'SUPER_ADMIN';

interface NavModule {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
  color: string;
  /**
   * 可见角色白名单。未设置表示所有已登录用户均可见。
   * ADMIN / SUPER_ADMIN 始终可见所有模块，无需列入此处。
   */
  roles?: UserRole[];
}

const NAV_MODULES: NavModule[] = [
  {
    label: '案件管理',
    href: '/cases',
    icon: FileText,
    description: '管理我的法律案件及相关文书',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
    // 律师：核心业务；企业法务：管理涉诉案件；普通用户：查看自己的案件
  },
  {
    label: '辩论生成',
    href: '/debates',
    icon: Scale,
    description: 'AI 驱动的法律辩论分析',
    color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '法条检索',
    href: '/law-articles',
    icon: Search,
    description: '搜索海量法律条文数据库',
    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '知识图谱',
    href: '/knowledge-graph',
    icon: Network,
    description: '可视化法律关系网络',
    color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '合同管理',
    href: '/contracts',
    icon: ScrollText,
    description: '合同全生命周期管理',
    color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '合同审查',
    href: '/contracts/review',
    icon: BookOpen,
    description: '智能合同风险分析',
    color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '资质认证',
    href: '/qualifications',
    icon: BadgeCheck,
    description: '律师执照及资格证书管理',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40',
    roles: ['LAWYER'],
  },
  {
    label: '合规检查',
    href: '/compliance',
    icon: Shield,
    description: '企业合规风险评估与报告',
    color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/40',
    roles: ['ENTERPRISE'],
  },
  {
    label: '审批中心',
    href: '/approvals',
    icon: ClipboardCheck,
    description: '查看我发起的审批流程进度',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '退款管理',
    href: '/refunds',
    icon: RefreshCw,
    description: '申请退款及查看退款记录',
    color: 'text-pink-600 bg-pink-50 dark:bg-pink-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '立案材料',
    href: '/filing-materials',
    icon: FolderOpen,
    description: '各类案件立案所需材料清单',
    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40',
    roles: ['LAWYER'],
  },
  {
    label: '文档管理',
    href: '/documents',
    icon: Upload,
    description: '上传案件文档，AI 自动提取关键信息',
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '风险评估',
    href: '/risk-assessment',
    icon: AlertTriangle,
    description: 'AI 驱动的案件法律风险评估',
    color: 'text-red-600 bg-red-50 dark:bg-red-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '法务报表',
    href: '/reports',
    icon: PieChart,
    description: '生成并导出法务统计报表',
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '任务管理',
    href: '/tasks',
    icon: ListTodo,
    description: '管理待办任务和跟进事项',
    color: 'text-green-600 bg-green-50 dark:bg-green-950/40',
  },
  {
    label: '团队管理',
    href: '/teams',
    icon: Users,
    description: '创建和管理律师团队',
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40',
    roles: ['LAWYER', 'ENTERPRISE'],
  },
  {
    label: '法院日程',
    href: '/court-schedule',
    icon: CalendarDays,
    description: '开庭日历及庭期冲突检测',
    color: 'text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40',
    roles: ['LAWYER'],
  },
  {
    label: '订单管理',
    href: '/orders',
    icon: ShoppingCart,
    description: '查看和管理我的订单记录',
    color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/40',
  },
  {
    label: '数据统计',
    href: '/dashboard',
    icon: BarChart2,
    description: '系统运营数据总览',
    color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40',
    // adminOnly — 由 isAdmin 逻辑处理，不设 roles
  },
];

const LAWYER_FEATURES = [
  '基于多源独立案例验证的辩护论点，附确定性评级',
  '每条法条显示认识论状态：确定 / 存疑 / 相变中',
  '自动发现对方论点依赖的不稳定法律解释',
  '少数意见追踪：识别可能成为未来主流的判例',
  '结论可审计：每个 AI 判断背后的证据链一目了然',
  '案件立案、文书撰写、开庭日程全周期管理',
];

const ENTERPRISE_FEATURES = [
  '合同条款引用法条的认识论状态实时标注',
  '合规风险评级结合司法实践稳定性分析',
  '劳动争议处理指引附典型判例独立性权重',
  '内部法律意见书生成，置信度表达规范化',
  '监管政策变化追踪，相变预警主动提醒',
  '法务工作报表统计与法律知识状态仪表盘',
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
      {/* ── 顶部导航 ── */}
      <header className='fixed inset-x-0 top-0 z-20 border-b border-white/10 bg-white/70 backdrop-blur-xl dark:bg-zinc-950/70'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5'>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 shadow-md shadow-blue-500/30'>
              <Scale className='h-4 w-4 text-white' />
            </div>
            <span className='text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-50'>
              律伴<span className='text-blue-600'>AI</span>助手
            </span>
          </div>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => router.push('/login')}
              className='rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50'
            >
              登录
            </button>
            <button
              onClick={() => router.push('/login')}
              className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md hover:shadow-blue-500/20'
            >
              申请使用
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero：左文右卡片 ── */}
      <section className='relative min-h-screen overflow-hidden bg-gradient-to-b from-slate-950 via-[#0d1b3e] to-[#0f172a]'>
        {/* 背景光晕 */}
        <div className='pointer-events-none absolute inset-0'>
          <div className='absolute left-1/4 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[120px]' />
          <div className='absolute right-0 top-1/3 h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[100px]' />
          <div className='absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-[80px]' />
          {/* 网格纹理 */}
          <div
            className='absolute inset-0 opacity-[0.03]'
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '60px 60px',
            }}
          />
        </div>

        <div className='relative mx-auto flex min-h-screen max-w-7xl items-center px-6 pt-20 pb-16'>
          <div className='grid w-full grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center'>
            {/* 左：文案 */}
            <div>
              <div className='mb-5 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3.5 py-1.5'>
                <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400' />
                <span className='text-xs font-medium text-blue-300'>
                  仅向认证律师 & 企业法务开放
                </span>
              </div>

              <h1 className='mb-5 text-4xl font-extrabold leading-tight tracking-tight text-white md:text-5xl lg:text-[3.25rem]'>
                知道边界在哪里的
                <span className='mt-4 block bg-gradient-to-r from-blue-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent'>
                  AI 法律搭档
                </span>
              </h1>

              <p className='mb-8 max-w-md text-base leading-relaxed text-slate-400'>
                律伴 AI 不只找到相关法条——还告诉你该法律在各级法院的
                <strong className='text-slate-200'>适用口径是否统一</strong>，
                对方援引的依据近期是否已有裁判提出质疑，以及你的论点在司法实践中
                <strong className='text-slate-200'>实际有多大说服力</strong>。
              </p>

              {/* 数据亮点 */}
              <div className='mb-8 grid grid-cols-3 gap-4'>
                {[
                  { num: '5 档', label: '裁判适用稳定性分级' },
                  { num: '4 类', label: '对方论点薄弱点自动识别' },
                  { num: '独立', label: '跨审级跨地域，优于单纯数量' },
                ].map(item => (
                  <div key={item.label} className='text-center'>
                    <div className='text-2xl font-bold text-white'>
                      {item.num}
                    </div>
                    <div className='mt-0.5 text-xs text-slate-500'>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className='flex flex-wrap gap-3'>
                <button
                  onClick={() => router.push('/login')}
                  className='flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 hover:shadow-blue-500/40'
                >
                  立即登录使用
                  <ArrowRight className='h-4 w-4' />
                </button>
                <button
                  onClick={() =>
                    document
                      .getElementById('features')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className='rounded-lg border border-white/15 px-6 py-3 text-sm font-medium text-white/70 backdrop-blur-sm transition-colors hover:border-white/30 hover:text-white'
                >
                  了解功能
                </button>
              </div>
            </div>

            {/* 右：产品 UI 预览卡片 */}
            <div className='relative hidden lg:block'>
              {/* 主卡片 */}
              <div className='rounded-2xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-md ring-1 ring-white/10'>
                {/* 假标题栏 */}
                <div className='mb-4 flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <div className='h-2 w-2 rounded-full bg-red-400/70' />
                    <div className='h-2 w-2 rounded-full bg-yellow-400/70' />
                    <div className='h-2 w-2 rounded-full bg-green-400/70' />
                  </div>
                  <span className='text-xs text-slate-500'>
                    AI 辩论生成 · 进行中
                  </span>
                </div>

                {/* 法条认识论状态 */}
                <div className='mb-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-4 py-2.5'>
                  <div className='mb-2 flex items-center gap-1.5'>
                    <Zap className='h-3 w-3 text-blue-400' />
                    <span className='text-xs font-medium text-blue-300'>
                      法条认识论状态分析
                    </span>
                  </div>
                  <div className='space-y-1.5'>
                    <div className='flex items-center justify-between'>
                      <span className='text-[11px] text-slate-300'>
                        《民法典》第680条
                      </span>
                      <span className='rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300'>
                        确定 89%
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-[11px] text-slate-300'>
                        《合同法》第54条
                      </span>
                      <span className='rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300'>
                        ⚠ 相变中 58%
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-[11px] text-slate-300'>
                        最高院司法解释第26条
                      </span>
                      <span className='rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-300'>
                        主流存疑 73%
                      </span>
                    </div>
                  </div>
                </div>

                {/* 原告论点（含置信度标注） */}
                <div className='mb-3 rounded-lg border border-white/10 bg-white/5 p-3.5'>
                  <div className='mb-2 flex items-center gap-2'>
                    <span className='rounded-full bg-blue-600/80 px-2 py-0.5 text-[10px] font-bold text-white'>
                      原告
                    </span>
                    <span className='text-[10px] text-slate-500'>
                      AI 生成中
                    </span>
                    <span className='h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400' />
                  </div>
                  <p className='text-xs leading-relaxed text-slate-300'>
                    <span className='text-emerald-400'>可以确定地说</span>，
                    依据《民法典》第680条（23个独立司法来源，共识89%），月利率3%
                    折合年化36%已超法定上限，该部分利息约定依法无效…
                  </p>
                  <div className='mt-2 rounded border border-amber-500/20 bg-amber-500/5 px-2 py-1 text-[10px] text-amber-400'>
                    ⚠ 对方可能援引第54条（相变中），此为潜在攻击路径
                  </div>
                </div>

                {/* 被告论点 */}
                <div className='rounded-lg border border-white/10 bg-white/5 p-3.5 opacity-60'>
                  <div className='mb-2 flex items-center gap-2'>
                    <span className='rounded-full bg-rose-600/80 px-2 py-0.5 text-[10px] font-bold text-white'>
                      被告
                    </span>
                    <span className='text-[10px] text-slate-500'>等待中…</span>
                  </div>
                  <div className='space-y-1.5'>
                    <div className='h-2 w-full rounded bg-white/10' />
                    <div className='h-2 w-4/5 rounded bg-white/10' />
                    <div className='h-2 w-3/5 rounded bg-white/10' />
                  </div>
                </div>

                {/* 进度条 */}
                <div className='mt-4'>
                  <div className='mb-1 flex justify-between text-[10px] text-slate-500'>
                    <span>生成进度</span>
                    <span>52%</span>
                  </div>
                  <div className='h-1 overflow-hidden rounded-full bg-white/10'>
                    <div className='h-full w-[52%] rounded-full bg-gradient-to-r from-blue-500 to-violet-500' />
                  </div>
                </div>
              </div>

              {/* 浮动小卡片：资质认证 */}
              <div className='absolute -left-6 bottom-12 rounded-xl border border-emerald-500/20 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur-md'>
                <div className='flex items-center gap-2'>
                  <BadgeCheck className='h-4 w-4 text-emerald-400' />
                  <span className='text-xs font-medium text-slate-200'>
                    律师资质已认证
                  </span>
                </div>
                <div className='mt-0.5 text-[10px] text-slate-500'>
                  执业证号 · 已验证
                </div>
              </div>

              {/* 浮动小卡片：合同风险 */}
              <div className='absolute -right-4 top-8 rounded-xl border border-amber-500/20 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur-md'>
                <div className='flex items-center gap-2'>
                  <Shield className='h-4 w-4 text-amber-400' />
                  <span className='text-xs font-medium text-slate-200'>
                    合同风险 · 2 项
                  </span>
                </div>
                <div className='mt-0.5 text-[10px] text-slate-500'>
                  已标记高风险条款
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 核心功能 ── */}
      <section id='features' className='bg-zinc-50 py-24 dark:bg-[#0a0f1e]'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='mb-14 text-center'>
            <div className='mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'>
              <Sparkles className='h-3 w-3 text-blue-500' />
              专业级 AI 工具
            </div>
            <h2 className='mb-3 text-3xl font-bold text-zinc-900 dark:text-zinc-50'>
              找到法条只是开始——法院怎么判，才是胜负关键
            </h2>
            <p className='mx-auto max-w-lg text-base text-zinc-500 dark:text-zinc-400'>
              每项 AI
              结论均附裁判支持来源与适用稳定性研判，方便评估论点说服力与对方依据的可攻击性
            </p>
          </div>

          <div className='grid grid-cols-1 gap-5 md:grid-cols-3'>
            {[
              {
                icon: Scale,
                title: '裁判支撑的辩论框架生成',
                tag: '核心功能',
                tagColor:
                  'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-400',
                desc: '依托多地独立裁判验证生成论点，每条论据均标注裁判稳定性。AI 表达"可以确定地说"还是"目前倾向于认为"，由实际案例数据决定，而非模型自行判断。',
                stat: '论据来源可追溯，强度可审计',
                statColor: 'text-violet-600 dark:text-violet-400',
                borderColor: 'border-violet-100 dark:border-violet-900/40',
                bgColor: 'bg-violet-50 dark:bg-violet-950/20',
                iconColor: 'text-violet-600',
                iconBg: 'bg-violet-100 dark:bg-violet-900/40',
              },
              {
                icon: Search,
                title: '法条司法适用口径检索',
                tag: '高频使用',
                tagColor:
                  'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400',
                desc: '113万+ 条文，每条附司法适用稳定性标注：各地一致 / 部分存疑 / 出现分歧 / 已有挑战趋势。不只找到法条，还知道这条法律在法院实践中有多稳固。',
                stat: '5 档适用稳定性分级',
                statColor: 'text-blue-600 dark:text-blue-400',
                borderColor: 'border-blue-100 dark:border-blue-900/40',
                bgColor: 'bg-blue-50 dark:bg-blue-950/20',
                iconColor: 'text-blue-600',
                iconBg: 'bg-blue-100 dark:bg-blue-900/40',
              },
              {
                icon: TrendingUp,
                title: '对方依据的裁判趋势预警',
                tag: '战略价值',
                tagColor:
                  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400',
                desc: '自动检测对方援引的法律依据是否正被各地判例质疑，识别已被最高法或高院裁判动摇的传统法律观点。精准找到可以有效攻击的论点弱点。',
                stat: '4 类论点薄弱点自动标记',
                statColor: 'text-emerald-600 dark:text-emerald-400',
                borderColor: 'border-emerald-100 dark:border-emerald-900/40',
                bgColor: 'bg-emerald-50 dark:bg-emerald-950/20',
                iconColor: 'text-emerald-600',
                iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
              },
            ].map(feat => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className={`group rounded-2xl border p-7 transition-all hover:-translate-y-1 hover:shadow-lg ${feat.borderColor} bg-white dark:bg-zinc-900`}
                >
                  <div className='mb-5 flex items-start justify-between'>
                    <div className={`rounded-xl p-2.5 ${feat.iconBg}`}>
                      <Icon className={`h-5 w-5 ${feat.iconColor}`} />
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${feat.tagColor}`}
                    >
                      {feat.tag}
                    </span>
                  </div>
                  <h3 className='mb-2.5 text-lg font-bold text-zinc-900 dark:text-zinc-50'>
                    {feat.title}
                  </h3>
                  <p className='mb-5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
                    {feat.desc}
                  </p>
                  <div className={`text-xs font-semibold ${feat.statColor}`}>
                    {feat.stat}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 元认知差异化说明 ── */}
      <section className='py-24'>
        <div className='mx-auto max-w-4xl px-6'>
          <div className='mb-10 text-center'>
            <h2 className='mb-3 text-3xl font-bold text-zinc-900 dark:text-zinc-50'>
              找到法条不难——难的是知道这个解释有多少裁判支撑
            </h2>
            <p className='text-base text-zinc-500 dark:text-zinc-400'>
              AI
              给结论容易；告诉你这个结论在司法实践中站不站得住脚，才是专业价值所在
            </p>
          </div>
          <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
            <div className='rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50'>
              <div className='mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400'>
                普通法律 AI
              </div>
              <p className='mb-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400'>
                《民法典》第680条适用。月利率3%超过法定上限，利息约定无效。
              </p>
              <div className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400'>
                没有告诉你：各地法院口径是否一致？对方有没有可以援引的反例？
              </div>
            </div>
            <div className='rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/40 dark:bg-blue-950/20'>
              <div className='mb-3 text-xs font-semibold uppercase tracking-widest text-blue-400'>
                律伴 AI
              </div>
              <p className='mb-3 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300'>
                <span className='font-semibold text-emerald-600 dark:text-emerald-400'>
                  可以确定地说
                </span>
                ，《民法典》第680条适用口径稳定——5省23份独立裁判支持，审级跨越中院至高院。
                <span className='text-amber-600 dark:text-amber-400'>
                  注意：对方可能援引的第54条，近期已有多份裁判对传统解释提出质疑，可作为反驳切入点。
                </span>
              </p>
              <div className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-600 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400'>
                裁判来源清晰可查，结论强度由案例数据支撑，论点弱点实时提示
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 双受众 ── */}
      <section className='py-24'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='mb-14 text-center'>
            <h2 className='mb-3 text-3xl font-bold text-zinc-900 dark:text-zinc-50'>
              专为两类专业人士设计
            </h2>
            <p className='text-base text-zinc-500 dark:text-zinc-400'>
              仅开放给有资质的法律从业者，保障服务的专业性与合规性
            </p>
          </div>

          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            <div className='relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 dark:border-blue-900/40'>
              <div className='pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10' />
              <div className='pointer-events-none absolute -bottom-4 right-12 h-24 w-24 rounded-full bg-white/5' />
              <div className='relative'>
                <div className='mb-5 flex items-center gap-3'>
                  <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm'>
                    <Briefcase className='h-5 w-5 text-white' />
                  </div>
                  <div>
                    <div className='text-lg font-bold text-white'>执业律师</div>
                    <div className='text-xs text-blue-200'>
                      持律师执业证方可申请
                    </div>
                  </div>
                </div>
                <ul className='space-y-2.5'>
                  {LAWYER_FEATURES.map(f => (
                    <li key={f} className='flex items-center gap-2.5'>
                      <CheckCircle2 className='h-4 w-4 flex-shrink-0 text-blue-200' />
                      <span className='text-sm text-blue-50'>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className='relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-600 to-teal-700 p-8 dark:border-emerald-900/40'>
              <div className='pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10' />
              <div className='pointer-events-none absolute -bottom-4 right-12 h-24 w-24 rounded-full bg-white/5' />
              <div className='relative'>
                <div className='mb-5 flex items-center gap-3'>
                  <div className='flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm'>
                    <Building2 className='h-5 w-5 text-white' />
                  </div>
                  <div>
                    <div className='text-lg font-bold text-white'>企业法务</div>
                    <div className='text-xs text-emerald-200'>
                      需提交企业法务证明材料
                    </div>
                  </div>
                </div>
                <ul className='space-y-2.5'>
                  {ENTERPRISE_FEATURES.map(f => (
                    <li key={f} className='flex items-center gap-2.5'>
                      <CheckCircle2 className='h-4 w-4 flex-shrink-0 text-emerald-200' />
                      <span className='text-sm text-emerald-50'>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className='relative overflow-hidden bg-[#0d1b3e] py-24'>
        <div className='pointer-events-none absolute inset-0'>
          <div className='absolute left-1/4 top-0 h-64 w-64 rounded-full bg-blue-600/20 blur-3xl' />
          <div className='absolute right-1/4 bottom-0 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl' />
        </div>
        <div className='relative mx-auto max-w-2xl px-6 text-center'>
          <div className='mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3.5 py-1.5 text-xs font-medium text-blue-300'>
            <BadgeCheck className='h-3.5 w-3.5' />
            需通过资质审核后方可使用
          </div>
          <h2 className='mb-4 text-3xl font-bold text-white'>
            准备好使用知道自己边界的 AI 了吗？
          </h2>
          <p className='mb-8 text-base text-slate-400'>
            联系管理员完成资质认证，审核通过后即可登录——
            每个法律结论都有认识论状态，每次引用都有证据可溯
          </p>
          <button
            onClick={() => router.push('/login')}
            className='inline-flex items-center gap-2 rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-blue-700 shadow-xl transition-all hover:bg-blue-50 hover:shadow-blue-500/20'
          >
            登录工作台
            <ArrowRight className='h-4 w-4' />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className='border-t border-zinc-100 bg-white py-8 dark:border-zinc-800/60 dark:bg-zinc-950'>
        <div className='mx-auto max-w-7xl px-6'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <div className='flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-blue-600 to-violet-600'>
                <Scale className='h-3 w-3 text-white' />
              </div>
              <span className='text-sm font-medium text-zinc-500 dark:text-zinc-400'>
                律伴<span className='text-blue-600'>AI</span>助手
              </span>
            </div>
            <p className='text-xs text-zinc-400 dark:text-zinc-600'>
              © {new Date().getFullYear()} 律伴 · 仅向认证法律从业者提供服务
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 普通用户：资质受限提示页
// ─────────────────────────────────────────────────────────────────────────────

function RestrictedPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const displayName = user?.name || user?.username || user?.email || '用户';

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-zinc-950'>
      {/* 顶部导航 */}
      <header className='border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-4'>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600'>
              <Scale className='h-4 w-4 text-white' />
            </div>
            <span className='text-base font-semibold text-zinc-900 dark:text-zinc-50'>
              律伴AI助手
            </span>
          </div>
          <div className='flex items-center gap-3'>
            <span className='hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block'>
              {displayName}
            </span>
            <button
              onClick={() => void logout()}
              className='rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* 提示区 */}
      <main className='flex min-h-[calc(100vh-65px)] items-center justify-center px-6'>
        <div className='w-full max-w-lg text-center'>
          {/* 图标 */}
          <div className='mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30'>
            <Shield className='h-10 w-10 text-amber-500' />
          </div>

          <h1 className='mb-3 text-2xl font-bold text-zinc-900 dark:text-zinc-50'>
            账号权限不足
          </h1>
          <p className='mb-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400'>
            根据法律行业相关规定，本平台仅向
            <span className='font-medium text-zinc-700 dark:text-zinc-300'>
              认证律师
            </span>
            及
            <span className='font-medium text-zinc-700 dark:text-zinc-300'>
              企业法务人员
            </span>
            提供服务。
          </p>
          <p className='mb-8 text-sm text-zinc-400 dark:text-zinc-500'>
            您当前的账号（{displayName}）尚未通过资质认证，无法使用工作台功能。
          </p>

          {/* 两种入驻方式 */}
          <div className='mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <div className='rounded-xl border border-blue-200 bg-blue-50 p-5 text-left dark:border-blue-900/40 dark:bg-blue-950/20'>
              <div className='mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600'>
                <Briefcase className='h-4 w-4 text-white' />
              </div>
              <h3 className='mb-1 text-sm font-semibold text-blue-900 dark:text-blue-200'>
                我是执业律师
              </h3>
              <p className='text-xs text-blue-700 dark:text-blue-400'>
                持有律师执业证，可申请律师认证，使用 AI
                辩论、法条检索、案件管理等全套功能。
              </p>
            </div>
            <div className='rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-left dark:border-emerald-900/40 dark:bg-emerald-950/20'>
              <div className='mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600'>
                <Building2 className='h-4 w-4 text-white' />
              </div>
              <h3 className='mb-1 text-sm font-semibold text-emerald-900 dark:text-emerald-200'>
                我是企业法务
              </h3>
              <p className='text-xs text-emerald-700 dark:text-emerald-400'>
                企业内部法务部门人员，可申请企业法务认证，使用合规检查、合同审查等功能。
              </p>
            </div>
          </div>

          <p className='text-xs text-zinc-400 dark:text-zinc-500'>
            请联系管理员完成资质审核，审核通过后即可登录使用。
          </p>

          <div className='mt-6 flex justify-center gap-3'>
            <button
              onClick={() => router.push('/login')}
              className='rounded-lg border border-zinc-200 px-5 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
            >
              切换账号
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 内部工作台（律师 / 企业法务）
// ─────────────────────────────────────────────────────────────────────────────

// 角色专属配置
const ROLE_CONFIG = {
  LAWYER: {
    badge: '执业律师',
    badgeColor: 'bg-blue-600',
    heroGrad: 'from-blue-600 via-indigo-600 to-violet-600',
    heroBg: 'from-blue-950 via-indigo-950 to-violet-950',
    glowA: 'bg-blue-600/20',
    glowB: 'bg-violet-600/15',
    quickActions: [
      {
        label: '新建案件',
        href: '/cases/create',
        icon: FilePlus,
        bg: 'bg-blue-500/20',
        color: 'text-blue-300',
      },
      {
        label: '发起辩论',
        href: '/debates',
        icon: Scale,
        bg: 'bg-violet-500/20',
        color: 'text-violet-300',
      },
      {
        label: '合同模板',
        href: '/contracts',
        icon: ScrollText,
        bg: 'bg-rose-500/20',
        color: 'text-rose-300',
      },
      {
        label: '法条检索',
        href: '/law-articles',
        icon: Search,
        bg: 'bg-emerald-500/20',
        color: 'text-emerald-300',
      },
    ],
    tagline: '高效处理法律事务，AI 助力庭审准备',
  },
  ENTERPRISE: {
    badge: '企业法务',
    badgeColor: 'bg-emerald-600',
    heroGrad: 'from-emerald-600 via-teal-600 to-cyan-600',
    heroBg: 'from-emerald-950 via-teal-950 to-cyan-950',
    glowA: 'bg-emerald-600/20',
    glowB: 'bg-teal-600/15',
    quickActions: [
      {
        label: '合同审查',
        href: '/contracts/review',
        icon: BookOpen,
        bg: 'bg-rose-500/20',
        color: 'text-rose-300',
      },
      {
        label: '合同模板',
        href: '/contracts',
        icon: ScrollText,
        bg: 'bg-teal-500/20',
        color: 'text-teal-300',
      },
      {
        label: '合规检查',
        href: '/compliance',
        icon: Shield,
        bg: 'bg-emerald-500/20',
        color: 'text-emerald-300',
      },
      {
        label: '案件管理',
        href: '/cases',
        icon: FileText,
        bg: 'bg-blue-500/20',
        color: 'text-blue-300',
      },
    ],
    tagline: '全面管控企业法律风险，合规经营有保障',
  },
  ADMIN: {
    badge: '系统管理员',
    badgeColor: 'bg-orange-600',
    heroGrad: 'from-orange-600 via-amber-600 to-yellow-600',
    heroBg: 'from-orange-950 via-amber-950 to-yellow-950',
    glowA: 'bg-orange-600/20',
    glowB: 'bg-amber-600/15',
    quickActions: [
      {
        label: '用户管理',
        href: '/admin/users',
        icon: Building2,
        bg: 'bg-blue-500/20',
        color: 'text-blue-300',
      },
      {
        label: '系统日志',
        href: '/admin/logs',
        icon: BarChart2,
        bg: 'bg-orange-500/20',
        color: 'text-orange-300',
      },
      {
        label: '数据统计',
        href: '/dashboard',
        icon: TrendingUp,
        bg: 'bg-violet-500/20',
        color: 'text-violet-300',
      },
      {
        label: '新建案件',
        href: '/cases/create',
        icon: FilePlus,
        bg: 'bg-emerald-500/20',
        color: 'text-emerald-300',
      },
    ],
    tagline: '全面掌控系统运营，高效管理平台资源',
  },
  SUPER_ADMIN: {
    badge: '超级管理员',
    badgeColor: 'bg-red-600',
    heroGrad: 'from-red-600 via-rose-600 to-pink-600',
    heroBg: 'from-red-950 via-rose-950 to-pink-950',
    glowA: 'bg-red-600/20',
    glowB: 'bg-rose-600/15',
    quickActions: [
      {
        label: '用户管理',
        href: '/admin/users',
        icon: Building2,
        bg: 'bg-blue-500/20',
        color: 'text-blue-300',
      },
      {
        label: '系统日志',
        href: '/admin/logs',
        icon: BarChart2,
        bg: 'bg-red-500/20',
        color: 'text-red-300',
      },
      {
        label: '数据统计',
        href: '/dashboard',
        icon: TrendingUp,
        bg: 'bg-violet-500/20',
        color: 'text-violet-300',
      },
      {
        label: '新建案件',
        href: '/cases/create',
        icon: FilePlus,
        bg: 'bg-emerald-500/20',
        color: 'text-emerald-300',
      },
    ],
    tagline: '全面掌控系统运营，高效管理平台资源',
  },
} as const;

function WorkspacePage() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const userRole = (user?.role ?? 'LAWYER') as UserRole;
  const displayName = user?.name || user?.username || user?.email || '用户';

  const roleKey = (
    userRole in ROLE_CONFIG ? userRole : 'LAWYER'
  ) as keyof typeof ROLE_CONFIG;
  const rc = ROLE_CONFIG[roleKey];

  useEffect(() => {
    fetch('/api/v1/system/overview')
      .then(r => (r.ok ? r.json() : null))
      .then(data => data && setOverview(data))
      .catch(() => {});
    fetch('/api/v1/system/recent-activity')
      .then(r => (r.ok ? r.json() : null))
      .then(data => data && setActivity(data))
      .catch(() => {});
    // 获取用户个人统计（案件数、待办任务、今日日程）
    fetch('/api/dashboard')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.success && data.data?.stats) {
          const stats = data.data.stats as Array<{ id: string; value: number }>;
          const get = (id: string) => stats.find(s => s.id === id)?.value ?? 0;
          setUserStats({
            totalCases: get('total-cases'),
            pendingTasks: get('pending-tasks'),
            todaySchedules: get('today-schedule'),
          });
        }
      })
      .catch(() => {});
  }, []);

  const recentDebates = activity?.recentDebates ?? [];

  // 可见模块
  const visibleModules = NAV_MODULES.filter(mod => {
    if (mod.href === '/dashboard') return isAdmin;
    if (isAdmin) return true;
    if (!mod.roles) return true;
    return mod.roles.includes(userRole);
  });

  return (
    <div className='min-h-screen bg-zinc-50'>
      {/* ── 顶部导航 ── */}
      <header className='sticky top-0 z-20 border-b border-white/10 bg-white/80 backdrop-blur-xl'>
        <div className='mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5'>
          <div className='flex items-center gap-2.5'>
            <div className='flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 shadow shadow-blue-500/30'>
              <Scale className='h-4 w-4 text-white' />
            </div>
            <span className='text-base font-bold tracking-tight text-zinc-900'>
              律伴<span className='text-blue-600'>AI</span>助手
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <span className='hidden text-sm text-zinc-500 sm:block'>
              {displayName}
            </span>
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className='flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50'
              >
                <Settings className='h-3.5 w-3.5' />
                管理后台
              </button>
            )}
            <button
              onClick={async () => {
                await logout();
                router.push('/login');
              }}
              className='rounded-md border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600'
            >
              退出登录
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero 横幅 ── */}
      <section
        className={`relative overflow-hidden bg-gradient-to-br ${rc.heroBg}`}
      >
        {/* 背景光晕 */}
        <div className='pointer-events-none absolute inset-0'>
          <div
            className={`absolute left-1/4 top-0 h-72 w-72 -translate-x-1/2 rounded-full ${rc.glowA} blur-[80px]`}
          />
          <div
            className={`absolute right-0 bottom-0 h-56 w-56 rounded-full ${rc.glowB} blur-[60px]`}
          />
          <div
            className='absolute inset-0 opacity-[0.04]'
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        <div className='relative mx-auto max-w-7xl px-6 py-10'>
          <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
            {/* 左：欢迎语 */}
            <div>
              <div className='mb-3 flex items-center gap-2'>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full ${rc.badgeColor} px-3 py-1 text-xs font-semibold text-white`}
                >
                  <Zap className='h-3 w-3' />
                  {rc.badge}
                </span>
                <span className='text-xs text-white/50'>
                  {new Date().toLocaleDateString('zh-CN', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </span>
              </div>
              <h1 className='text-3xl font-extrabold tracking-tight text-white'>
                你好，
                <span
                  className={`bg-gradient-to-r ${rc.heroGrad} bg-clip-text text-transparent`}
                >
                  {displayName}
                </span>
              </h1>
              <p className='mt-2 text-sm text-white/60'>{rc.tagline}</p>
            </div>

            {/* 右：数据统计（平台 + 个人） */}
            <div className='flex flex-col gap-3'>
              {/* 平台数据 */}
              <div className='grid grid-cols-3 gap-2'>
                {[
                  {
                    icon: FileText,
                    label: '法律条文',
                    value: overview
                      ? (overview.totalLawArticles / 10000).toFixed(0) + '万+'
                      : '—',
                    color: 'text-blue-300',
                  },
                  {
                    icon: Network,
                    label: '法律关系',
                    value: overview
                      ? overview.totalRelations.toLocaleString()
                      : '—',
                    color: 'text-violet-300',
                  },
                  {
                    icon: ScrollText,
                    label: '合同模板',
                    value: '460+',
                    color: 'text-rose-300',
                  },
                ].map(s => (
                  <div
                    key={s.label}
                    className='rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-center backdrop-blur-sm'
                  >
                    <s.icon className={`mx-auto mb-1 h-3.5 w-3.5 ${s.color}`} />
                    <div className={`text-lg font-bold ${s.color}`}>
                      {s.value}
                    </div>
                    <div className='text-xs text-white/40'>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* 用户个人数据 */}
              <div className='grid grid-cols-3 gap-2'>
                {[
                  {
                    icon: FolderOpen,
                    label: '我的案件',
                    value: userStats ? String(userStats.totalCases) : '—',
                    color: 'text-amber-300',
                    href: '/cases',
                  },
                  {
                    icon: ClipboardCheck,
                    label: '待办任务',
                    value: userStats ? String(userStats.pendingTasks) : '—',
                    color: 'text-emerald-300',
                    href: '/tasks',
                  },
                  {
                    icon: Clock,
                    label: '今日日程',
                    value: userStats ? String(userStats.todaySchedules) : '—',
                    color: 'text-cyan-300',
                    href: '/court-schedule',
                  },
                ].map(s => (
                  <button
                    key={s.label}
                    onClick={() => router.push(s.href)}
                    className='rounded-xl border border-white/15 bg-white/8 px-3 py-2.5 text-center backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/15'
                  >
                    <s.icon className={`mx-auto mb-1 h-3.5 w-3.5 ${s.color}`} />
                    <div className={`text-lg font-bold ${s.color}`}>
                      {s.value}
                    </div>
                    <div className='text-xs text-white/40'>{s.label}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 快速操作按钮行 */}
          <div className='mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4'>
            {rc.quickActions.map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.href}
                  onClick={() => router.push(action.href)}
                  className='group flex items-center gap-3 rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-left backdrop-blur-sm transition-all hover:border-white/25 hover:bg-white/15'
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${action.bg}`}
                  >
                    <Icon className={`h-4 w-4 ${action.color}`} />
                  </div>
                  <span className='text-sm font-medium text-white/90 group-hover:text-white'>
                    {action.label}
                  </span>
                  <ArrowRight className='ml-auto h-3.5 w-3.5 flex-shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60' />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── 主内容区 ── */}
      <main className='mx-auto max-w-7xl px-6 py-8'>
        <div className='grid grid-cols-1 gap-6 lg:grid-cols-3'>
          {/* 功能模块（占 2/3） */}
          <div className='lg:col-span-2'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-sm font-semibold text-zinc-500'>全部功能</h2>
              <span className='text-xs text-zinc-400'>
                {visibleModules.length} 个模块
              </span>
            </div>
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
              {visibleModules.map(mod => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.href}
                    onClick={() => router.push(mod.href)}
                    className='group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all hover:border-zinc-300 hover:shadow-md'
                  >
                    <div
                      className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${mod.color} transition-transform group-hover:scale-105`}
                    >
                      <Icon className='h-5 w-5' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center justify-between'>
                        <span className='text-sm font-semibold text-zinc-900'>
                          {mod.label}
                        </span>
                        <ChevronRight className='h-4 w-4 flex-shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-500' />
                      </div>
                      <p className='mt-0.5 truncate text-xs text-zinc-500'>
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
            {/* 最近案件 */}
            {(() => {
              const recentCases = activity?.recentCases ?? [];
              const CASE_STATUS_LABEL: Record<string, string> = {
                OPEN: '进行中',
                PENDING: '待处理',
                CLOSED: '已结案',
                ARCHIVED: '已归档',
                ACTIVE: '活跃',
              };
              const CASE_STATUS_COLOR: Record<string, string> = {
                OPEN: 'bg-blue-100 text-blue-700',
                ACTIVE: 'bg-blue-100 text-blue-700',
                PENDING: 'bg-amber-100 text-amber-700',
                CLOSED: 'bg-zinc-100 text-zinc-500',
                ARCHIVED: 'bg-zinc-100 text-zinc-400',
              };
              return (
                <div className='rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm'>
                  <div className='mb-3 flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      <FolderOpen className='h-3.5 w-3.5 text-zinc-400' />
                      <h2 className='text-sm font-semibold text-zinc-700'>
                        最近案件
                      </h2>
                      {userStats && userStats.totalCases > 0 && (
                        <span className='rounded-full bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-600'>
                          共 {userStats.totalCases}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => router.push('/cases')}
                      className='text-xs text-blue-600 hover:underline'
                    >
                      全部
                    </button>
                  </div>
                  {recentCases.length > 0 ? (
                    <div className='space-y-1'>
                      {recentCases.slice(0, 4).map(c => (
                        <button
                          key={c.id}
                          onClick={() => router.push(`/cases/${c.id}`)}
                          className='flex w-full items-start justify-between gap-2 rounded-xl p-2.5 text-left transition-colors hover:bg-zinc-50'
                        >
                          <div className='min-w-0'>
                            <div className='truncate text-xs font-medium text-zinc-800'>
                              {c.title}
                            </div>
                            <div className='mt-0.5 text-xs text-zinc-400'>
                              {formatRelativeTime(c.updatedAt)}
                            </div>
                          </div>
                          <span
                            className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CASE_STATUS_COLOR[c.status] ?? 'bg-zinc-100 text-zinc-600'}`}
                          >
                            {CASE_STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className='py-5 text-center'>
                      <p className='text-xs text-zinc-400'>暂无案件记录</p>
                      <button
                        onClick={() => router.push('/cases/create')}
                        className='mt-2 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700'
                      >
                        新建案件
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 平台能力亮点 */}
            <div className='overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm'>
              <div className={`bg-gradient-to-r ${rc.heroGrad} px-5 py-4`}>
                <div className='flex items-center gap-2'>
                  <Sparkles className='h-4 w-4 text-white/80' />
                  <span className='text-sm font-semibold text-white'>
                    平台能力
                  </span>
                </div>
              </div>
              <div className='divide-y divide-zinc-100 px-1'>
                {[
                  {
                    icon: CheckCircle2,
                    text: 'AI 驱动辩论论点生成',
                    color: 'text-blue-500',
                  },
                  {
                    icon: CheckCircle2,
                    text: '113万+ 法律条文检索',
                    color: 'text-violet-500',
                  },
                  {
                    icon: CheckCircle2,
                    text: '460 份标准合同模板',
                    color: 'text-rose-500',
                  },
                  {
                    icon: CheckCircle2,
                    text: '智能合同风险识别',
                    color: 'text-amber-500',
                  },
                  {
                    icon: CheckCircle2,
                    text: '法律知识图谱可视化',
                    color: 'text-emerald-500',
                  },
                ].map(item => (
                  <div
                    key={item.text}
                    className='flex items-center gap-3 px-4 py-3'
                  >
                    <item.icon
                      className={`h-4 w-4 flex-shrink-0 ${item.color}`}
                    />
                    <span className='text-xs text-zinc-600'>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 最近辩论 */}
            <div className='flex-1 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm'>
              <div className='mb-3 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Clock className='h-3.5 w-3.5 text-zinc-400' />
                  <h2 className='text-sm font-semibold text-zinc-700'>
                    最近辩论
                  </h2>
                </div>
                <button
                  onClick={() => router.push('/debates')}
                  className='text-xs text-blue-600 hover:underline'
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
                      className='flex w-full items-start justify-between gap-2 rounded-xl p-2.5 text-left transition-colors hover:bg-zinc-50'
                    >
                      <div className='min-w-0'>
                        <div className='truncate text-xs font-medium text-zinc-800'>
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
                <div className='py-8 text-center'>
                  <div className='mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100'>
                    <Scale className='h-6 w-6 text-zinc-300' />
                  </div>
                  <p className='text-xs text-zinc-400'>暂无辩论记录</p>
                  <button
                    onClick={() => router.push('/debates')}
                    className='mt-3 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700'
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

  // 普通用户（未通过资质认证）：展示受限提示页
  if (user.role === 'USER') {
    return <RestrictedPage />;
  }

  // 认证律师 / 企业法务：业务工作台
  return <WorkspacePage />;
}
