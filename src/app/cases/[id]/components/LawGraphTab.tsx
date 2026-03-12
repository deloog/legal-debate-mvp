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

interface LawGraphTabProps {
  caseId: string;
}

export function LawGraphTab({ caseId }: LawGraphTabProps) {
  const router = useRouter();
  const [data, setData] = useState<CaseLawGraphResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    fetch(`/api/cases/${caseId}/law-graph`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
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
          请先在案件概览中添加法律引用，系统将自动分析法条关系。
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 图谱可视化 */}
      <div className='bg-white rounded-lg shadow-sm border p-4'>
        <div className='flex items-center justify-between mb-3'>
          <h3 className='text-lg font-semibold text-gray-800'>法条关系图谱</h3>
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
        {data.articleIds.length > 0 ? (
          <LawArticleGraphVisualization
            centerArticleId={data.articleIds[0]}
            depth={2}
          />
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

      {/* 推荐补充法条 */}
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
                查看法条 →
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
