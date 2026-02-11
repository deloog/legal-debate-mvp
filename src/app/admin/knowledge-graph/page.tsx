/**
 * 知识图谱管理后台页面
 * 路径: /admin/knowledge-graph
 */

'use client';

// 禁用静态生成，因为需要使用 NextAuth session
export const dynamic = 'force-dynamic';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  BarChart3,
  CheckCircle,
  Network,
  RefreshCw,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface RelationStats {
  total: number;
  verified: number;
  pending: number;
  rejected: number;
  verificationRate: number;
  byType: Record<string, number>;
  byDiscoveryMethod: Record<string, number>;
  avgConfidence: number;
  avgStrength: number;
}

interface RecommendationStats {
  totalArticles: number;
  articlesWithRelations: number;
  coverageRate: number;
  totalRelations: number;
  verifiedRelations: number;
  avgRelationsPerArticle: number;
  topArticles: Array<{
    article: {
      id: string;
      lawName: string;
      articleNumber: string;
      fullText: string;
    };
    relationCount: number;
  }>;
}

interface PendingRelation {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  strength: number;
  confidence: number;
  description?: string;
  discoveryMethod: string;
  verificationStatus: string;
  createdAt: string;
  source: {
    id: string;
    lawName: string;
    articleNumber: string;
    fullText: string;
  };
  target: {
    id: string;
    lawName: string;
    articleNumber: string;
    fullText: string;
  };
}

