'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useDiscussionPolling } from '@/hooks/useDiscussionPolling';
import {
  SparklesIcon,
  ChevronDownIcon,
  ScaleIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  HelpCircleIcon,
  PaperclipIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  XCircleIcon,
  SwordsIcon,
  PlusCircleIcon,
  NetworkIcon,
  ClipboardListIcon,
} from 'lucide-react';
import type { ProposalDetail } from '@/types/proposal';

// ── 本地接口定义 ──────────────────────────────────────────────────────────────

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

interface AttachmentItem {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
}

interface CaseItem {
  id: string;
  title: string;
  caseNumber?: string | null;
  type: string;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ChatContextPanelProps {
  conversationId: string;
  userRole?: string;
  refreshTrigger?: number;
  onCrystalChange?: (crystal: { case_type?: string | null } | null) => void;
}

// ── 常量 ─────────────────────────────────────────────────────────────────────

const DEBATE_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'text-slate-500' },
  IN_PROGRESS: { label: '进行中', color: 'text-blue-500' },
  PAUSED: { label: '已暂停', color: 'text-amber-500' },
  COMPLETED: { label: '已完成', color: 'text-emerald-500' },
  ARCHIVED: { label: '已归档', color: 'text-slate-400' },
};

const DEBATE_MODE_LABELS: Record<string, string> = {
  STANDARD: '标准',
  FAST: '快速',
  DETAILED: '详细',
};

// ── 工具函数 ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

// ── 子组件 ────────────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  badge,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string | number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className='w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors'
    >
      <span className='flex items-center gap-2 font-medium'>
        {icon}
        {label}
        {badge !== undefined && (
          <span className='text-xs text-gray-400 font-normal'>{badge}</span>
        )}
      </span>
      <ChevronDownIcon
        className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
      />
    </button>
  );
}

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
    <div className='rounded-lg bg-gray-50 border border-gray-100 px-2 py-2 text-center'>
      <p className='text-[10px] text-gray-400 mb-0.5'>{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function DebateStatusBadge({ status }: { status: string }) {
  const cfg = DEBATE_STATUS_CONFIG[status] ?? {
    label: status,
    color: 'text-gray-400',
  };
  return (
    <span className={`text-[10px] shrink-0 ${cfg.color}`}>{cfg.label}</span>
  );
}

// ── 提案状态区 ────────────────────────────────────────────────────────────────

function ProposalStatusSection({
  conversationId,
  refreshTrigger,
}: {
  conversationId: string;
  refreshTrigger?: number;
}) {
  const router = useRouter();
  const [proposals, setProposals] = useState<ProposalDetail[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/proposals/list?conversationId=${conversationId}`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then((data: { data?: ProposalDetail[] }) => {
        if (!cancelled) setProposals(data.data ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [conversationId, refreshTrigger]);

  const active = proposals.filter(
    p => p.status === 'PENDING' || p.status === 'EXECUTING'
  );
  const completed = proposals.filter(
    p => p.status === 'COMPLETED' || p.status === 'PARTIALLY_COMPLETED'
  );

  if (proposals.length === 0) return null;

  return (
    <div className='border-b border-gray-100'>
      <SectionHeader
        icon={<ClipboardListIcon className='w-4 h-4 text-blue-500' />}
        label='AI 建案提案'
        badge={proposals.length}
        open={open}
        onToggle={() => setOpen(o => !o)}
      />
      {open && (
        <div className='px-4 pb-3 space-y-2'>
          {active.map(p => (
            <div
              key={p.id}
              className='rounded-lg border border-blue-100 bg-blue-50 px-3 py-2'
            >
              <div className='flex items-center justify-between'>
                <span className='text-xs font-medium text-blue-700'>
                  {p.status === 'EXECUTING' ? '执行中...' : '待确认'}
                </span>
                <span className='text-[10px] text-blue-400'>
                  {p.actions.length} 项操作
                </span>
              </div>
              <p className='text-[11px] text-blue-600 mt-0.5'>
                {p.extractedData.caseType || '案件提案'}
              </p>
            </div>
          ))}
          {completed.map(p => {
            const caseAction = p.actions.find(
              a => a.actionType === 'CREATE_CASE' && a.resourceId
            );
            return (
              <div
                key={p.id}
                className='rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2'
              >
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-emerald-700'>
                    {p.status === 'PARTIALLY_COMPLETED' ? '部分完成' : '已完成'}
                  </span>
                  {caseAction?.resourceId && (
                    <button
                      onClick={() =>
                        router.push(`/cases/${caseAction.resourceId}`)
                      }
                      className='text-[10px] text-emerald-600 hover:text-emerald-800 underline'
                    >
                      查看案件 →
                    </button>
                  )}
                </div>
                <p className='text-[11px] text-emerald-600 mt-0.5'>
                  {p.extractedData.caseType || '案件'}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 知识图谱面板（光亮主题版） ────────────────────────────────────────────────

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
    if (!trimmed || trimmed.length > 100) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/v1/law-articles?q=${encodeURIComponent(trimmed)}&limit=5`,
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
    <div className='border-b border-gray-100'>
      <SectionHeader
        icon={<NetworkIcon className='w-4 h-4 text-cyan-500' />}
        label='知识图谱'
        open={open}
        onToggle={() => setOpen(o => !o)}
      />
      {open && (
        <div className='px-4 pb-3 space-y-2'>
          <div className='flex gap-1.5'>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !searching && handleSearch()}
              placeholder='搜索法条...'
              className='flex-1 bg-gray-50 rounded-md px-2.5 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 outline-none border border-gray-200 focus:border-cyan-400'
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className='px-2.5 py-1.5 rounded-md bg-cyan-50 hover:bg-cyan-100 text-cyan-600 text-xs transition-colors disabled:opacity-50 border border-cyan-200'
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
                  className='w-full text-left rounded-md bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 border border-gray-100 transition-colors'
                >
                  <p className='text-[11px] text-gray-700 truncate'>
                    {r.title}
                  </p>
                  <p className='text-[10px] text-gray-400'>{r.category}</p>
                </button>
              ))}
              <button
                onClick={() =>
                  router.push(
                    `/law-articles?q=${encodeURIComponent(query)}&graph=1`
                  )
                }
                className='w-full text-center py-1 text-[11px] text-cyan-500 hover:text-cyan-700 transition-colors'
              >
                在图谱中查看关系 →
              </button>
            </div>
          )}
          {results.length === 0 && !searching && query && (
            <p className='text-[11px] text-gray-400 text-center py-1'>
              未找到相关法条
            </p>
          )}
          <button
            onClick={() => router.push('/law-articles')}
            className='w-full text-center py-1.5 rounded-md border border-dashed border-cyan-200 text-[11px] text-cyan-500/70 hover:border-cyan-300 hover:text-cyan-600 transition-colors'
          >
            打开完整知识图谱
          </button>
        </div>
      )}
    </div>
  );
}

