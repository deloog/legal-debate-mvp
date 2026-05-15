'use client';

/**
 * 案件法条知识图谱 Tab 组件
 *
 * 展示案件涉及法条之间的：
 * 1. 图谱可视化（冲突红色高亮，补充绿色，普通蓝色）
 * 2. 冲突法条列表
 * 3. 历史沿革（替代链）
 * 4. 推荐补充法条
 * 5. 推理引擎结论
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LawArticleGraphVisualization } from '@/components/law-article/LawArticleGraphVisualization';
import { ReasoningChainViewer } from '@/components/debate/ReasoningChainViewer';
import type { CaseLawGraphResult } from '@/lib/case/knowledge-graph-analyzer';
import type {
  ApplicationConfidence,
  ApplicationRiskSeverity,
  ApplicationRouteStatus,
} from '@/lib/case/law-application-analysis';

interface LawGraphTabProps {
  caseId: string;
}

export function LawGraphTab({ caseId }: LawGraphTabProps) {
  const router = useRouter();
  const [data, setData] = useState<CaseLawGraphResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/cases/${caseId}/law-graph`, {
      credentials: 'include',
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setData(res.data as CaseLawGraphResult);
        } else {
          setError(res.message || '加载失败');
        }
      })
      .catch(() => setError('网络错误，请稍后重试'))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className='flex items-center justify-center py-16'>
        <div className='h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-r-transparent' />
        <span className='ml-3 text-gray-600'>分析法条关系中...</span>
      </div>
    );
  }

  if (error) {
    return <div className='py-8 text-center text-red-500'>{error}</div>;
  }

  if (!data?.hasData) {
    return (
      <div className='py-12 text-center'>
        <div className='text-gray-400 text-5xl mb-4'>📋</div>
        <p className='text-gray-600 font-medium'>暂无法条关联数据</p>
        <p className='text-gray-400 text-sm mt-2'>
          完成法条适用性分析或辩论后，系统会沉淀涉案法条并自动生成关系图谱。
        </p>
      </div>
    );
  }

  const recommendedLabels = new Map(
    data.graphData.nodes.map(node => [
      node.id,
      `${node.lawName}第${node.articleNumber}条`,
    ])
  );
  const analysis = data.applicationAnalysis;

  return (
    <div className='space-y-6'>
      {/* 法条适用分析 2.0 */}
      <div className='bg-white rounded-lg shadow-sm border p-4'>
        <div className='flex flex-col gap-3 md:flex-row md:items-start md:justify-between'>
          <div>
            <div className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-600'>
              案件法条适用分析 2.0
              <span className='rounded-full bg-blue-50 px-2 py-0.5 text-blue-700'>
                知识图谱增强
              </span>
            </div>
            <h3 className='mt-2 text-xl font-semibold text-gray-900'>
              {analysis.summary.headline}
            </h3>
            <p className='mt-2 text-sm text-gray-500'>
              系统已把法条关系图谱转译为可执行的法律适用路线：先看核心依据，再看补充规则，最后处理冲突与效力风险。
            </p>
          </div>
          <div className='grid grid-cols-3 gap-2 text-center md:min-w-[260px]'>
            <MetricCard label='核心法条' value={analysis.summary.coreCount} />
            <MetricCard
              label='补充法条'
              value={analysis.summary.supportingCount}
            />
            <MetricCard label='风险提示' value={analysis.summary.riskCount} />
          </div>
        </div>
        <div className='mt-4 flex flex-wrap items-center gap-2'>
          <ConfidenceBadge confidence={analysis.summary.overallConfidence} />
          <span className='text-xs text-gray-400'>
            该结论为系统辅助分析，正式文书仍需人工核验法条效力与事实匹配。
          </span>
        </div>
      </div>

      {/* 核心法条 */}
      <div className='bg-white rounded-lg shadow-sm border p-4'>
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-lg font-semibold text-gray-800'>本案核心法条</h3>
          <span className='text-xs text-gray-400'>按适用度和引用来源排序</span>
        </div>
        {analysis.coreArticles.length > 0 ? (
          <div className='grid grid-cols-1 gap-3 lg:grid-cols-2'>
            {analysis.coreArticles.map(article => (
              <div
                key={article.articleId}
                className='rounded-xl border border-blue-100 bg-blue-50/50 p-4'
              >
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <button
                      onClick={() =>
                        router.push(`/law-articles/${article.articleId}`)
                      }
                      className='text-left text-base font-semibold text-blue-900 hover:text-blue-700'
                    >
                      {article.title}
                    </button>
                    <div className='mt-1 flex flex-wrap gap-2'>
                      <ConfidenceBadge confidence={article.confidence} />
                      <span className='rounded-full bg-white px-2 py-0.5 text-xs text-gray-500'>
                        {article.sourceLabel}
                      </span>
                      {article.score !== null && (
                        <span className='rounded-full bg-white px-2 py-0.5 text-xs text-gray-500'>
                          适用度 {Math.round(article.score * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className='mt-3 text-sm leading-relaxed text-gray-700'>
                  {article.useGuidance}
                </p>

                {article.reasons.length > 0 && (
                  <ul className='mt-3 space-y-1'>
                    {article.reasons.slice(0, 3).map(reason => (
                      <li
                        key={reason}
                        className='text-sm leading-relaxed text-gray-600'
                      >
                        <span className='mr-1 text-blue-500'>•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                )}

                {article.excerpt && (
                  <p className='mt-3 rounded-lg bg-white/80 p-2 text-xs leading-relaxed text-gray-500'>
                    {article.excerpt}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className='text-sm text-gray-400'>尚未识别出核心法条</p>
        )}
      </div>

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-5'>
        {/* 适用路线图 */}
        <div className='rounded-lg border bg-white p-4 shadow-sm lg:col-span-3'>
          <h3 className='mb-4 text-lg font-semibold text-gray-800'>
            适用路线图
          </h3>
          <div className='space-y-3'>
            {analysis.applicationRoute.map((step, index) => (
              <div
                key={step.id}
                className='rounded-xl border border-gray-100 bg-gray-50 p-3'
              >
                <div className='flex items-start gap-3'>
                  <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white'>
                    {index + 1}
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h4 className='font-semibold text-gray-900'>
                        {step.title}
                      </h4>
                      <RouteStatusBadge status={step.status} />
                    </div>
                    <p className='mt-1 text-sm leading-relaxed text-gray-600'>
                      {step.description}
                    </p>
                    <p className='mt-2 text-xs leading-relaxed text-gray-500'>
                      建议：{step.action}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 风险提示 */}
        <div className='rounded-lg border bg-white p-4 shadow-sm lg:col-span-2'>
          <h3 className='mb-4 text-lg font-semibold text-gray-800'>
            风险与复核点
          </h3>
          {analysis.riskArticles.length > 0 ? (
            <div className='space-y-3'>
              {analysis.riskArticles.slice(0, 5).map((risk, index) => (
                <div
                  key={`${risk.title}-${index}`}
                  className='rounded-xl border border-red-100 bg-red-50 p-3'
                >
                  <div className='flex items-center gap-2'>
                    <RiskBadge severity={risk.severity} />
                    <h4 className='font-semibold text-red-900'>{risk.title}</h4>
                  </div>
                  <p className='mt-2 text-sm leading-relaxed text-red-700'>
                    {risk.description}
                  </p>
                  <p className='mt-2 text-xs leading-relaxed text-red-600'>
                    处理：{risk.action}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className='rounded-xl border border-green-100 bg-green-50 p-3'>
              <p className='text-sm text-green-700'>
                当前未发现明显冲突、失效或替代风险，但正式引用前仍需人工核验法条现行有效性。
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 补充法条 */}
      {analysis.supportingArticles.length > 0 && (
        <div className='bg-white rounded-lg shadow-sm border p-4'>
          <h3 className='text-base font-semibold text-green-700 mb-3 flex items-center gap-2'>
            <span>补充适用法条</span>
          </h3>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            {analysis.supportingArticles.map(article => (
              <button
                key={article.articleId}
                onClick={() =>
                  router.push(`/law-articles/${article.articleId}`)
                }
                className='rounded-xl border border-green-100 bg-green-50 p-3 text-left transition-colors hover:bg-green-100'
              >
                <div className='flex items-center justify-between gap-2'>
                  <span className='font-semibold text-green-900'>
                    {article.title}
                  </span>
                  <span className='rounded-full bg-white px-2 py-0.5 text-xs text-green-700'>
                    {article.relationLabel}
                  </span>
                </div>
                <p className='mt-2 text-sm leading-relaxed text-green-700'>
                  {article.reason}
                </p>
                <p className='mt-2 text-xs text-green-600'>
                  关联核心：{article.anchorTitle}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 下一步 */}
      <div className='rounded-lg border border-amber-100 bg-amber-50 p-4'>
        <h3 className='mb-2 text-base font-semibold text-amber-900'>
          建议下一步
        </h3>
        <ul className='space-y-1'>
          {analysis.nextActions.map(action => (
            <li key={action} className='text-sm leading-relaxed text-amber-800'>
              <span className='mr-1 text-amber-500'>•</span>
              {action}
            </li>
          ))}
        </ul>
      </div>

      {/* 图谱可视化 */}
      <div className='bg-white rounded-lg shadow-sm border p-4'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-lg font-semibold text-gray-800'>
            法条关系图谱佐证
          </h3>
          <div className='flex items-center gap-3 text-xs text-gray-500'>
            <span className='flex items-center gap-1'>
              <span className='inline-block w-3 h-3 rounded-full bg-blue-500' />
              涉案法条
            </span>
            <span className='flex items-center gap-1'>
              <span className='inline-block w-3 h-3 rounded-full bg-red-500' />
              冲突法条
            </span>
            <span className='flex items-center gap-1'>
              <span className='inline-block w-3 h-3 rounded-full bg-green-500' />
              推荐补充
            </span>
          </div>
        </div>
        {data.graphData.nodes.length > 0 ? (
          <LawArticleGraphVisualization graphData={data.graphData} />
        ) : (
          <p className='text-gray-400 text-sm text-center py-8'>图谱数据不足</p>
        )}
      </div>

      {/* 推理引擎结论 */}
      {data.keyInferences.length > 0 && (
        <ReasoningChainViewer
          inferences={data.keyInferences}
          collapsible={true}
        />
      )}

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* 冲突法条 */}
        <div className='bg-white rounded-lg shadow-sm border p-4'>
          <h3 className='text-base font-semibold text-red-700 mb-3 flex items-center gap-2'>
            <span>⚠️</span> 法条冲突
            <span className='ml-auto text-xs font-normal text-gray-400'>
              {data.conflicts.length} 处
            </span>
          </h3>
          {data.conflicts.length > 0 ? (
            <ul className='space-y-3'>
              {data.conflicts.map((c, i) => (
                <li
                  key={i}
                  className='rounded-lg bg-red-50 border border-red-100 p-3'
                >
                  <div className='text-sm font-medium text-red-800'>
                    {c.sourceName}
                    <span className='mx-2 text-red-400'>⟷</span>
                    {c.targetName}
                  </div>
                  <p className='text-xs text-red-600 mt-1'>{c.description}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-sm text-gray-400'>未发现冲突关系</p>
          )}
        </div>

        {/* 历史沿革 */}
        <div className='bg-white rounded-lg shadow-sm border p-4'>
          <h3 className='text-base font-semibold text-orange-700 mb-3 flex items-center gap-2'>
            <span>📜</span> 历史沿革
            <span className='ml-auto text-xs font-normal text-gray-400'>
              {data.evolutionChain.length} 条
            </span>
          </h3>
          {data.evolutionChain.length > 0 ? (
            <ul className='space-y-2'>
              {data.evolutionChain.map(item => (
                <li
                  key={item.articleId}
                  className={`rounded p-2.5 text-sm ${
                    item.isSuperseded
                      ? 'bg-gray-50 border border-gray-200'
                      : 'bg-orange-50 border border-orange-100'
                  }`}
                >
                  <span
                    className={
                      item.isSuperseded
                        ? 'line-through text-gray-400'
                        : 'font-medium text-orange-800'
                    }
                  >
                    {item.articleName}
                  </span>
                  {item.isSuperseded && item.supersededBy && (
                    <span className='text-xs text-gray-500 block mt-0.5'>
                      已被 {item.supersededBy} 替代
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-sm text-gray-400'>未发现替代关系</p>
          )}
        </div>
      </div>

      {/* 旧版推荐补充法条兜底 */}
      {data.recommendedArticleIds.length > 0 && (
        <div className='bg-white rounded-lg shadow-sm border p-4'>
          <h3 className='text-base font-semibold text-green-700 mb-3 flex items-center gap-2'>
            <span>💡</span> 推荐补充法条
          </h3>
          <p className='text-xs text-gray-500 mb-3'>
            基于知识图谱推理，以下法条可能与本案相关，建议纳入参考：
          </p>
          <div className='flex flex-wrap gap-2'>
            {data.recommendedArticleIds.map(id => (
              <button
                key={id}
                onClick={() => router.push(`/law-articles/${id}`)}
                className='px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg hover:bg-green-100 transition-colors'
              >
                {recommendedLabels.get(id) ?? '查看法条'} →
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className='rounded-xl border border-gray-100 bg-gray-50 px-3 py-2'>
      <div className='text-lg font-semibold text-gray-900'>{value}</div>
      <div className='text-xs text-gray-500'>{label}</div>
    </div>
  );
}

function ConfidenceBadge({
  confidence,
}: {
  confidence: ApplicationConfidence;
}) {
  const styles: Record<ApplicationConfidence, string> = {
    high: 'bg-green-100 text-green-700 border-green-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const labels: Record<ApplicationConfidence, string> = {
    high: '高置信',
    medium: '中置信',
    low: '低置信',
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${styles[confidence]}`}
    >
      {labels[confidence]}
    </span>
  );
}

function RiskBadge({ severity }: { severity: ApplicationRiskSeverity }) {
  const styles: Record<ApplicationRiskSeverity, string> = {
    high: 'bg-red-600 text-white',
    medium: 'bg-orange-500 text-white',
    low: 'bg-gray-500 text-white',
  };
  const labels: Record<ApplicationRiskSeverity, string> = {
    high: '高',
    medium: '中',
    low: '低',
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${styles[severity]}`}
    >
      {labels[severity]}风险
    </span>
  );
}

function RouteStatusBadge({ status }: { status: ApplicationRouteStatus }) {
  const styles: Record<ApplicationRouteStatus, string> = {
    ready: 'bg-green-100 text-green-700',
    attention: 'bg-amber-100 text-amber-700',
    missing: 'bg-gray-100 text-gray-600',
  };
  const labels: Record<ApplicationRouteStatus, string> = {
    ready: '可执行',
    attention: '需复核',
    missing: '待补充',
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
