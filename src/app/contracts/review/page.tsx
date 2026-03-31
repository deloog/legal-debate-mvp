'use client';

import { useState, useEffect, useRef } from 'react';
import type {
  ReviewReport,
  RiskItem,
  Suggestion,
} from '@/types/contract-review';

// ─── 审查阶段定义 ──────────────────────────────────────────────────────────────
const REVIEW_STAGES = [
  {
    id: 1,
    label: '解析合同文本',
    hint: '读取文件内容，识别合同结构…',
    durationMs: 6000,
  },
  {
    id: 2,
    label: '识别风险条款',
    hint: 'AI正在逐条扫描合同条款…',
    durationMs: 48000,
  },
  {
    id: 3,
    label: '分析风险影响',
    hint: '评估每项风险的法律影响与概率…',
    durationMs: 10000,
  },
  {
    id: 4,
    label: '生成修改建议',
    hint: '针对识别出的风险撰写专业建议…',
    durationMs: 20000,
  },
];
const TOTAL_DURATION_MS = REVIEW_STAGES.reduce((s, r) => s + r.durationMs, 0);

// ─── 工具函数 ──────────────────────────────────────────────────────────────────
const getRiskLevelColor = (level: string) => {
  switch (level) {
    case 'CRITICAL':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'HIGH':
      return 'bg-orange-50 text-orange-800 border-orange-200';
    case 'MEDIUM':
      return 'bg-yellow-50 text-yellow-800 border-yellow-200';
    default:
      return 'bg-blue-50 text-blue-800 border-blue-200';
  }
};
const getRiskLevelText = (level: string) =>
  ({ CRITICAL: '严重', HIGH: '高', MEDIUM: '中', LOW: '低' })[level] ?? '未知';
const getScoreColor = (score: number) =>
  score >= 80
    ? 'text-green-600'
    : score >= 60
      ? 'text-yellow-600'
      : 'text-red-600';
const getScoreBg = (score: number) =>
  score >= 80
    ? 'bg-green-50 border-green-200'
    : score >= 60
      ? 'bg-yellow-50 border-yellow-200'
      : 'bg-red-50 border-red-200';

