'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  ScaleIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  BrainCircuitIcon,
  ArrowRightIcon,
  FileTextIcon,
  NetworkIcon,
} from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/chat');
    }
  }, [user, loading, router]);

  // 已登录时显示跳转动画
  if (!loading && user) {
    return (
      <div className='flex h-screen items-center justify-center bg-slate-950'>
        <div className='text-center'>
          <div className='inline-flex w-12 h-12 rounded-xl bg-white/10 items-center justify-center mb-4'>
            <span className='text-white text-xl font-bold'>律</span>
          </div>
          <div className='flex items-center gap-1.5 justify-center'>
            <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]' />
            <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]' />
            <span className='w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce' />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-slate-950 text-white'>
      {/* 顶部导航 */}
      <header className='fixed top-0 left-0 right-0 z-50 border-b border-white/8 bg-slate-950/80 backdrop-blur-md'>
        <div className='max-w-6xl mx-auto px-6 h-14 flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center'>
              <span className='text-white text-sm font-bold'>律</span>
            </div>
            <span className='text-sm font-semibold text-white'>律伴</span>
          </div>
          <div className='flex items-center gap-3'>
            <Link
              href='/login'
              className='text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5'
            >
              登录
            </Link>
            <Link
              href='/register'
              className='text-sm font-medium bg-white text-slate-900 hover:bg-slate-100 transition-colors px-4 py-1.5 rounded-lg'
            >
              免费注册
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className='pt-32 pb-20 px-6 text-center'>
        <div className='max-w-3xl mx-auto'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-slate-400 mb-8'>
            <span className='w-1.5 h-1.5 rounded-full bg-emerald-400' />
            为律师与法务团队打造的 AI 助理
          </div>
          <h1 className='text-4xl sm:text-5xl font-bold tracking-tight text-white mb-6 leading-tight'>
            让每一个法律问题
            <br />
            <span className='text-transparent bg-clip-text bg-gradient-to-r from-slate-300 to-slate-500'>
              都有清晰的答案
            </span>
          </h1>
          <p className='text-lg text-slate-400 mb-10 leading-relaxed max-w-xl mx-auto'>
            律伴结合最高法指导案例与171万条裁判文书，为律师提供辩论推演、案情分析、法条检索等专业工具，帮助法务团队实现合同管理与合规监控。
          </p>
          <div className='flex flex-col sm:flex-row items-center justify-center gap-3'>
            <Link
              href='/register'
              className='flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-medium px-6 py-3 rounded-xl transition-colors text-sm'
            >
              免费开始使用
              <ArrowRightIcon className='w-4 h-4' />
            </Link>
            <Link
              href='/login'
              className='flex items-center gap-2 border border-white/15 hover:border-white/30 text-slate-300 hover:text-white px-6 py-3 rounded-xl transition-colors text-sm'
            >
              已有账号，去登录
            </Link>
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section className='py-16 px-6'>
        <div className='max-w-5xl mx-auto'>
          <h2 className='text-center text-2xl font-semibold text-white mb-3'>
            专为法律工作者设计
          </h2>
          <p className='text-center text-slate-500 text-sm mb-12'>
            律师与法务各有专属功能，清晰分工
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {FEATURES.map(f => (
              <div
                key={f.title}
                className='border border-white/8 bg-white/3 rounded-2xl p-5 hover:bg-white/6 transition-colors'
              >
                <div className='w-9 h-9 rounded-xl bg-white/8 flex items-center justify-center mb-4'>
                  <f.icon className='w-4.5 h-4.5 text-slate-300' />
                </div>
                <h3 className='text-sm font-semibold text-white mb-1.5'>
                  {f.title}
                </h3>
                <p className='text-xs text-slate-500 leading-relaxed'>
                  {f.desc}
                </p>
                {f.tag && (
                  <span className='mt-3 inline-block text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-slate-400'>
                    {f.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 数据亮点 */}
      <section className='py-16 px-6 border-t border-white/6'>
        <div className='max-w-3xl mx-auto'>
          <div className='grid grid-cols-3 gap-6 text-center'>
            {STATS.map(s => (
              <div key={s.label}>
                <div className='text-3xl font-bold text-white mb-1'>
                  {s.value}
                </div>
                <div className='text-xs text-slate-500'>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className='py-20 px-6 text-center border-t border-white/6'>
        <div className='max-w-xl mx-auto'>
          <h2 className='text-2xl font-semibold text-white mb-4'>
            立即开始，免费体验
          </h2>
          <p className='text-slate-500 text-sm mb-8'>
            注册即可使用全部功能，无需信用卡
          </p>
          <Link
            href='/register'
            className='inline-flex items-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-medium px-8 py-3 rounded-xl transition-colors text-sm'
          >
            免费注册
            <ArrowRightIcon className='w-4 h-4' />
          </Link>
        </div>
      </section>

      {/* 底部 */}
      <footer className='border-t border-white/6 py-8 px-6 text-center'>
        <p className='text-xs text-slate-600'>
          © {new Date().getFullYear()} 律伴 · 专业法律 AI 助理
        </p>
      </footer>
    </div>
  );
}

const FEATURES = [
  {
    icon: MessageSquareIcon,
    title: 'AI 对话工作台',
    desc: '基于案情的智能问答，自动提炼案情晶体，每轮对话都有上下文记忆。',
    tag: '律师 · 法务',
  },
  {
    icon: ScaleIcon,
    title: '辩论推演',
    desc: '模拟对抗辩论，AI 分别扮演原告/被告，推演各方论点与反驳策略。',
    tag: '律师专属',
  },
  {
    icon: BrainCircuitIcon,
    title: 'AI 案件评估',
    desc: '基于案情晶体自动生成胜诉率、难度评级、风险提示，辅助决策。',
    tag: '律师专属',
  },
  {
    icon: NetworkIcon,
    title: '知识图谱',
    desc: '法条关联网络，发现相关法条、上下位法、引用关系，一键检索。',
    tag: '律师 · 法务',
  },
  {
    icon: FileTextIcon,
    title: '合同管理',
    desc: '合同全生命周期管理，AI 审查风险条款，关键节点自动提醒。',
    tag: '法务专属',
  },
  {
    icon: ShieldCheckIcon,
    title: 'PII 自动脱敏',
    desc: '发送给 AI 前自动识别并替换身份证号、手机号、银行卡等敏感信息。',
    tag: '全角色',
  },
];

const STATS = [
  { value: '171万+', label: '裁判文书' },
  { value: '267条', label: '最高法指导案例' },
  { value: '70万+', label: '法条知识图谱' },
];
