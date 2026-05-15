'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  MessageSquareIcon,
  ScaleIcon,
  ClipboardCheckIcon,
  NetworkIcon,
  FileTextIcon,
  ShieldCheckIcon,
} from 'lucide-react';

type TagType = 'lawyer' | 'firm' | 'all';

const TAG_STYLES: Record<TagType, string> = {
  lawyer: 'bg-blue-50 text-blue-700',
  firm: 'bg-green-50 text-green-700',
  all: 'bg-purple-50 text-purple-700',
};

const FEATURES: {
  icon: React.ElementType;
  title: string;
  desc: string;
  tags: { label: string; type: TagType }[];
  isNew: boolean;
}[] = [
  {
    icon: MessageSquareIcon,
    title: 'AI 对话工作台',
    desc: '智能问答，自动搜索精品体，每轮对话都有上下文记忆。',
    tags: [
      { label: '律师', type: 'lawyer' },
      { label: '法务', type: 'firm' },
    ],
    isNew: false,
  },
  {
    icon: ScaleIcon,
    title: '辩论推演',
    desc: '模拟对抗辩论，AI 分析控辩各方论点与反驳策略。',
    tags: [{ label: '律师专属', type: 'lawyer' }],
    isNew: false,
  },
  {
    icon: ClipboardCheckIcon,
    title: 'AI 案件评估',
    desc: '自动生成成诉成本率，推度评级与风险提示辅助决策。',
    tags: [{ label: '律师专属', type: 'lawyer' }],
    isNew: true,
  },
  {
    icon: NetworkIcon,
    title: '知识图谱',
    desc: '法条关联网络，发现相关法条，上下位法、引用关系一键检索。',
    tags: [
      { label: '律师', type: 'lawyer' },
      { label: '法务', type: 'firm' },
    ],
    isNew: false,
  },
  {
    icon: FileTextIcon,
    title: '合同管理',
    desc: '合同全生命周期管理，AI 审查风险条款，关键节点自动提醒。',
    tags: [{ label: '法务专属', type: 'firm' }],
    isNew: false,
  },
  {
    icon: ShieldCheckIcon,
    title: 'PII 自动脱敏',
    desc: '发送 AI 前自动识别并替换身份证号、手机号、银行卡等敏感信息。',
    tags: [{ label: '全角色', type: 'all' }],
    isNew: false,
  },
];

