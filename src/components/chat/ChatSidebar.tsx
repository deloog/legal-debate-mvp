'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { useDiscussionPolling } from '@/hooks/useDiscussionPolling';
import { useRouter } from 'next/navigation';
import {
  PlusIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronRightIcon as ChevronRightSmall,
  BriefcaseIcon,
  MessageSquareIcon,
  SparklesIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  HelpCircleIcon,
  ScaleIcon,
  PaperclipIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  XCircleIcon,
  SwordsIcon,
  PlusCircleIcon,
  NetworkIcon,
  BuildingIcon,
} from 'lucide-react';
import type { ConversationSummary } from '@/types/chat';

interface ChatSidebarProps {
  open: boolean;
  onToggle: () => void;
  activeConversationId?: string;
  onRefresh?: (fn: () => void) => void;
  userRole?: string;
  onCrystalChange?: (crystal: { case_type?: string | null } | null) => void;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

interface CaseItem {
  id: string;
  title: string;
  caseNumber?: string | null;
  type: string;
}

interface AttachmentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
}

interface CaseCrystal {
  version?: number;
  case_type?: string | null;
  core_dispute?: string | null;
  established_facts?: { fact: string; confidence: number }[];
  uncertain_facts?: { fact: string; confidence: number }[];
  open_questions?: string[];
  current_position?: string | null;
}

interface DebateItem {
  id: string;
  title: string;
  status: string;
  debateMode: string;
  maxRounds: number;
  createdAt: string;
}