// ── 辩论创建内联表单（光亮主题版） ───────────────────────────────────────────

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
    <div className='mt-2 rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2.5'>
      <p className='text-[11px] text-gray-600 font-medium'>新建辩论</p>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder='辩论标题'
        className='w-full bg-white rounded-md px-2.5 py-1.5 text-xs text-gray-700 placeholder:text-gray-400 outline-none border border-gray-200 focus:border-orange-400'
      />
      <div className='flex gap-2'>
        <div className='flex-1'>
          <p className='text-[10px] text-gray-400 mb-1'>轮次</p>
          <select
            value={maxRounds}
            onChange={e => setMaxRounds(Number(e.target.value))}
            className='w-full bg-white rounded-md px-2 py-1.5 text-xs text-gray-700 outline-none border border-gray-200'
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>
                {n} 轮
              </option>
            ))}
          </select>
        </div>
        <div className='flex-1'>
          <p className='text-[10px] text-gray-400 mb-1'>模式</p>
          <select
            value={debateMode}
            onChange={e =>
              setDebateMode(e.target.value as 'STANDARD' | 'FAST' | 'DETAILED')
            }
            className='w-full bg-white rounded-md px-2 py-1.5 text-xs text-gray-700 outline-none border border-gray-200'
          >
            <option value='STANDARD'>标准</option>
            <option value='FAST'>快速</option>
            <option value='DETAILED'>详细</option>
          </select>
        </div>
      </div>
      {error && <p className='text-[11px] text-red-500'>{error}</p>}
      <div className='flex gap-2'>
        <button
          onClick={onCancel}
          className='flex-1 py-1.5 rounded-md text-[11px] text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 transition-colors'
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

// ── 主组件 ────────────────────────────────────────────────────────────────────

