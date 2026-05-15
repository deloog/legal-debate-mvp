'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface WorkflowStatus {
  documentsTotal: number;
  documentsCompleted: number;
  hasExtraction: boolean;
  extractionGeneratedAt: string | null;
  hasRiskAssessment: boolean;
  riskAssessedAt: string | null;
  hasDebate: boolean;
  debateId: string | null;
  hasValidPackageReview: boolean;
  packageReviewValidity: 'none' | 'valid' | 'stale';
  nextStep:
    | 'upload'
    | 'wait_analysis'
    | 'extraction'
    | 'risk'
    | 'debate'
    | 'package'
    | 'done';
}

type StepState = 'done' | 'active' | 'pending';

interface Step {
  label: string;
  detail: (s: WorkflowStatus) => string;
  state: (s: WorkflowStatus) => StepState;
  action?: {
    label: string;
    visible: (s: WorkflowStatus) => boolean;
    onClick: (
      caseId: string,
      s: WorkflowStatus,
      callbacks: StepCallbacks
    ) => void;
  };
}

interface StepCallbacks {
  router: ReturnType<typeof useRouter>;
  onSwitchToDocuments: () => void;
  onTriggerExtraction: () => void;
  onTriggerRisk: () => void;
  onStartDebate: () => void;
}

const STEPS: Step[] = [
  {
    label: '上传卷宗',
    detail: s =>
      s.documentsTotal === 0
        ? '尚未上传任何材料'
        : `已上传 ${s.documentsTotal} 份，已完成分析 ${s.documentsCompleted} 份`,
    state: s => {
      if (s.documentsCompleted > 0) return 'done';
      if (s.documentsTotal > 0) return 'active';
      return 'pending';
    },
    action: {
      label: '上传文档',
      visible: s => s.documentsTotal === 0,
      onClick: (_caseId, _s, cb) => cb.onSwitchToDocuments(),
    },
  },
  {
    label: '案件提炼',
    detail: s =>
      s.hasExtraction
        ? `已完成${s.extractionGeneratedAt ? '（' + new Date(s.extractionGeneratedAt).toLocaleString('zh-CN') + '）' : ''}`
        : s.documentsCompleted > 0
          ? '材料就绪，可触发提炼'
          : '需要先完成文档分析',
    state: s => {
      if (s.hasExtraction) return 'done';
      if (s.documentsCompleted > 0) return 'active';
      return 'pending';
    },
    action: {
      label: '生成案件摘要',
      visible: s => !s.hasExtraction && s.documentsCompleted > 0,
      onClick: (_caseId, _s, cb) => cb.onTriggerExtraction(),
    },
  },
  {
    label: '风险评估',
    detail: s =>
      s.hasRiskAssessment
        ? `已完成${s.riskAssessedAt ? '（' + new Date(s.riskAssessedAt).toLocaleString('zh-CN') + '）' : ''}`
        : s.hasExtraction
          ? '案件提炼就绪，可生成风险评估'
          : '需要先完成案件提炼',
    state: s => {
      if (s.hasRiskAssessment) return 'done';
      if (s.hasExtraction) return 'active';
      return 'pending';
    },
    action: {
      label: '生成风险评估',
      visible: s => !s.hasRiskAssessment && s.hasExtraction,
      onClick: (_caseId, _s, cb) => cb.onTriggerRisk(),
    },
  },
  {
    label: '辩论推演',
    detail: s =>
      s.hasDebate
        ? '辩论已创建，可继续生成轮次'
        : s.hasRiskAssessment
          ? '可开始模拟法庭辩论'
          : '建议先完成风险评估再开始辩论',
    state: s => {
      if (s.hasDebate) return 'done';
      if (s.hasRiskAssessment) return 'active';
      return 'pending';
    },
    action: {
      label: s => (s.hasDebate ? '进入辩论' : '创建初始辩论'),
      visible: () => true,
      onClick: (_caseId, _s, cb) => cb.onStartDebate(),
    },
  },
  {
    label: '整案交付包',
    detail: s => {
      if (s.packageReviewValidity === 'valid')
        return '复核已通过，内容与提交时一致';
      if (s.packageReviewValidity === 'stale') return '内容已变更，需重新复核';
      if (s.hasDebate) return '可生成并提交整案交付包';
      return '需要先完成辩论推演';
    },
    state: s => {
      if (s.hasValidPackageReview) return 'done';
      if (s.hasDebate || s.hasExtraction) return 'active';
      return 'pending';
    },
    action: {
      label: '打开整案交付包',
      visible: s => s.hasDebate || s.hasExtraction,
      onClick: (caseId, _s, cb) => cb.router.push(`/cases/${caseId}/package`),
    },
  },
];

