/**
 * 辩论推荐组件
 * 功能：显示辩论相关的推荐法条，支持选择和查看详情
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Search } from 'lucide-react';

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
interface DebateRecommendationsProps {
  debateId: string;
  onSelect?: (article: LawArticle) => void;
  showFilter?: boolean;
  limit?: number;
  minScore?: number;
}

/**
 * 辩论推荐组件
 */
export function DebateRecommendations({
  debateId,
  onSelect,
  showFilter = false,
  limit = 10,
  minScore = 0,
}: DebateRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<
    Recommendation[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');

  // 获取推荐法条
  const fetchRecommendations = useCallback(async () => {
    if (!debateId) {
      setError('无效的辩论ID');
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
        `/api/v1/debates/${debateId}/recommendations?${params}`
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
    } finally {
      setIsLoading(false);
    }
  }, [debateId, limit, minScore]);

  // 初始加载
  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

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

  // 处理选择
  const handleSelect = (article: LawArticle) => {
    if (onSelect) {
      onSelect(article);
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

  // 错误状态 — 以空状态形式呈现，避免干扰主界面
  if (error) {
    return (
      <div className='rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-10 text-center dark:border-zinc-700 dark:bg-zinc-800'>
        <BookOpen className='mx-auto mb-3 h-10 w-10 text-zinc-400' />
        <p className='text-sm text-zinc-600 dark:text-zinc-400'>暂无推荐法条</p>
        <button
          onClick={fetchRecommendations}
          className='mt-3 text-xs text-zinc-400 underline hover:text-zinc-600 dark:hover:text-zinc-200'
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
          const scorePercent = Math.round(rec.score * 100);

          return (
            <div
              key={rec.article.id}
              className='rounded-lg border border-zinc-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900'
            >
              {/* 法条标题 */}
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2'>
                    <h4 className='font-semibold text-zinc-900 dark:text-zinc-50'>
                      {rec.article.lawName}
                    </h4>
                    <span className='rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'>
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

                  {onSelect && (
                    <button
                      onClick={() => handleSelect(rec.article)}
                      className='rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700'
                    >
                      选择
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
