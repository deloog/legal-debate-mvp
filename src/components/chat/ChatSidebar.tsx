'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronRightIcon as ChevronRightSmall,
  BriefcaseIcon,
} from 'lucide-react';
import type { ConversationSummary } from '@/types/chat';

interface ChatSidebarProps {
  open: boolean;
  onToggle: () => void;
  activeConversationId: string;
}

// 收缩宽度只保留图标
const COLLAPSED_W = 'w-12';
const EXPANDED_W = 'w-60';

export function ChatSidebar({
  open,
  onToggle,
  activeConversationId,
}: ChatSidebarProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);
  const loadConversations = useCallback(() => setRefreshKey(k => k + 1), []);

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
      const data = await res.json();
      router.push(`/chat/${data.data.id}`);
      loadConversations();
    } catch {
      // 静默失败
    }
  };

  return (
    <aside
      className={`
        relative flex flex-col border-r border-gray-200 bg-gray-50 transition-all duration-200 shrink-0
        ${open ? EXPANDED_W : COLLAPSED_W}
      `}
    >
      {/* 顶部：新建按钮 + 折叠按钮 */}
      <div className='flex items-center justify-between px-2 py-3 border-b border-gray-200'>
        {open && (
          <button
            onClick={handleNew}
            className='flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 px-1'
          >
            <PlusIcon className='w-4 h-4' />
            新对话
          </button>
        )}
        {!open && (
          <button
            onClick={handleNew}
            className='w-full flex justify-center text-blue-600 hover:text-blue-700 py-1'
            title='新对话'
          >
            <PlusIcon className='w-5 h-5' />
          </button>
        )}
        {open && (
          <button
            onClick={onToggle}
            className='text-gray-400 hover:text-gray-600 p-1 rounded'
          >
            <ChevronLeftIcon className='w-4 h-4' />
          </button>
        )}
      </div>

      {/* 展开时显示展开按钮 */}
      {!open && (
        <button
          onClick={onToggle}
          className='flex justify-center py-2 text-gray-400 hover:text-gray-600'
        >
          <ChevronRightIcon className='w-4 h-4' />
        </button>
      )}

      {/* 对话列表 */}
      {open && (
        <div className='flex-1 overflow-y-auto py-2'>
          {conversations.length === 0 ? (
            <p className='text-xs text-gray-400 px-3 py-4 text-center'>
              暂无对话
            </p>
          ) : (
            <ConversationTree
              items={conversations}
              activeId={activeConversationId}
              depth={0}
            />
          )}
        </div>
      )}

      {/* 底部：工作台入口 */}
      {open && (
        <div className='border-t border-gray-200'>
          <button
            onClick={() => setWorkbenchOpen(o => !o)}
            className='w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-100'
          >
            <span className='flex items-center gap-2'>
              <BriefcaseIcon className='w-4 h-4' />
              工作台
            </span>
            <ChevronDownIcon
              className={`w-3.5 h-3.5 transition-transform ${workbenchOpen ? '' : '-rotate-90'}`}
            />
          </button>
          {workbenchOpen && (
            <div className='pb-2'>
              {WORKBENCH_ITEMS.map(item => (
                <button
                  key={item.href}
                  onClick={() => router.push(item.href)}
                  className='w-full text-left px-6 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

// 递归渲染对话树（支持分叉层级）
function ConversationTree({
  items,
  activeId,
  depth,
}: {
  items: ConversationSummary[];
  activeId: string;
  depth: number;
}) {
  const router = useRouter();

  return (
    <>
      {items.map(conv => (
        <ConversationItem
          key={conv.id}
          conv={conv}
          activeId={activeId}
          depth={depth}
          onSelect={id => router.push(`/chat/${id}`)}
        />
      ))}
    </>
  );
}

function ConversationItem({
  conv,
  activeId,
  depth,
  onSelect,
}: {
  conv: ConversationSummary;
  activeId: string;
  depth: number;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasBranches = conv.branches.length > 0;
  const isActive = conv.id === activeId;

  return (
    <div>
      <div
        className={`
          group flex items-center gap-1 px-2 py-1.5 rounded-md mx-1 cursor-pointer text-sm
          ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => onSelect(conv.id)}
      >
        {hasBranches && (
          <button
            onClick={e => {
              e.stopPropagation();
              setExpanded(o => !o);
            }}
            className='shrink-0 text-gray-400'
          >
            <ChevronRightSmall
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        )}
        {!hasBranches && <span className='w-3 shrink-0' />}
        <span className='truncate flex-1 text-xs leading-5'>{conv.title}</span>
      </div>
      {hasBranches && expanded && (
        <ConversationTree
          items={conv.branches}
          activeId={activeId}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

const WORKBENCH_ITEMS = [
  { label: '案件管理', href: '/cases' },
  { label: '合同管理', href: '/contracts' },
  { label: '客户管理', href: '/clients' },
  { label: '文书模板', href: '/document-templates' },
  { label: '任务', href: '/tasks' },
  { label: '开庭日程', href: '/court-schedule' },
  { label: '法条检索', href: '/law-articles' },
  { label: '仪表盘', href: '/dashboard' },
];