const stateStyles: Record<
  StepState,
  { icon: string; badge: string; circle: string }
> = {
  done: {
    icon: '✓',
    badge:
      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
    circle: 'bg-green-500 text-white dark:bg-green-600',
  },
  active: {
    icon: '→',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
    circle: 'bg-blue-500 text-white dark:bg-blue-600',
  },
  pending: {
    icon: '○',
    badge: 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500',
    circle: 'bg-gray-200 text-gray-500 dark:bg-zinc-700 dark:text-zinc-400',
  },
};

interface WorkflowPanelProps {
  caseId: string;
  onSwitchToDocuments: () => void;
  onStartDebate: () => void;
}

export function WorkflowPanel({
  caseId,
  onSwitchToDocuments,
  onStartDebate,
}: WorkflowPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/workflow-status`);
      if (!res.ok) {
        setLoadError(
          res.status === 404 ? '案件不存在' : '加载进度失败，请重试'
        );
        return;
      }
      const data = (await res.json()) as {
        success: boolean;
        data: WorkflowStatus;
      };
      if (data.success) setStatus(data.data);
      else setLoadError('加载进度失败，请重试');
    } catch {
      setLoadError('网络错误，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleTriggerExtraction = useCallback(async () => {
    setActionLoading('extraction');
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        showMessage('案件提炼完成', 'success');
        await loadStatus();
      } else {
        showMessage(data.error ?? '提炼失败，请稍后重试', 'error');
      }
    } catch {
      showMessage('网络错误，请稍后重试', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [caseId, loadStatus]);

  const handleTriggerRisk = useCallback(async () => {
    setActionLoading('risk');
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/assess`, {
        method: 'POST',
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        showMessage('风险评估完成', 'success');
        await loadStatus();
      } else {
        showMessage(data.error ?? '风险评估失败，请稍后重试', 'error');
      }
    } catch {
      showMessage('网络错误，请稍后重试', 'error');
    } finally {
      setActionLoading(null);
    }
  }, [caseId, loadStatus]);

  const callbacks: StepCallbacks = {
    router,
    onSwitchToDocuments,
    onTriggerExtraction: handleTriggerExtraction,
    onTriggerRisk: handleTriggerRisk,
    onStartDebate,
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>办案进度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='space-y-3 animate-pulse'>
            {[1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className='h-12 rounded bg-gray-100 dark:bg-zinc-800'
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>办案进度</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-between rounded-md bg-red-50 px-3 py-2.5 dark:bg-red-900/20'>
            <p className='text-sm text-red-600 dark:text-red-400'>
              {loadError}
            </p>
            <button
              onClick={() => {
                setLoading(true);
                void loadStatus();
              }}
              className='ml-3 shrink-0 text-xs font-medium text-red-600 underline hover:text-red-800 dark:text-red-400'
            >
              重试
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!status) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center justify-between'>
          <span>办案进度</span>
          <button
            onClick={() => void loadStatus()}
            className='text-xs text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300'
          >
            刷新
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {message && (
          <div
            className={`mb-4 rounded-md px-3 py-2 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}
          >
            {message.text}
          </div>
        )}

        <ol className='space-y-3'>
          {STEPS.map((step, idx) => {
            const state = step.state(status);
            const styles = stateStyles[state];
            const actionLabel =
              typeof step.action?.label === 'function'
                ? step.action.label(status)
                : step.action?.label;
            const showAction = step.action?.visible(status) ?? false;
            const isLoadingAction =
              (idx === 1 && actionLoading === 'extraction') ||
              (idx === 2 && actionLoading === 'risk');

            return (
              <li
                key={idx}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  state === 'active'
                    ? 'bg-blue-50/60 dark:bg-blue-900/10'
                    : 'bg-transparent'
                }`}
              >
                {/* 步骤序号 */}
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${styles.circle}`}
                >
                  {state === 'done' ? '✓' : idx + 1}
                </span>

                {/* 步骤信息 */}
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium text-gray-900 dark:text-zinc-100'>
                      {step.label}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${styles.badge}`}
                    >
                      {state === 'done'
                        ? '已完成'
                        : state === 'active'
                          ? '待操作'
                          : '未开始'}
                    </span>
                  </div>
                  <p className='mt-0.5 text-xs text-gray-500 dark:text-zinc-400'>
                    {step.detail(status)}
                  </p>
                </div>

                {/* 操作按钮 */}
                {showAction && actionLabel && (
                  <Button
                    size='sm'
                    variant={state === 'active' ? 'primary' : 'outline'}
                    disabled={isLoadingAction}
                    onClick={() =>
                      step.action!.onClick(caseId, status, callbacks)
                    }
                    className='shrink-0'
                  >
                    {isLoadingAction ? '处理中...' : actionLabel}
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
