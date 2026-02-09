/**
 * 法条详情页
 *
 * 功能：
 * 1. 显示法条基本信息
 * 2. 显示关系图谱可视化
 * 3. 显示推荐的相关法条
 * 4. 显示关系统计信息
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { LawArticleGraphVisualization } from '@/components/law-article/LawArticleGraphVisualization';
import { RecommendationFeedbackButton } from '@/components/feedback/RecommendationFeedbackButton';
import { RelationFeedbackButton } from '@/components/feedback/RelationFeedbackButton';
import type { LawArticle } from '@prisma/client';
import type {
  RecommendationResult,
  RecommendationStats,
} from '@/lib/law-article/recommendation-service';

/**
 * 法条详情页组件
 */
export default function LawArticleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id as string;

  const [article, setArticle] = useState<LawArticle | null>(null);
  const [recommendations, setRecommendations] = useState<
    RecommendationResult[]
  >([]);
  const [stats, setStats] = useState<RecommendationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const userId = session?.user?.id || null;

  // 加载法条详情
  useEffect(() => {
    async function loadArticle() {
      try {
        setLoading(true);
        setError(null);

        // 获取法条基本信息
        const articleResponse = await fetch(
          `/api/v1/law-articles/${articleId}`
        );
        if (!articleResponse.ok) {
          if (articleResponse.status === 404) {
            setError('法条不存在');
            return;
          }
          throw new Error('加载法条失败');
        }
        const articleData = await articleResponse.json();
        setArticle(articleData);

        // 获取推荐法条
        const recommendationsResponse = await fetch(
          `/api/v1/law-articles/${articleId}/recommendations`
        );
        if (recommendationsResponse.ok) {
          const recommendationsData = await recommendationsResponse.json();
          setRecommendations(recommendationsData);
        }

        // 获取统计信息
        const statsResponse = await fetch(
          `/api/v1/law-articles/${articleId}/stats`
        );
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }
      } catch (err) {
        console.error('加载失败:', err);
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }

    if (articleId) {
      loadArticle();
    }
  }, [articleId]);

  // 加载状态
  if (loading) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-center'>
          <div className='mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent'></div>
          <p className='text-sm text-gray-600'>加载中...</p>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-center'>
          <p className='text-lg text-red-600 mb-4'>{error}</p>
          <button
            onClick={() => router.back()}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  // 法条不存在
  if (!article) {
    return (
      <div className='flex min-h-screen items-center justify-center'>
        <div className='text-center'>
          <p className='text-lg text-gray-600 mb-4'>法条不存在</p>
          <button
            onClick={() => router.back()}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* 法条基本信息 */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <h1 className='text-3xl font-bold mb-4'>{article.lawName}</h1>
        <div className='flex items-center gap-4 mb-4'>
          <span className='text-xl text-gray-700'>
            第{article.articleNumber}条
          </span>
          <span className='px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm'>
            {getCategoryLabel(article.category)}
          </span>
        </div>
        <p className='text-gray-700 leading-relaxed mb-4'>{article.fullText}</p>
        <div className='flex items-center gap-6 text-sm text-gray-600'>
          <div>
            <span className='font-semibold'>生效日期：</span>
            {article.effectiveDate
              ? new Date(article.effectiveDate).toLocaleDateString('zh-CN')
              : '未知'}
          </div>
          <div>
            <span className='font-semibold'>发布机关：</span>
            {article.issuingAuthority || '未知'}
          </div>
        </div>
      </div>

      {/* 关系统计 */}
      {stats && (
        <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
          <h2 className='text-2xl font-bold mb-4'>关系统计</h2>
          <div className='grid grid-cols-3 gap-4'>
            <div className='text-center'>
              <div className='text-3xl font-bold text-blue-600'>
                {stats.totalRelations}
              </div>
              <div className='text-sm text-gray-600'>总关系数</div>
            </div>
            <div className='text-center'>
              <div className='text-3xl font-bold text-green-600'>
                {Object.keys(stats.relationsByType).length}
              </div>
              <div className='text-sm text-gray-600'>关系类型数</div>
            </div>
            <div className='text-center'>
              <div className='text-3xl font-bold text-purple-600'>
                {Math.round(stats.recommendationScore * 100)}%
              </div>
              <div className='text-sm text-gray-600'>推荐分数</div>
            </div>
          </div>
        </div>
      )}

      {/* 关系图谱 */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-6'>
        <h2 className='text-2xl font-bold mb-4'>关系图谱</h2>
        <LawArticleGraphVisualization centerArticleId={articleId} depth={2} />
      </div>

      {/* 推荐法条 */}
      {recommendations.length > 0 && (
        <div className='bg-white rounded-lg shadow-md p-6'>
          <h2 className='text-2xl font-bold mb-4'>推荐法条</h2>
          <div className='space-y-4'>
            {recommendations.map(rec => (
              <div
                key={rec.article.id}
                className='border rounded-lg p-4 hover:bg-gray-50'
              >
                <div
                  className='cursor-pointer'
                  onClick={() => router.push(`/law-articles/${rec.article.id}`)}
                >
                  <div className='flex items-start justify-between mb-2'>
                    <div className='flex-1'>
                      <h3 className='text-lg font-semibold'>
                        {rec.article.lawName} 第{rec.article.articleNumber}条
                      </h3>
                      <p className='text-gray-600 text-sm mt-1'>
                        {rec.article.fullText}
                      </p>
                    </div>
                    <div className='ml-4 text-right'>
                      <div className='text-sm font-semibold text-blue-600'>
                        相关性: {Math.round(rec.score * 100)}%
                      </div>
                      {rec.relationType && (
                        <div className='text-xs text-gray-500 mt-1'>
                          {getRelationTypeLabel(rec.relationType)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className='text-sm text-gray-500 mb-3'>{rec.reason}</div>
                </div>
                {/* 推荐反馈按钮 */}
                <div className='mt-3 pt-3 border-t'>
                  <RecommendationFeedbackButton
                    userId={userId}
                    lawArticleId={rec.article.id}
                    lawArticleName={`${rec.article.lawName}第${rec.article.articleNumber}条`}
                    contextType='GENERAL'
                    contextId={articleId}
                    showCommentInput={true}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 获取分类标签
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    CIVIL: '民事',
    CRIMINAL: '刑事',
    ADMINISTRATIVE: '行政',
    COMMERCIAL: '商事',
    LABOR: '劳动',
  };
  return labels[category] || category;
}

/**
 * 获取关系类型标签
 */
function getRelationTypeLabel(relationType: string): string {
  const labels: Record<string, string> = {
    CITES: '引用',
    CITED_BY: '被引用',
    CONFLICTS: '冲突',
    COMPLETES: '补全',
    COMPLETED_BY: '被补全',
    SUPERSEDES: '替代',
    SUPERSEDED_BY: '被替代',
    IMPLEMENTS: '实施',
    IMPLEMENTED_BY: '被实施',
    RELATED: '相关',
  };
  return labels[relationType] || relationType;
}