export default function KnowledgeGraphAdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [relationStats, setRelationStats] = useState<RelationStats | null>(
    null
  );
  const [recommendationStats, setRecommendationStats] =
    useState<RecommendationStats | null>(null);
  const [pendingRelations, setPendingRelations] = useState<PendingRelation[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载统计数据
  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsRes, recStatsRes, pendingRes] = await Promise.all([
        fetch('/api/v1/law-article-relations/stats'),
        fetch('/api/v1/law-article-relations/recommendation-stats'),
        fetch('/api/v1/law-article-relations/pending?pageSize=10'),
      ]);

      if (!statsRes.ok || !recStatsRes.ok || !pendingRes.ok) {
        throw new Error('加载数据失败');
      }

      const [statsData, recStatsData, pendingData] = await Promise.all([
        statsRes.json(),
        recStatsRes.json(),
        pendingRes.json(),
      ]);

      setRelationStats(statsData.data);
      setRecommendationStats(recStatsData.data);
      setPendingRelations(pendingData.data.relations);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  // 获取会话信息
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const userId = session?.user?.id || 'anonymous';

  // 审核关系
  const handleVerify = async (relationId: string, approved: boolean) => {
    try {
      const res = await fetch(
        `/api/v1/law-article-relations/${relationId}/verify`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            approved,
            verifiedBy: userId,
          }),
        }
      );

      if (!res.ok) {
        throw new Error('审核失败');
      }

      // 重新加载数据
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : '审核失败');
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <RefreshCw className='w-8 h-8 animate-spin text-gray-400' />
      </div>
    );
  }

  return (
    <div className='container mx-auto p-6 space-y-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>知识图谱管理</h1>
          <p className='text-gray-500 mt-1'>
            管理法条关系、审核质量、监控推荐效果
          </p>
        </div>
        <Button onClick={loadStats} variant='outline'>
          <RefreshCw className='w-4 h-4 mr-2' />
          刷新数据
        </Button>
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value='overview'>概览</TabsTrigger>
          <TabsTrigger value='review'>关系审核</TabsTrigger>
          <TabsTrigger value='quality'>质量统计</TabsTrigger>
          <TabsTrigger value='recommendation'>推荐监控</TabsTrigger>
        </TabsList>

        {/* 概览标签 */}
        <TabsContent value='overview' className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-gray-500'>
                  总关系数
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>
                  {relationStats?.total || 0}
                </div>
                <p className='text-xs text-gray-500 mt-1'>
                  平均置信度:{' '}
                  {((relationStats?.avgConfidence || 0) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-gray-500'>
                  已验证
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold text-green-600'>
                  {relationStats?.verified || 0}
                </div>
                <p className='text-xs text-gray-500 mt-1'>
                  验证率:{' '}
                  {((relationStats?.verificationRate || 0) * 100).toFixed(1)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-gray-500'>
                  待审核
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold text-yellow-600'>
                  {relationStats?.pending || 0}
                </div>
                <p className='text-xs text-gray-500 mt-1'>需要人工审核</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className='pb-2'>
                <CardTitle className='text-sm font-medium text-gray-500'>
                  覆盖率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold text-blue-600'>
                  {((recommendationStats?.coverageRate || 0) * 100).toFixed(1)}%
                </div>
                <p className='text-xs text-gray-500 mt-1'>
                  {recommendationStats?.articlesWithRelations || 0} /{' '}
                  {recommendationStats?.totalArticles || 0} 法条
                </p>
              </CardContent>
            </Card>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <Network className='w-5 h-5' />
                  关系类型分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  {Object.entries(relationStats?.byType || {}).map(
                    ([type, count]) => (
                      <div
                        key={type}
                        className='flex items-center justify-between'
                      >
                        <span className='text-sm'>{type}</span>
                        <Badge variant='secondary'>{count}</Badge>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                  <BarChart3 className='w-5 h-5' />
                  发现方式分布
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-2'>
                  {Object.entries(relationStats?.byDiscoveryMethod || {}).map(
                    ([method, count]) => (
                      <div
                        key={method}
                        className='flex items-center justify-between'
                      >
                        <span className='text-sm'>{method}</span>
                        <Badge variant='secondary'>{count}</Badge>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 关系审核标签 */}
        <TabsContent value='review' className='space-y-4'>
          <Card>
            <CardHeader>
              <CardTitle>待审核关系</CardTitle>
              <CardDescription>
                共 {relationStats?.pending || 0} 条待审核关系
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pendingRelations.length === 0 ? (
                <div className='text-center py-8 text-gray-500'>
                  <CheckCircle className='w-12 h-12 mx-auto mb-2 text-green-500' />
                  <p>暂无待审核关系</p>
                </div>
              ) : (
                <div className='space-y-4'>
                  {pendingRelations.map(relation => (
                    <Card
                      key={relation.id}
                      className='border-l-4 border-l-yellow-500'
                    >
                      <CardContent className='pt-6'>
                        <div className='space-y-3'>
                          <div className='flex items-start justify-between'>
                            <div className='flex-1'>
                              <div className='flex items-center gap-2 mb-2'>
                                <Badge>{relation.relationType}</Badge>
                                <Badge variant='outline'>
                                  {relation.discoveryMethod}
                                </Badge>
                                <span className='text-sm text-gray-500'>
                                  置信度:{' '}
                                  {(relation.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className='grid grid-cols-2 gap-4'>
                                <div>
                                  <p className='text-xs text-gray-500 mb-1'>
                                    源法条
                                  </p>
                                  <p className='text-sm font-medium'>
                                    {relation.source.lawName}{' '}
                                    {relation.source.articleNumber}
                                  </p>
                                  <p className='text-xs text-gray-600 mt-1 line-clamp-2'>
                                    {relation.source.fullText}
                                  </p>
                                </div>
                                <div>
                                  <p className='text-xs text-gray-500 mb-1'>
                                    目标法条
                                  </p>
                                  <p className='text-sm font-medium'>
                                    {relation.target.lawName}{' '}
                                    {relation.target.articleNumber}
                                  </p>
                                  <p className='text-xs text-gray-600 mt-1 line-clamp-2'>
                                    {relation.target.fullText}
                                  </p>
                                </div>
                              </div>
                              {relation.description && (
                                <p className='text-sm text-gray-600 mt-2'>
                                  {relation.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className='flex gap-2 pt-2 border-t'>
                            <Button
                              size='sm'
                              onClick={() => handleVerify(relation.id, true)}
                              className='flex-1'
                            >
                              <CheckCircle className='w-4 h-4 mr-1' />
                              通过
                            </Button>
                            <Button
                              size='sm'
                              variant='destructive'
                              onClick={() => handleVerify(relation.id, false)}
                              className='flex-1'
                            >
                              <XCircle className='w-4 h-4 mr-1' />
                              拒绝
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 质量统计标签 */}
        <TabsContent value='quality' className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-sm'>平均置信度</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold'>
                  {((relationStats?.avgConfidence || 0) * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-sm'>平均强度</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold'>
                  {((relationStats?.avgStrength || 0) * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-sm'>验证率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold text-green-600'>
                  {((relationStats?.verificationRate || 0) * 100).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>关系质量分析</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div>
                  <div className='flex justify-between mb-2'>
                    <span className='text-sm font-medium'>已验证</span>
                    <span className='text-sm text-gray-500'>
                      {relationStats?.verified || 0} /{' '}
                      {relationStats?.total || 0}
                    </span>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <div
                      className='bg-green-600 h-2 rounded-full'
                      style={{
                        width: `${((relationStats?.verificationRate || 0) * 100).toFixed(1)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className='flex justify-between mb-2'>
                    <span className='text-sm font-medium'>待审核</span>
                    <span className='text-sm text-gray-500'>
                      {relationStats?.pending || 0} /{' '}
                      {relationStats?.total || 0}
                    </span>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <div
                      className='bg-yellow-600 h-2 rounded-full'
                      style={{
                        width: `${(((relationStats?.pending || 0) / (relationStats?.total || 1)) * 100).toFixed(1)}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div className='flex justify-between mb-2'>
                    <span className='text-sm font-medium'>已拒绝</span>
                    <span className='text-sm text-gray-500'>
                      {relationStats?.rejected || 0} /{' '}
                      {relationStats?.total || 0}
                    </span>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <div
                      className='bg-red-600 h-2 rounded-full'
                      style={{
                        width: `${(((relationStats?.rejected || 0) / (relationStats?.total || 1)) * 100).toFixed(1)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 推荐监控标签 */}
        <TabsContent value='recommendation' className='space-y-6'>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
            <Card>
              <CardHeader>
                <CardTitle className='text-sm'>法条覆盖率</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold text-blue-600'>
                  {((recommendationStats?.coverageRate || 0) * 100).toFixed(1)}%
                </div>
                <p className='text-xs text-gray-500 mt-1'>
                  {recommendationStats?.articlesWithRelations || 0} /{' '}
                  {recommendationStats?.totalArticles || 0}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-sm'>平均关系数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold'>
                  {(recommendationStats?.avgRelationsPerArticle || 0).toFixed(
                    2
                  )}
                </div>
                <p className='text-xs text-gray-500 mt-1'>
                  每个法条的平均关系数
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className='text-sm'>已验证关系</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='text-3xl font-bold text-green-600'>
                  {recommendationStats?.verifiedRelations || 0}
                </div>
                <p className='text-xs text-gray-500 mt-1'>
                  / {recommendationStats?.totalRelations || 0} 总关系
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className='flex items-center gap-2'>
                <TrendingUp className='w-5 h-5' />
                热门法条（关系数最多）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-3'>
                {(recommendationStats?.topArticles || []).map((item, index) => (
                  <div
                    key={item.article.id}
                    className='flex items-start gap-3 p-3 border rounded-lg'
                  >
                    <div className='flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600'>
                      {index + 1}
                    </div>
                    <div className='flex-1'>
                      <p className='font-medium'>
                        {item.article.lawName} {item.article.articleNumber}
                      </p>
                      <p className='text-sm text-gray-600 mt-1 line-clamp-2'>
                        {item.article.fullText}
                      </p>
                      <div className='flex items-center gap-2 mt-2'>
                        <Badge variant='secondary'>
                          {item.relationCount} 个关系
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
