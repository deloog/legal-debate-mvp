'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// ── 类型 ──────────────────────────────────────────────────────────────────────

type SectionKey =
  | 's1_case_summary'
  | 's2_dispute_focus'
  | 's3_argument_analysis'
  | 's4_evidence'
  | 's5_risk_assessment'
  | 's6_expert_opinion'
  | 's7_ai_declaration';

type Tier = 'primary' | 'enhanced' | 'fallback' | 'none';

interface SectionInfo {
  tier: Tier;
  available: boolean;
  data: unknown;
}

interface PreviewData {
  caseId: string;
  templateVersion: string;
  sections: Partial<Record<SectionKey, SectionInfo>>;
  meta: { totalAvailable: number; totalSections: number };
}

interface ReviewRecord {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  reviewNotes: string | null;
}

// ── 章节定义（产品固定顺序）─────────────────────────────────────────────────

const SECTION_DEFS: { key: SectionKey; label: string; description: string }[] =
  [
    {
      key: 's1_case_summary',
      label: '§1 案情摘要',
      description: '案件基本信息、涉案金额、已确认事实与存疑事实',
    },
    {
      key: 's2_dispute_focus',
      label: '§2 争议焦点',
      description: '法律争议焦点、核心争议、待厘清问题',
    },
    {
      key: 's3_argument_analysis',
      label: '§3 论点分析',
      description: '双方论点列表及对应法律依据',
    },
    {
      key: 's4_evidence',
      label: '§4 证据清单',
      description: '证据清单、状态及相关度评分（取前20份）',
    },
    {
      key: 's5_risk_assessment',
      label: '§5 风险评估',
      description: '胜诉概率、风险等级、AI主要风险点',
    },
    {
      key: 's6_expert_opinion',
      label: '§6 专业意见',
      description: '律师综合判断与建议、双方优劣分析',
    },
    {
      key: 's7_ai_declaration',
      label: '§7 AI声明',
      description: '本文档由 AI 辅助声明及律师复核状态说明',
    },
  ];