export function ChatContextPanel({
  conversationId,
  userRole = 'USER',
  refreshTrigger,
  onCrystalChange,
}: ChatContextPanelProps) {
  const router = useRouter();
  const isLawyer = userRole === 'LAWYER';
  const isEnterprise = userRole === 'ENTERPRISE';

  // 面板开合状态
  const [crystalOpen, setCrystalOpen] = useState(true);
  const [filesOpen, setFilesOpen] = useState(true);
  const [debateOpen, setDebateOpen] = useState(true);

  // 数据
  const [crystal, setCrystal] = useState<CaseCrystal | null>(null);
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [linkedCaseId, setLinkedCaseId] = useState<string | null>(null);
  const [linkedCaseTitle, setLinkedCaseTitle] = useState('');
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [caseSearch, setCaseSearch] = useState('');
  const [debates, setDebates] = useState<DebateItem[]>([]);
  const [debateCreateOpen, setDebateCreateOpen] = useState(false);
  const [assessment, setAssessment] = useState<CaseAssessmentSummary | null>(
    null
  );
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [innerRefresh, setInnerRefresh] = useState(0);

  // 加载对话上下文（晶体 + 关联案件）
  useEffect(() => {
    let cancelled = false;
    startTransition(() => {
      setCrystal(null);
      setLinkedCaseId(null);
      setLinkedCaseTitle('');
    });
    fetch(`/api/v1/chat/conversations/${conversationId}`, {
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
  }, [conversationId, refreshTrigger, innerRefresh, onCrystalChange]);

  // 加载附件
  useEffect(() => {
    let cancelled = false;
    startTransition(() => setAttachments([]));
    fetch(`/api/v1/chat/conversations/${conversationId}/attachments`, {
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
  }, [conversationId, refreshTrigger, innerRefresh]);

  // 加载辩论（律师专属）
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
  }, [isLawyer, linkedCaseId, refreshTrigger, innerRefresh]);

  // 辩论轮询（进行中时）
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
    interval: 15000,
    enabled: hasInProgressDebate,
  });

  // AI 案件评估（律师专属，晶体 v2+）
  useEffect(() => {
    const version = crystal?.version ?? 0;
    if (!isLawyer || version < 2) {
      startTransition(() => {
        setAssessment(null);
        setAssessmentLoading(false);
      });
      return;
    }
    if (version !== 2 && (version - 2) % 3 !== 0) return;
    let cancelled = false;
    startTransition(() => setAssessmentLoading(true));
    fetch(`/api/v1/chat/conversations/${conversationId}/assess`, {
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
      setAssessmentLoading(false);
    };
  }, [isLawyer, conversationId, crystal?.version]);

  // 关联案件操作
  const handleLinkCase = async (caseId: string | null, caseTitle: string) => {
    try {
      await fetch(`/api/v1/chat/conversations/${conversationId}`, {
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

  return (
    <aside className='flex flex-col bg-white border-l border-gray-200 h-full overflow-y-auto'>
      {/* 面板标题 */}
      <div className='px-4 py-3 border-b border-gray-100 shrink-0'>
        <h2 className='text-sm font-semibold text-gray-700'>案件上下文</h2>
        <p className='text-[11px] text-gray-400 mt-0.5'>AI 实时提炼</p>
      </div>

      {/* AI 建案提案 */}
      <ProposalStatusSection
        conversationId={conversationId}
        refreshTrigger={refreshTrigger}
      />

      {/* 案情晶体 */}
      <div className='border-b border-gray-100'>
        <SectionHeader
          icon={<SparklesIcon className='w-4 h-4 text-violet-500' />}
          label='案情晶体'
          badge={
            crystal?.version !== undefined ? `v${crystal.version}` : undefined
          }
          open={crystalOpen}
          onToggle={() => setCrystalOpen(o => !o)}
        />
        {crystalOpen && (
          <div className='px-4 pb-3 space-y-2'>
            {!crystal ||
            (!crystal.case_type &&
              !crystal.core_dispute &&
              !crystal.established_facts?.length) ? (
              <p className='text-[11px] text-gray-400 text-center py-2'>
                对话开始后自动提炼案情
              </p>
            ) : (
              <>
                {crystal.case_type && (
                  <div className='flex items-center gap-1.5'>
                    <ScaleIcon className='w-3 h-3 text-gray-400 shrink-0' />
                    <span className='text-[11px] text-gray-600 truncate'>
                      {crystal.case_type}
                    </span>
                  </div>
                )}
                {crystal.core_dispute && (
                  <div className='rounded-lg bg-violet-50 border border-violet-100 px-3 py-2'>
                    <p className='text-[10px] text-violet-400 mb-0.5'>
                      核心争议
                    </p>
                    <p className='text-[11px] text-violet-700 line-clamp-3 leading-relaxed'>
                      {crystal.core_dispute}
                    </p>
                  </div>
                )}
                <div className='flex gap-3 flex-wrap'>
                  {(crystal.established_facts?.length ?? 0) > 0 && (
                    <div className='flex items-center gap-1'>
                      <CheckCircle2Icon className='w-3 h-3 text-emerald-500' />
                      <span className='text-[11px] text-gray-500'>
                        {crystal.established_facts!.length} 已确认
                      </span>
                    </div>
                  )}
                  {(crystal.uncertain_facts?.length ?? 0) > 0 && (
                    <div className='flex items-center gap-1'>
                      <AlertTriangleIcon className='w-3 h-3 text-amber-500' />
                      <span className='text-[11px] text-gray-500'>
                        {crystal.uncertain_facts!.length} 存疑
                      </span>
                    </div>
                  )}
                  {(crystal.open_questions?.length ?? 0) > 0 && (
                    <div className='flex items-center gap-1'>
                      <HelpCircleIcon className='w-3 h-3 text-blue-400' />
                      <span className='text-[11px] text-gray-500'>
                        {crystal.open_questions!.length} 待解
                      </span>
                    </div>
                  )}
                </div>
                {crystal.current_position && (
                  <div className='rounded-lg bg-gray-50 border border-gray-100 px-3 py-2'>
                    <p className='text-[10px] text-gray-400 mb-0.5'>当前立场</p>
                    <p className='text-[11px] text-gray-600 line-clamp-2'>
                      {crystal.current_position}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* AI 案件评估（律师专属，晶体 v2+） */}
      {isLawyer && (crystal?.version ?? 0) >= 2 && (
        <div className='border-b border-gray-100 px-4 py-3'>
          <div className='flex items-center justify-between mb-2'>
            <span className='text-xs font-medium text-gray-600 flex items-center gap-1.5'>
              <ScaleIcon className='w-3.5 h-3.5 text-violet-500' />
              AI 案件评估
            </span>
            {assessmentLoading && (
              <span className='text-[10px] text-gray-400 animate-pulse'>
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
                    ? 'text-emerald-500'
                    : assessment.winRate >= 0.4
                      ? 'text-amber-500'
                      : 'text-red-500'
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
                    EASY: 'text-emerald-500',
                    MEDIUM: 'text-amber-500',
                    HARD: 'text-red-500',
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
                    LOW: 'text-emerald-500',
                    MEDIUM: 'text-amber-500',
                    HIGH: 'text-red-500',
                  }[assessment.riskLevel]
                }
              />
            </div>
          ) : !assessmentLoading ? (
            <p className='text-[11px] text-gray-400 text-center py-1'>
              评估即将就绪
            </p>
          ) : null}
        </div>
      )}

      {/* 上传文件 */}
      {attachments.length > 0 && (
        <div className='border-b border-gray-100'>
          <SectionHeader
            icon={<PaperclipIcon className='w-4 h-4 text-gray-500' />}
            label='上传文件'
            badge={attachments.length}
            open={filesOpen}
            onToggle={() => setFilesOpen(o => !o)}
          />
          {filesOpen && (
            <div className='px-4 pb-3 space-y-1'>
              {attachments.map(att => (
                <div
                  key={att.id}
                  className='flex items-center gap-2 py-1'
                  title={att.fileName}
                >
                  {att.fileType.startsWith('image/') ? (
                    <ImageIcon className='w-3.5 h-3.5 text-gray-400 shrink-0' />
                  ) : (
                    <FileTextIcon className='w-3.5 h-3.5 text-gray-400 shrink-0' />
                  )}
                  <span className='text-[11px] text-gray-600 truncate flex-1'>
                    {att.fileName}
                  </span>
                  <span className='text-[10px] text-gray-400 shrink-0'>
                    {formatFileSize(att.fileSize)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 关联案件 */}
      <div className='border-b border-gray-100 px-4 py-3'>
        <div className='flex items-center justify-between mb-1.5'>
          <span className='flex items-center gap-1.5 text-xs font-medium text-gray-600'>
            <LinkIcon className='w-3.5 h-3.5 text-gray-400' />
            关联案件
          </span>
          {linkedCaseId ? (
            <button
              onClick={() => handleLinkCase(null, '')}
              className='text-[10px] text-gray-400 hover:text-red-500 transition-colors'
              title='取消关联'
            >
              <XCircleIcon className='w-3.5 h-3.5' />
            </button>
          ) : (
            <button
              onClick={handleOpenCasePicker}
              className='text-[10px] text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 hover:border-gray-300 transition-colors'
            >
              + 关联
            </button>
          )}
        </div>

        {linkedCaseId ? (
          <button
            onClick={() => router.push(`/cases/${linkedCaseId}`)}
            className='w-full text-left text-[11px] text-violet-600 hover:text-violet-800 truncate transition-colors'
          >
            {linkedCaseTitle || '查看关联案件'}
          </button>
        ) : (
          <p className='text-[10px] text-gray-400'>未关联案件</p>
        )}

        {casePickerOpen && (
          <div className='mt-2 rounded-lg bg-white border border-gray-200 overflow-hidden shadow-sm'>
            <input
              type='text'
              value={caseSearch}
              onChange={e => setCaseSearch(e.target.value)}
              placeholder='搜索案件...'
              className='w-full bg-transparent px-3 py-2 text-xs text-gray-700 placeholder:text-gray-400 outline-none border-b border-gray-100'
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
                    className='w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors'
                  >
                    <span className='truncate block'>{c.title}</span>
                    {c.caseNumber && (
                      <span className='text-[10px] text-gray-400'>
                        {c.caseNumber}
                      </span>
                    )}
                  </button>
                ))}
              {cases.filter(c => !caseSearch || c.title.includes(caseSearch))
                .length === 0 && (
                <p className='px-3 py-2 text-[11px] text-gray-400'>
                  暂无匹配案件
                </p>
              )}
            </div>
            <button
              onClick={() => {
                setCasePickerOpen(false);
                setCaseSearch('');
              }}
              className='w-full text-center py-1.5 text-[10px] text-gray-400 hover:text-gray-600 border-t border-gray-100 transition-colors'
            >
              取消
            </button>
          </div>
        )}
      </div>

      {/* 知识图谱（律师+法务） */}
      {(isLawyer || isEnterprise) && <KnowledgeGraphPanel />}

      {/* 辩论面板（律师专属） */}
      {isLawyer && (
        <div className='border-b border-gray-100'>
          <SectionHeader
            icon={<SwordsIcon className='w-4 h-4 text-orange-500' />}
            label='辩论'
            badge={debates.length > 0 ? debates.length : undefined}
            open={debateOpen}
            onToggle={() => setDebateOpen(o => !o)}
          />
          {debateOpen && (
            <div className='px-4 pb-3'>
              {!linkedCaseId ? (
                <p className='text-[11px] text-gray-400 text-center py-2'>
                  请先关联案件以发起辩论
                </p>
              ) : debates.length === 0 ? (
                <div className='space-y-2'>
                  <p className='text-[11px] text-gray-400 text-center py-1'>
                    暂无辩论
                  </p>
                  <button
                    onClick={() => setDebateCreateOpen(true)}
                    className='w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-orange-300 text-[11px] text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition-colors'
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
                      className='w-full text-left rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-100 px-2.5 py-2 transition-colors'
                    >
                      <div className='flex items-center justify-between gap-1'>
                        <span className='text-[11px] text-gray-700 truncate flex-1'>
                          {debate.title}
                        </span>
                        <DebateStatusBadge status={debate.status} />
                      </div>
                      <div className='flex items-center gap-2 mt-0.5'>
                        <span className='text-[10px] text-gray-400'>
                          {debate.maxRounds} 轮
                        </span>
                        <span className='text-[10px] text-gray-400'>
                          {DEBATE_MODE_LABELS[debate.debateMode] ??
                            debate.debateMode}
                        </span>
                      </div>
                    </button>
                  ))}
                  <button
                    onClick={() => setDebateCreateOpen(true)}
                    className='w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-orange-300 text-[11px] text-orange-500 hover:border-orange-400 hover:bg-orange-50 transition-colors mt-1'
                  >
                    <PlusCircleIcon className='w-3.5 h-3.5' />
                    新建辩论
                  </button>
                </div>
              )}
              {debateCreateOpen && linkedCaseId && (
                <DebateCreateInline
                  caseId={linkedCaseId}
                  caseTitle={linkedCaseTitle}
                  onSuccess={debateId => {
                    setDebateCreateOpen(false);
                    setInnerRefresh(k => k + 1);
                    router.push(`/debates/${debateId}`);
                  }}
                  onCancel={() => setDebateCreateOpen(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* 占位空间 */}
      <div className='flex-1' />
    </aside>
  );
}
