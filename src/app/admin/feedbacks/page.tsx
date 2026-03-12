/**
 * 管理后台 - 用户反馈页面
 *
 * 功能：
 * 1. 查看推荐反馈和关系反馈
 * 2. 统计反馈数据
 * 3. 分析反馈趋势
 */

'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ThumbsUp,
  ThumbsDown,
  XCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface FeedbackStats {
  total: number;
  byType: Array<{
    feedbackType: string;
    count: number;
    percentage: number;
  }>;
  trend?: Array<{
    date: string;
    count: number;
  }>;
}

interface Feedback {
  id: string;
  userId: string;
  feedbackType: string;
  comment?: string;
  createdAt: string;
  lawArticle?: {
    id: string;
    lawName: string;
    articleNumber: string;
  };
  relation?: {
    id: string;
    sourceArticleId: string;
    targetArticleId: string;
    relationType: string;
  };
}

interface FeedbackListData {
  feedbacks: Feedback[];
  total: number;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

const RECOMMENDATION_FEEDBACK_LABELS: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  HELPFUL: {
    label: '有用',
    icon: <ThumbsUp className='w-4 h-4' />,
    color: 'bg-green-100 text-green-800',
  },
  NOT_HELPFUL: {
    label: '无用',
    icon: <ThumbsDown className='w-4 h-4' />,
    color: 'bg-red-100 text-red-800',
  },
  IRRELEVANT: {
    label: '不相关',
    icon: <XCircle className='w-4 h-4' />,
    color: 'bg-gray-100 text-gray-800',
  },
  EXCELLENT: {
    label: '优秀',
    icon: <CheckCircle className='w-4 h-4' />,
    color: 'bg-blue-100 text-blue-800',
  },
};

const RELATION_FEEDBACK_LABELS: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  ACCURATE: {
    label: '准确',
    icon: <CheckCircle className='w-4 h-4' />,
    color: 'bg-green-100 text-green-800',
  },
  INACCURATE: {
    label: '不准确',
    icon: <XCircle className='w-4 h-4' />,
    color: 'bg-red-100 text-red-800',
  },
  MISSING: {
    label: '缺失',
    icon: <AlertTriangle className='w-4 h-4' />,
    color: 'bg-yellow-100 text-yellow-800',
  },
  SHOULD_REMOVE: {
    label: '应删除',
    icon: <XCircle className='w-4 h-4' />,
    color: 'bg-red-100 text-red-800',
  },
  WRONG_TYPE: {
    label: '类型错误',
    icon: <AlertTriangle className='w-4 h-4' />,
    color: 'bg-orange-100 text-orange-800',
  },
};