interface CaseAssessmentSummary {
  winRate: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  keyLegalPoints: string[];
}

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
  onCrystalChange,
}: ChatSidebarProps) {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [workbenchOpen, setWorkbenchOpen] = useState(false);
  const [crystalOpen, setCrystalOpen] = useState(true);
  const [crystal, setCrystal] = useState<CaseCrystal | null>(null);
  const [filesOpen, setFilesOpen] = useState(true);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [linkedCaseId, setLinkedCaseId] = useState<string | null>(null);
  const [linkedCaseTitle, setLinkedCaseTitle] = useState<string>('');
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseSearch, setCaseSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  // 辩论面板状态（律师专属）
  const [debateOpen, setDebateOpen] = useState(true);
  const [debates, setDebates] = useState<DebateItem[]>([]);
  const [debateCreateOpen, setDebateCreateOpen] = useState(false);
  // AI 案件评估（律师专属，晶体 v2+ 时显示）
  const [assessment, setAssessment] = useState<CaseAssessmentSummary | null>(
    null
  );
  const [assessmentLoading, setAssessmentLoading] = useState(false);

  const isLawyer = userRole === 'LAWYER';
  const isEnterprise = userRole === 'ENTERPRISE';
  const workbenchItems = getWorkbenchItems(userRole);

  const loadConversations = useCallback(() => setRefreshKey(k => k + 1), []);

  // 将刷新函数暴露给父级
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

  // 拉取当前对话的案情晶体 + 已关联案件
  useEffect(() => {
    if (!activeConversationId) {
      startTransition(() => {
        setCrystal(null);
        setLinkedCaseId(null);
        setLinkedCaseTitle('');
      });
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/chat/conversations/${activeConversationId}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(
        (data: {
          data?: {
            caseContext?: unknown;
            caseId?: string | null;
            case?: { title?: string } | null;
          };
        }) => {
          if (!cancelled) {
            const newCrystal =
              data.data?.caseContext &&
              typeof data.data.caseContext === 'object'
                ? (data.data.caseContext as CaseCrystal)
                : null;
            setCrystal(newCrystal);
            onCrystalChange?.(
              newCrystal ? { case_type: newCrystal.case_type } : null
            );
            setLinkedCaseId(data.data?.caseId ?? null);
            setLinkedCaseTitle(data.data?.case?.title ?? '');
          }
        }
      )
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, onCrystalChange, refreshKey]);

  // 拉取当前对话关联案件下的辩论列表（律师专属）
  useEffect(() => {
    if (!isLawyer || !linkedCaseId) {
      startTransition(() => setDebates([]));
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/debates?caseId=${linkedCaseId}&limit=5`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((data: { data?: DebateItem[] | { debates?: DebateItem[] } }) => {
        if (!cancelled) {
          const list = Array.isArray(data.data)
            ? data.data
            : ((data.data as { debates?: DebateItem[] })?.debates ?? []);
          setDebates(list);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isLawyer, linkedCaseId, refreshKey]);

  // 辩论进行中时自动轮询状态（利用 useDiscussionPolling，页面隐藏时暂停）
  const hasInProgressDebate = debates.some(d => d.status === 'IN_PROGRESS');
  const pollDebates = useCallback(() => {
    if (!isLawyer || !linkedCaseId) return;
    fetch(`/api/v1/debates?caseId=${linkedCaseId}&limit=5`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((data: { data?: DebateItem[] | { debates?: DebateItem[] } }) => {
        const list = Array.isArray(data.data)
          ? data.data
          : ((data.data as { debates?: DebateItem[] })?.debates ?? []);
        setDebates(list);
      })
      .catch(() => {});
  }, [isLawyer, linkedCaseId]);

  useDiscussionPolling(pollDebates, {
    interval: 15000, // 15 秒
    enabled: hasInProgressDebate,
  });

  // 拉取 AI 案件评估（律师专属，晶体 version >= 2 时触发，每 3 个版本更新一次避免频繁 AI 调用）
  useEffect(() => {
    const version = crystal?.version ?? 0;
    if (!isLawyer || !activeConversationId || version < 2) {
      startTransition(() => {
        setAssessment(null);
        setAssessmentLoading(false);
      });
      return;
    }
    // 只在版本为 2 或每 3 个版本更新一次（v2, v5, v8...），避免每轮对话都调用 AI
    if (version !== 2 && (version - 2) % 3 !== 0) return;
    let cancelled = false;
    startTransition(() => setAssessmentLoading(true));
    fetch(`/api/v1/chat/conversations/${activeConversationId}/assess`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((data: { data?: CaseAssessmentSummary }) => {
        if (!cancelled && data.data) setAssessment(data.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setAssessmentLoading(false);
      });
    return () => {
      cancelled = true;
      setAssessmentLoading(false); // 切换对话时立即清除 loading 状态
    };
  }, [isLawyer, activeConversationId, crystal?.version]);

  // 拉取当前对话的附件列表
  useEffect(() => {
    if (!activeConversationId) {
      startTransition(() => setAttachments([]));
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/chat/conversations/${activeConversationId}/attachments`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((data: { data?: AttachmentItem[] }) => {
        if (!cancelled) setAttachments(data.data ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeConversationId, refreshKey]);

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

  const handleLinkCase = async (caseId: string | null, caseTitle: string) => {
    if (!activeConversationId) return;
    try {
      await fetch(`/api/v1/chat/conversations/${activeConversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ caseId }),
      });
      setLinkedCaseId(caseId);
      setLinkedCaseTitle(caseTitle);
      setCasePickerOpen(false);
      setCaseSearch('');
    } catch {
      // 静默失败
    }
  };

  const handleOpenCasePicker = async () => {
    setCasePickerOpen(true);
    if (cases.length === 0) {
      try {
        const res = await fetch('/api/v1/cases?limit=50', {
          credentials: 'include',
        });
        const data = (await res.json()) as { data?: { cases?: CaseItem[] } };
        setCases(data.data?.cases ?? []);
      } catch {
        // 静默失败
      }
    }
  };

  const groups = groupConversationsByDate(conversations);

  if (!open) {
    return (
      <aside className='relative flex flex-col bg-slate-900 shrink-0 w-12 transition-all duration-200'>
        <div className='flex flex-col items-center py-3 gap-3'>
          {/* Logo mark */}
          <div className='w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center'>
            <span className='text-white text-xs font-bold'>律</span>
          </div>
          {/* New */}
          <button
            onClick={handleNew}
            className='w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors'
            title='新对话'
          >
            <PlusIcon className='w-4 h-4' />
          </button>
          {/* Expand */}
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

      {/* 案情晶体面板 */}
      {activeConversationId && (
        <div className='border-t border-white/8'>
          <button
            onClick={() => setCrystalOpen(o => !o)}
            className='w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/6 transition-colors'
          >
            <span className='flex items-center gap-2'>
              <SparklesIcon className='w-4 h-4 text-violet-400' />
              案情晶体
              {crystal?.version !== undefined && (
                <span className='text-[10px] text-slate-600'>
                  v{crystal.version}
                </span>
              )}
            </span>
            <ChevronDownIcon
              className={`w-3.5 h-3.5 transition-transform duration-200 ${crystalOpen ? '' : '-rotate-90'}`}
            />
          </button>
          {crystalOpen && (
            <div className='px-3 pb-3 space-y-2'>
              {!crystal ||
              (!crystal.case_type &&
                !crystal.core_dispute &&
                !crystal.established_facts?.length) ? (
                <p className='text-[11px] text-slate-600 text-center py-2'>
                  对话开始后自动提炼案情
                </p>
              ) : (
                <>
                  {crystal.case_type && (
                    <div className='flex items-center gap-1.5'>
                      <ScaleIcon className='w-3 h-3 text-slate-500 shrink-0' />
                      <span className='text-[11px] text-slate-400 truncate'>
                        {crystal.case_type}
                      </span>
                    </div>
                  )}
                  {crystal.core_dispute && (
                    <div className='rounded-md bg-white/5 px-2 py-1.5'>
                      <p className='text-[10px] text-slate-500 mb-0.5'>
                        核心争议
                      </p>
                      <p className='text-[11px] text-slate-300 line-clamp-2 leading-relaxed'>
                        {crystal.core_dispute}
                      </p>
                    </div>
                  )}
                  <div className='flex gap-2'>
                    {(crystal.established_facts?.length ?? 0) > 0 && (
                      <div className='flex items-center gap-1'>
                        <CheckCircle2Icon className='w-3 h-3 text-emerald-500' />
                        <span className='text-[11px] text-slate-400'>
                          {crystal.established_facts!.length} 已确认
                        </span>
                      </div>
                    )}
                    {(crystal.uncertain_facts?.length ?? 0) > 0 && (
                      <div className='flex items-center gap-1'>
                        <AlertTriangleIcon className='w-3 h-3 text-amber-500' />
                        <span className='text-[11px] text-slate-400'>
                          {crystal.uncertain_facts!.length} 存疑
                        </span>
                      </div>
                    )}
                    {(crystal.open_questions?.length ?? 0) > 0 && (
                      <div className='flex items-center gap-1'>
                        <HelpCircleIcon className='w-3 h-3 text-blue-400' />
                        <span className='text-[11px] text-slate-400'>
                          {crystal.open_questions!.length} 待解
                        </span>
                      </div>
                    )}
                  </div>
                  {crystal.current_position && (
                    <div className='rounded-md bg-white/5 px-2 py-1.5'>
                      <p className='text-[10px] text-slate-500 mb-0.5'>
                        当前立场
                      </p>
                      <p className='text-[11px] text-slate-300 line-clamp-1'>
                        {crystal.current_position}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── AI 案件评估摘要（律师专属，晶体 v2+ 触发） ──────────────────── */}
      {isLawyer && activeConversationId && (crystal?.version ?? 0) >= 2 && (
        <div className='border-t border-white/8 px-3 py-2.5'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-[11px] text-slate-400 font-medium flex items-center gap-1.5'>
              <ScaleIcon className='w-3.5 h-3.5 text-violet-400' />
              AI 案件评估
            </span>
            {assessmentLoading && (
              <span className='text-[10px] text-slate-600 animate-pulse'>
                分析中...
              </span>
            )}
          </div>
          {assessment ? (
            <div className='grid grid-cols-3 gap-1.5'>
              <AssessmentMetric
                label='胜诉率'
                value={`${Math.round(assessment.winRate * 100)}%`}
                color={
                  assessment.winRate >= 0.6
                    ? 'text-emerald-400'
                    : assessment.winRate >= 0.4
                      ? 'text-amber-400'
                      : 'text-red-400'
                }
              />
              <AssessmentMetric
                label='难度'
                value={
                  { EASY: '低', MEDIUM: '中', HARD: '高' }[
                    assessment.difficulty
                  ]
                }
                color={
                  {
                    EASY: 'text-emerald-400',
                    MEDIUM: 'text-amber-400',
                    HARD: 'text-red-400',
                  }[assessment.difficulty]
                }
              />
              <AssessmentMetric
                label='风险'
                value={
                  { LOW: '低', MEDIUM: '中', HIGH: '高' }[assessment.riskLevel]
                }
                color={
                  {
                    LOW: 'text-emerald-400',
                    MEDIUM: 'text-amber-400',
                    HIGH: 'text-red-400',
                  }[assessment.riskLevel]
                }
              />
            </div>
          ) : !assessmentLoading ? (
            <p className='text-[11px] text-slate-600 text-center py-1'>
              对话进行中，评估即将就绪
            </p>
          ) : null}
        </div>
      )}

      {/* 已上传文件面板 */}
      {activeConversationId && attachments.length > 0 && (
        <div className='border-t border-white/8'>
          <button
            onClick={() => setFilesOpen(o => !o)}
            className='w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/6 transition-colors'
          >
            <span className='flex items-center gap-2'>
              <PaperclipIcon className='w-4 h-4' />
              上传文件
              <span className='text-[10px] text-slate-600'>
                {attachments.length}
              </span>
            </span>
            <ChevronDownIcon
              className={`w-3.5 h-3.5 transition-transform duration-200 ${filesOpen ? '' : '-rotate-90'}`}
            />
          </button>
          {filesOpen && (
            <div className='px-3 pb-2 space-y-1'>
              {attachments.map(att => (
                <div
                  key={att.id}
                  className='flex items-center gap-2 py-1 group'
                  title={att.fileName}
                >
                  {att.fileType.startsWith('image/') ? (
                    <ImageIcon className='w-3.5 h-3.5 text-slate-500 shrink-0' />
                  ) : (
                    <FileTextIcon className='w-3.5 h-3.5 text-slate-500 shrink-0' />
                  )}
                  <span className='text-[11px] text-slate-400 truncate flex-1'>
                    {att.fileName}
                  </span>
                  <span className='text-[10px] text-slate-600 shrink-0'>
                    {formatFileSize(att.fileSize)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 关联案件 */}
      {activeConversationId && (
        <div className='border-t border-white/8 px-3 py-2.5'>
          <div className='flex items-center justify-between mb-1.5'>
            <span className='flex items-center gap-1.5 text-xs text-slate-400'>
              <LinkIcon className='w-3.5 h-3.5' />
              关联案件
            </span>
            {linkedCaseId ? (
              <button
                onClick={() => handleLinkCase(null, '')}
                className='text-[10px] text-slate-600 hover:text-red-400 transition-colors'
                title='取消关联'
              >
                <XCircleIcon className='w-3.5 h-3.5' />
              </button>
            ) : (
              <button
                onClick={handleOpenCasePicker}
                className='text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-1.5 py-0.5 rounded border border-white/10 hover:border-white/20'
              >
                + 关联
              </button>
            )}
          </div>

          {linkedCaseId ? (
            <button
              onClick={() => router.push(`/cases/${linkedCaseId}`)}
              className='w-full text-left text-[11px] text-violet-400 hover:text-violet-300 truncate'
            >
              {linkedCaseTitle || '查看关联案件'}
            </button>
          ) : (
            <p className='text-[10px] text-slate-600'>未关联案件</p>
          )}

          {/* 案件选择器 */}
          {casePickerOpen && (
            <div className='mt-2 rounded-lg bg-slate-800 border border-white/10 overflow-hidden'>
              <input
                type='text'
                value={caseSearch}
                onChange={e => setCaseSearch(e.target.value)}
                placeholder='搜索案件...'
                className='w-full bg-transparent px-3 py-2 text-xs text-slate-300 placeholder:text-slate-600 outline-none border-b border-white/8'
                autoFocus
              />
              <div className='max-h-40 overflow-y-auto'>
                {cases
                  .filter(c => !caseSearch || c.title.includes(caseSearch))
                  .slice(0, 10)
                  .map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleLinkCase(c.id, c.title)}
                      className='w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-white/8 hover:text-slate-200 transition-colors'
                    >
                      <span className='truncate block'>{c.title}</span>
                      {c.caseNumber && (
                        <span className='text-[10px] text-slate-600'>
                          {c.caseNumber}
                        </span>
                      )}
                    </button>
                  ))}
                {cases.filter(c => !caseSearch || c.title.includes(caseSearch))
                  .length === 0 && (
                  <p className='px-3 py-2 text-[11px] text-slate-600'>
                    暂无匹配案件
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  setCasePickerOpen(false);
                  setCaseSearch('');
                }}
                className='w-full text-center py-1.5 text-[10px] text-slate-600 hover:text-slate-400 border-t border-white/8'
              >
                取消
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 知识图谱快速入口（律师+法务） ──────────────────────────────── */}
      {(isLawyer || isEnterprise) && <KnowledgeGraphPanel />}

      {/* ── 辩论面板（律师专属） ────────────────────────────────────────── */}
      {isLawyer && activeConversationId && (
        <div className='border-t border-white/8'>
          <button
            onClick={() => setDebateOpen(o => !o)}
            className='w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/6 transition-colors'
          >
            <span className='flex items-center gap-2'>
              <SwordsIcon className='w-4 h-4 text-orange-400' />
              辩论
              {debates.length > 0 && (
                <span className='text-[10px] text-slate-600'>
                  {debates.length}
                </span>
              )}
            </span>
            <ChevronDownIcon
              className={`w-3.5 h-3.5 transition-transform duration-200 ${debateOpen ? '' : '-rotate-90'}`}
            />
          </button>
          {debateOpen && (
            <div className='px-3 pb-3'>
              {!linkedCaseId ? (
                <p className='text-[11px] text-slate-600 text-center py-2'>
                  请先关联案件以发起辩论
                </p>
              ) : debates.length === 0 ? (
                <div className='space-y-2'>
                  <p className='text-[11px] text-slate-600 text-center py-1'>
                    暂无辩论
                  </p>
                  <button
                    onClick={() => setDebateCreateOpen(true)}
                    className='w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-orange-400/30 text-[11px] text-orange-400/70 hover:border-orange-400/60 hover:text-orange-400 transition-colors'
                  >
                    <PlusCircleIcon className='w-3.5 h-3.5' />
                    发起辩论
                  </button>
                </div>
              ) : (
                <div className='space-y-1.5'>
                  {debates.map(debate => (
                    <button
                      key={debate.id}
                      onClick={() => router.push(`/debates/${debate.id}`)}
                      className='w-full text-left rounded-lg bg-white/5 hover:bg-white/10 px-2.5 py-2 transition-colors group'
                    >
                      <div className='flex items-center justify-between gap-1'>
                        <span className='text-[11px] text-slate-300 truncate flex-1'>
                          {debate.title}
                        </span>
                        <DebateStatusBadge status={debate.status} />
                      </div>
                      <div className='flex items-center gap-2 mt-0.5'>
                        <span className='text-[10px] text-slate-600'>
                          {debate.maxRounds} 轮
                        </span>
                        <span className='text-[10px] text-slate-600'>
                          {DEBATE_MODE_LABELS[debate.debateMode] ??
                            debate.debateMode}
                        </span>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => setDebateCreateOpen(true)}
                    className='w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-orange-400/30 text-[11px] text-orange-400/70 hover:border-orange-400/60 hover:text-orange-400 transition-colors mt-1'
                  >
                    <PlusCircleIcon className='w-3.5 h-3.5' />
                    新建辩论
                  </button>
                </div>
              )}
              {/* 辩论创建表单 */}
              {debateCreateOpen && linkedCaseId && (
                <DebateCreateInline
                  caseId={linkedCaseId}
                  caseTitle={linkedCaseTitle}
                  onSuccess={debateId => {
                    setDebateCreateOpen(false);
                    setRefreshKey(k => k + 1);
                    router.push(`/debates/${debateId}`);
                  }}
                  onCancel={() => setDebateCreateOpen(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 底部工作台 ───────────────────────────────────────────────────── */}
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
    </aside>
  );
}

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
  const hasBranches = conv.branches.length > 0;
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
          {conv.branches.map(branch => (
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

// ── 辩论状态标签 ────────────────────────────────────────────────────────────
const DEBATE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'text-slate-500' },
  IN_PROGRESS: { label: '进行中', color: 'text-blue-400' },
  PAUSED: { label: '已暂停', color: 'text-amber-400' },
  COMPLETED: { label: '已完成', color: 'text-emerald-400' },
  ARCHIVED: { label: '已归档', color: 'text-slate-600' },
};

const DEBATE_MODE_LABELS: Record<string, string> = {
  STANDARD: '标准',
  FAST: '快速',
  DETAILED: '详细',
};

function DebateStatusBadge({ status }: { status: string }) {
  const cfg = DEBATE_STATUS_CONFIG[status] ?? {
    label: status,
    color: 'text-slate-500',
  };
  return (
    <span className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.label}</span>
  );
}

// ── 辩论创建内联表单 ─────────────────────────────────────────────────────────
function DebateCreateInline({
  caseId,
  caseTitle,
  onSuccess,
  onCancel,
}: {
  caseId: string;
  caseTitle: string;
  onSuccess: (debateId: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(caseTitle ? `${caseTitle} 辩论` : '');
  const [maxRounds, setMaxRounds] = useState(3);
  const [debateMode, setDebateMode] = useState<
    'STANDARD' | 'FAST' | 'DETAILED'
  >('STANDARD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (title.trim().length < 2) {
      setError('标题至少 2 个字符');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          caseId,
          title: title.trim(),
          maxRounds,
          debateMode,
        }),
      });
      const data = (await res.json()) as {
        data?: { id: string };
        error?: { message: string };
      };
      if (!res.ok) {
        setError(data.error?.message ?? '创建失败');
        return;
      }
      if (data.data?.id) onSuccess(data.data.id);
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='mt-2 rounded-lg bg-slate-800 border border-white/10 p-3 space-y-2.5'>
      <p className='text-[11px] text-slate-400 font-medium'>新建辩论</p>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder='辩论标题'
        className='w-full bg-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none border border-white/8 focus:border-orange-400/50'
      />
      <div className='flex gap-2'>
        <div className='flex-1'>
          <p className='text-[10px] text-slate-600 mb-1'>轮次</p>
          <select
            value={maxRounds}
            onChange={e => setMaxRounds(Number(e.target.value))}
            className='w-full bg-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-300 outline-none border border-white/8'
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>
                {n} 轮
              </option>
            ))}
          </select>
        </div>
        <div className='flex-1'>
          <p className='text-[10px] text-slate-600 mb-1'>模式</p>
          <select
            value={debateMode}
            onChange={e =>
              setDebateMode(e.target.value as 'STANDARD' | 'FAST' | 'DETAILED')
            }
            className='w-full bg-slate-700 rounded-md px-2 py-1.5 text-xs text-slate-300 outline-none border border-white/8'
          >
            <option value='STANDARD'>标准</option>
            <option value='FAST'>快速</option>
            <option value='DETAILED'>详细</option>
          </select>
        </div>
      </div>
      {error && <p className='text-[11px] text-red-400'>{error}</p>}
      <div className='flex gap-2'>
        <button
          onClick={onCancel}
          className='flex-1 py-1.5 rounded-md text-[11px] text-slate-500 hover:text-slate-300 border border-white/8 hover:border-white/20 transition-colors'
        >
          取消
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className='flex-1 py-1.5 rounded-md text-[11px] font-medium bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white transition-colors'
        >
          {loading ? '创建中...' : '创建'}
        </button>
      </div>
    </div>
  );
}

// ── 评估指标格子 ──────────────────────────────────────────────────────────────
function AssessmentMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className='rounded-md bg-white/5 px-2 py-1.5 text-center'>
      <p className='text-[10px] text-slate-600 mb-0.5'>{label}</p>
      <p className={`text-[13px] font-semibold ${color}`}>{value}</p>
    </div>
  );
}

// ── 知识图谱快速入口 ──────────────────────────────────────────────────────────
function KnowledgeGraphPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    { id: string; title: string; category: string }[]
  >([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length > 100) return; // 防止超长查询
    setSearching(true);
    try {
      const res = await fetch(
        `/api/v1/law-articles?q=${encodeURIComponent(query.trim())}&limit=5`,
        { credentials: 'include' }
      );
      const data = (await res.json()) as {
        data?: {
          articles?: { id: string; title: string; category?: string }[];
        };
      };
      setResults(
        (data.data?.articles ?? []).map(a => ({
          id: a.id,
          title: a.title,
          category: a.category ?? '法规',
        }))
      );
    } catch {
      // 静默失败
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className='border-t border-white/8'>
      <button
        onClick={() => setOpen(o => !o)}
        className='w-full flex items-center justify-between px-3 py-2.5 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/6 transition-colors'
      >
        <span className='flex items-center gap-2'>
          <NetworkIcon className='w-4 h-4 text-cyan-400' />
          知识图谱
        </span>
        <ChevronDownIcon
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && (
        <div className='px-3 pb-3 space-y-2'>
          <div className='flex gap-1.5'>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !searching && handleSearch()}
              placeholder='搜索法条...'
              className='flex-1 bg-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-300 placeholder:text-slate-600 outline-none border border-white/8 focus:border-cyan-400/40'
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className='px-2.5 py-1.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs transition-colors disabled:opacity-50'
            >
              {searching ? '...' : '搜'}
            </button>
          </div>
          {results.length > 0 && (
            <div className='space-y-1'>
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() =>
                    router.push(
                      `/law-articles?q=${encodeURIComponent(r.title)}`
                    )
                  }
                  className='w-full text-left rounded-md bg-white/5 hover:bg-white/10 px-2.5 py-1.5 transition-colors'
                >
                  <p className='text-[11px] text-slate-300 truncate'>
                    {r.title}
                  </p>
                  <p className='text-[10px] text-slate-600'>{r.category}</p>
                </button>
              ))}
              <button
                onClick={() =>
                  router.push(
                    `/law-articles?q=${encodeURIComponent(query)}&graph=1`
                  )
                }
                className='w-full text-center py-1 text-[11px] text-cyan-400/70 hover:text-cyan-400 transition-colors'
              >
                在图谱中查看关系 →
              </button>
            </div>
          )}
          {results.length === 0 && !searching && query && (
            <p className='text-[11px] text-slate-600 text-center py-1'>
              未找到相关法条
            </p>
          )}
          <button
            onClick={() => router.push('/law-articles')}
            className='w-full text-center py-1.5 rounded-md border border-dashed border-cyan-400/20 text-[11px] text-cyan-400/50 hover:border-cyan-400/40 hover:text-cyan-400/70 transition-colors'
          >
            打开完整知识图谱
          </button>
        </div>
      )}
    </div>
  );
}