const STATS = [
  { main: '171万', unit: '+', label: '裁判文书' },
  { main: '267', unit: '条', label: '最高法指导案例' },
  { main: '70万', unit: '+', label: '法条知识图谱' },
];

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/chat');
    }
  }, [user, loading, router]);

  if (!loading && user) {
    return (
      <div className='flex h-screen items-center justify-center bg-white'>
        <div className='text-center'>
          <div className='inline-flex w-12 h-12 rounded-xl bg-slate-100 items-center justify-center mb-4'>
            <span className='text-slate-800 text-xl font-bold'>律</span>
          </div>
          <div className='flex items-center gap-1.5 justify-center'>
            <span className='w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]' />
            <span className='w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]' />
            <span className='w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce' />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-white text-[#0f1923]'>
      {/* ── 导航 ── */}
      <header className='fixed top-0 left-0 right-0 z-50 h-14 border-b border-gray-200 bg-white flex items-center'>
        <div className='max-w-6xl mx-auto px-6 w-full flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <div className='w-[26px] h-[26px] rounded-[6px] bg-[#0f1923] flex items-center justify-center flex-shrink-0'>
              <span className='text-white text-[12px] font-bold'>律</span>
            </div>
            <span className='text-[15px] font-semibold text-[#0f1923] tracking-[0.02em]'>
              律伴
            </span>
          </div>
          <div className='flex items-center gap-2'>
            <Link
              href='/login'
              className='text-[13px] text-gray-600 hover:text-[#0f1923] transition-colors px-3.5 py-1.5 rounded-md'
            >
              登录
            </Link>
            <Link
              href='/register'
              className='text-[13px] font-medium text-white bg-[#0f1923] hover:bg-gray-800 transition-colors px-4 py-[7px] rounded-md'
            >
              免费注册
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className='pt-14 bg-white'>
        <div className='max-w-6xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-2 gap-12 items-center'>
          {/* 左栏 */}
          <div>
            <div className='flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-gray-400 uppercase mb-4'>
              <span className='inline-block w-5 h-px bg-gray-300 flex-shrink-0' />
              专业法律 AI 助手
            </div>
            <h1 className='font-serif text-[32px] md:text-[38px] font-bold leading-[1.25] text-[#0f1923] tracking-tight mb-4'>
              让每一个
              <br />
              法律问题
              <br />
              都有
              <em className='not-italic text-blue-700'>清晰的答案</em>
            </h1>
            <p className='text-[14px] text-gray-500 leading-[1.75] mb-7 font-light'>
              结合最高法指导案例与 171
              万条裁判文书，为律师提供辩论推演、案情分析、法条检索等专业工具。
            </p>
            <div className='flex items-center gap-4'>
              <Link
                href='/register'
                className='inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-[#0f1923] hover:bg-gray-800 transition-colors px-[22px] py-2.5 rounded-md'
              >
                免费开始使用 →
              </Link>
              <Link
                href='/login'
                className='text-[13px] text-gray-600 underline underline-offset-[3px] hover:text-[#0f1923] transition-colors'
              >
                已有账号，去登录
              </Link>
            </div>
          </div>

          {/* 右栏：AI 对话预览 */}
          <div className='bg-[#f8f9fb] border border-gray-200 rounded-[10px] p-5'>
            <div className='text-[11px] text-gray-400 font-medium tracking-[0.06em] uppercase mb-4'>
              AI 对话工作台
            </div>
            {/* 用户消息 */}
            <div className='flex justify-end mb-2.5'>
              <span
                className='bg-[#0f1923] text-white text-[12.5px] leading-[1.55] px-3 py-2 max-w-[85%]'
                style={{ borderRadius: '10px 10px 2px 10px' }}
              >
                这份合同第7条存在什么风险？
              </span>
            </div>
            {/* AI 回复 */}
            <div className='mb-1.5'>
              <span
                className='inline-block bg-white border border-gray-200 text-gray-800 text-[12.5px] leading-[1.55] px-3 py-2 max-w-[90%]'
                style={{ borderRadius: '10px 10px 10px 2px' }}
              >
                第7条违约金条款存在三点风险：① 约定违约金超过实际损失
                30%，法院可能调低；② 未区分根本违约与一般违约；③
                免责条款表述模糊……
              </span>
            </div>
            {/* 引用来源 */}
            <div className='flex items-center gap-1 text-[11px] text-blue-700 mt-2'>
              <FileTextIcon className='w-3 h-3 flex-shrink-0' />
              引用《合同法司法解释二》第29条 · 3条相关判例
            </div>
          </div>
        </div>
      </section>

      {/* ── 功能卡片 ── */}
      <section className='bg-[#f8f9fb] border-t border-b border-gray-200 py-12 px-6'>
        <div className='max-w-6xl mx-auto'>
          <div className='text-[11px] font-medium tracking-[0.12em] text-gray-400 uppercase text-center mb-2'>
            核心功能
          </div>
          <h2 className='font-serif text-[22px] font-bold text-[#0f1923] text-center tracking-tight mb-1'>
            专为法律工作者设计
          </h2>
          <p className='text-[13px] text-gray-500 text-center font-light mb-8'>
            律师与法务各有专属功能，清晰分工
          </p>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
            {FEATURES.map(f => (
              <div
                key={f.title}
                className='relative bg-white border border-gray-200 rounded-lg py-[18px] px-4'
              >
                {f.isNew && (
                  <div className='absolute top-0 right-0 bg-blue-700 text-white text-[9.5px] font-medium tracking-[0.04em] px-[7px] py-0.5 rounded-[0_8px_0_6px]'>
                    NEW
                  </div>
                )}
                <div className='w-8 h-8 border border-gray-200 rounded-[7px] flex items-center justify-center mb-3 text-gray-600'>
                  <f.icon className='w-4 h-4' />
                </div>
                <div className='text-[13px] font-semibold text-[#0f1923] mb-1.5 tracking-[0.01em]'>
                  {f.title}
                </div>
                <div className='text-[11.5px] text-gray-500 leading-[1.65] mb-3 font-light'>
                  {f.desc}
                </div>
                <div className='flex gap-1.5 flex-wrap'>
                  {f.tags.map(t => (
                    <span
                      key={t.label}
                      className={`text-[10.5px] px-2 py-0.5 rounded font-medium ${TAG_STYLES[t.type]}`}
                    >
                      {t.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 数据区 ── */}
      <section className='bg-white py-10 px-6'>
        <div className='max-w-6xl mx-auto'>
          <div className='grid grid-cols-3 divide-x divide-gray-200'>
            {STATS.map(s => (
              <div key={s.label} className='text-center py-4'>
                <div className='font-serif text-[28px] font-bold text-[#0f1923] tracking-tight leading-none mb-1.5'>
                  {s.main}
                  <span className='text-blue-700'>{s.unit}</span>
                </div>
                <div className='text-xs text-gray-400'>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className='bg-[#0f1923] py-12 px-6 text-center'>
        <div className='max-w-xl mx-auto'>
          <h2 className='font-serif text-[22px] font-bold text-white tracking-tight mb-2'>
            立即开始，免费体验
          </h2>
          <p className='text-[13px] text-gray-400 font-light mb-6'>
            注册即可使用全部功能，无需信用卡
          </p>
          <Link
            href='/register'
            className='inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0f1923] bg-white hover:bg-gray-100 transition-colors px-6 py-2.5 rounded-md'
          >
            免费注册 →
          </Link>
        </div>
      </section>

      {/* ── 底部 ── */}
      <footer className='bg-[#f8f9fb] border-t border-gray-200 py-4 px-6 text-center'>
        <p className='text-[11.5px] text-gray-400'>
          © {new Date().getFullYear()} 律伴 · 专业法律 AI 助理
        </p>
      </footer>
    </div>
  );
}
