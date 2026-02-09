/**
 * 内部系统首页
 *
 * 功能：
 * 1. 显示系统概览统计
 * 2. 提供快速操作入口
 * 3. 显示知识图谱统计
 * 4. 不包含营销内容
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';

/**
 * 系统概览数据
 */
interface SystemOverview {
  totalLawArticles: number;
  totalRelations: number;
  relationCoverage: number;
  lastSyncTime: string;
}

/**
 * 知识图谱统计
 */
interface GraphStats {
  relationsByType: Record<string, number>;
  topArticles: Array<{ id: string; title: string; relationCount: number }>;
  recommendationAccuracy: number;
}

/**
 * 最近活动数据
 */
interface RecentActivity {
  recentArticles: Array<{
    id: string;
    lawName: string;
    articleNumber: string;
    fullText: string;
    viewedAt: string;
  }>;
  recentDebates: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    createdAt: string;
  }>;
  recentContracts: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    createdAt: string;
  }>;
}

/**
 * 内部系统首页组件
 */
export default function InternalHomepage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [graphStats, setGraphStats] = useState<GraphStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载系统数据
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        // 并行获取所有数据
        const [overviewResponse, graphStatsResponse, activityResponse] =
          await Promise.all([
            fetch('/api/v1/system/overview'),
            fetch('/api/v1/system/graph-stats'),
            fetch('/api/v1/system/recent-activity'),
          ]);

        if (overviewResponse && overviewResponse.ok) {
          const overviewData = await overviewResponse.json();
          setOverview(overviewData);
        }

        if (graphStatsResponse && graphStatsResponse.ok) {
          const graphStatsData = await graphStatsResponse.json();
          setGraphStats(graphStatsData);
        }

        if (activityResponse && activityResponse.ok) {
          const activityData = await activityResponse.json();
          setActivity(activityData);
        }
      } catch (err) {
        console.error('加载失败:', err);
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading) {
      loadData();
    }
  }, [authLoading]);

  // 加载状态
  if (authLoading || loading) {
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
          <p className='text-lg text-red-600 mb-4'>加载失败，请稍后重试</p>
          <button
            onClick={() => window.location.reload()}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='container mx-auto px-4 py-8'>
      {/* 页面标题 */}
      <div className='mb-8'>
        <h1 className='text-3xl font-bold mb-2'>法律知识图谱系统</h1>
        <p className='text-gray-600'>内部管理工作台</p>
      </div>

      {/* 系统概览 */}
      {overview && (
        <div className='grid grid-cols-1 md:grid-cols-4 gap-6 mb-8'>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <div className='text-3xl font-bold text-blue-600 mb-2'>
              {overview.totalLawArticles.toLocaleString()}
            </div>
            <div className='text-sm text-gray-600'>法条总数</div>
          </div>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <div className='text-3xl font-bold text-green-600 mb-2'>
              {overview.totalRelations.toLocaleString()}
            </div>
            <div className='text-sm text-gray-600'>关系总数</div>
          </div>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <div className='text-3xl font-bold text-purple-600 mb-2'>
              {Math.round(overview.relationCoverage * 100)}%
            </div>
            <div className='text-sm text-gray-600'>关系覆盖率</div>
          </div>
          <div className='bg-white rounded-lg shadow-md p-6'>
            <div className='text-sm font-semibold text-gray-700 mb-2'>
              最后同步
            </div>
            <div className='text-xs text-gray-600'>
              {new Date(overview.lastSyncTime).toLocaleString('zh-CN')}
            </div>
          </div>
        </div>
      )}

      {/* 快速操作 */}
      <div className='bg-white rounded-lg shadow-md p-6 mb-8'>
        <h2 className='text-2xl font-bold mb-4'>快速操作</h2>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <button
            onClick={() => router.push('/law-articles/search')}
            className='p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors'
          >
            <div className='text-lg font-semibold mb-1'>搜索法条</div>
            <div className='text-sm text-gray-600'>查找法律条文</div>
          </button>
          <button
            onClick={() => router.push('/knowledge-graph')}
            className='p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors'
          >
            <div className='text-lg font-semibold mb-1'>知识图谱</div>
            <div className='text-sm text-gray-600'>浏览关系网络</div>
          </button>
          <button
            onClick={() => router.push('/debates/new')}
            className='p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors'
          >
            <div className='text-lg font-semibold mb-1'>创建辩论</div>
            <div className='text-sm text-gray-600'>生成法律辩论</div>
          </button>
          <button
            onClick={() => router.push('/contracts/review')}
            className='p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors'
          >
            <div className='text-lg font-semibold mb-1'>合同审查</div>
            <div className='text-sm text-gray-600'>智能合同分析</div>
          </button>
        </div>
      </div>

      {/* 最近活动 */}
      {activity && (
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
          {/* 最近查看的法条 */}
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h3 className='text-lg font-semibold mb-4'>最近查看的法条</h3>
            {activity.recentArticles && activity.recentArticles.length > 0 ? (
              <div className='space-y-3'>
                {activity.recentArticles.map(article => (
                  <button
                    key={article.id}
                    onClick={() => router.push(`/law-articles/${article.id}`)}
                    className='w-full text-left p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors'
                  >
                    <div className='font-medium text-gray-900'>
                      {article.lawName}
                    </div>
                    <div className='text-sm text-gray-600'>
                      {article.articleNumber}
                    </div>
                    <div className='text-xs text-gray-500 mt-1'>
                      {formatRelativeTime(article.viewedAt)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className='text-gray-500 text-sm'>暂无记录</p>
            )}
          </div>

          {/* 最近的辩论 */}
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h3 className='text-lg font-semibold mb-4'>最近的辩论</h3>
            {activity.recentDebates && activity.recentDebates.length > 0 ? (
              <div className='space-y-3'>
                {activity.recentDebates.map(debate => (
                  <button
                    key={debate.id}
                    onClick={() => router.push(`/debates/${debate.id}`)}
                    className='w-full text-left p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors'
                  >
                    <div className='font-medium text-gray-900'>
                      {debate.title}
                    </div>
                    <div className='text-sm text-gray-600 truncate'>
                      {debate.description}
                    </div>
                    <div className='text-xs text-gray-500 mt-1'>
                      {formatRelativeTime(debate.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className='text-gray-500 text-sm'>暂无记录</p>
            )}
          </div>

          {/* 最近的合同 */}
          <div className='bg-white rounded-lg shadow-md p-6'>
            <h3 className='text-lg font-semibold mb-4'>最近的合同</h3>
            {activity.recentContracts && activity.recentContracts.length > 0 ? (
              <div className='space-y-3'>
                {activity.recentContracts.map(contract => (
                  <button
                    key={contract.id}
                    onClick={() => router.push(`/contracts/${contract.id}`)}
                    className='w-full text-left p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors'
                  >
                    <div className='font-medium text-gray-900'>
                      {contract.title}
                    </div>
                    <div className='text-sm text-gray-600'>{contract.type}</div>
                    <div className='text-xs text-gray-500 mt-1'>
                      {formatRelativeTime(contract.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className='text-gray-500 text-sm'>暂无记录</p>
            )}
          </div>
        </div>
      )}

      {/* 知识图谱统计 */}
      {graphStats && (
        <div className='bg-white rounded-lg shadow-md p-6'>
          <h2 className='text-2xl font-bold mb-4'>知识图谱统计</h2>

          {/* 关系类型统计 */}
          <div className='mb-6'>
            <h3 className='text-lg font-semibold mb-3'>关系类型分布</h3>
            <div className='grid grid-cols-2 md:grid-cols-5 gap-4'>
              {Object.entries(graphStats.relationsByType).map(
                ([type, count]) => (
                  <div
                    key={type}
                    className='text-center p-3 bg-gray-50 rounded'
                  >
                    <div className='text-2xl font-bold text-blue-600'>
                      {count}
                    </div>
                    <div className='text-xs text-gray-600'>
                      {getRelationTypeLabel(type)}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* 推荐准确率 */}
          <div className='flex items-center justify-between p-4 bg-green-50 rounded-lg'>
            <div>
              <div className='text-sm text-gray-600'>推荐准确率</div>
              <div className='text-2xl font-bold text-green-600'>
                {Math.round(graphStats.recommendationAccuracy * 100)}%
              </div>
            </div>
            <div className='text-sm text-gray-600'>基于用户反馈和验证数据</div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 获取关系类型标签
 */
function getRelationTypeLabel(type: string): string {
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
  return labels[type] || type;
}

/**
 * 格式化相对时间
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}分钟前`;
    }
    return `${hours}小时前`;
  } else if (days === 1) {
    return '昨天';
  } else if (days < 7) {
    return `${days}天前`;
  } else {
    return date.toLocaleDateString('zh-CN');
  }
}