// ─── 导出报告（下载 HTML） ─────────────────────────────────────────────────────
function buildReportHtml(data: ReviewReport): string {
  const date = new Date().toLocaleString('zh-CN');
  const riskRows = data.risks
    .map(
      r => `
    <tr>
      <td class="risk-${r.level.toLowerCase()}">${getRiskLevelText(r.level)}</td>
      <td>${r.title}</td>
      <td>${r.description}</td>
      <td>${r.impact}</td>
      <td>${(r.probability * 100).toFixed(0)}%</td>
    </tr>`
    )
    .join('');
  const suggRows = data.suggestions
    .map(
      s => `
    <tr>
      <td>${s.title}</td>
      <td>${s.description}</td>
      <td class="suggested-text">${s.suggestedText || '—'}</td>
      <td>${s.reason}</td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>合同智能审查报告</title>
<style>
  body{font-family:"Microsoft YaHei",Arial,sans-serif;margin:40px;color:#1a1a1a;line-height:1.6}
  h1{font-size:24px;border-bottom:2px solid #2563eb;padding-bottom:8px;color:#1e40af}
  h2{font-size:18px;margin-top:32px;color:#1e3a8a}
  .meta{color:#6b7280;font-size:13px;margin-bottom:24px}
  .scores{display:flex;gap:24px;margin:16px 0}
  .score-box{text-align:center;padding:16px 24px;border-radius:8px;border:1px solid #e5e7eb;min-width:120px}
  .score-box .num{font-size:36px;font-weight:bold}
  .score-box .lbl{font-size:12px;color:#6b7280;margin-top:4px}
  .green{color:#16a34a}.yellow{color:#ca8a04}.red{color:#dc2626}
  .stats{display:flex;gap:16px;margin:12px 0}
  .stat{background:#f9fafb;border-radius:6px;padding:12px 20px;text-align:center}
  .stat .n{font-size:28px;font-weight:bold}.stat .l{font-size:12px;color:#6b7280}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th{background:#1e40af;color:#fff;padding:8px 10px;text-align:left}
  td{padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top}
  tr:nth-child(even) td{background:#f9fafb}
  .risk-critical{color:#dc2626;font-weight:bold}
  .risk-high{color:#ea580c;font-weight:bold}
  .risk-medium{color:#ca8a04}
  .risk-low{color:#2563eb}
  .suggested-text{font-style:italic;color:#15803d;white-space:pre-wrap}
  .footer{margin-top:40px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px}
</style>
</head>
<body>
<h1>合同智能审查报告</h1>
<div class="meta">生成时间：${date} &nbsp;|&nbsp; 审查耗时：${(data.reviewTime / 1000).toFixed(1)} 秒</div>

<h2>综合评分</h2>
<div class="scores">
  <div class="score-box">
    <div class="num ${data.overallScore >= 80 ? 'green' : data.overallScore >= 60 ? 'yellow' : 'red'}">${data.overallScore}</div>
    <div class="lbl">总体评分</div>
  </div>
  <div class="score-box">
    <div class="num ${data.riskScore >= 80 ? 'green' : data.riskScore >= 60 ? 'yellow' : 'red'}">${data.riskScore}</div>
    <div class="lbl">风险评分</div>
  </div>
  <div class="score-box">
    <div class="num ${data.complianceScore >= 80 ? 'green' : data.complianceScore >= 60 ? 'yellow' : 'red'}">${data.complianceScore}</div>
    <div class="lbl">合规评分</div>
  </div>
</div>

<h2>风险统计</h2>
<div class="stats">
  <div class="stat"><div class="n">${data.totalRisks}</div><div class="l">总风险数</div></div>
  <div class="stat" style="color:#dc2626"><div class="n">${data.criticalRisks}</div><div class="l">严重风险</div></div>
  <div class="stat" style="color:#ea580c"><div class="n">${data.highRisks}</div><div class="l">高风险</div></div>
  <div class="stat" style="color:#ca8a04"><div class="n">${data.mediumRisks}</div><div class="l">中风险</div></div>
</div>

<h2>风险详情</h2>
<table>
  <thead><tr><th>等级</th><th>风险标题</th><th>描述</th><th>影响</th><th>概率</th></tr></thead>
  <tbody>${riskRows || '<tr><td colspan="5">未发现风险</td></tr>'}</tbody>
</table>

<h2>修改建议</h2>
<table>
  <thead><tr><th>建议标题</th><th>说明</th><th>建议文本</th><th>原因</th></tr></thead>
  <tbody>${suggRows || '<tr><td colspan="4">暂无建议</td></tr>'}</tbody>
</table>

<div class="footer">本报告由 AI 自动生成，仅供参考，不构成正式法律意见。如涉及重大法律事项，请咨询专业律师。</div>
</body>
</html>`;
}

function downloadReport(data: ReviewReport) {
  const html = buildReportHtml(data);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `合同审查报告_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── 加载动画组件 ──────────────────────────────────────────────────────────────
function ReviewingAnimation() {
  const [elapsedMs, setElapsedMs] = useState(0);
  // eslint-disable-next-line react-hooks/purity
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startRef.current);
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // 计算当前阶段
  let accumulated = 0;
  let currentStageIdx = REVIEW_STAGES.length - 1;
  for (let i = 0; i < REVIEW_STAGES.length; i++) {
    accumulated += REVIEW_STAGES[i].durationMs;
    if (elapsedMs < accumulated) {
      currentStageIdx = i;
      break;
    }
  }
  const progress = Math.min((elapsedMs / TOTAL_DURATION_MS) * 100, 97); // 最多 97%，完成才 100%
  const elapsedSec = Math.floor(elapsedMs / 1000);
  const estimatedRemain = Math.max(
    0,
    Math.ceil((TOTAL_DURATION_MS - elapsedMs) / 1000)
  );

  return (
    <div className='mx-auto max-w-2xl'>
      <div className='rounded-xl bg-white p-8 shadow-lg'>
        {/* 标题 */}
        <div className='mb-6 text-center'>
          <div className='mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50'>
            <svg
              className='h-8 w-8 animate-spin text-blue-600'
              fill='none'
              viewBox='0 0 24 24'
            >
              <circle
                className='opacity-25'
                cx='12'
                cy='12'
                r='10'
                stroke='currentColor'
                strokeWidth='4'
              />
              <path
                className='opacity-75'
                fill='currentColor'
                d='M4 12a8 8 0 018-8v8z'
              />
            </svg>
          </div>
          <h3 className='text-lg font-semibold text-gray-900'>
            AI 正在审查合同
          </h3>
          <p className='mt-1 text-sm text-gray-500'>
            已用时 {elapsedSec} 秒
            {estimatedRemain > 0 && <>，预计还需约 {estimatedRemain} 秒</>}
          </p>
        </div>

        {/* 进度条 */}
        <div className='mb-6'>
          <div className='mb-1 flex justify-between text-xs text-gray-400'>
            <span>审查进度</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className='h-2.5 w-full overflow-hidden rounded-full bg-gray-100'>
            <div
              className='h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500'
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 阶段步骤 */}
        <div className='space-y-3'>
          {REVIEW_STAGES.map((stage, idx) => {
            const isDone = idx < currentStageIdx;
            const isCurrent = idx === currentStageIdx;
            return (
              <div key={stage.id} className='flex items-start gap-3'>
                {/* 图标 */}
                <div className='mt-0.5 flex-shrink-0'>
                  {isDone ? (
                    <div className='flex h-6 w-6 items-center justify-center rounded-full bg-green-100'>
                      <svg
                        className='h-4 w-4 text-green-600'
                        fill='none'
                        viewBox='0 0 24 24'
                        stroke='currentColor'
                      >
                        <path
                          strokeLinecap='round'
                          strokeLinejoin='round'
                          strokeWidth={2}
                          d='M5 13l4 4L19 7'
                        />
                      </svg>
                    </div>
                  ) : isCurrent ? (
                    <div className='flex h-6 w-6 items-center justify-center rounded-full bg-blue-100'>
                      <div className='h-2.5 w-2.5 animate-pulse rounded-full bg-blue-600' />
                    </div>
                  ) : (
                    <div className='flex h-6 w-6 items-center justify-center rounded-full bg-gray-100'>
                      <div className='h-2.5 w-2.5 rounded-full bg-gray-300' />
                    </div>
                  )}
                </div>
                {/* 文字 */}
                <div className='flex-1'>
                  <p
                    className={`text-sm font-medium ${isDone ? 'text-green-700' : isCurrent ? 'text-blue-700' : 'text-gray-400'}`}
                  >
                    {stage.label}
                    {isDone && (
                      <span className='ml-2 text-xs font-normal text-green-500'>
                        ✓ 完成
                      </span>
                    )}
                  </p>
                  {isCurrent && (
                    <p className='mt-0.5 text-xs text-gray-500 animate-pulse'>
                      {stage.hint}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 说明 */}
        <p className='mt-6 text-center text-xs text-gray-400'>
          AI 正在对合同进行两阶段深度分析，请耐心等待。
          <br />
          整个过程约需 60–120 秒，完成后将自动显示报告。
        </p>
      </div>
    </div>
  );
}

// ─── 主页面 ────────────────────────────────────────────────────────────────────
export default function ContractReviewPage() {
  const [reviewData, setReviewData] = useState<ReviewReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/contracts/review/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok || !uploadData.success) {
        throw new Error(uploadData.error?.message || '上传失败');
      }

      setUploading(false);
      await startReview(uploadData.data.contractId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败，请重试');
      setUploading(false);
    }
  };

  const startReview = async (contractId: string) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/contracts/review/${contractId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || '审查失败');
      }
      setReviewData(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '审查失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // ── 加载中 ───────────────────────────────────────────────────────────────────
  if (uploading || loading) {
    return (
      <div className='min-h-screen bg-gray-50'>
        <div className='border-b border-gray-200 bg-white px-6 py-4'>
          <div className='mx-auto max-w-7xl'>
            <h1 className='text-2xl font-bold text-gray-900'>合同智能审查</h1>
            <p className='mt-1 text-sm text-gray-600'>
              AI自动识别合同风险点，生成专业审查报告
            </p>
          </div>
        </div>
        <div className='mx-auto max-w-7xl p-6'>
          {uploading ? (
            <div className='mx-auto max-w-2xl'>
              <div className='rounded-xl bg-white p-8 shadow-lg text-center'>
                <div className='mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-blue-50'>
                  <svg
                    className='h-8 w-8 animate-bounce text-blue-600'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
                    />
                  </svg>
                </div>
                <h3 className='text-lg font-semibold text-gray-900'>
                  正在上传合同文件…
                </h3>
                <p className='mt-1 text-sm text-gray-500'>请稍候</p>
              </div>
            </div>
          ) : (
            <ReviewingAnimation />
          )}
        </div>
      </div>
    );
  }

  // ── 上传区 ───────────────────────────────────────────────────────────────────
  if (!reviewData) {
    return (
      <div className='min-h-screen bg-gray-50'>
        <div className='border-b border-gray-200 bg-white px-6 py-4'>
          <div className='mx-auto max-w-7xl'>
            <h1 className='text-2xl font-bold text-gray-900'>合同智能审查</h1>
            <p className='mt-1 text-sm text-gray-600'>
              AI自动识别合同风险点，生成专业审查报告
            </p>
          </div>
        </div>
        <div className='mx-auto max-w-7xl p-6'>
          {error && (
            <div className='mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800 border border-red-200'>
              ⚠️ {error}
            </div>
          )}
          <div className='mx-auto max-w-2xl'>
            <div className='rounded-xl bg-white p-10 shadow-lg text-center'>
              <svg
                className='mx-auto h-14 w-14 text-blue-400'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={1.5}
                  d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                />
              </svg>
              <h3 className='mt-4 text-xl font-semibold text-gray-900'>
                上传合同文件
              </h3>
              <p className='mt-2 text-sm text-gray-500'>
                支持 PDF、DOC、DOCX、TXT 格式，最大 10 MB
              </p>
              <p className='mt-1 text-xs text-gray-400'>
                AI 将自动进行两阶段深度审查，约需 60–120 秒
              </p>
              <div className='mt-8'>
                <label
                  htmlFor='file-upload'
                  className='inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-8 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors'
                >
                  <svg
                    className='h-4 w-4'
                    fill='none'
                    viewBox='0 0 24 24'
                    stroke='currentColor'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
                    />
                  </svg>
                  选择文件
                  <input
                    id='file-upload'
                    type='file'
                    className='sr-only'
                    accept='.pdf,.doc,.docx,.txt'
                    onChange={handleFileChange}
                    aria-label='上传合同'
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── 审查结果 ─────────────────────────────────────────────────────────────────
  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='border-b border-gray-200 bg-white px-6 py-4'>
        <div className='mx-auto max-w-7xl flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>合同智能审查</h1>
            <p className='mt-1 text-sm text-gray-600'>
              审查完成 · 耗时 {(reviewData.reviewTime / 1000).toFixed(0)} 秒
            </p>
          </div>
          <div className='flex gap-3'>
            <button
              onClick={() => {
                setReviewData(null);
                setError(null);
              }}
              className='rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors'
            >
              审查新合同
            </button>
            <button
              onClick={() => downloadReport(reviewData)}
              className='rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors flex items-center gap-2'
            >
              <svg
                className='h-4 w-4'
                fill='none'
                viewBox='0 0 24 24'
                stroke='currentColor'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth={2}
                  d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                />
              </svg>
              下载报告
            </button>
          </div>
        </div>
      </div>

      <div className='mx-auto max-w-7xl p-6 space-y-6'>
        {/* 评分卡 */}
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
          {[
            { label: '总体评分', score: reviewData.overallScore },
            { label: '风险评分', score: reviewData.riskScore },
            { label: '合规评分', score: reviewData.complianceScore },
          ].map(({ label, score }) => (
            <div
              key={label}
              className={`rounded-xl border p-6 ${getScoreBg(score)} shadow-sm`}
            >
              <div className='text-sm font-medium text-gray-600'>{label}</div>
              <div
                className={`mt-2 text-5xl font-bold ${getScoreColor(score)}`}
              >
                {score}
              </div>
              <div className='mt-1 text-xs text-gray-500'>满分 100 分</div>
              <div className='mt-3 h-1.5 w-full rounded-full bg-gray-200'>
                <div
                  className={`h-full rounded-full ${score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* 风险统计 */}
        <div className='rounded-xl bg-white p-6 shadow-sm border border-gray-100'>
          <h2 className='text-base font-semibold text-gray-900 mb-4'>
            风险统计
          </h2>
          <div className='grid grid-cols-2 gap-4 sm:grid-cols-4'>
            {[
              {
                label: '总风险数',
                count: reviewData.totalRisks,
                color: 'text-gray-900',
              },
              {
                label: '严重风险',
                count: reviewData.criticalRisks,
                color: 'text-red-600',
              },
              {
                label: '高风险',
                count: reviewData.highRisks,
                color: 'text-orange-600',
              },
              {
                label: '中风险',
                count: reviewData.mediumRisks,
                color: 'text-yellow-600',
              },
            ].map(({ label, count, color }) => (
              <div
                key={label}
                className='rounded-lg bg-gray-50 p-4 text-center'
              >
                <div className={`text-3xl font-bold ${color}`}>{count}</div>
                <div className='mt-1 text-xs text-gray-500'>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 风险详情 */}
        <div className='rounded-xl bg-white p-6 shadow-sm border border-gray-100'>
          <h2 className='text-base font-semibold text-gray-900 mb-4'>
            风险详情
            <span className='ml-2 text-sm font-normal text-gray-400'>
              ({reviewData.risks.length} 项)
            </span>
          </h2>
          {reviewData.risks.length === 0 ? (
            <p className='text-sm text-gray-500'>✅ 未发现明显风险</p>
          ) : (
            <div className='space-y-3'>
              {reviewData.risks.map((risk: RiskItem) => (
                <div
                  key={risk.id}
                  className={`rounded-lg border p-4 ${getRiskLevelColor(risk.level)}`}
                >
                  <div className='flex items-center gap-2 mb-1'>
                    <span className='inline-flex rounded px-2 py-0.5 text-xs font-bold border border-current'>
                      {getRiskLevelText(risk.level)}
                    </span>
                    <h3 className='text-sm font-semibold'>{risk.title}</h3>
                    <span className='ml-auto text-xs opacity-60'>
                      概率 {(risk.probability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className='text-sm mt-1'>{risk.description}</p>
                  <p className='text-xs mt-2 opacity-80'>
                    <span className='font-medium'>影响：</span>
                    {risk.impact}
                  </p>
                  {risk.originalText && (
                    <p className='text-xs mt-2 italic opacity-70 bg-white/50 rounded px-2 py-1'>
                      原文：{risk.originalText}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 修改建议 */}
        <div className='rounded-xl bg-white p-6 shadow-sm border border-gray-100'>
          <h2 className='text-base font-semibold text-gray-900 mb-4'>
            修改建议
            <span className='ml-2 text-sm font-normal text-gray-400'>
              ({reviewData.suggestions.length} 条)
            </span>
          </h2>
          {reviewData.suggestions.length === 0 ? (
            <p className='text-sm text-gray-500'>暂无修改建议</p>
          ) : (
            <div className='space-y-3'>
              {reviewData.suggestions.map((s: Suggestion) => (
                <div
                  key={s.id}
                  className='rounded-lg border border-gray-200 p-4'
                >
                  <div className='flex items-center gap-2 mb-2'>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        s.priority === 'HIGH'
                          ? 'bg-red-100 text-red-800'
                          : s.priority === 'MEDIUM'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {s.priority === 'HIGH'
                        ? '高优先级'
                        : s.priority === 'MEDIUM'
                          ? '中优先级'
                          : '低优先级'}
                    </span>
                    <h3 className='text-sm font-medium text-gray-900'>
                      {s.title}
                    </h3>
                  </div>
                  <p className='text-sm text-gray-600'>{s.description}</p>
                  {s.suggestedText && (
                    <div className='mt-3 rounded-lg bg-green-50 border border-green-200 p-3'>
                      <div className='text-xs font-medium text-green-700 mb-1'>
                        建议条款文字：
                      </div>
                      <div className='text-sm text-green-900 whitespace-pre-wrap'>
                        {s.suggestedText}
                      </div>
                    </div>
                  )}
                  <p className='mt-2 text-xs text-gray-500'>
                    <span className='font-medium'>原因：</span>
                    {s.reason}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 页尾下载按钮 */}
        <div className='flex justify-end pb-8'>
          <button
            onClick={() => downloadReport(reviewData)}
            className='rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors flex items-center gap-2 shadow'
          >
            <svg
              className='h-4 w-4'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
              />
            </svg>
            下载报告
          </button>
        </div>
      </div>
    </div>
  );
}
