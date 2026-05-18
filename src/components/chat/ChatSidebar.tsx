'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronRightIcon as ChevronRightSmall,
  BriefcaseIcon,
  MessageSquareIcon,
  BuildingIcon,
  LogOutIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';
import type { ConversationSummary } from '@/types/chat';

interface ChatSidebarProps {
  open: boolean;
  onToggle: () => void;
  activeConversationId?: string;
  onRefresh?: (fn: () => void) => void;
  userRole?: string;
}

// ── 工作台菜单（按角色差异化） ───────────────────────────────────────────────
const WORKBENCH_LAWYER = [
  { label: '案件管理', href: '/cases' },
  { label: '客户管理', href: '/clients' },
  { label: '文书模板', href: '/document-templates' },
  { label: '开庭日程', href: '/court-schedule' },
  { label: '任务', href: '/tasks' },
  { label: '法条检索', href: '/law-articles' },
  { label: '仪表盘', href: '/dashboard' },
];

const WORKBENCH_ENTERPRISE = [
  { label: '合同管理', href: '/contracts' },
  { label: '客户管理', href: '/clients' },
  { label: '文书模板', href: '/document-templates' },
  { label: '任务', href: '/tasks' },
  { label: '法条检索', href: '/law-articles' },
  { label: '仪表盘', href: '/dashboard' },
];

const WORKBENCH_DEFAULT = [
  { label: '文书模板', href: '/document-templates' },
  { label: '法条检索', href: '/law-articles' },
  { label: '仪表盘', href: '/dashboard' },
];

function getWorkbenchItems(role: string) {
  if (role === 'LAWYER') return WORKBENCH_LAWYER;
  if (role === 'ENTERPRISE') return WORKBENCH_ENTERPRISE;
  return WORKBENCH_DEFAULT;
}

type DateGroup = { label: string; items: ConversationSummary[] };

function groupConversationsByDate(convs: ConversationSummary[]): DateGroup[] {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  const groups: DateGroup[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '最近 7 天', items: [] },
    { label: '更早', items: [] },
  ];

  convs.forEach(conv => {
    const d = new Date(conv.createdAt);
    const startOfD = new Date(d);
    startOfD.setHours(0, 0, 0, 0);
    if (startOfD >= startOfToday) groups[0].items.push(conv);
    else if (startOfD >= startOfYesterday) groups[1].items.push(conv);
    else if (startOfD >= startOfWeek) groups[2].items.push(conv);
    else groups[3].items.push(conv);
  });

  return groups.filter(g => g.items.length > 0);
}