export default function FeedbacksPage() {
  const [recommendationStats, setRecommendationStats] =
    useState<FeedbackStats | null>(null);
  const [relationStats, setRelationStats] = useState<FeedbackStats | null>(
    null
  );
  const [recommendationList, setRecommendationList] =
    useState<FeedbackListData | null>(null);
  const [relationList, setRelationList] = useState<FeedbackListData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // 加载统计数据
  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        setError(null);

        // 获取推荐反馈统计
        const recStatsResponse = await fetch(
          '/api/v1/feedbacks/stats?type=recommendation&includeTrend=true'
        );
        if (recStatsResponse.ok) {
          const recStatsData = await recStatsResponse.json();
          setRecommendationStats(recStatsData.data);
        }

        // 获取关系反馈统计
        const relStatsResponse = await fetch(
          '/api/v1/feedbacks/stats?type=relation&includeTrend=true'
        );
        if (relStatsResponse.ok) {
          const relStatsData = await relStatsResponse.json();
          setRelationStats(relStatsData.data);
        }

        // 获取推荐反馈列表
        const recListResponse = await fetch(
          `/api/v1/feedbacks/list?type=recommendation&page=${currentPage}&pageSize=10`
        );
        if (recListResponse.ok) {
          const recListData = await recListResponse.json();
          setRecommendationList(recListData.data);
        }

        // 获取关系反馈列表
        const relListResponse = await fetch(
          `/api/v1/feedbacks/list?type=relation&page=${currentPage}&pageSize=10`
        );
        if (relListResponse.ok) {
          const relListData = await relListResponse.json();
          setRelationList(relListData.data);
        }
      } catch (err) {
        console.error('加载失败:', err);
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, [currentPage]);

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

  if (error) {
    return (
      <div className='container mx-auto px-4 py-8'>
        <Alert variant='destructive'>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      <h1 className='text-3xl font-bold mb-6'>用户反馈管理</h1>

      <Tabs defaultValue='recommendation' className='space-y-6'>
        <TabsList>
          <TabsTrigger value='recommendation'>推荐反馈</TabsTrigger>
          <TabsTrigger value='relation'>关系反馈</TabsTrigger>
        </TabsList>

        {/* 推荐反馈标签页 */}
        <TabsContent value='recommendation' className='space-y-6'>
          {/* 统计概览 */}
          {recommendationStats && (
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm font-medium text-gray-600'>
                    总反馈数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-3xl font-bold'>
                    {recommendationStats.total}
                  </div>
                </CardContent>
              </Card>

              {recommendationStats.byType.map(item => {
                const config =
                  RECOMMENDATION_FEEDBACK_LABELS[item.feedbackType];
                return (
                  <Card key={item.feedbackType}>
                    <CardHeader className='pb-2'>
                      <CardTitle className='text-sm font-medium text-gray-600 flex items-center gap-2'>
                        {config?.icon}
                        {config?.label || item.feedbackType}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='text-3xl font-bold'>{item.count}</div>
                      <p className='text-sm text-gray-500 mt-1'>
                        {item.percentage.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 反馈列表 */}
          {recommendationList && (
            <Card>
              <CardHeader>
                <CardTitle>反馈列表</CardTitle>
                <CardDescription>
                  共 {recommendationList.total} 条反馈
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {recommendationList.feedbacks.map(feedback => {
                    const config =
                      RECOMMENDATION_FEEDBACK_LABELS[feedback.feedbackType];
                    return (
                      <div key={feedback.id} className='border rounded-lg p-4'>
                        <div className='flex items-start justify-between mb-2'>
                          <div className='flex-1'>
                            <div className='flex items-center gap-2 mb-2'>
                              <Badge className={config?.color}>
                                {config?.label || feedback.feedbackType}
                              </Badge>
                              <span className='text-sm text-gray-500'>
                                {new Date(feedback.createdAt).toLocaleString(
                                  'zh-CN'
                                )}
                              </span>
                            </div>
                            {feedback.lawArticle && (
                              <p className='text-sm font-medium'>
                                {feedback.lawArticle.lawName}{' '}
                                {feedback.lawArticle.articleNumber}
                              </p>
                            )}
                            {feedback.comment && (
                              <p className='text-sm text-gray-600 mt-2'>
                                {feedback.comment}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 分页 */}
                {recommendationList.pagination.totalPages > 1 && (
                  <div className='flex items-center justify-between mt-6'>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!recommendationList.pagination.hasPrev}
                      className='px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      上一页
                    </button>
                    <span className='text-sm text-gray-600'>
                      第 {recommendationList.pagination.page} /{' '}
                      {recommendationList.pagination.totalPages} 页
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!recommendationList.pagination.hasNext}
                      className='px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      下一页
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 关系反馈标签页 */}
        <TabsContent value='relation' className='space-y-6'>
          {/* 统计概览 */}
          {relationStats && (
            <div className='grid grid-cols-1 md:grid-cols-4 gap-4'>
              <Card>
                <CardHeader className='pb-2'>
                  <CardTitle className='text-sm font-medium text-gray-600'>
                    总反馈数
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className='text-3xl font-bold'>
                    {relationStats.total}
                  </div>
                </CardContent>
              </Card>

              {relationStats.byType.slice(0, 3).map(item => {
                const config = RELATION_FEEDBACK_LABELS[item.feedbackType];
                return (
                  <Card key={item.feedbackType}>
                    <CardHeader className='pb-2'>
                      <CardTitle className='text-sm font-medium text-gray-600 flex items-center gap-2'>
                        {config?.icon}
                        {config?.label || item.feedbackType}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className='text-3xl font-bold'>{item.count}</div>
                      <p className='text-sm text-gray-500 mt-1'>
                        {item.percentage.toFixed(1)}%
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* 反馈列表 */}
          {relationList && (
            <Card>
              <CardHeader>
                <CardTitle>反馈列表</CardTitle>
                <CardDescription>
                  共 {relationList.total} 条反馈
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {relationList.feedbacks.map(feedback => {
                    const config =
                      RELATION_FEEDBACK_LABELS[feedback.feedbackType];
                    return (
                      <div key={feedback.id} className='border rounded-lg p-4'>
                        <div className='flex items-start justify-between mb-2'>
                          <div className='flex-1'>
                            <div className='flex items-center gap-2 mb-2'>
                              <Badge className={config?.color}>
                                {config?.label || feedback.feedbackType}
                              </Badge>
                              <span className='text-sm text-gray-500'>
                                {new Date(feedback.createdAt).toLocaleString(
                                  'zh-CN'
                                )}
                              </span>
                            </div>
                            {feedback.relation && (
                              <p className='text-sm font-medium'>
                                关系ID: {feedback.relation.id}
                              </p>
                            )}
                            {feedback.comment && (
                              <p className='text-sm text-gray-600 mt-2'>
                                {feedback.comment}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 分页 */}
                {relationList.pagination.totalPages > 1 && (
                  <div className='flex items-center justify-between mt-6'>
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={!relationList.pagination.hasPrev}
                      className='px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      上一页
                    </button>
                    <span className='text-sm text-gray-600'>
                      第 {relationList.pagination.page} /{' '}
                      {relationList.pagination.totalPages} 页
                    </span>
                    <button
                      onClick={() => setCurrentPage(p => p + 1)}
                      disabled={!relationList.pagination.hasNext}
                      className='px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      下一页
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
