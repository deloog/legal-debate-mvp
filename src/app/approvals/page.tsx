/**
 * 审批中心页面
 *
 * 功能：
 * 1. 待我审批
 *    - 展示待审批事项列表（合同审批等）
 *    - 显示审批事项信息（标题、编号、提交人、提交时间）
 *    - 通过操作：一键同意，记录审批意见
 *    - 拒绝操作：填写拒绝原因，记录审批意见
 *    - 查看详情：跳转到对应的合同详情页
 * 2. 已处理记录
 *    - 展示历史审批记录
 *    - 显示审批结果（已通过/已拒绝）
 *    - 显示审批意见（如有）
 * 3. 审批统计
 *    - 待审批数量
 *    - 今日通过数量
 *    - 今日拒绝数量
 *    - 累计处理数量
 * 4. 状态管理
 *    - 切换"待我审批"和"已处理"标签页
 *    - 自动加载审批列表和统计数据
 *    - 支持刷新数据
 *    - 成功和错误提示
 *
 * @page /approvals
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckSquare,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

// ── 类型定义 ────────────────────────────────────────────────
interface ApprovalItem {
  id: string;
  contractId?: string;
  contractTitle?: string;
  contractNo?: string;
  submittedBy?: string;
  submittedAt: string;
  type?: string;
  status: string;
  comment?: string;
}

interface ApprovalStats {
  pending: number;
  approvedToday: number;
  rejectedToday: number;
  totalHandled: number;
}

// ── 主组件 ────────────────────────────────────────────────
export default function ApprovalsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/approvals/pending');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 获取审批列表失败`);
      }
      const data = await res.json();
      if (data.success) {
        setApprovals(data.data?.approvals ?? []);
        setStats(data.data?.stats ?? null);
      } else {
        throw new Error(data.error?.message || '获取失败');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取审批列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const handleApprove = async (id: string, contractId?: string) => {
    if (!contractId) return;
    setActionLoading(id);
    try {
      const res = await fetch(`/api/contracts/${contractId}/approval/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', comment: '同意' }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 审批失败`);
      }
      const data = await res.json();
      if (data.success) {
        fetchApprovals();
      } else {
        setError(data.message || '审批失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, contractId?: string) => {
    if (!contractId) return;
    if (!rejectComment.trim()) {
      setError('请填写拒绝原因');
      return;
    }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/contracts/${contractId}/approval/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', comment: rejectComment }),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 拒绝失败`);
      }
      const data = await res.json();
      if (data.success) {
        setShowRejectDialog(null);
        setRejectComment('');
        fetchApprovals();
      } else {
        setError(data.message || '拒绝失败');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setActionLoading(null);
    }
  };

  // ── 统计卡片 ────────────────────────────────────────────────
  const StatsCard = ({
    label,
    value,
    color,
  }: {
    label: string;
    value: number;
    color: string;
  }) => (
    <div className='bg-white rounded-xl border border-zinc-200 p-4 text-center'>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className='text-xs text-zinc-500 mt-1'>{label}</div>
    </div>
  );

  return (
    <div className='min-h-screen bg-zinc-50'>
      {/* 页头 */}
      <header className='border-b border-zinc-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-5xl flex items-center gap-3'>
          <CheckSquare className='h-6 w-6 text-blue-600' />
          <h1 className='text-xl font-semibold text-zinc-900'>审批中心</h1>
        </div>
      </header>

      <main className='mx-auto max-w-5xl px-6 py-6 space-y-5'>
        {/* 错误提示 */}
        {error && (
          <div className='flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm'>
            <AlertCircle className='h-4 w-4 shrink-0' /> {error}
            <button
              onClick={() => setError(null)}
              className='ml-auto text-red-400 hover:text-red-600'
            >
              ✕
            </button>
          </div>
        )}

        {/* 统计 */}
        {stats && (
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
            <StatsCard
              label='待审批'
              value={stats.pending}
              color='text-yellow-600'
            />
            <StatsCard
              label='今日通过'
              value={stats.approvedToday}
              color='text-green-600'
            />
            <StatsCard
              label='今日拒绝'
              value={stats.rejectedToday}
              color='text-red-500'
            />
            <StatsCard
              label='累计处理'
              value={stats.totalHandled}
              color='text-blue-600'
            />
          </div>
        )}

        {/* Tabs */}
        <div className='flex gap-1 bg-zinc-100 rounded-xl p-1 w-fit'>
          {(['pending', 'history'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              {t === 'pending' ? '待我审批' : '已处理'}
            </button>
          ))}
        </div>

        {/* 内容 */}
        {loading ? (
          <div className='space-y-3'>
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className='bg-white rounded-xl border border-zinc-200 p-5 animate-pulse'
              >
                <div className='h-4 bg-zinc-200 rounded w-1/2 mb-3' />
                <div className='h-3 bg-zinc-100 rounded w-1/3' />
              </div>
            ))}
          </div>
        ) : approvals.length === 0 ? (
          <div className='bg-white rounded-xl border border-zinc-200 p-12 text-center'>
            <CheckCircle className='h-12 w-12 text-zinc-300 mx-auto mb-4' />
            <p className='text-zinc-500 font-medium'>
              {tab === 'pending' ? '暂无待审批事项' : '暂无历史记录'}
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            {approvals.map(item => (
              <div
                key={item.id}
                className='bg-white rounded-xl border border-zinc-200 p-5'
              >
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2 mb-1'>
                      <FileText className='h-4 w-4 text-zinc-400 shrink-0' />
                      <h3 className='font-medium text-zinc-900 truncate'>
                        {item.contractTitle ?? '合同审批'}
                      </h3>
                    </div>
                    <div className='flex items-center gap-3 text-xs text-zinc-500 flex-wrap'>
                      {item.contractNo && (
                        <span>合同编号：{item.contractNo}</span>
                      )}
                      {item.submittedBy && (
                        <span>提交人：{item.submittedBy}</span>
                      )}
                      <span className='flex items-center gap-1'>
                        <Clock className='h-3 w-3' />
                        {new Date(item.submittedAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>

                  {tab === 'pending' ? (
                    <div className='flex items-center gap-2 shrink-0'>
                      <button
                        onClick={() => handleApprove(item.id, item.contractId)}
                        disabled={actionLoading === item.id}
                        className='flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50'
                      >
                        <CheckCircle className='h-3.5 w-3.5' /> 通过
                      </button>
                      <button
                        onClick={() => setShowRejectDialog(item.id)}
                        disabled={actionLoading === item.id}
                        className='flex items-center gap-1 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 disabled:opacity-50'
                      >
                        <XCircle className='h-3.5 w-3.5' /> 拒绝
                      </button>
                      {item.contractId && (
                        <button
                          onClick={() =>
                            router.push(`/contracts/${item.contractId}`)
                          }
                          className='flex items-center gap-1 px-3 py-1.5 border border-zinc-300 text-zinc-600 rounded-lg text-sm hover:bg-zinc-50'
                        >
                          详情 <ChevronRight className='h-3.5 w-3.5' />
                        </button>
                      )}
                    </div>
                  ) : (
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${item.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}
                    >
                      {item.status === 'APPROVED' ? '已通过' : '已拒绝'}
                    </span>
                  )}
                </div>

                {/* 拒绝对话框 */}
                {showRejectDialog === item.id && (
                  <div className='mt-4 pt-4 border-t border-zinc-100'>
                    <label className='block text-sm font-medium text-zinc-700 mb-2'>
                      拒绝原因
                    </label>
                    <textarea
                      value={rejectComment}
                      onChange={e => setRejectComment(e.target.value)}
                      placeholder='请说明拒绝原因...'
                      rows={3}
                      className='w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-500'
                    />
                    <div className='flex gap-2 mt-2 justify-end'>
                      <button
                        onClick={() => {
                          setShowRejectDialog(null);
                          setRejectComment('');
                        }}
                        className='px-3 py-1.5 border border-zinc-300 rounded-lg text-sm text-zinc-600 hover:bg-zinc-50'
                      >
                        取消
                      </button>
                      <button
                        onClick={() => handleReject(item.id, item.contractId)}
                        disabled={actionLoading === item.id}
                        className='px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50'
                      >
                        确认拒绝
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