export function ChatSidebar({
  open,
  onToggle,
  activeConversationId,
  onRefresh,
  userRole = 'USER',
}: ChatSidebarProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const isEnterprise = userRole === 'ENTERPRISE';
  const isLawyer = userRole === 'LAWYER';
  const workbenchItems = getWorkbenchItems(userRole);

  const loadConversations = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    onRefresh?.(loadConversations);
  }, [onRefresh, loadConversations]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/v1/chat/conversations', { credentials: 'include' })
      .then(r => r.json())
      .then((data: { data?: ConversationSummary[] }) => {
        if (!cancelled) setConversations(data.data ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const handleNew = async () => {
    try {
      const res = await fetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: '新对话' }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { data?: { id: string } };
      if (data.data?.id) {
        router.push(`/chat/${data.data.id}`);
        loadConversations();
      }
    } catch {
      // 静默失败
    }
  };

  const groups = groupConversationsByDate(conversations);

  if (!open) {
    return (
      <aside className='relative flex flex-col bg-slate-900 shrink-0 w-12 transition-all duration-200'>
        <div className='flex flex-col items-center py-3 gap-3'>
          <div className='w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center'>
            <span className='text-white text-xs font-bold'>律</span>
          </div>
          <button
            onClick={handleNew}
            className='w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors'
            title='新对话'
          >
            <PlusIcon className='w-4 h-4' />
          </button>
          <button
            onClick={onToggle}
            className='w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/10 transition-colors'
          >
            <ChevronRightIcon className='w-4 h-4' />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className='relative flex flex-col bg-slate-900 w-full h-full'>
      {/* 顶部 */}
      <div className='flex items-center justify-between px-3 py-3 border-b border-white/8'>
        <div className='flex items-center gap-2'>
          <div className='w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0'>
            <span className='text-white text-xs font-bold'>律</span>
          </div>
          <span className='text-sm font-medium text-white tracking-tight'>
            律伴
          </span>
        </div>
        <button
          onClick={onToggle}
          className='text-slate-500 hover:text-slate-300 p-1 rounded-md hover:bg-white/8 transition-colors'
        >
          <ChevronLeftIcon className='w-4 h-4' />
        </button>
      </div>

      {/* 新建对话 */}
      <div className='px-3 pt-3'>
        <button
          onClick={handleNew}
          className='w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/8 hover:bg-white/14 text-slate-300 hover:text-white text-sm transition-colors'
        >
          <PlusIcon className='w-4 h-4 shrink-0' />
          <span>新对话</span>
        </button>
      </div>

      {/* 对话列表 */}
      <div className='flex-1 overflow-y-auto py-3 space-y-4'>
        {groups.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-8 gap-2'>
            <MessageSquareIcon className='w-5 h-5 text-slate-600' />
            <p className='text-xs text-slate-600 text-center'>暂无对话记录</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label}>
              <p className='px-3 pb-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider'>
                {group.label}
              </p>
              {group.items.map(conv => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  activeId={activeConversationId}
                  depth={0}
                  onSelect={id => router.push(`/chat/${id}`)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* 底部工作台 */}
      <div className='border-t border-white/8'>
        <button
          onClick={() => setWorkbenchOpen(o => !o)}
          className='w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/6 transition-colors'
        >
          <span className='flex items-center gap-2'>
            {isEnterprise ? (
              <BuildingIcon className='w-4 h-4' />
            ) : (
              <BriefcaseIcon className='w-4 h-4' />
            )}
            {isEnterprise ? '法务工作台' : isLawyer ? '律师工作台' : '工作台'}
          </span>
          <ChevronDownIcon
            className={`w-3.5 h-3.5 transition-transform duration-200 ${workbenchOpen ? '' : '-rotate-90'}`}
          />
        </button>
        {workbenchOpen && (
          <div className='pb-2'>
            {workbenchItems.map(item => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className='w-full text-left px-8 py-1.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors'
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 用户信息区 */}
      <div className='border-t border-white/8 p-2 shrink-0'>
        <div className='flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/6 transition-colors'>
          <div className='w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0'>
            <UserIcon className='w-3.5 h-3.5 text-slate-400' />
          </div>
          <div className='flex-1 min-w-0'>
            <p className='text-xs font-medium text-slate-300 truncate'>
              {user?.name || user?.email || '用户'}
            </p>
            <p className='text-[10px] text-slate-600 truncate'>
              {userRole === 'LAWYER'
                ? '律师'
                : userRole === 'ENTERPRISE'
                  ? '法务'
                  : userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'
                    ? '管理员'
                    : '用户'}
            </p>
          </div>
        </div>
        <div className='flex gap-1 mt-1'>
          <button
            onClick={() => router.push('/settings')}
            className='flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors'
          >
            <SettingsIcon className='w-3 h-3' />
            设置
          </button>
          <button
            onClick={async () => {
              await logout();
              router.replace('/login');
            }}
            className='flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] text-slate-500 hover:text-red-400 hover:bg-red-500/8 transition-colors'
          >
            <LogOutIcon className='w-3 h-3' />
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── 对话条目 ──────────────────────────────────────────────────────────────────

function ConversationItem({
  conv,
  activeId,
  depth,
  onSelect,
}: {
  conv: ConversationSummary;
  activeId?: string;
  depth: number;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasBranches = (conv.branches?.length ?? 0) > 0;
  const isActive = conv.id === activeId;

  return (
    <div>
      <div
        className={`
          group flex items-center gap-1 mx-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors
          ${isActive ? 'bg-white/14 text-white' : 'text-slate-400 hover:bg-white/8 hover:text-slate-200'}
        `}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => onSelect(conv.id)}
      >
        {hasBranches ? (
          <button
            onClick={e => {
              e.stopPropagation();
              setExpanded(o => !o);
            }}
            className='shrink-0 text-slate-600 hover:text-slate-400'
          >
            <ChevronRightSmall
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className='w-3 shrink-0' />
        )}
        <span className='truncate flex-1 leading-5'>{conv.title}</span>
      </div>
      {hasBranches && expanded && (
        <>
          {(conv.branches ?? []).map(branch => (
            <ConversationItem
              key={branch.id}
              conv={branch}
              activeId={activeId}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </>
      )}
    </div>
  );
}
