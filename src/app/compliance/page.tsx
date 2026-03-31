/**
 * 合规管理页面
 * 企业法务合规管理功能
 */

'use client';

import _React, { useState, useEffect, useRef } from 'react';
import type {
  ComplianceDashboard,
  ComplianceChecklist,
  ComplianceCheckItem,
  ComplianceReport,
} from '@/types/compliance';
import {
  ComplianceCheckStatus,
  CompliancePriority,
  getComplianceStatusLabel,
  getComplianceStatusColor,
  getComplianceCategoryLabel,
  getCompliancePriorityLabel,
} from '@/types/compliance';

type TabType = 'dashboard' | 'checklist' | 'report';

// ─── 状态操作弹窗 ────────────────────────────────────────────────────────────

interface StatusDialogState {
  checklistId: string;
  itemId: string;
  itemTitle: string;
  status: ComplianceCheckStatus;
}

function StatusDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: StatusDialogState;
  onConfirm: (notes: string) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const statusLabels: Record<ComplianceCheckStatus, string> = {
    [ComplianceCheckStatus.PASSED]: '通过',
    [ComplianceCheckStatus.FAILED]: '未通过',
    [ComplianceCheckStatus.WARNING]: '警告',
    [ComplianceCheckStatus.PENDING]: '待检查',
  };

  const statusColors: Record<ComplianceCheckStatus, string> = {
    [ComplianceCheckStatus.PASSED]: 'bg-green-600',
    [ComplianceCheckStatus.FAILED]: 'bg-red-600',
    [ComplianceCheckStatus.WARNING]: 'bg-yellow-500',
    [ComplianceCheckStatus.PENDING]: 'bg-gray-500',
  };

  return (
    <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50'>
      <div className='bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4'>
        <h3 className='font-semibold text-lg mb-2'>标记检查结果</h3>
        <p className='text-sm text-gray-600 mb-4'>{state.itemTitle}</p>
        <div className='mb-4'>
          <span
            className={`inline-block px-3 py-1 rounded text-white text-sm ${statusColors[state.status]}`}
          >
            {statusLabels[state.status]}
          </span>
        </div>
        <label className='block text-sm font-medium text-gray-700 mb-1'>
          备注（可选）
        </label>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder='填写检查说明、问题描述或整改建议...'
          rows={3}
          className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
        <div className='flex justify-end gap-3 mt-4'>
          <button
            onClick={onCancel}
            className='px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50'
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(notes)}
            className={`px-4 py-2 text-sm text-white rounded-md ${statusColors[state.status]} hover:opacity-90`}
          >
            确认标记为{statusLabels[state.status]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 检查项操作按钮 ──────────────────────────────────────────────────────────

function CheckItemActions({
  item,
  checklistId,
  onUpdate,
}: {
  item: ComplianceCheckItem;
  checklistId: string;
  onUpdate: (
    checklistId: string,
    itemId: string,
    status: ComplianceCheckStatus,
    notes?: string
  ) => Promise<void>;
}) {
  const [dialog, setDialog] = useState<StatusDialogState | null>(null);

  const requestStatus = (status: ComplianceCheckStatus) => {
    setDialog({ checklistId, itemId: item.id, itemTitle: item.title, status });
  };

  const handleConfirm = async (notes: string) => {
    if (!dialog) return;
    await onUpdate(
      dialog.checklistId,
      dialog.itemId,
      dialog.status,
      notes || undefined
    );
    setDialog(null);
  };

  return (
    <>
      {dialog && (
        <StatusDialog
          state={dialog}
          onConfirm={handleConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
      <div className='flex items-center gap-1 flex-shrink-0'>
        {item.status !== ComplianceCheckStatus.PASSED && (
          <button
            onClick={() => requestStatus(ComplianceCheckStatus.PASSED)}
            className='px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 whitespace-nowrap'
          >
            通过
          </button>
        )}
        {item.status !== ComplianceCheckStatus.WARNING && (
          <button
            onClick={() => requestStatus(ComplianceCheckStatus.WARNING)}
            className='px-2 py-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600 whitespace-nowrap'
          >
            警告
          </button>
        )}
        {item.status !== ComplianceCheckStatus.FAILED && (
          <button
            onClick={() => requestStatus(ComplianceCheckStatus.FAILED)}
            className='px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 whitespace-nowrap'
          >
            未通过
          </button>
        )}
        {item.status !== ComplianceCheckStatus.PENDING && (
          <button
            onClick={() => requestStatus(ComplianceCheckStatus.PENDING)}
            className='px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500 whitespace-nowrap'
          >
            重置
          </button>
        )}
      </div>
    </>
  );
}

// ─── 进度条 ──────────────────────────────────────────────────────────────────

function ProgressBar({
  rate,
  color = 'bg-blue-600',
}: {
  rate: number;
  color?: string;
}) {
  return (
    <div className='bg-gray-200 rounded-full h-2 mt-1'>
      <div
        className={`${color} rounded-full h-2 transition-all duration-500`}
        style={{ width: `${Math.min(100, rate)}%` }}
      />
    </div>
  );
}

// ─── 主页面组件 ─────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [checklists, setChecklists] = useState<ComplianceChecklist[]>([]);
  const [report, setReport] = useState<ComplianceReport | null>(null);

  // 是否为非企业用户（仪表盘数据全零且无问题）
  const isNonEnterprise =
    dashboard !== null &&
    dashboard.overallScore === 0 &&
    dashboard.statistics.totalChecks === 0 &&
    dashboard.recentIssues.length === 0;

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compliance/dashboard');
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || '加载失败');
      setDashboard(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadChecklists = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compliance/checklist');
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || '加载失败');
      setChecklists(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/compliance/report');
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || '加载失败');
      setReport(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const updateCheckItem = async (
    checklistId: string,
    itemId: string,
    status: ComplianceCheckStatus,
    notes?: string
  ) => {
    try {
      const res = await fetch('/api/compliance/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistId, itemId, status, notes }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || '更新失败');
      await loadChecklists();
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'dashboard' && !dashboard) loadDashboard();
    else if (tab === 'checklist' && checklists.length === 0) loadChecklists();
    else if (tab === 'report' && !report) loadReport();
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // 统计检查清单各状态数量
  const checklistStats = checklists.reduce(
    (acc, cl) => {
      cl.items.forEach(item => {
        acc.total++;
        if (item.status === ComplianceCheckStatus.PASSED) acc.passed++;
        else if (item.status === ComplianceCheckStatus.FAILED) acc.failed++;
        else if (item.status === ComplianceCheckStatus.WARNING) acc.warning++;
        else acc.pending++;
      });
      return acc;
    },
    { total: 0, passed: 0, failed: 0, warning: 0, pending: 0 }
  );

  const nonEnterpriseNotice = (
    <div className='bg-amber-50 border border-amber-200 rounded-lg p-6 text-center'>
      <div className='text-4xl mb-3'>🏢</div>
      <h3 className='text-lg font-semibold text-amber-800 mb-2'>
        此功能仅限企业用户
      </h3>
      <p className='text-sm text-amber-700'>
        合规管理功能专为企业法务团队设计，需要完成企业认证后方可使用。
      </p>
      <p className='text-sm text-amber-700 mt-1'>
        请联系管理员或前往&quot;企业认证&quot;完成资质认证。
      </p>
    </div>
  );

  return (
    <div className='container mx-auto px-4 py-8'>
      <h1 className='text-3xl font-bold mb-8'>合规管理</h1>

      {/* 标签页 */}
      <div className='flex gap-4 mb-6 border-b'>
        {(['dashboard', 'checklist', 'report'] as TabType[]).map(tab => (
          <button
            key={tab}
            onClick={() => handleTabChange(tab)}
            className={`px-4 py-2 font-medium ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'dashboard'
              ? '合规仪表盘'
              : tab === 'checklist'
                ? '检查清单'
                : '合规报告'}
          </button>
        ))}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6'>
          {error}
          <button
            onClick={() => setError(null)}
            className='float-right text-red-400 hover:text-red-600'
          >
            ✕
          </button>
        </div>
      )}

      {/* 加载状态 */}
      {loading && (
        <div className='text-center py-12'>
          <div className='inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3' />
          <div className='text-gray-600'>加载中...</div>
        </div>
      )}

      {/* ── 合规仪表盘 ── */}
      {!loading && activeTab === 'dashboard' && (
        <>
          {isNonEnterprise
            ? nonEnterpriseNotice
            : dashboard && (
                <div className='space-y-6'>
                  {/* 总体评分 */}
                  <div className='bg-white rounded-lg shadow p-6'>
                    <h2 className='text-xl font-semibold mb-4'>总体合规评分</h2>
                    <div className='flex items-center gap-6'>
                      <div
                        className={`text-6xl font-bold ${
                          dashboard.overallScore >= 80
                            ? 'text-green-600'
                            : dashboard.overallScore >= 60
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {dashboard.overallScore}
                      </div>
                      <div>
                        <div className='text-sm text-gray-500'>满分100分</div>
                        <div className='text-sm mt-1'>
                          趋势:{' '}
                          <span
                            className={
                              dashboard.trend === 'up'
                                ? 'text-green-600 font-medium'
                                : dashboard.trend === 'down'
                                  ? 'text-red-600 font-medium'
                                  : 'text-gray-600'
                            }
                          >
                            {dashboard.trend === 'up'
                              ? '↑ 上升'
                              : dashboard.trend === 'down'
                                ? '↓ 下降'
                                : '→ 稳定'}
                          </span>
                        </div>
                        {dashboard.statistics.pendingChecks > 0 && (
                          <div className='text-sm text-amber-600 mt-1'>
                            ⚠ 还有 {dashboard.statistics.pendingChecks}{' '}
                            项待完成自查
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 统计信息 */}
                  <div className='bg-white rounded-lg shadow p-6'>
                    <h2 className='text-xl font-semibold mb-4'>统计概览</h2>
                    <div className='grid grid-cols-5 gap-4'>
                      {[
                        {
                          label: '总检查项',
                          value: dashboard.statistics.totalChecks,
                          color: 'text-gray-900',
                        },
                        {
                          label: '已通过',
                          value: dashboard.statistics.passedChecks,
                          color: 'text-green-600',
                        },
                        {
                          label: '未通过',
                          value: dashboard.statistics.failedChecks,
                          color: 'text-red-600',
                        },
                        {
                          label: '警告',
                          value: dashboard.statistics.warningChecks,
                          color: 'text-yellow-600',
                        },
                        {
                          label: '待检查',
                          value: dashboard.statistics.pendingChecks,
                          color: 'text-gray-500',
                        },
                      ].map(stat => (
                        <div key={stat.label} className='text-center'>
                          <div className={`text-3xl font-bold ${stat.color}`}>
                            {stat.value}
                          </div>
                          <div className='text-sm text-gray-600 mt-1'>
                            {stat.label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 各类别评分 */}
                  <div className='bg-white rounded-lg shadow p-6'>
                    <h2 className='text-xl font-semibold mb-4'>各类别评分</h2>
                    <div className='space-y-4'>
                      {Object.entries(dashboard.categoryScores).map(
                        ([category, score]) => (
                          <div key={category}>
                            <div className='flex justify-between text-sm mb-1'>
                              <span className='font-medium'>
                                {getComplianceCategoryLabel(category as never)}
                              </span>
                              <span
                                className={
                                  score >= 80
                                    ? 'text-green-600'
                                    : score >= 60
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                }
                              >
                                {score} 分
                              </span>
                            </div>
                            <ProgressBar
                              rate={score}
                              color={
                                score >= 80
                                  ? 'bg-green-500'
                                  : score >= 60
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* 最近合规问题 */}
                  {dashboard.recentIssues.length > 0 && (
                    <div className='bg-white rounded-lg shadow p-6'>
                      <h2 className='text-xl font-semibold mb-4'>
                        最近合规问题
                      </h2>
                      <div className='space-y-3'>
                        {dashboard.recentIssues.map(issue => (
                          <div key={issue.id} className='border rounded-md p-4'>
                            <div className='flex justify-between items-start mb-2'>
                              <h3 className='font-semibold'>{issue.title}</h3>
                              <span
                                className={`px-2 py-1 rounded text-sm ${
                                  issue.severity === CompliancePriority.CRITICAL
                                    ? 'bg-red-100 text-red-700'
                                    : issue.severity === CompliancePriority.HIGH
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-yellow-100 text-yellow-700'
                                }`}
                              >
                                {getCompliancePriorityLabel(issue.severity)}
                              </span>
                            </div>
                            <p className='text-sm text-gray-600'>
                              {issue.description}
                            </p>
                            <div className='text-xs text-gray-400 mt-2'>
                              状态:{' '}
                              {issue.status === 'open'
                                ? '待处理'
                                : issue.status === 'in_progress'
                                  ? '处理中'
                                  : '已解决'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 即将到期的任务 */}
                  {dashboard.upcomingDeadlines.length > 0 && (
                    <div className='bg-white rounded-lg shadow p-6'>
                      <h2 className='text-xl font-semibold mb-4'>
                        即将到期的任务
                      </h2>
                      <div className='space-y-3'>
                        {dashboard.upcomingDeadlines.map(deadline => (
                          <div
                            key={deadline.id}
                            className='flex justify-between items-center border-b pb-3 last:border-0 last:pb-0'
                          >
                            <div>
                              <div className='font-medium'>
                                {deadline.title}
                              </div>
                              <div className='text-sm text-gray-500'>
                                截止日期:{' '}
                                {new Date(deadline.dueDate).toLocaleDateString(
                                  'zh-CN'
                                )}
                              </div>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-sm ${
                                deadline.priority ===
                                  CompliancePriority.CRITICAL ||
                                deadline.priority === CompliancePriority.HIGH
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}
                            >
                              {getCompliancePriorityLabel(deadline.priority)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
        </>
      )}

      {/* ── 检查清单 ── */}
      {!loading && activeTab === 'checklist' && (
        <>
          {checklists.length === 0 ? (
            <div className='text-center py-12 text-gray-500'>
              <div className='text-4xl mb-3'>📋</div>
              <p className='font-medium'>暂无检查清单</p>
              <p className='text-sm mt-1'>需要企业账号才能访问合规检查清单。</p>
            </div>
          ) : (
            <div className='space-y-4'>
              {/* 整体进度 */}
              <div className='bg-blue-50 border border-blue-200 rounded-lg p-4'>
                <div className='flex items-center justify-between mb-2'>
                  <span className='font-medium text-blue-800'>
                    整体完成进度
                  </span>
                  <span className='text-blue-800 font-bold'>
                    {checklistStats.total > 0
                      ? Math.round(
                          ((checklistStats.passed + checklistStats.warning) /
                            checklistStats.total) *
                            100
                        )
                      : 0}
                    %
                  </span>
                </div>
                <ProgressBar
                  rate={
                    checklistStats.total > 0
                      ? ((checklistStats.passed + checklistStats.warning) /
                          checklistStats.total) *
                        100
                      : 0
                  }
                  color='bg-blue-600'
                />
                <div className='flex gap-4 text-xs text-gray-600 mt-2'>
                  <span className='text-green-600'>
                    通过 {checklistStats.passed}
                  </span>
                  <span className='text-yellow-600'>
                    警告 {checklistStats.warning}
                  </span>
                  <span className='text-red-600'>
                    未通过 {checklistStats.failed}
                  </span>
                  <span className='text-gray-500'>
                    待检查 {checklistStats.pending}
                  </span>
                </div>
                {checklistStats.pending > 0 && (
                  <p className='text-xs text-blue-700 mt-2'>
                    还有 {checklistStats.pending}{' '}
                    项尚未检查，请逐条完成自查并标记结果。
                  </p>
                )}
              </div>

              {/* 按清单展示 */}
              {checklists.map(checklist => (
                <div key={checklist.id} className='bg-white rounded-lg shadow'>
                  {/* 清单头部 */}
                  <div className='flex justify-between items-start p-5 border-b'>
                    <div>
                      <h2 className='text-lg font-semibold'>
                        {checklist.name}
                      </h2>
                      {checklist.description && (
                        <p className='text-sm text-gray-500 mt-1'>
                          {checklist.description}
                        </p>
                      )}
                      <div className='text-xs text-gray-400 mt-1'>
                        {getComplianceCategoryLabel(
                          checklist.category as never
                        )}
                      </div>
                    </div>
                    <div className='text-right ml-4'>
                      <div className='text-2xl font-bold text-blue-600'>
                        {checklist.completionRate}%
                      </div>
                      <div className='text-xs text-gray-500'>完成率</div>
                      <div className='text-xs text-gray-400 mt-1'>
                        {checklist.items.length} 项
                      </div>
                    </div>
                  </div>

                  {/* 检查项列表 */}
                  <div className='divide-y'>
                    {checklist.items.map(item => (
                      <div key={item.id} className='p-4'>
                        <div className='flex justify-between items-start gap-4'>
                          <div className='flex-1 min-w-0'>
                            <div className='flex items-start gap-2'>
                              <span
                                className='inline-block px-2 py-0.5 rounded text-xs mt-0.5 flex-shrink-0'
                                style={{
                                  backgroundColor: `${getComplianceStatusColor(item.status)}20`,
                                  color: getComplianceStatusColor(item.status),
                                }}
                              >
                                {getComplianceStatusLabel(item.status)}
                              </span>
                              <h3 className='text-sm font-medium'>
                                {item.title}
                              </h3>
                            </div>
                            {item.description && (
                              <p className='text-xs text-gray-500 mt-1 ml-14'>
                                {item.description}
                              </p>
                            )}
                            {item.notes && (
                              <div className='mt-1 ml-14 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1'>
                                备注: {item.notes}
                              </div>
                            )}
                            {item.completedDate && (
                              <div className='text-xs text-gray-400 mt-1 ml-14'>
                                标记时间:{' '}
                                {new Date(item.completedDate).toLocaleString(
                                  'zh-CN'
                                )}
                              </div>
                            )}
                          </div>
                          <CheckItemActions
                            item={item}
                            checklistId={checklist.id}
                            onUpdate={updateCheckItem}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── 合规报告 ── */}
      {!loading && activeTab === 'report' && report && (
        <div className='space-y-6'>
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>{report.title}</h2>
            <div className='grid grid-cols-2 gap-4 mb-4'>
              <div>
                <div className='text-sm text-gray-500'>报告日期</div>
                <div className='font-medium'>
                  {new Date(report.reportDate).toLocaleDateString('zh-CN')}
                </div>
              </div>
              <div>
                <div className='text-sm text-gray-500'>报告期间</div>
                <div className='font-medium'>
                  {new Date(report.period.startDate).toLocaleDateString(
                    'zh-CN'
                  )}{' '}
                  -{' '}
                  {new Date(report.period.endDate).toLocaleDateString('zh-CN')}
                </div>
              </div>
            </div>
            <div className='mb-4'>
              <div className='text-sm text-gray-500 mb-1'>总体评分</div>
              <div
                className={`text-5xl font-bold ${
                  report.overallScore >= 80
                    ? 'text-green-600'
                    : report.overallScore >= 60
                      ? 'text-yellow-600'
                      : 'text-red-600'
                }`}
              >
                {report.overallScore}
              </div>
            </div>
            <div>
              <div className='text-sm text-gray-500 mb-1'>摘要</div>
              <p className='text-gray-700'>{report.summary}</p>
            </div>
          </div>

          {/* 统计信息 */}
          <div className='bg-white rounded-lg shadow p-6'>
            <h2 className='text-xl font-semibold mb-4'>统计信息</h2>
            <div className='grid grid-cols-5 gap-4'>
              {[
                {
                  label: '总检查项',
                  value: report.statistics.totalChecks,
                  color: 'text-gray-900',
                },
                {
                  label: '已通过',
                  value: report.statistics.passedChecks,
                  color: 'text-green-600',
                },
                {
                  label: '未通过',
                  value: report.statistics.failedChecks,
                  color: 'text-red-600',
                },
                {
                  label: '警告',
                  value: report.statistics.warningChecks,
                  color: 'text-yellow-600',
                },
                {
                  label: '待检查',
                  value: report.statistics.pendingChecks,
                  color: 'text-gray-500',
                },
              ].map(stat => (
                <div key={stat.label} className='text-center'>
                  <div className={`text-3xl font-bold ${stat.color}`}>
                    {stat.value}
                  </div>
                  <div className='text-sm text-gray-600 mt-1'>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 合规问题 */}
          {report.issues.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>合规问题</h2>
              <div className='space-y-3'>
                {report.issues.map(issue => (
                  <div key={issue.id} className='border rounded-md p-4'>
                    <div className='flex justify-between items-start mb-2'>
                      <h3 className='font-semibold'>{issue.title}</h3>
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          issue.severity === CompliancePriority.CRITICAL ||
                          issue.severity === CompliancePriority.HIGH
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {getCompliancePriorityLabel(issue.severity)}
                      </span>
                    </div>
                    <p className='text-sm text-gray-600 mb-2'>
                      {issue.description}
                    </p>
                    {issue.recommendations.length > 0 && (
                      <div className='mt-2'>
                        <div className='text-sm font-medium mb-1'>建议:</div>
                        <ul className='list-disc list-inside text-sm text-gray-600 space-y-1'>
                          {issue.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 改进建议 */}
          {report.recommendations.length > 0 && (
            <div className='bg-white rounded-lg shadow p-6'>
              <h2 className='text-xl font-semibold mb-4'>改进建议</h2>
              <ul className='space-y-2 text-gray-700'>
                {report.recommendations.map((rec, idx) => (
                  <li key={idx} className='flex items-start gap-2'>
                    <span className='text-blue-500 mt-0.5'>→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
