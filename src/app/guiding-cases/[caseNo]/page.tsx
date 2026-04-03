'use client';

import _React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

interface GuidingCaseLawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
}

interface GuidingCase {
  id: string;
  caseNo: number;
  title: string;
  batch: number;
  publishDate: string | null;
  category: string | null;
  keywords: string[];
  holdingPoints: string;
  basicFacts: string | null;
  judgmentResult: string | null;
  judgmentReason: string | null;
  relevantLaws: string | null;
  url: string | null;
  source: string | null;
  lawArticles: GuidingCaseLawArticle[];
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className='mb-6'>
      <h2 className='text-base font-semibold text-gray-900 border-l-4 border-blue-600 pl-3 mb-3'>
        {title}
      </h2>
      <div className='text-sm text-gray-700 leading-relaxed whitespace-pre-wrap'>
        {children}
      </div>
    </div>
  );
}

export default function GuidingCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const caseNo = params.caseNo as string;

  const [guidingCase, setGuidingCase] = useState<GuidingCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/v1/guiding-cases/${caseNo}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('指导案例不存在');
            return;
          }
          throw new Error('加载失败');
        }
        const data = await res.json();
        setGuidingCase(data.data);
      } catch {
        setError('加载指导案例失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [user, caseNo]);

  if (loading) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-gray-500 text-sm'>加载中...</div>
      </div>
    );
  }

  if (error || !guidingCase) {
    return (
      <div className='min-h-screen bg-gray-50 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-gray-500 text-sm mb-4'>{error ?? '案例不存在'}</p>
          <button
            onClick={() => router.back()}
            className='text-blue-600 text-sm hover:underline'
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const cleanedJudgmentReason =
    guidingCase.judgmentReason?.replace(/责任编辑：[\s\S]*$/, '').trim() ??
    null;

  return (
    <div className='min-h-screen bg-gray-50'>
      <div className='max-w-3xl mx-auto px-4 py-8'>
        {/* 返回按钮 */}
        <button
          onClick={() => router.back()}
          className='flex items-center text-sm text-gray-500 hover:text-gray-700 mb-6'
        >
          <svg
            className='w-4 h-4 mr-1'
            fill='none'
            stroke='currentColor'
            viewBox='0 0 24 24'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeWidth={2}
              d='M15 19l-7-7 7-7'
            />
          </svg>
          返回
        </button>

        {/* 标题区 */}
        <div className='bg-white rounded-lg shadow-sm p-6 mb-4'>
          <div className='flex items-center gap-2 mb-2'>
            <span className='text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5 font-medium'>
              指导案例 {guidingCase.caseNo} 号
            </span>
            {guidingCase.batch > 0 && (
              <span className='text-xs text-gray-400'>
                第{guidingCase.batch}批
              </span>
            )}
            {guidingCase.publishDate && (
              <span className='text-xs text-gray-400'>
                {guidingCase.publishDate}
              </span>
            )}
          </div>
          <h1 className='text-lg font-bold text-gray-900 leading-snug mb-3'>
            {guidingCase.title}
          </h1>
          {guidingCase.keywords.length > 0 && (
            <div className='flex flex-wrap gap-1.5'>
              {guidingCase.keywords.map((kw, i) => (
                <span
                  key={i}
                  className='text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5'
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 内容区 */}
        <div className='bg-white rounded-lg shadow-sm p-6'>
          <Section title='裁判要旨'>{guidingCase.holdingPoints}</Section>

          {guidingCase.basicFacts && (
            <Section title='基本案情'>{guidingCase.basicFacts}</Section>
          )}

          {guidingCase.judgmentResult && (
            <Section title='裁判结果'>{guidingCase.judgmentResult}</Section>
          )}

          {cleanedJudgmentReason && (
            <Section title='裁判理由'>{cleanedJudgmentReason}</Section>
          )}

          {guidingCase.relevantLaws && (
            <Section title='相关法条'>{guidingCase.relevantLaws}</Section>
          )}

          {/* 关联法条 */}
          {guidingCase.lawArticles.length > 0 && (
            <div className='mb-6'>
              <h2 className='text-base font-semibold text-gray-900 border-l-4 border-blue-600 pl-3 mb-3'>
                关联法条
              </h2>
              <div className='flex flex-wrap gap-2'>
                {guidingCase.lawArticles.map(a => (
                  <a
                    key={a.id}
                    href={`/law-articles/${a.id}`}
                    className='text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-2 py-1 hover:bg-blue-100 transition-colors'
                  >
                    《{a.lawName}》{a.articleNumber}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 原文链接 */}
          {guidingCase.url && (
            <div className='pt-4 border-t border-gray-100'>
              <a
                href={guidingCase.url}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-flex items-center text-sm text-blue-600 hover:underline'
              >
                <svg
                  className='w-3.5 h-3.5 mr-1'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth={2}
                    d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                  />
                </svg>
                查看最高人民法院原文
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