const TIER_BADGE: Record<Tier, { label: string; className: string }> = {
  primary: {
    label: '数据完整',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  enhanced: {
    label: '数据充实',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  fallback: {
    label: '部分数据',
    className:
      'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  none: {
    label: '暂无数据',
    className: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400',
  },
};

const REVIEW_STATUS_LABEL: Record<string, string> = {
  PENDING: '待审批',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};

// ── 页面 ───────────────────────────────────────────────────────────────────────

export default function PackageComposerPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = typeof params?.id === 'string' ? params.id : '';
  const [caseTitle, setCaseTitle] = useState('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [latestReview, setLatestReview] = useState<ReviewRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 选中章节集合，默认全选
  const [selected, setSelected] = useState<Set<SectionKey>>(
    () => new Set(SECTION_DEFS.map(d => d.key))
  );

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  // ── 数据加载 ───────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!caseId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [caseRes, previewRes, reviewRes] = await Promise.all([
        fetch(`/api/v1/cases/${caseId}`),
        fetch(`/api/v1/cases/${caseId}/package/preview`),
        fetch(`/api/v1/cases/${caseId}/package/review/latest`),
      ]);

      if (caseRes.ok) {
        const caseJson = (await caseRes.json()) as { data: { title: string } };
        setCaseTitle(caseJson.data?.title ?? '');
      }

      if (previewRes.ok) {
        const pJson = (await previewRes.json()) as { data: PreviewData };
        setPreviewData(pJson.data);
        // 将可用章节自动选中，不可用章节留在集合里（导出时仍可选，但 DOCX 会显示占位）
        const availableKeys = SECTION_DEFS.map(d => d.key).filter(
          k => pJson.data?.sections?.[k]?.available
        );
        if (availableKeys.length > 0) {
          setSelected(new Set(availableKeys));
        }
      } else if (previewRes.status === 404) {
        setError('案件不存在或您无权访问');
      }

      if (reviewRes.ok) {
        const rJson = (await reviewRes.json()) as { data: ReviewRecord | null };
        setLatestReview(rJson.data);
      }
    } catch {
      setError('网络异常，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── 章节切换 ──────────────────────────────────────────────────────────────

  function toggleSection(key: SectionKey) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(SECTION_DEFS.map(d => d.key)));
  }

  function selectAvailable() {
    if (!previewData) return;
    const available = SECTION_DEFS.map(d => d.key).filter(
      k => previewData.sections?.[k]?.available
    );
    setSelected(new Set(available));
  }

  // ── 导出 DOCX ─────────────────────────────────────────────────────────────

  async function handleExport() {
    if (selected.size === 0) {
      setExportError('请至少选择一个章节');
      return;
    }
    setIsExporting(true);
    setExportError(null);

    try {
      const res = await fetch(`/api/v1/cases/${caseId}/package/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedSections: Array.from(selected) }),
      });

      if (!res.ok) {
        let msg = '导出失败';
        try {
          const errJson = (await res.json()) as {
            error?: { message?: string };
          };
          msg = errJson.error?.message ?? msg;
        } catch {
          /* ignore parse error */
        }
        setExportError(msg);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
      a.download = `整案交付包_${date}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setExportError('网络异常，请稍后重试');
    } finally {
      setIsExporting(false);
    }
  }

  // ── 提交复核 ──────────────────────────────────────────────────────────────

  async function handleSubmitReview() {
    if (selected.size === 0) {
      setReviewError('请至少选择一个章节再提交复核');
      return;
    }
    setIsSubmittingReview(true);
    setReviewError(null);
    setReviewSuccess(false);

    try {
      const res = await fetch(`/api/v1/cases/${caseId}/package/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedSections: Array.from(selected),
          reviewNotes: reviewNotes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        let msg = '提交复核失败';
        try {
          const errJson = (await res.json()) as {
            error?: { message?: string };
          };
          msg = errJson.error?.message ?? msg;
        } catch {
          /* ignore */
        }
        setReviewError(msg);
        return;
      }

      const data = (await res.json()) as { data: ReviewRecord };
      setLatestReview(data.data);
      setReviewSuccess(true);
      setShowReviewForm(false);
      setReviewNotes('');
    } catch {
      setReviewError('网络异常，请稍后重试');
    } finally {
      setIsSubmittingReview(false);
    }
  }

  // ── 加载 / 错误 ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
        <div className='mx-auto max-w-4xl px-6 py-6'>
          <div className='animate-pulse space-y-4'>
            <div className='h-8 w-1/3 rounded bg-gray-200 dark:bg-zinc-700' />
            <div className='h-64 rounded-lg bg-white dark:bg-zinc-900' />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
        <div className='mx-auto max-w-4xl px-6 py-6'>
          <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
            <h2 className='mb-2 text-lg font-semibold'>加载失败</h2>
            <p className='mb-4'>{error}</p>
            <div className='flex gap-3'>
              <Button onClick={() => void loadData()}>重试</Button>
              <Button variant='ghost' onClick={() => router.back()}>
                返回
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalAvailable = previewData?.meta.totalAvailable ?? 0;

  return (
    <div className='min-h-screen bg-gray-50 dark:bg-zinc-950'>
      {/* 页面头部 */}
      <header className='border-b border-gray-200 bg-white px-6 py-4 dark:border-zinc-700 dark:bg-zinc-900'>
        <div className='mx-auto max-w-4xl'>
          <Button
            variant='ghost'
            onClick={() => router.push(`/cases/${caseId}`)}
            className='mb-2 text-sm'
          >
            ← 返回案件详情
          </Button>
          <div className='flex items-start justify-between'>
            <div>
              <h1 className='text-2xl font-semibold text-gray-900 dark:text-zinc-100'>
                整案交付包
              </h1>
              {caseTitle && (
                <p className='mt-1 text-sm text-gray-500 dark:text-zinc-400'>
                  {caseTitle}
                </p>
              )}
            </div>
            {previewData && (
              <div className='text-right text-sm text-gray-500 dark:text-zinc-400'>
                <span className='font-medium text-gray-700 dark:text-zinc-300'>
                  {totalAvailable}
                </span>
                <span> / {previewData.meta.totalSections} 个章节有数据</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className='mx-auto max-w-4xl space-y-6 px-6 py-6'>
        {/* 复核状态横幅 */}
        {latestReview ? (
          <div
            className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
              latestReview.status === 'APPROVED'
                ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300'
                : latestReview.status === 'REJECTED'
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                  : 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
            }`}
          >
            <span>
              最近复核：
              <span className='font-medium'>
                {REVIEW_STATUS_LABEL[latestReview.status] ??
                  latestReview.status}
              </span>
              {' · '}
              {new Date(latestReview.createdAt).toLocaleDateString('zh-CN')}
              {latestReview.reviewNotes && (
                <span className='ml-2 opacity-75'>
                  — {latestReview.reviewNotes}
                </span>
              )}
            </span>
            {reviewSuccess && (
              <span className='text-xs opacity-75'>复核记录已更新</span>
            )}
          </div>
        ) : (
          <div className='flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400'>
            <span>{'尚无复核记录，导出的文档将标注“待律师复核”'}</span>
          </div>
        )}

        {/* 章节选择 */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <CardTitle>选择导出章节</CardTitle>
              <div className='flex gap-2 text-xs'>
                <button
                  onClick={selectAll}
                  className='rounded px-2 py-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
                >
                  全选
                </button>
                <button
                  onClick={selectAvailable}
                  className='rounded px-2 py-1 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20'
                >
                  仅有数据
                </button>
                <button
                  onClick={() => setSelected(new Set())}
                  className='rounded px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                >
                  清空
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className='divide-y divide-gray-100 dark:divide-zinc-800'>
              {SECTION_DEFS.map(def => {
                const info = previewData?.sections?.[def.key];
                const tier: Tier = info?.tier ?? 'none';
                const badge = TIER_BADGE[tier];
                const isSelected = selected.has(def.key);

                return (
                  <label
                    key={def.key}
                    className={`flex cursor-pointer items-start gap-4 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${
                      isSelected ? '' : 'opacity-60'
                    }`}
                  >
                    <input
                      type='checkbox'
                      checked={isSelected}
                      onChange={() => toggleSection(def.key)}
                      className='mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 dark:border-zinc-600'
                    />
                    <div className='min-w-0 flex-1'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='text-sm font-medium text-gray-900 dark:text-zinc-100'>
                          {def.label}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className='mt-0.5 text-xs text-gray-500 dark:text-zinc-400'>
                        {def.description}
                      </p>
                      {!info?.available && tier !== 'none' && (
                        <p className='mt-1 text-xs text-zinc-400 dark:text-zinc-500'>
                          未找到相关数据，导出时将显示占位说明
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            <div className='mt-4 border-t border-gray-100 pt-4 text-right text-xs text-gray-400 dark:border-zinc-800 dark:text-zinc-500'>
              已选 {selected.size} / {SECTION_DEFS.length} 个章节
            </div>
          </CardContent>
        </Card>

        {/* 导出区 */}
        <Card>
          <CardHeader>
            <CardTitle>导出文档</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <p className='text-sm text-gray-600 dark:text-zinc-400'>
              点击下方按钮生成 Word
              文档（.docx）并自动下载。文档内容以服务端实时数据为准，与当前预览保持同步。
            </p>

            {exportError && (
              <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
                {exportError}
              </div>
            )}

            <div className='flex flex-wrap gap-3'>
              <Button
                variant='primary'
                onClick={() => void handleExport()}
                disabled={isExporting || selected.size === 0}
              >
                {isExporting ? '生成中…' : '导出 DOCX'}
              </Button>

              {!showReviewForm && (
                <Button
                  variant='outline'
                  onClick={() => {
                    setShowReviewForm(true);
                    setReviewError(null);
                  }}
                  title='提交复核记录，标注交付包已经律师审阅确认'
                >
                  提交复核记录
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 复核表单 */}
        {showReviewForm && (
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <CardTitle>提交复核记录</CardTitle>
                <button
                  onClick={() => {
                    setShowReviewForm(false);
                    setReviewError(null);
                  }}
                  className='text-sm text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                >
                  取消
                </button>
              </div>
            </CardHeader>
            <CardContent className='space-y-4'>
              <p className='text-sm text-gray-600 dark:text-zinc-400'>
                提交复核记录表示您已审阅当前选中章节的内容，并确认其准确性。
                {
                  '系统将记录当前内容哈希，若内容后续变更，文档中将显示"需重新复核"提示。'
                }
              </p>

              <div>
                <label className='mb-1 block text-sm font-medium text-gray-700 dark:text-zinc-300'>
                  复核备注（可选）
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder='如：已核实案情摘要与卷宗一致'
                  rows={3}
                  className='w-full rounded-md border border-gray-300 px-3 py-2 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'
                />
              </div>

              {reviewError && (
                <div className='rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'>
                  {reviewError}
                </div>
              )}

              <div className='rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400'>
                {
                  '提交复核需具备本案件的编辑权限。若提交后收到"权限不足"提示，请联系案件负责人。'
                }
              </div>

              <div className='flex gap-3'>
                <Button
                  variant='primary'
                  onClick={() => void handleSubmitReview()}
                  disabled={isSubmittingReview || selected.size === 0}
                >
                  {isSubmittingReview ? '提交中…' : '确认提交复核'}
                </Button>
                <Button
                  variant='ghost'
                  onClick={() => {
                    setShowReviewForm(false);
                    setReviewError(null);
                  }}
                >
                  取消
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 说明 */}
        <div className='rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400'>
          <p className='mb-1 font-medium'>关于整案交付包</p>
          <ul className='list-inside list-disc space-y-1'>
            <li>文档内容实时从系统最新数据生成，与预览保持同步</li>
            <li>暂无数据的章节将在文档中显示占位说明，而非被跳过</li>
            <li>复核记录通过内容哈希校验，内容变更后需重新复核</li>
            <li>模板版本：{previewData?.templateVersion ?? 'v1'}</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
