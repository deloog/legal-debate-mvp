/**
 * 合同推荐组件
 * 功能：显示合同相关的推荐法条，支持选择和查看详情
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Search,
  AlertCircle,
  Check,
  X,
  Loader2,
} from 'lucide-react';

/**
 * 法条信息
 */
interface LawArticle {
  id: string;
  lawName: string;
  articleNumber: string;
  fullText: string;
  category: string;
  effectiveDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  keywords?: string[];
  tags?: string[];
  // 关联信息（如果已关联）
  associationId?: string;
  addedBy?: string;
  addedAt?: Date;
  reason?: string;
  relevanceScore?: number;
}

/**
 * 推荐结果
 */
interface Recommendation {
  article: LawArticle;
  score: number;
  reason: string;
  relationType?: string;
}

/**
 * 组件属性
 */
interface ContractRecommendationsProps {
  contractId: string;
  userId: string; // 当前用户ID，用于记录添加人
  onSelect?: (article: LawArticle) => void;
  showFilter?: boolean;
  limit?: number;
  minScore?: number;
}

/**
 * 合同推荐组件
 */
export function ContractRecommendations({
  contractId,
  userId,
  onSelect,
  showFilter = false,
  limit = 10,
  minScore = 0,
}: ContractRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<
    Recommendation[]
  >([]);
  const [associatedArticles, setAssociatedArticles] = useState<LawArticle[]>(
    []
  );
  const [associatedArticleIds, setAssociatedArticleIds] = useState<Set<string>>(
    new Set()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showAssociated, setShowAssociated] = useState(true);

  // 获取已关联的法条
  const fetchAssociatedArticles = useCallback(async () => {
    if (!contractId) return;

    try {
      const response = await fetch(
        `/api/v1/contracts/${contractId}/law-articles`
      );

      if (!response.ok) {
        throw new Error('获取已关联法条失败');
      }

      const data = await response.json();
      const articles = data.lawArticles || [];
      setAssociatedArticles(articles);
      setAssociatedArticleIds(new Set(articles.map((a: LawArticle) => a.id)));
    } catch (err) {
      console.error('获取已关联法条失败:', err);
    }
  }, [contractId]);

  // 获取推荐法条
  const fetchRecommendations = useCallback(async () => {
    if (!contractId) {
      setError('无效的合同ID');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        limit: limit.toString(),
        minScore: minScore.toString(),
      });

      const response = await fetch(
        `/api/v1/contracts/${contractId}/recommendations?${params}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '获取推荐失败');
      }

      const data = await response.json();
      setRecommendations(data.recommendations || []);
      setFilteredRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
      console.error('获取推荐失败:', err);
    } finally {
      setIsLoading(false);
    }
  }, [contractId, limit, minScore]);

  // 初始加载
  useEffect(() => {
    fetchRecommendations();
    fetchAssociatedArticles();
  }, [fetchRecommendations, fetchAssociatedArticles]);

  // 过滤推荐结果
  useEffect(() => {
    if (!filterText) {
      setFilteredRecommendations(recommendations);
      return;
    }

    const filtered = recommendations.filter(
      rec =>
        rec.article.lawName.includes(filterText) ||
        rec.article.articleNumber.includes(filterText) ||
        rec.article.fullText.includes(filterText)
    );
    setFilteredRecommendations(filtered);
  }, [filterText, recommendations]);

  // 切换展开状态
  const toggleExpand = (articleId: string) => {
    setExpandedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(articleId)) {
        newSet.delete(articleId);
      } else {
        newSet.add(articleId);
      }
      return newSet;
    });
  };

  // 添加法条关联
  const handleAddAssociation = async (article: LawArticle, score: number) => {
    if (processingIds.has(article.id)) return;

    try {
      setProcessingIds(prev => new Set(prev).add(article.id));

      const response = await fetch(
        `/api/v1/contracts/${contractId}/law-articles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            lawArticleId: article.id,
            addedBy: userId,
            reason: '基于推荐系统选择',
            relevanceScore: score,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '添加关联失败');
      }

      // 刷新已关联法条列表
      await fetchAssociatedArticles();

      // 调用回调
      if (onSelect) {
        onSelect(article);
      }
    } catch (err) {
      console.error('添加关联失败:', err);
      alert(err instanceof Error ? err.message : '添加关联失败');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(article.id);
        return newSet;
      });
    }
  };

  // 删除法条关联
  const handleRemoveAssociation = async (articleId: string) => {
    if (processingIds.has(articleId)) return;

    try {
      setProcessingIds(prev => new Set(prev).add(articleId));

      const response = await fetch(
        `/api/v1/contracts/${contractId}/law-articles/${articleId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '删除关联失败');
      }

      // 刷新已关联法条列表
      await fetchAssociatedArticles();
    } catch (err) {
      console.error('删除关联失败:', err);
      alert(err instanceof Error ? err.message : '删除关联失败');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-8'>
        <div className='text-zinc-600 dark:text-zinc-400'>加载中...</div>
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className='rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20'>
        <AlertCircle className='mx-auto mb-2 h-8 w-8 text-red-600' />
        <p className='text-red-900 dark:text-red-300'>{error}</p>
        <button
          onClick={fetchRecommendations}
          className='mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-900/20'
        >
          重新加载
        </button>
      </div>
    );
  }

  // 空状态
  if (recommendations.length === 0) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800'>
        <BookOpen className='mx-auto mb-4 h-12 w-12 text-zinc-400' />
        <h3 className='mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
          暂无推荐法条
        </h3>
        <p className='text-sm text-zinc-600 dark:text-zinc-400'>
          系统未找到相关的法条推荐
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* 已关联法条区域 */}
      {associatedArticles.length > 0 && (
        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <Check className='h-5 w-5 text-green-600' />
              <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
                已关联法条（{associatedArticles.length}条）
              </h3>
            </div>
            <button
              onClick={() => setShowAssociated(!showAssociated)}
              className='text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400'
            >
              {showAssociated ? '收起' : '展开'}
            </button>
          </div>

          {showAssociated && (
            <div className='space-y-3'>
              {associatedArticles.map(article => {
                const isExpanded = expandedIds.has(article.id);
                const isProcessing = processingIds.has(article.id);

                return (
                  <div
                    key={article.id}
                    className='rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20'
                  >
                    <div className='flex items-start justify-between gap-4'>
                      <div className='flex-1'>
                        <div className='flex items-center gap-2'>
                          <Check className='h-4 w-4 text-green-600' />
                          <h4 className='font-semibold text-zinc-900 dark:text-zinc-50'>
                            {article.lawName}
                          </h4>
                          <span className='rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'>
                            {article.articleNumber}
                          </span>
                        </div>

                        {article.reason && (
                          <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
                            {article.reason}
                          </p>
                        )}

                        {isExpanded && (
                          <div className='mt-3 rounded-lg bg-white p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'>
                            {article.fullText}
                          </div>
                        )}
                      </div>

                      <div className='flex flex-col gap-2'>
                        <button
                          onClick={() => toggleExpand(article.id)}
                          className='rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                          aria-label={isExpanded ? '收起' : '展开'}
                        >
                          {isExpanded ? (
                            <ChevronUp className='h-4 w-4' />
                          ) : (
                            <ChevronDown className='h-4 w-4' />
                          )}
                        </button>

                        <button
                          onClick={() => handleRemoveAssociation(article.id)}
                          disabled={isProcessing}
                          className='flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50'
                        >
                          {isProcessing ? (
                            <Loader2 className='h-4 w-4 animate-spin' />
                          ) : (
                            <X className='h-4 w-4' />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 推荐法条区域 */}
      <div className='space-y-4'>
        {/* 标题和过滤器 */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-2'>
            <BookOpen className='h-5 w-5 text-blue-600' />
            <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-50'>
              推荐法条（{filteredRecommendations.length}条）
            </h3>
          </div>

          {showFilter && (
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400' />
              <input
                type='text'
                placeholder='搜索法条...'
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                className='rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100'
              />
            </div>
          )}
        </div>

        {/* 推荐列表 */}
        <div className='space-y-3'>
          {filteredRecommendations.map(rec => {
            const isExpanded = expandedIds.has(rec.article.id);
            const isAssociated = associatedArticleIds.has(rec.article.id);
            const isProcessing = processingIds.has(rec.article.id);
            const scorePercent = Math.round(rec.score * 100);

            return (
              <div
                key={rec.article.id}
                className={`rounded-lg border p-4 transition-shadow hover:shadow-md ${
                  isAssociated
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                }`}
              >
                {/* 法条标题 */}
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2'>
                      {isAssociated && (
                        <Check className='h-4 w-4 text-green-600' />
                      )}
                      <h4 className='font-semibold text-zinc-900 dark:text-zinc-50'>
                        {rec.article.lawName}
                      </h4>
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          isAssociated
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        }`}
                      >
                        {rec.article.articleNumber}
                      </span>
                    </div>

                    {/* 推荐分数 */}
                    <div className='mt-2 flex items-center gap-2'>
                      <div className='h-2 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700'>
                        <div
                          className='h-full bg-blue-600 transition-all'
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                      <span className='text-sm font-medium text-zinc-700 dark:text-zinc-300'>
                        {scorePercent}%
                      </span>
                    </div>

                    {/* 推荐原因 */}
                    <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
                      {rec.reason}
                    </p>

                    {/* 展开的法条内容 */}
                    {isExpanded && (
                      <div className='mt-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'>
                        {rec.article.fullText}
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <div className='flex flex-col gap-2'>
                    <button
                      onClick={() => toggleExpand(rec.article.id)}
                      className='rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      aria-label={isExpanded ? '收起' : '展开'}
                    >
                      {isExpanded ? (
                        <ChevronUp className='h-4 w-4' />
                      ) : (
                        <ChevronDown className='h-4 w-4' />
                      )}
                    </button>

                    {isAssociated ? (
                      <button
                        onClick={() => handleRemoveAssociation(rec.article.id)}
                        disabled={isProcessing}
                        className='flex items-center justify-center rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50'
                        title='取消关联'
                      >
                        {isProcessing ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          <X className='h-4 w-4' />
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          handleAddAssociation(rec.article, rec.score)
                        }
                        disabled={isProcessing}
                        className='flex items-center justify-center rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50'
                        title='选择'
                      >
                        {isProcessing ? (
                          <Loader2 className='h-4 w-4 animate-spin' />
                        ) : (
                          '选择'
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
