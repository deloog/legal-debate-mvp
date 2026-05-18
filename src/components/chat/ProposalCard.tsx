'use client';

import { useState, useRef, useEffect } from 'react';
import type { ProposalDetail, ProposalActionItem } from '@/types/proposal';

interface Props {
  proposal: ProposalDetail;
  onConfirmed?: (proposalId: string) => void;
  onRejected?: (proposalId: string) => void;
}

// ─── 工具函数 ─────────────────────────────────────────────────────────────────

function confidenceBadge(confidence: number) {
  if (confidence >= 0.7) return null;
  return (
    <span className='ml-1 text-xs text-amber-600 font-medium'>⚠ 请确认</span>
  );
}

// ─── 子组件 ───────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProposalDetail['status'] }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING: { label: '待确认', cls: 'bg-blue-100 text-blue-700' },
    EXECUTING: { label: '执行中', cls: 'bg-yellow-100 text-yellow-700' },
    COMPLETED: { label: '已完成', cls: 'bg-green-100 text-green-700' },
    PARTIALLY_COMPLETED: {
      label: '部分完成',
      cls: 'bg-orange-100 text-orange-700',
    },
    FAILED: { label: '失败', cls: 'bg-red-100 text-red-700' },
    REJECTED: { label: '已拒绝', cls: 'bg-gray-100 text-gray-500' },
    REVERTED: { label: '已撤销', cls: 'bg-gray-100 text-gray-500' },
  };
  const { label, cls } = map[status] ?? {
    label: status,
    cls: 'bg-gray-100 text-gray-500',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

/** 溯源浮层：点击 [溯源] 展示 AI 的原文依据 */
function SourcePopover({
  quote,
  onClose,
}: {
  quote: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className='absolute z-20 left-0 top-full mt-1 w-64 rounded-lg border border-blue-100 bg-white shadow-lg p-3'
    >
      <p className='text-[10px] text-blue-500 font-medium mb-1 uppercase tracking-wide'>
        AI 原文依据
      </p>
      <p className='text-xs text-gray-700 leading-relaxed'>「{quote}」</p>
      <button
        onClick={onClose}
        className='mt-2 text-[10px] text-gray-400 hover:text-gray-600'
      >
        关闭
      </button>
    </div>
  );
}

/** 可编辑字段行 */
function EditableField({
  label,
  value,
  editedValue,
  confidence,
  sourceQuote,
  editable,
  onEdit,
  onReset,
  onChange,
}: {
  label: string;
  value: string;
  editedValue: string | null;
  confidence: number;
  sourceQuote?: string;
  editable: boolean;
  onEdit: () => void;
  onReset: () => void;
  onChange: (v: string) => void;
}) {
  const [showSource, setShowSource] = useState(false);
  const isEditing = editedValue !== null;
  const displayValue = editedValue ?? value;

  return (
    <div className='px-3 py-2 flex gap-2'>
      <span className='text-gray-500 w-16 shrink-0 pt-0.5'>{label}</span>
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2 flex-wrap'>
          {isEditing ? (
            <input
              autoFocus
              value={displayValue}
              onChange={e => onChange(e.target.value)}
              className='text-gray-800 text-sm border-b border-blue-400 focus:outline-none bg-transparent flex-1 min-w-0'
            />
          ) : (
            <span className='text-gray-800 text-sm'>{displayValue}</span>
          )}
          {confidenceBadge(confidence)}
          <div className='flex items-center gap-1 relative'>
            {editable && (
              <button
                onClick={isEditing ? onReset : onEdit}
                className='text-[11px] text-blue-500 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors'
              >
                {isEditing ? '还原' : '修改'}
              </button>
            )}
            {sourceQuote && (
              <>
                <button
                  onClick={() => setShowSource(s => !s)}
                  className='text-[11px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50 transition-colors'
                >
                  溯源
                </button>
                {showSource && (
                  <SourcePopover
                    quote={sourceQuote}
                    onClose={() => setShowSource(false)}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Action 勾选行 */
function ActionCheckbox({
  action,
  checked,
  onChange,
  disabled,
}: {
  action: ProposalActionItem;
  checked: boolean;
  onChange: (id: string, checked: boolean) => void;
  disabled: boolean;
}) {
  const statusIcon: Record<string, string> = {
    COMPLETED: '✓',
    FAILED: '✗',
    EXECUTING: '…',
    SKIPPED: '—',
  };

  return (
    <label
      className={`flex items-center gap-2 text-sm py-1 ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {action.status === 'PENDING' || action.status === 'SKIPPED' ? (
        <input
          type='checkbox'
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(action.id, e.target.checked)}
          className='h-4 w-4 rounded border-gray-300 text-blue-600'
        />
      ) : (
        <span
          className={`w-4 h-4 flex items-center justify-center text-xs font-bold ${
            action.status === 'COMPLETED'
              ? 'text-green-600'
              : action.status === 'FAILED'
                ? 'text-red-600'
                : 'text-gray-400'
          }`}
        >
          {statusIcon[action.status] ?? '?'}
        </span>
      )}
      <span className={action.status === 'FAILED' ? 'text-red-600' : ''}>
        {action.label}
      </span>
      {action.error && (
        <span className='text-xs text-red-500 ml-1'>({action.error})</span>
      )}
    </label>
  );
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export function ProposalCard({ proposal, onConfirmed, onRejected }: Props) {
  const extracted = proposal.extractedData as {
    parties?: Array<{
      name: string;
      role: string;
      meta: { confidence: number; sourceQuote?: string };
    }>;
    caseType?: string;
    caseTypeMeta?: { confidence: number; sourceQuote?: string };
    claims?: Array<{
      text: string;
      meta: { confidence: number; sourceQuote?: string };
    }>;
    keyDates?: Array<{
      date: string;
      description: string;
      meta: { confidence: number; sourceQuote?: string };
    }>;
  };

  // ── 勾选状态 ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(proposal.actions.filter(a => a.selected).map(a => a.id))
  );

  // ── 内联编辑状态 ──
  const [editedCaseType, setEditedCaseType] = useState<string | null>(null);
  const [editedPartyNames, setEditedPartyNames] = useState<Map<number, string>>(
    () => new Map()
  );

  // ── 低置信度核实 ──
  const [lowConfAcknowledged, setLowConfAcknowledged] = useState(false);

  // ── UI 状态 ──
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(
    proposal.status !== 'PENDING' && proposal.status !== 'EXECUTING'
  );

  // 本地实时提案状态 — 轮询时更新，父组件刷新时同步
  const [liveProposal, setLiveProposal] = useState<ProposalDetail>(proposal);
  useEffect(() => {
    setLiveProposal(proposal);
  }, [proposal]);

  // 状态 EXECUTING 时每 3 秒轮询一次，完成后通知父组件刷新
  useEffect(() => {
    if (liveProposal.status !== 'EXECUTING') return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/proposals/${liveProposal.id}`);
        if (!res.ok) return;
        const json = (await res.json()) as {
          success: boolean;
          data?: ProposalDetail;
        };
        if (!json.success || !json.data) return;
        const updated = json.data;
        setLiveProposal(updated);
        if (updated.status !== 'EXECUTING') {
          clearInterval(timer);
          onConfirmed?.(updated.id);
        }
      } catch {
        // 忽略单次轮询网络错误
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [liveProposal.status, liveProposal.id, onConfirmed]);

  const isPending = liveProposal.status === 'PENDING';
  const isExecuting = liveProposal.status === 'EXECUTING';
  const isDone = !isPending && !isExecuting;

  const hasLowConfidence =
    (extracted.parties ?? []).some(p => p.meta.confidence < 0.7) ||
    (extracted.caseTypeMeta?.confidence ?? 1) < 0.7;

  const canConfirm =
    isPending &&
    selectedIds.size > 0 &&
    (!hasLowConfidence || lowConfAcknowledged);

  // ── 辅助：构建 confirmedData ──
  function buildConfirmedData(): Record<string, unknown> | undefined {
    const data: Record<string, unknown> = {};
    let hasChanges = false;

    if (editedCaseType !== null) {
      data.caseType = { value: editedCaseType, confirmedAsIs: false };
      hasChanges = true;
    }

    const parties = extracted.parties ?? [];
    const hasPartyEdits = editedPartyNames.size > 0;
    if (hasPartyEdits || (hasLowConfidence && lowConfAcknowledged)) {
      data.parties = parties.map((p, i) => ({
        name: {
          value: editedPartyNames.get(i) ?? p.name,
          confirmedAsIs: !editedPartyNames.has(i),
        },
        role: { value: p.role, confirmedAsIs: true },
      }));
      hasChanges = true;
    }

    return hasChanges ? data : undefined;
  }

  function toggleAction(id: string, checked: boolean) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/proposals/${proposal.id}/confirm`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedActionIds: Array.from(selectedIds),
          confirmedData: buildConfirmedData(),
        }),
      });
      if (res.ok) {
        // 将本地状态切换到 EXECUTING，轮询 useEffect 会接管并在完成后调用 onConfirmed
        setLiveProposal(prev => ({ ...prev, status: 'EXECUTING' }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/proposals/${proposal.id}/reject`, {
        method: 'PATCH',
      });
      if (res.ok) {
        onRejected?.(proposal.id);
        setCollapsed(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetry() {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/proposals/${proposal.id}/retry`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setLiveProposal(prev => ({ ...prev, status: 'EXECUTING' }));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── 折叠态 ──
  if (collapsed) {
    return (
      <div className='mt-2 flex items-center gap-2 text-xs text-gray-400 border border-gray-200 rounded-lg px-3 py-2'>
        <span>AI 建案建议</span>
        <StatusBadge status={liveProposal.status} />
        <button
          onClick={() => setCollapsed(false)}
          className='ml-auto underline hover:text-gray-600'
        >
          查看
        </button>
      </div>
    );
  }

  const parties = extracted.parties ?? [];
  const claims = extracted.claims ?? [];
  const keyDates = extracted.keyDates ?? [];

  return (
    <div className='mt-3 border border-blue-200 rounded-xl bg-blue-50 p-4 space-y-3 text-sm'>
      {/* 标题行 */}
      <div className='flex items-center justify-between'>
        <span className='font-semibold text-blue-800'>AI 识别到建案信息</span>
        <div className='flex items-center gap-2'>
          <StatusBadge status={liveProposal.status} />
          {isDone && (
            <button
              onClick={() => setCollapsed(true)}
              className='text-xs text-gray-400 hover:text-gray-600'
            >
              收起
            </button>
          )}
        </div>
      </div>

      {/* 提取的信息（支持内联编辑） */}
      <div className='bg-white rounded-lg border border-blue-100 divide-y divide-blue-50'>
        {parties.length > 0 && (
          <div className='px-3 py-2 flex gap-2'>
            <span className='text-gray-500 w-16 shrink-0 pt-0.5'>当事人</span>
            <div className='flex flex-col gap-2 flex-1'>
              {parties.map((p, i) => (
                <div key={i} className='flex items-start gap-2 relative'>
                  <div className='flex-1'>
                    <EditableField
                      label=''
                      value={`${p.name}（${p.role === 'CLIENT' ? '委托方' : p.role === 'OPPONENT' ? '对方' : p.role}）`}
                      editedValue={
                        editedPartyNames.has(i)
                          ? editedPartyNames.get(i)!
                          : null
                      }
                      confidence={p.meta.confidence}
                      sourceQuote={p.meta.sourceQuote}
                      editable={isPending && !submitting}
                      onEdit={() =>
                        setEditedPartyNames(prev =>
                          new Map(prev).set(i, p.name)
                        )
                      }
                      onReset={() =>
                        setEditedPartyNames(prev => {
                          const m = new Map(prev);
                          m.delete(i);
                          return m;
                        })
                      }
                      onChange={v =>
                        setEditedPartyNames(prev => new Map(prev).set(i, v))
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {extracted.caseType && (
          <EditableField
            label='案件类型'
            value={extracted.caseType}
            editedValue={editedCaseType}
            confidence={extracted.caseTypeMeta?.confidence ?? 1}
            sourceQuote={extracted.caseTypeMeta?.sourceQuote}
            editable={isPending && !submitting}
            onEdit={() => setEditedCaseType(extracted.caseType ?? '')}
            onReset={() => setEditedCaseType(null)}
            onChange={setEditedCaseType}
          />
        )}

        {claims.length > 0 && (
          <div className='px-3 py-2 flex gap-2'>
            <span className='text-gray-500 w-16 shrink-0'>核心诉求</span>
            <div className='flex flex-col gap-1'>
              {claims.map((c, i) => (
                <div key={i} className='flex items-center gap-1 relative'>
                  <span className='text-gray-800'>{c.text}</span>
                  {confidenceBadge(c.meta.confidence)}
                  {c.meta.sourceQuote && (
                    <SourceQuoteButton quote={c.meta.sourceQuote} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {keyDates.length > 0 && (
          <div className='px-3 py-2 flex gap-2'>
            <span className='text-gray-500 w-16 shrink-0'>关键日期</span>
            <div className='flex flex-col gap-1'>
              {keyDates.map((d, i) => (
                <div key={i} className='flex items-center gap-1 relative'>
                  <span className='text-gray-800'>
                    {d.date} · {d.description}
                  </span>
                  {confidenceBadge(d.meta.confidence)}
                  {d.meta.sourceQuote && (
                    <SourceQuoteButton quote={d.meta.sourceQuote} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 建议操作 */}
      {proposal.actions.length > 0 && (
        <div>
          <p className='text-gray-600 mb-1'>建议执行以下操作：</p>
          <div className='space-y-0.5'>
            {liveProposal.actions.map(action => (
              <ActionCheckbox
                key={action.id}
                action={action}
                checked={selectedIds.has(action.id)}
                onChange={toggleAction}
                disabled={!isPending || submitting}
              />
            ))}
          </div>
        </div>
      )}

      {/* 低置信度核实 */}
      {isPending && hasLowConfidence && (
        <div className='space-y-2'>
          <p className='text-amber-600 text-xs'>
            ⚠ 有字段置信度较低，请先核实标注 ⚠ 的内容
          </p>
          <label className='flex items-center gap-2 cursor-pointer select-none'>
            <input
              type='checkbox'
              checked={lowConfAcknowledged}
              onChange={e => setLowConfAcknowledged(e.target.checked)}
              className='h-4 w-4 rounded border-amber-400 text-amber-600'
            />
            <span className='text-xs text-amber-700'>
              我已核实以上内容，确认无误
            </span>
          </label>
        </div>
      )}

      {/* 操作按钮 */}
      {isPending && (
        <div className='flex gap-2 pt-1'>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className='flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium disabled:opacity-40 hover:bg-blue-700 transition-colors'
          >
            {submitting ? '执行中…' : '确认执行'}
          </button>
          <button
            onClick={handleReject}
            disabled={submitting}
            className='rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors'
          >
            暂不处理
          </button>
        </div>
      )}

      {isExecuting && (
        <p className='text-center text-sm text-blue-600 animate-pulse'>
          正在创建档案…
        </p>
      )}

      {liveProposal.status === 'COMPLETED' && (
        <CompletedLinks actions={liveProposal.actions} />
      )}

      {(liveProposal.status === 'FAILED' ||
        liveProposal.status === 'PARTIALLY_COMPLETED') && (
        <div className='flex items-center justify-between'>
          <p className='text-amber-600 text-xs'>
            {liveProposal.status === 'FAILED'
              ? '执行失败，可点击重试'
              : '部分操作失败，可重试或前往案件页面手动补充'}
          </p>
          <button
            onClick={handleRetry}
            disabled={submitting}
            className='text-xs px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-40 transition-colors'
          >
            {submitting ? '重试中…' : '重试失败项'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 完成态资源链接 ────────────────────────────────────────────────────────────

function CompletedLinks({ actions }: { actions: ProposalActionItem[] }) {
  const links = actions
    .filter(a => a.status === 'COMPLETED' && a.resourceId !== null)
    .flatMap(a => {
      if (a.resourceType === 'Case') {
        return [{ label: '查看案件', href: `/cases/${a.resourceId}` }];
      }
      if (a.resourceType === 'Client') {
        return [{ label: '查看客户', href: `/clients/${a.resourceId}` }];
      }
      return [];
    });

  if (links.length === 0) {
    return <p className='text-green-700 text-sm font-medium'>✓ 档案创建成功</p>;
  }

  return (
    <div className='space-y-1.5'>
      <p className='text-green-700 text-sm font-medium'>✓ 档案创建成功</p>
      <div className='flex flex-wrap gap-2'>
        {links.map((link, i) => (
          <a
            key={i}
            href={link.href}
            className='inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors'
          >
            {link.label} →
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── 独立溯源按钮（用于 claims / keyDates 等非 EditableField 行） ────────────

function SourceQuoteButton({ quote }: { quote: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className='relative'>
      <button
        onClick={() => setShow(s => !s)}
        className='text-[11px] text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded hover:bg-gray-50 transition-colors'
      >
        溯源
      </button>
      {show && <SourcePopover quote={quote} onClose={() => setShow(false)} />}
    </span>
  );
}
