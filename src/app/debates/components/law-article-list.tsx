"use client";

import { useState, useEffect, useCallback } from "react";
import { LawArticleCard } from "./law-article-card";
import { RemoveReasonModal } from "./remove-reason-modal";
import { BookOpen, Trash2, CheckCircle2 } from "lucide-react";

interface Article {
  id: string;
  lawName: string;
  articleNumber: string;
  content: string;
  applicabilityScore?: number | null;
  applicabilityReason?: string | null;
  status?: string;
  metadata?: {
    lawyerFeedback?: {
      action: "CONFIRMED" | "REMOVED" | "MANUALLY_ADDED";
      removedReason?: "NOT_RELEVANT" | "REPEALED" | "OTHER";
      otherReason?: string;
      timestamp: string;
    };
  };
}

interface LawArticleListProps {
  debateId: string;
  roundId: string;
}

type RemoveReasonType = "NOT_RELEVANT" | "REPEALED" | "OTHER";

/**
 * 法条列表容器组件
 * 功能：管理法条推荐列表、律师干预操作
 */
export function LawArticleList({ debateId, roundId }: LawArticleListProps) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 获取法条列表
  const fetchArticles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/v1/debates/${debateId}/rounds/${roundId}/legal-references`,
      );

      if (!response.ok) {
        throw new Error("获取法条列表失败");
      }

      const data = await response.json();
      setArticles(data.articles || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
      console.error("获取法条列表失败：", err);
    } finally {
      setIsLoading(false);
    }
  }, [debateId, roundId]);

  // 确认法条适用
  const handleConfirm = async (articleId: string) => {
    try {
      const response = await fetch(
        `/api/v1/legal-references/${articleId}/feedback`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "CONFIRMED",
          }),
        },
      );

      if (!response.ok) {
        throw new Error("确认失败");
      }

      // 更新本地状态
      setArticles((prev) =>
        prev.map((a) =>
          a.id === articleId
            ? {
                ...a,
                metadata: {
                  ...a.metadata,
                  lawyerFeedback: {
                    action: "CONFIRMED",
                    timestamp: new Date().toISOString(),
                  },
                },
              }
            : a,
        ),
      );
    } catch (err) {
      console.error("确认法条失败：", err);
      alert("确认失败，请重试");
    }
  };

  // 处理移除操作
  const handleRemoveClick = (articleId: string) => {
    const article = articles.find((a) => a.id === articleId);
    if (article) {
      setSelectedArticle(article);
      setIsModalOpen(true);
    }
  };

  // 确认移除
  const handleRemoveConfirm = async (
    reason: RemoveReasonType,
    detail?: string,
  ) => {
    if (!selectedArticle) {
      return;
    }

    try {
      const response = await fetch(
        `/api/v1/legal-references/${selectedArticle.id}/feedback`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "REMOVED",
            removedReason: reason,
            otherReason: detail,
          }),
        },
      );

      if (!response.ok) {
        throw new Error("移除失败");
      }

      // 更新本地状态
      setArticles((prev) =>
        prev.map((a) =>
          a.id === selectedArticle.id
            ? {
                ...a,
                metadata: {
                  ...a.metadata,
                  lawyerFeedback: {
                    action: "REMOVED",
                    removedReason: reason,
                    otherReason: detail,
                    timestamp: new Date().toISOString(),
                  },
                },
              }
            : a,
        ),
      );

      setIsModalOpen(false);
      setSelectedArticle(null);
    } catch (err) {
      console.error("移除法条失败：", err);
      alert("移除失败，请重试");
    }
  };

  // 关闭弹窗
  const handleCancelModal = () => {
    setIsModalOpen(false);
    setSelectedArticle(null);
  };

  // 分组显示
  const confirmedArticles = articles.filter(
    (a) => a.metadata?.lawyerFeedback?.action === "CONFIRMED",
  );
  const pendingArticles = articles.filter((a) => !a.metadata?.lawyerFeedback);
  const removedArticles = articles.filter(
    (a) => a.metadata?.lawyerFeedback?.action === "REMOVED",
  );

  // 初始加载
  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-zinc-600 dark:text-zinc-400">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-red-900 dark:text-red-300">{error}</p>
        <button
          onClick={fetchArticles}
          className="mt-3 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          重新加载
        </button>
      </div>
    );
  }

  const totalCount = articles.length;
  const confirmedCount = confirmedArticles.length;
  const pendingCount = pendingArticles.length;
  const removedCount = removedArticles.length;

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3 dark:bg-blue-900/20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              法条推荐（共{totalCount}条）
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                {confirmedCount}
              </span>
              已确认
            </span>
            <span className="text-zinc-400">/</span>
            <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                {pendingCount}
              </span>
              待审核
            </span>
            <span className="text-zinc-400">/</span>
            <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
              <Trash2 className="h-4 w-4" />
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                {removedCount}
              </span>
              已移除
            </span>
          </div>
        </div>
      </div>

      {/* 待审核法条 */}
      {pendingArticles.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs dark:bg-amber-900/30">
              待审核
            </span>
            （{pendingArticles.length}条）
          </h3>
          <div className="space-y-3">
            {pendingArticles.map((article) => (
              <LawArticleCard
                key={article.id}
                article={article}
                onConfirm={handleConfirm}
                onRemove={handleRemoveClick}
              />
            ))}
          </div>
        </div>
      )}

      {/* 已确认法条 */}
      {confirmedArticles.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            已确认（{confirmedArticles.length}条）
          </h3>
          <div className="space-y-3">
            {confirmedArticles.map((article) => (
              <LawArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* 已移除法条 */}
      {removedArticles.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            <Trash2 className="h-5 w-5 text-red-600" />
            已移除（{removedArticles.length}条）
          </h3>
          <div className="space-y-3">
            {removedArticles.map((article) => (
              <LawArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* 无法条提示 */}
      {articles.length === 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-700 dark:bg-zinc-800">
          <BookOpen className="mx-auto mb-4 h-12 w-12 text-zinc-400" />
          <h3 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            暂无推荐法条
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            请等待AI分析完成
          </p>
        </div>
      )}

      {/* 移除原因弹窗 */}
      {selectedArticle && (
        <RemoveReasonModal
          isOpen={isModalOpen}
          articleName={selectedArticle.lawName}
          articleNumber={selectedArticle.articleNumber}
          onConfirm={handleRemoveConfirm}
          onCancel={handleCancelModal}
        />
      )}
    </div>
  );
}
